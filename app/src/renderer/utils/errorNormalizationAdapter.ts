/**
 * Error Normalization Adapter
 * 
 * Purpose: Convert various error types into standardized NormalizedError shape
 * Ensures consistent error handling and telemetry codes across the application
 */

import { DEFAULT_ERROR_MAP, type NormalizedError, type ErrorNormalizationMap } from '@shared/errorNormalization';

/**
 * Normalize any throwable into a standardized error shape
 * 
 * @param error - The error to normalize (Error, string, number, unknown)
 * @param customMap - Optional custom error normalization map (defaults to DEFAULT_ERROR_MAP)
 * @returns NormalizedError with code, message, userMessage, retryable, and optional details
 */
export function errorNormalizationAdapter(
  error: unknown,
  customMap: ErrorNormalizationMap = DEFAULT_ERROR_MAP
): NormalizedError {
  // Handle Error instances
  if (error instanceof Error) {
    const errorName = error.name || 'Error';
    const errorMessage = error.message || 'Unknown error';

    // Detect error code from message patterns or error properties
    let code = detectErrorCode(error, errorMessage, customMap);

    const config = customMap[code] || customMap['UNKNOWN_ERROR'];
    if (!config) {
      throw new Error('DEFAULT_ERROR_MAP must include UNKNOWN_ERROR');
    }

    return {
      code,
      message: errorMessage,
      userMessage: config.defaultUserMessage,
      retryable: config.retryable,
      details: {
        originalName: errorName,
        stack: error.stack,
      },
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    const code = detectErrorCodeFromString(error, customMap);
    const config = customMap[code] || customMap['UNKNOWN_ERROR'];
    if (!config) {
      throw new Error('DEFAULT_ERROR_MAP must include UNKNOWN_ERROR');
    }
    return {
      code,
      message: error,
      userMessage: config.defaultUserMessage,
      retryable: config.retryable,
      details: {
        originalType: 'string',
      },
    };
  }

  // Handle number errors (rare but possible)
  if (typeof error === 'number') {
    const config = customMap['UNKNOWN_ERROR'];
    if (!config) {
      throw new Error('DEFAULT_ERROR_MAP must include UNKNOWN_ERROR');
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: `Error code: ${error}`,
      userMessage: config.defaultUserMessage,
      retryable: config.retryable,
      details: {
        originalType: 'number',
        errorCode: error,
      },
    };
  }

  // Handle completely unknown errors
  const config = customMap['UNKNOWN_ERROR'];
  if (!config) {
    throw new Error('DEFAULT_ERROR_MAP must include UNKNOWN_ERROR');
  }
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    userMessage: config.defaultUserMessage,
    retryable: config.retryable,
    details: {
      originalType: typeof error,
      value: String(error),
    },
  };
}

/**
 * Detect error code from Error instance
 * Uses message patterns, error codes, and error names
 */
