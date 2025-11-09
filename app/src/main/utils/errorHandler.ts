import type { IpcMainInvokeEvent } from 'electron';
import { AppError } from '../errors/AppError';
import { DEFAULT_ERROR_MAP, type NormalizedError } from '@shared/errorNormalization';

/**
 * Standard IPC result format
 */
export interface IPCResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    userMessage?: string;
    retryable?: boolean;
    details?: unknown;
  };
}

/**
 * Converts unknown error to user-friendly message
 */
export function toErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  /**
   * Normalize error in main process using shared error normalization logic
   * T055: Main process error normalization
   */


  /**
   * Detect error code from Error instance
   */
  function detectErrorCode(error: Error, message: string): string {
    const lowerMessage = message.toLowerCase();
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code) {
      if (errorWithCode.code === 'ENOENT') return 'FILE_NOT_FOUND';
      if (errorWithCode.code === 'EACCES' || errorWithCode.code === 'EPERM') return 'PERMISSION_DENIED';
      if (errorWithCode.code === 'ETIMEDOUT' || errorWithCode.code === 'ESOCKETTIMEDOUT') return 'TIMEOUT';
      if (errorWithCode.code === 'ENOTFOUND' || errorWithCode.code === 'ECONNREFUSED') return 'NETWORK_ERROR';
    }
    if (lowerMessage.includes('timeout')) return 'TIMEOUT';
    if (lowerMessage.includes('not found')) return 'FILE_NOT_FOUND';
    if (lowerMessage.includes('permission denied')) return 'PERMISSION_DENIED';
    if (lowerMessage.includes('validation')) return 'VALIDATION_ERROR';
    if (lowerMessage.includes('parse')) return 'PARSE_ERROR';
    if (lowerMessage.includes('schema')) return 'SCHEMA_ERROR';
    if (lowerMessage.includes('credential')) return 'CREDENTIAL_ERROR';
    if (lowerMessage.includes('config')) return 'CONFIG_ERROR';
    if (lowerMessage.includes('provider')) return 'PROVIDER_ERROR';
    if (lowerMessage.includes('network')) return 'NETWORK_ERROR';
    if (lowerMessage.includes('api')) return 'API_ERROR';
    if (lowerMessage.includes('unavailable')) return 'SERVICE_UNAVAILABLE';
    if (lowerMessage.includes('session')) return 'SESSION_ERROR';
    if (lowerMessage.includes('index')) return 'INDEX_ERROR';
    if (lowerMessage.includes('tool not found')) return 'TOOL_NOT_FOUND';
    if (lowerMessage.includes('tool') && lowerMessage.includes('disabled')) return 'TOOL_DISABLED';
    if (lowerMessage.includes('not supported')) return 'OPERATION_NOT_SUPPORTED';
    if (lowerMessage.includes('state')) return 'STATE_ERROR';
    if (lowerMessage.includes('boundary')) return 'PATH_SECURITY_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Detect error code from string
   */
  function detectErrorCodeFromString(message: string): string {
    return detectErrorCode(new Error(message), message);
  }

  /**
   * Converts unknown error to user-friendly message
   */
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  return fallback;
}

/**
 * Handles error and returns standardized IPC result
 */
export function handleError(error: unknown): IPCResult {
  // T055: Use error normalization
  const normalized = (function normalizeMainProcessErrorWrapper(e: unknown){
    return normalizeMainProcessError(e);
  })(error);

  // Handle our custom app errors
  if (error instanceof AppError) {
    return {
      ok: false,
      error: {
        message: normalized.message,
        code: normalized.code,
        userMessage: normalized.userMessage,
        retryable: normalized.retryable,
        details: error.details
      }
    };
  }

  // Handle all other errors with normalization
  console.error('Error:', normalized.code, normalized.message);
  return {
    ok: false,
    error: {
      message: normalized.message,
      code: normalized.code,
      userMessage: normalized.userMessage,
      retryable: normalized.retryable,
      details: normalized.details
    }
  };
}

/**
 * Wraps an IPC handler with standardized error handling
 * 
 * @example
 * ipcMain.handle('context:validate', withErrorHandling(async (_event, { dir }) => {
 *   const service = new ContextService(dir);
 *   return await service.validate();
 * }));
 */
export function withErrorHandling<TArgs extends any[], TResult>(
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult>
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<IPCResult<TResult>> {
  return async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<IPCResult<TResult>> => {
    try {
      const result = await handler(event, ...args);
      return { ok: true, data: result };
    } catch (error) {
      return handleError(error) as IPCResult<TResult>;
    }
  };
}

/**
 * Parses pipeline error output (from execa errors)
 */
export function parsePipelineError(error: unknown, fallbackMessage: string): IPCResult {
  const execError = error as { stdout?: string; stderr?: string; message?: string };
  
  // Try to parse JSON from stdout (pipelines output JSON)
  if (execError.stdout) {
    try {
      return JSON.parse(execError.stdout);
    } catch {
      // Fall through to fallback handling
    }
  }

  // Use error message or fallback
  const message = typeof execError.message === 'string' ? execError.message : fallbackMessage;
  return { ok: false, error: { message, code: 'PIPELINE_ERROR' } };
}
