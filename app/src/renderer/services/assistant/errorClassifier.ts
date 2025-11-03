// T055: Error Classification Utility
// Classifies tool execution errors into categories for appropriate handling and user feedback.

export type ErrorCategory = 
  | 'network'
  | 'timeout'
  | 'validation'
  | 'permission'
  | 'capability'
  | 'service-unavailable'
  | 'not-found'
  | 'unknown';

export interface ClassifiedError {
  category: ErrorCategory;
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  suggestedAction?: string;
}

/**
 * Classify an error into a category with user-friendly messaging.
 */
export function classifyError(error: unknown): ClassifiedError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Network errors
  if (lowerMessage.includes('network') || 
      lowerMessage.includes('econnrefused') || 
      lowerMessage.includes('enotfound') ||
      lowerMessage.includes('fetch failed')) {
    return {
      category: 'network',
      code: 'NETWORK_ERROR',
      message: errorMessage,
      userMessage: 'Network connection failed. Please check your internet connection.',
      retryable: true,
      suggestedAction: 'Retry the operation or check network settings.'
    };
  }

  // Timeout errors
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return {
      category: 'timeout',
      code: 'TIMEOUT',
      message: errorMessage,
      userMessage: 'The operation took too long to complete.',
      retryable: true,
      suggestedAction: 'Try again or increase timeout settings.'
    };
  }

  // Validation errors
  if (lowerMessage.includes('validation') || 
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('400')) {
    return {
      category: 'validation',
      code: 'VALIDATION_ERROR',
      message: errorMessage,
      userMessage: 'Invalid input or parameters provided.',
      retryable: false,
      suggestedAction: 'Check your input and try again.'
    };
  }

  // Permission errors
  if (lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('permission') ||
      lowerMessage.includes('401') ||
      lowerMessage.includes('403')) {
    return {
      category: 'permission',
      code: 'PERMISSION_DENIED',
      message: errorMessage,
      userMessage: 'You don\'t have permission to perform this operation.',
      retryable: false,
      suggestedAction: 'Check your credentials or contact an administrator.'
    };
  }

  // Capability mismatch
  if (lowerMessage.includes('capability') || 
      lowerMessage.includes('not supported') ||
      lowerMessage.includes('feature not available')) {
    return {
      category: 'capability',
      code: 'CAPABILITY_MISMATCH',
      message: errorMessage,
      userMessage: 'This feature is not available in the current configuration.',
      retryable: false,
      suggestedAction: 'Check capability manifest or update service configuration.'
    };
  }

  // Service unavailable
  if (lowerMessage.includes('unavailable') ||
      lowerMessage.includes('503') ||
      lowerMessage.includes('502') ||
      lowerMessage.includes('service') ||
      lowerMessage.includes('degraded')) {
    return {
      category: 'service-unavailable',
      code: 'SERVICE_UNAVAILABLE',
      message: errorMessage,
      userMessage: 'The service is temporarily unavailable.',
      retryable: true,
      suggestedAction: 'Wait a moment and try again.'
    };
  }

  // Not found
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return {
      category: 'not-found',
      code: 'NOT_FOUND',
      message: errorMessage,
      userMessage: 'The requested resource was not found.',
      retryable: false,
      suggestedAction: 'Check the resource path or identifier.'
    };
  }

  // Unknown error
  return {
    category: 'unknown',
    code: 'UNKNOWN_ERROR',
    message: errorMessage,
    userMessage: 'An unexpected error occurred.',
    retryable: true,
    suggestedAction: 'Try again or contact support if the issue persists.'
  };
}

/**
 * Format error for display in UI components.
 */
export function formatErrorForDisplay(error: ClassifiedError): string {
  let message = `**${error.userMessage}**`;
  
  if (error.suggestedAction) {
    message += `\n\n*${error.suggestedAction}*`;
  }

  if (error.retryable) {
    message += '\n\n🔄 This operation can be retried.';
  }

  return message;
}

/**
 * Determine if error should trigger a fallback mode.
 */
export function shouldTriggerFallback(error: ClassifiedError): boolean {
  return error.category === 'service-unavailable' || 
         error.category === 'capability';
}

/**
 * Get severity level for error (for UI styling).
 */
export function getErrorSeverity(error: ClassifiedError): 'error' | 'warning' | 'info' {
  if (error.category === 'permission' || error.category === 'validation') {
    return 'error';
  }
  if (error.category === 'capability' || error.category === 'not-found') {
    return 'warning';
  }
  return 'info';
}
