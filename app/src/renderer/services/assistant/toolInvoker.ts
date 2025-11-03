// T053: Tool Invocation Abstraction
// Provides unified interface for executing tools through sidecar with retry logic and error handling.

// Correct import: assistantBridge types live in preload; path alias mapping uses root-relative via @/../preload
import type { ExecuteToolPayload, ToolExecutionResponse } from '@/../preload/assistantBridge';

export interface ToolInvocationOptions extends ExecuteToolPayload {
  retryCount?: number;
  retryDelayMs?: number;
  timeout?: number;
}

export interface ToolInvocationResult {
  success: boolean;
  result?: ToolExecutionResponse;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    attemptsMade: number;
  };
  duration: number;
}

const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Execute a tool with automatic retry logic for transient failures.
 * T057: Implements partial retry for network/timeout errors.
 */
export async function invokeTool(
  sessionId: string,
  options: ToolInvocationOptions
): Promise<ToolInvocationResult> {
  const startTime = Date.now();
  const maxRetries = options.retryCount ?? DEFAULT_RETRY_COUNT;
  const retryDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

  let lastError: Error | null = null;
  let attemptsMade = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptsMade = attempt + 1;

    try {
      const result = await executeWithTimeout(sessionId, options, timeout);
      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        duration
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Check if error is retryable
      const isRetryable = isRetryableError(lastError);
      
      if (!isRetryable || attempt === maxRetries) {
        // Don't retry if non-retryable or out of attempts
        break;
      }

      // Wait before retry with exponential backoff
      const backoffDelay = retryDelay * Math.pow(2, attempt);
      const toolRef = 'toolId' in options ? (options as ExecuteToolPayload).toolId : 'unknown-tool';
      console.warn(`[toolInvoker] Tool ${toolRef} failed (attempt ${attemptsMade}/${maxRetries + 1}), retrying in ${backoffDelay}ms...`, lastError);
      await sleep(backoffDelay);
    }
  }

  // All retries exhausted or non-retryable error
  const duration = Date.now() - startTime;
  const errorCode = classifyError(lastError!);

  return {
    success: false,
    error: {
      code: errorCode,
      message: lastError!.message,
      retryable: isRetryableError(lastError!),
      attemptsMade
    },
    duration
  };
}

/**
 * Execute tool with timeout protection.
 */
async function executeWithTimeout(
  sessionId: string,
  options: ExecuteToolPayload,
  timeoutMs: number
): Promise<ToolExecutionResponse> {
  const bridge = window.api?.assistant;
  if (!bridge) {
    throw new Error('Assistant bridge not available');
  }

  return Promise.race([
    bridge.executeTool(sessionId, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Determine if an error is retryable (transient failure).
 * T057: Retry logic classification.
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network/timeout errors are retryable
  if (message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('503') ||
      message.includes('502')) {
    return true;
  }

  // Validation/permission errors are not retryable
  if (message.includes('validation') ||
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('400') ||
      message.includes('401') ||
      message.includes('403')) {
    return false;
  }

  // Default: assume retryable for unknown errors
  return true;
}

/**
 * Classify error into standard error codes.
 * T055: Error classification utility.
 */
function classifyError(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('timeout')) return 'TIMEOUT';
  if (message.includes('network') || message.includes('econnrefused')) return 'NETWORK_ERROR';
  if (message.includes('unauthorized') || message.includes('401')) return 'UNAUTHORIZED';
  if (message.includes('forbidden') || message.includes('403')) return 'FORBIDDEN';
  if (message.includes('not found') || message.includes('404')) return 'NOT_FOUND';
  if (message.includes('validation')) return 'VALIDATION_ERROR';
  if (message.includes('capability')) return 'CAPABILITY_MISMATCH';
  if (message.includes('unavailable') || message.includes('503')) return 'SERVICE_UNAVAILABLE';

  return 'UNKNOWN_ERROR';
}

/**
 * Sleep utility for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Batch tool invocation with concurrency control.
 * Useful for running multiple tools in parallel with a limit.
 */
export async function invokeToolsBatch(
  sessionId: string,
  tools: ToolInvocationOptions[],
  concurrency = 3
): Promise<ToolInvocationResult[]> {
  const results: ToolInvocationResult[] = [];
  const queue = [...tools];
  const inFlight: Promise<void>[] = [];

  while (queue.length > 0 || inFlight.length > 0) {
    // Start new tasks up to concurrency limit
    while (inFlight.length < concurrency && queue.length > 0) {
      const tool = queue.shift()!;
      const promise = invokeTool(sessionId, tool).then(result => {
        results.push(result);
        const idx = inFlight.indexOf(promise);
        if (idx > -1) inFlight.splice(idx, 1);
      }).catch(() => {
        // Error already logged in invokeTool
      });
      void inFlight.push(promise);
    }

    // Wait for at least one to complete
    if (inFlight.length > 0) {
      await Promise.race(inFlight);
    }
  }

  return results;
}
