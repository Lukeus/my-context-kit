// Tool Invocation Status Types (T019)
// -----------------------------------------------------------------------------
// Provides granular status tracking for tool invocations with discriminated unions.
// Supports UI visualization, telemetry, and error handling workflows.
// TODO(T019-UI): Wire status types into ToolResult.vue component.
// TODO(T019-Retry): Integrate with retry logic for failed invocations.

import type { AssistantProvider } from './types';

export type ToolInvocationPhase =
  | 'queued'         // Waiting in queue manager
  | 'validating'     // Parameter validation in progress
  | 'executing'      // Tool execution in progress
  | 'streaming'      // Streaming response chunks
  | 'approval-pending' // Awaiting user approval
  | 'completing'     // Finalizing execution
  | 'succeeded'      // Successfully completed
  | 'failed'         // Execution failed
  | 'aborted'        // Cancelled by user or system
  | 'timeout';       // Exceeded timeout threshold

export type ToolInvocationErrorType =
  | 'validation'     // Invalid parameters
  | 'capability'     // Capability not available
  | 'permission'     // Insufficient permissions
  | 'network'        // Network/connection error
  | 'timeout'        // Execution timeout
  | 'provider'       // Provider-specific error
  | 'internal'       // Internal system error
  | 'user-abort';    // User cancelled operation

export interface ToolInvocationTimestamps {
  queued: string;
  started?: string;
  firstChunk?: string;
  approvalRequested?: string;
  approvalResolved?: string;
  completed?: string;
}

export interface ToolInvocationMetrics {
  durationMs?: number;
  queueWaitMs?: number;
  executionMs?: number;
  approvalWaitMs?: number;
  retryCount?: number;
  chunkCount?: number;
  bytesProcessed?: number;
}

export interface ToolInvocationError {
  type: ToolInvocationErrorType;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  stack?: string;
  retryable: boolean;
}

/**
 * Base tool invocation record.
 */
export interface ToolInvocationBase {
  id: string;
  sessionId: string;
  toolId: string;
  provider: AssistantProvider;
  parameters: Record<string, unknown>;
  timestamps: ToolInvocationTimestamps;
  metrics: ToolInvocationMetrics;
  metadata?: Record<string, unknown>;
}

/**
 * Queued invocation (awaiting execution).
 */
export interface ToolInvocationQueued extends ToolInvocationBase {
  phase: 'queued';
  queuePosition?: number;
}

/**
 * Validating parameters.
 */
export interface ToolInvocationValidating extends ToolInvocationBase {
  phase: 'validating';
}

/**
 * Executing tool.
 */
export interface ToolInvocationExecuting extends ToolInvocationBase {
  phase: 'executing';
  progress?: number; // 0-100
  statusMessage?: string;
}

/**
 * Streaming response.
 */
export interface ToolInvocationStreaming extends ToolInvocationBase {
  phase: 'streaming';
  chunks: unknown[];
  progress?: number;
}

/**
 * Awaiting approval.
 */
export interface ToolInvocationApprovalPending extends ToolInvocationBase {
  phase: 'approval-pending';
  approvalId: string;
  approvalReason: string;
}

/**
 * Completing execution.
 */
export interface ToolInvocationCompleting extends ToolInvocationBase {
  phase: 'completing';
  result?: unknown;
}

/**
 * Successfully completed.
 */
export interface ToolInvocationSucceeded extends ToolInvocationBase {
  phase: 'succeeded';
  result: unknown;
  summary?: string;
}

/**
 * Execution failed.
 */
export interface ToolInvocationFailed extends ToolInvocationBase {
  phase: 'failed';
  error: ToolInvocationError;
  partialResult?: unknown;
}

/**
 * User or system aborted.
 */
export interface ToolInvocationAborted extends ToolInvocationBase {
  phase: 'aborted';
  reason: string;
  abortedBy: 'user' | 'system';
}

/**
 * Execution timeout.
 */
export interface ToolInvocationTimeout extends ToolInvocationBase {
  phase: 'timeout';
  timeoutMs: number;
  partialResult?: unknown;
}

/**
 * Discriminated union of all tool invocation states.
 */
export type ToolInvocation =
  | ToolInvocationQueued
  | ToolInvocationValidating
  | ToolInvocationExecuting
  | ToolInvocationStreaming
  | ToolInvocationApprovalPending
  | ToolInvocationCompleting
  | ToolInvocationSucceeded
  | ToolInvocationFailed
  | ToolInvocationAborted
  | ToolInvocationTimeout;

/**
 * Type guards for discriminated union.
 */
export function isToolQueued(inv: ToolInvocation): inv is ToolInvocationQueued {
  return inv.phase === 'queued';
}

