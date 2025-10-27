/**
 * Shared error handling utilities for pipelines
 * Provides consistent error codes, messages, and exit handling
 */

/**
 * Standard error codes for pipelines
 */
export const ErrorCodes = {
  // File/IO errors (10-19)
  FILE_NOT_FOUND: 10,
  FILE_READ_ERROR: 11,
  FILE_WRITE_ERROR: 12,
  DIRECTORY_NOT_FOUND: 13,
  
  // Parsing errors (20-29)
  YAML_PARSE_ERROR: 20,
  JSON_PARSE_ERROR: 21,
  INVALID_FORMAT: 22,
  
  // Validation errors (30-39)
  VALIDATION_ERROR: 30,
  SCHEMA_VALIDATION_ERROR: 31,
  MISSING_REQUIRED_FIELD: 32,
  INVALID_FIELD_VALUE: 33,
  
  // Entity errors (40-49)
  ENTITY_NOT_FOUND: 40,
  DUPLICATE_ENTITY: 41,
  INVALID_ENTITY_TYPE: 42,
  
  // Pipeline errors (50-59)
  PIPELINE_ERROR: 50,
  EXECUTION_ERROR: 51,
  TIMEOUT_ERROR: 52,
  
  // External service errors (60-69)
  AI_SERVICE_ERROR: 60,
  NETWORK_ERROR: 61,
  API_ERROR: 62,
  
  // Unknown errors (99)
  UNKNOWN_ERROR: 99
};

/**
 * Pipeline error class with structured information
 */
export class PipelineError extends Error {
  constructor(message, code = ErrorCodes.UNKNOWN_ERROR, details = {}) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      ...(process.env.DEBUG && { stack: this.stack })
    };
  }
}

/**
 * Exit pipeline with error
 * @param {string|Error} error - Error message or Error object
 * @param {number} code - Exit code (defaults to ErrorCodes.UNKNOWN_ERROR)
 * @param {object} details - Additional error details
 */
export function exitWithError(error, code, details = {}) {
  const errorObj = error instanceof PipelineError
    ? error
    : error instanceof Error
    ? new PipelineError(error.message, code || ErrorCodes.UNKNOWN_ERROR, { ...details, originalError: error.name })
    : new PipelineError(String(error), code || ErrorCodes.UNKNOWN_ERROR, details);

  console.error(JSON.stringify(errorObj.toJSON(), null, 2));
  process.exit(1);
}

/**
 * Wrap async pipeline function with error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function that handles errors
 */
export function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof PipelineError) {
        exitWithError(error);
      } else {
        exitWithError(error, ErrorCodes.EXECUTION_ERROR, {
          function: fn.name || 'anonymous',
          args: args.length
        });
      }
    }
  };
}

/**
 * Assert condition or throw PipelineError
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message if condition is false
 * @param {number} code - Error code
 * @param {object} details - Additional details
 */
export function assert(condition, message, code = ErrorCodes.VALIDATION_ERROR, details = {}) {
  if (!condition) {
    throw new PipelineError(message, code, details);
  }
}

/**
 * Validate required fields in an object
 * @param {object} obj - Object to validate
 * @param {string[]} fields - Required field names
 * @param {string} entityType - Entity type for error message
 * @throws {PipelineError} If any required field is missing
 */
export function validateRequiredFields(obj, fields, entityType = 'entity') {
  const missing = fields.filter(field => !obj || obj[field] === undefined || obj[field] === null);
  
  if (missing.length > 0) {
    throw new PipelineError(
      `Missing required fields in ${entityType}: ${missing.join(', ')}`,
      ErrorCodes.MISSING_REQUIRED_FIELD,
      { missing, entityType, receivedFields: obj ? Object.keys(obj) : [] }
    );
  }
}

/**
 * Create a safe error message (strips sensitive info)
 * @param {Error} error - Error object
 * @param {boolean} includeStack - Include stack trace
 * @returns {string} Safe error message
 */
export function getSafeErrorMessage(error, includeStack = false) {
  if (!error) return 'Unknown error';
  
  let message = error.message || String(error);
  
  // Strip potential sensitive information
  message = message.replace(/api[_-]?key[=:]\s*[\w-]+/gi, 'api_key=[REDACTED]');
  message = message.replace(/token[=:]\s*[\w-]+/gi, 'token=[REDACTED]');
  message = message.replace(/password[=:]\s*[\w-]+/gi, 'password=[REDACTED]');
  
  if (includeStack && error.stack) {
    return `${message}\n${error.stack}`;
  }
  
  return message;
}

/**
 * Handle multiple errors and return summary
 * @param {Error[]} errors - Array of errors
 * @returns {object} Error summary
 */
export function summarizeErrors(errors) {
  const summary = {
    total: errors.length,
    byCode: {},
    messages: []
  };

  for (const error of errors) {
    const code = error.code || ErrorCodes.UNKNOWN_ERROR;
    summary.byCode[code] = (summary.byCode[code] || 0) + 1;
    summary.messages.push(getSafeErrorMessage(error));
  }

  return summary;
}
