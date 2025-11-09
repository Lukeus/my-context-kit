/**
 * Error Normalization Types
 * Purpose: Standardize error handling and telemetry codes
 */

import { z } from 'zod';

/**
 * Normalized error shape for consistent error handling
 */
export const NormalizedErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  userMessage: z.string(),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type NormalizedError = z.infer<typeof NormalizedErrorSchema>;

/**
 * Error code to normalization config mapping
 */
export const ErrorNormalizationMapSchema = z.record(
  z.string(),
  z.object({
    defaultUserMessage: z.string(),
    retryable: z.boolean(),
  })
);

export type ErrorNormalizationMap = z.infer<typeof ErrorNormalizationMapSchema>;

/**
 * Default error normalization map
 */
export const DEFAULT_ERROR_MAP: ErrorNormalizationMap = {
  // Validation & Data
  VALIDATION_ERROR: {
    defaultUserMessage: 'The data provided is invalid. Please check your input and try again.',
    retryable: false,
  },
  PARSE_ERROR: {
    defaultUserMessage: 'Failed to parse the data. The format may be incorrect.',
    retryable: false,
  },
  SCHEMA_ERROR: {
    defaultUserMessage: 'The data structure is invalid. Please check the format.',
    retryable: false,
  },
  
  // Network & Timing
  TIMEOUT: {
    defaultUserMessage: 'The operation timed out. Please try again.',
    retryable: true,
  },
  NETWORK_ERROR: {
    defaultUserMessage: 'Network connection failed. Please check your connection and try again.',
    retryable: true,
  },
  API_ERROR: {
    defaultUserMessage: 'External service request failed. Please try again later.',
    retryable: true,
  },
  SERVICE_UNAVAILABLE: {
    defaultUserMessage: 'The service is temporarily unavailable. Please try again later.',
    retryable: true,
  },
  
  // Configuration & Authentication
  CREDENTIAL_ERROR: {
    defaultUserMessage: 'Authentication failed. Please check your credentials in settings.',
    retryable: false,
  },
  CONFIG_ERROR: {
    defaultUserMessage: 'Configuration is missing or invalid. Please check settings.',
    retryable: false,
  },
  PROVIDER_ERROR: {
    defaultUserMessage: 'The selected provider is not configured or unavailable.',
    retryable: false,
  },
  
  // File System & Resources
  FILE_NOT_FOUND: {
    defaultUserMessage: 'The requested file was not found.',
    retryable: false,
  },
  PERMISSION_DENIED: {
    defaultUserMessage: 'Permission denied. You do not have access to this resource.',
    retryable: false,
  },
  PATH_SECURITY_ERROR: {
    defaultUserMessage: 'The file path is outside allowed boundaries.',
    retryable: false,
  },
  
  // State & Lifecycle
  STATE_ERROR: {
    defaultUserMessage: 'The operation cannot be performed in the current state.',
    retryable: false,
  },
  SESSION_ERROR: {
    defaultUserMessage: 'No active session. Please create a session first.',
    retryable: false,
  },
  INDEX_ERROR: {
    defaultUserMessage: 'The repository is not indexed. Please index it first.',
    retryable: false,
  },
  
  // Tools & Operations
  TOOL_NOT_FOUND: {
    defaultUserMessage: 'The requested tool was not found.',
    retryable: false,
  },
  TOOL_DISABLED: {
    defaultUserMessage: 'The tool is not enabled for this provider.',
    retryable: false,
  },
  OPERATION_NOT_SUPPORTED: {
    defaultUserMessage: 'This operation is not supported in the current context.',
    retryable: false,
  },
  
  // Design System
  DESIGN_TOKEN_VIOLATION: {
    defaultUserMessage: 'Design token validation failed. Please check the component styling.',
    retryable: false,
  },
  
  // Fallback
  UNKNOWN_ERROR: {
    defaultUserMessage: 'An unexpected error occurred. Please try again or contact support.',
    retryable: true,
  },
};