export function isToolExecuting(inv: ToolInvocation): inv is ToolInvocationExecuting {
  return inv.phase === 'executing';
}

export function isToolStreaming(inv: ToolInvocation): inv is ToolInvocationStreaming {
  return inv.phase === 'streaming';
}

export function isToolAwaitingApproval(inv: ToolInvocation): inv is ToolInvocationApprovalPending {
  return inv.phase === 'approval-pending';
}

export function isToolCompleted(inv: ToolInvocation): boolean {
  return inv.phase === 'succeeded' || inv.phase === 'failed' || inv.phase === 'aborted' || inv.phase === 'timeout';
}

export function isToolSuccessful(inv: ToolInvocation): inv is ToolInvocationSucceeded {
  return inv.phase === 'succeeded';
}

export function isToolFailed(inv: ToolInvocation): inv is ToolInvocationFailed {
  return inv.phase === 'failed';
}

/**
 * Create initial tool invocation record.
 */
export function createToolInvocation(
  sessionId: string,
  toolId: string,
  provider: AssistantProvider,
  parameters: Record<string, unknown>,
  metadata?: Record<string, unknown>
): ToolInvocationQueued {
  const now = new Date().toISOString();
  return {
    id: `inv-${crypto.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*10000)}`}`,
    sessionId,
    toolId,
    provider,
    parameters,
    phase: 'queued',
    timestamps: { queued: now },
    metrics: { retryCount: 0, chunkCount: 0 },
    metadata
  };
}

/**
 * Transition invocation to new phase.
 */
export function transitionInvocation<T extends ToolInvocation>(
  current: ToolInvocation,
  phase: ToolInvocationPhase,
  updates: Partial<Omit<T, keyof ToolInvocationBase | 'phase'>>
): T {
  const now = new Date().toISOString();
  const timestamps = { ...current.timestamps };
  
  // Update timestamps based on phase
  switch (phase) {
    case 'executing':
      timestamps.started = now;
      break;
    case 'streaming':
      if (!timestamps.firstChunk) timestamps.firstChunk = now;
      break;
    case 'approval-pending':
      timestamps.approvalRequested = now;
      break;
    case 'completing':
    case 'succeeded':
    case 'failed':
    case 'aborted':
    case 'timeout':
      timestamps.completed = now;
      if (timestamps.approvalRequested && !timestamps.approvalResolved) {
        timestamps.approvalResolved = now;
      }
      break;
  }
  
  // Calculate metrics
  const metrics = { ...current.metrics };
  if (timestamps.started && timestamps.queued) {
    metrics.queueWaitMs = new Date(timestamps.started).getTime() - new Date(timestamps.queued).getTime();
  }
  if (timestamps.completed && timestamps.started) {
    metrics.executionMs = new Date(timestamps.completed).getTime() - new Date(timestamps.started).getTime();
  }
  if (timestamps.completed && timestamps.queued) {
    metrics.durationMs = new Date(timestamps.completed).getTime() - new Date(timestamps.queued).getTime();
  }
  if (timestamps.approvalResolved && timestamps.approvalRequested) {
    metrics.approvalWaitMs = new Date(timestamps.approvalResolved).getTime() - new Date(timestamps.approvalRequested).getTime();
  }
  
  return {
    ...current,
    ...updates,
    phase,
    timestamps,
    metrics
  } as T;
}

/**
 * Format invocation status for display.
 */
export function formatInvocationStatus(inv: ToolInvocation): string {
  switch (inv.phase) {
    case 'queued':
      return inv.queuePosition ? `Queued (position ${inv.queuePosition})` : 'Queued';
    case 'validating':
      return 'Validating parameters';
    case 'executing':
      return inv.statusMessage || 'Executing';
    case 'streaming':
      return `Streaming (${inv.chunks.length} chunks)`;
    case 'approval-pending':
      return 'Awaiting approval';
    case 'completing':
      return 'Finalizing';
    case 'succeeded':
      return 'Completed';
    case 'failed':
      return `Failed: ${inv.error.message}`;
    case 'aborted':
      return `Aborted by ${inv.abortedBy}`;
    case 'timeout':
      return `Timeout after ${inv.timeoutMs}ms`;
    default:
      return 'Unknown status';
  }
}

// Example usage:
// const inv = createToolInvocation(sessionId, 'pipeline.run', 'azure-openai', { pipeline: 'validate' });
// const executing = transitionInvocation<ToolInvocationExecuting>(inv, 'executing', { progress: 0 });
// const succeeded = transitionInvocation<ToolInvocationSucceeded>(executing, 'succeeded', { result: {} });