function detectErrorCode(
  error: Error,
  message: string,
  customMap: ErrorNormalizationMap
): string {
  const lowerMessage = message.toLowerCase();
  
  // Check for error.code property (common in Node.js errors)
  const errorWithCode = error as Error & { code?: string };
  if (errorWithCode.code) {
    const nodeCode = errorWithCode.code;
    // Map Node.js error codes
    if (nodeCode === 'ENOENT') return 'FILE_NOT_FOUND';
    if (nodeCode === 'EACCES' || nodeCode === 'EPERM') return 'PERMISSION_DENIED';
    if (nodeCode === 'ETIMEDOUT' || nodeCode === 'ESOCKETTIMEDOUT') return 'TIMEOUT';
    if (nodeCode === 'ENOTFOUND' || nodeCode === 'ECONNREFUSED') return 'NETWORK_ERROR';
  }

  // Pattern matching on error messages
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) return 'TIMEOUT';
  if (lowerMessage.includes('not found')) return 'FILE_NOT_FOUND';
  if (lowerMessage.includes('permission denied') || lowerMessage.includes('access denied')) return 'PERMISSION_DENIED';
  if (lowerMessage.includes('invalid') || lowerMessage.includes('validation')) return 'VALIDATION_ERROR';
  if (lowerMessage.includes('parse') || lowerMessage.includes('parsing')) return 'PARSE_ERROR';
  if (lowerMessage.includes('schema')) return 'SCHEMA_ERROR';
  if (lowerMessage.includes('credential') || lowerMessage.includes('authentication')) return 'CREDENTIAL_ERROR';
  if (lowerMessage.includes('configuration') || lowerMessage.includes('config')) return 'CONFIG_ERROR';
  if (lowerMessage.includes('provider')) return 'PROVIDER_ERROR';
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) return 'NETWORK_ERROR';
  if (lowerMessage.includes('api')) return 'API_ERROR';
  if (lowerMessage.includes('unavailable') || lowerMessage.includes('service')) return 'SERVICE_UNAVAILABLE';
  if (lowerMessage.includes('session')) return 'SESSION_ERROR';
  if (lowerMessage.includes('not indexed') || lowerMessage.includes('index')) return 'INDEX_ERROR';
  if (lowerMessage.includes('tool not found')) return 'TOOL_NOT_FOUND';
  if (lowerMessage.includes('tool') && lowerMessage.includes('disabled')) return 'TOOL_DISABLED';
  if (lowerMessage.includes('not supported')) return 'OPERATION_NOT_SUPPORTED';
  if (lowerMessage.includes('state') || lowerMessage.includes('lifecycle')) return 'STATE_ERROR';
  if (lowerMessage.includes('outside') && lowerMessage.includes('boundary')) return 'PATH_SECURITY_ERROR';

  // Try to match error name to known code
  const errorName = error.name.toLowerCase();
  for (const [knownCode, _config] of Object.entries(customMap)) {
    if (errorName.includes(knownCode.toLowerCase().replace('_', ''))) {
      return knownCode;
    }
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Detect error code from string error message
 */
function detectErrorCodeFromString(
  message: string,
  customMap: ErrorNormalizationMap
): string {
  const lowerMessage = message.toLowerCase();

  // Pattern matching on string messages
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) return 'TIMEOUT';
  if (lowerMessage.includes('not found')) return 'FILE_NOT_FOUND';
  if (lowerMessage.includes('permission denied') || lowerMessage.includes('access denied')) return 'PERMISSION_DENIED';
  if (lowerMessage.includes('invalid') || lowerMessage.includes('validation')) return 'VALIDATION_ERROR';
  if (lowerMessage.includes('parse') || lowerMessage.includes('parsing')) return 'PARSE_ERROR';
  if (lowerMessage.includes('schema')) return 'SCHEMA_ERROR';
  if (lowerMessage.includes('credential') || lowerMessage.includes('authentication')) return 'CREDENTIAL_ERROR';
  if (lowerMessage.includes('configuration') || lowerMessage.includes('config')) return 'CONFIG_ERROR';
  if (lowerMessage.includes('provider')) return 'PROVIDER_ERROR';
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) return 'NETWORK_ERROR';
  if (lowerMessage.includes('api')) return 'API_ERROR';
  if (lowerMessage.includes('unavailable') || lowerMessage.includes('service')) return 'SERVICE_UNAVAILABLE';
  if (lowerMessage.includes('session')) return 'SESSION_ERROR';
  if (lowerMessage.includes('not indexed') || lowerMessage.includes('index')) return 'INDEX_ERROR';
  if (lowerMessage.includes('tool not found')) return 'TOOL_NOT_FOUND';
  if (lowerMessage.includes('tool') && lowerMessage.includes('disabled')) return 'TOOL_DISABLED';
  if (lowerMessage.includes('not supported')) return 'OPERATION_NOT_SUPPORTED';
  if (lowerMessage.includes('state') || lowerMessage.includes('lifecycle')) return 'STATE_ERROR';
  if (lowerMessage.includes('outside') && lowerMessage.includes('boundary')) return 'PATH_SECURITY_ERROR';

  return 'UNKNOWN_ERROR';
}

/**
 * Extract error code from normalized error for telemetry
 * 
 * @param normalized - The normalized error
 * @returns The error code string
 */
export function extractErrorCode(normalized: NormalizedError): string {
  return normalized.code;
}

/**
 * Check if an error is retryable
 * 
 * @param normalized - The normalized error
 * @returns True if the error can be retried
 */
export function isRetryable(normalized: NormalizedError): boolean {
  return normalized.retryable;
}
