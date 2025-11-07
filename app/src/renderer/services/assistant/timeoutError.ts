/**
 * timeoutError.ts
 * Structured timeout error construction per FR-041.
 */
export interface ToolTimeoutError {
  type: 'timeout';
  toolId: string;
  timeoutMs: number;
  elapsedMs: number;
  suggestion: string;
  retryGuidance: string[];
}

export function createTimeoutError(toolId: string, timeoutMs: number, elapsedMs: number): ToolTimeoutError {
  return {
    type: 'timeout',
    toolId,
    timeoutMs,
    elapsedMs,
    suggestion: 'Consider reducing scope or splitting the request',
    retryGuidance: [
      'Verify sidecar health',
      'Reduce number of files or context size',
      'Try again with narrower parameters'
    ]
  };
}
