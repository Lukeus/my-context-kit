import type { IpcMainInvokeEvent } from 'electron';
import { AppError } from '../errors/AppError';

/**
 * Standard IPC result format
 */
export interface IPCResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
}

/**
 * Converts unknown error to user-friendly message
 */
export function toErrorMessage(error: unknown, fallback = 'Unknown error'): string {
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
  // Handle our custom app errors
  if (error instanceof AppError) {
    return {
      ok: false,
      error: {
        message: error.userMessage,
        code: error.code,
        details: error.details
      }
    };
  }

  // Handle standard errors
  if (error instanceof Error) {
    console.error('Unexpected error:', error);
    return {
      ok: false,
      error: {
        message: 'An unexpected error occurred.',
        code: 'UNKNOWN_ERROR',
        details: process.env.NODE_ENV === 'development'
          ? { message: error.message, stack: error.stack }
          : undefined
      }
    };
  }

  // Handle unknown error types
  console.error('Unknown error type:', error);
  return {
    ok: false,
    error: {
      message: 'An unknown error occurred.',
      code: 'UNKNOWN_ERROR'
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
