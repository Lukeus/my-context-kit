/**
 * Standard IPC response format for all handlers
 * 
 * All IPC handlers should return responses in this format to ensure
 * consistency across the application.
 */

/**
 * Success response with data
 */
export interface IPCSuccessResponse<T = unknown> {
  ok: true;
  data?: T;
  [key: string]: unknown; // Allow additional fields for backward compatibility
}

/**
 * Error response
 */
export interface IPCErrorResponse {
  ok: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Union type for all IPC responses
 */
export type IPCResponse<T = unknown> = IPCSuccessResponse<T> | IPCErrorResponse;

/**
 * Helper to create a success response
 */
export function success<T = unknown>(data?: T): IPCSuccessResponse<T> {
  return {
    ok: true,
    ...(data !== undefined && { data }),
  };
}

/**
 * Helper to create a success response with custom fields (backward compatibility)
 */
export function successWith<T extends object>(fields: T): IPCSuccessResponse & T {
  return {
    ok: true,
    ...fields,
  } as IPCSuccessResponse & T;
}

/**
 * Helper to create an error response
 */
export function error(message: string, code?: string, details?: unknown): IPCErrorResponse {
  const response: IPCErrorResponse = {
    ok: false,
    error: message,
  };
  if (code) response.code = code;
  if (details !== undefined) response.details = details;
  return response;
}

/**
 * Type guard to check if response is successful
 */
export function isSuccess<T>(response: IPCResponse<T>): response is IPCSuccessResponse<T> {
  return response.ok === true;
}

/**
 * Type guard to check if response is an error
 */
export function isError(response: IPCResponse): response is IPCErrorResponse {
  return response.ok === false;
}
