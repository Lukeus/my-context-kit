/**
 * Context Kit Error Handling Composable
 * 
 * Provides user-friendly error messages and recovery suggestions
 * for Context Kit operations.
 */


export interface ErrorInfo {
  title: string;
  message: string;
  suggestion?: string;
  recoveryAction?: () => void;
  recoveryLabel?: string;
  severity: 'error' | 'warning' | 'info';
}

export function useContextKitErrors() {
  /**
   * Parse an error and return user-friendly information
   */
  function parseError(error: string | Error | unknown): ErrorInfo {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Service not running
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed') || errorMessage.includes('No handler registered')) {
      return {
        title: 'Service Not Running',
        message: 'The Context Kit service is not running or not responding.',
        suggestion: 'Try starting the service from the Context Kit Hub.',
        severity: 'error',
      };
    }
    
    // API key missing
    if (errorMessage.includes('API key') || errorMessage.includes('OPENAI_API_KEY') || errorMessage.includes('AZURE_OPENAI')) {
      return {
        title: 'API Key Not Configured',
        message: 'Azure OpenAI API key is not configured.',
        suggestion: 'Configure your API key in AI Settings or add AZURE_OPENAI_ENDPOINT to the service .env file.',
        severity: 'error',
      };
    }
    
    // Repository not found
    if (errorMessage.includes('Repository not found') || errorMessage.includes('No .context directory')) {
      return {
        title: 'Repository Not Found',
        message: 'The context repository could not be located.',
        suggestion: 'Make sure you have selected a valid context repository.',
        severity: 'error',
      };
    }
    
    // Network/timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        title: 'Request Timeout',
        message: 'The operation took too long to complete.',
        suggestion: 'Try again or check your network connection and Azure OpenAI service status.',
        severity: 'warning',
      };
    }
    
    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return {
        title: 'Rate Limit Exceeded',
        message: 'Too many requests to the AI service.',
        suggestion: 'Wait a moment and try again. Azure OpenAI has rate limits per minute.',
        severity: 'warning',
      };
    }
    
    // Model/deployment errors
    if (errorMessage.includes('deployment') || errorMessage.includes('model not found')) {
      return {
        title: 'Model Configuration Error',
        message: 'The specified AI model or deployment could not be found.',
        suggestion: 'Check that your model/deployment name matches your Azure OpenAI configuration.',
        severity: 'error',
      };
    }
    
    // Invalid input
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return {
        title: 'Invalid Input',
        message: errorMessage,
        suggestion: 'Check your input and try again.',
        severity: 'warning',
      };
    }
    
    // Generic Python service errors
    if (errorMessage.includes('500') || errorMessage.includes('Internal server error')) {
      return {
        title: 'Service Error',
        message: 'The Context Kit service encountered an internal error.',
        suggestion: 'Check the service logs for details. You may need to restart the service.',
        severity: 'error',
      };
    }
    
    // Generic error
    return {
      title: 'Operation Failed',
      message: errorMessage,
      suggestion: 'If this persists, try restarting the service or check the logs.',
      severity: 'error',
    };
  }

  /**
   * Get icon for error severity
   */
  function getSeverityIcon(severity: ErrorInfo['severity']): string {
    switch (severity) {
      case 'error':
        return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'warning':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
      case 'info':
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  /**
   * Get color classes for error severity
   */
  function getSeverityColors(severity: ErrorInfo['severity']): {
    bg: string;
    border: string;
    text: string;
    icon: string;
  } {
    switch (severity) {
      case 'error':
        return {
          bg: 'bg-error-50',
          border: 'border-error-200',
          text: 'text-error-800',
          icon: 'text-error-600',
        };
      case 'warning':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          icon: 'text-orange-600',
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600',
        };
    }
  }

  return {
    parseError,
    getSeverityIcon,
    getSeverityColors,
  };
}
