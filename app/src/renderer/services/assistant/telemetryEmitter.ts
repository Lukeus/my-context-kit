// Telemetry emission helper (T014)
// -----------------------------------------------------------------------------
// Provides a thin abstraction for constructing and recording telemetry events
// using the factories in @shared/assistant/telemetry. Eventually this module
// will flush events to a main-process IPC handler for persistence / audit.
// TODO(T014-IPCPersist): Add bridge call (e.g. window.api.assistant.logTelemetry) once implemented.
// TODO(T014-Buffer): Introduce batching/flush interval for high-frequency events.

import type { AssistantTelemetryEvent } from '@shared/assistant/telemetry';
import {
  makeSessionCreated,
  makeSessionUpdated,
  makeMessageSent,
  makeToolInvoked,
  makeToolCompleted,
  makeToolFailed,
  makePipelineStarted,
  makePipelineFinished,
  makePipelineFailed,
  makeApprovalRequested,
  makeApprovalDecided,
  makeHealthSnapshot,
  makeCapabilityLoaded,
  makeEnvelope
} from '@shared/assistant/telemetry';
import type { AssistantSessionExtended, ToolInvocationRecord } from '@shared/assistant/types';

interface TelemetryEmitterOptions {
  provider?: string;
  onEmit?: (event: AssistantTelemetryEvent) => void; // side-effect hook
  onEnvelope?: (envelope: ReturnType<typeof makeEnvelope>) => void; // batch hook
  sessionSupplier: () => AssistantSessionExtended | null; // deferred session access
  eventSink: (event: AssistantTelemetryEvent) => void; // append into store state
}

export function createTelemetryEmitter(opts: TelemetryEmitterOptions) {
  function record(event: AssistantTelemetryEvent) {
    try { opts.eventSink(event); } catch {/* ignore sink errors */}
    try { opts.onEmit?.(event); } catch {/* ignore hook errors */}
  }

  function envelopeAndRecord(events: AssistantTelemetryEvent[]) {
    for (const e of events) record(e);
    try { opts.onEnvelope?.(makeEnvelope(opts.sessionSupplier()?.id, events)); } catch {/* ignore */}
  }

  function emitSessionCreated() {
    const session = opts.sessionSupplier();
    if (!session) return;
    record(makeSessionCreated(session.id, session.provider));
  }

  function emitSessionUpdated(meta?: Record<string, unknown>) {
    const session = opts.sessionSupplier();
    if (!session) return;
    record(makeSessionUpdated(session.id, session.provider, meta));
  }

  function emitMessageSent(content: string, correlationId?: string) {
    const session = opts.sessionSupplier();
    if (!session) return;
    record(makeMessageSent(session.id, session.provider, correlationId, content.length));
  }

  function emitToolLifecycle(invocation: ToolInvocationRecord) {
    const session = opts.sessionSupplier();
    if (!session) return;
    const invoked = makeToolInvoked(session.id, session.provider, invocation.toolId, invocation.parameters, invocation.id);
    record(invoked);
    if (invocation.status === 'succeeded') {
      record(makeToolCompleted(invoked, invocation.resultSummary, latency(invocation)));
    } else if (invocation.status === 'failed') {
      const rawErr = (invocation.metadata as any)?.errorMessage; // eslint-disable-line @typescript-eslint/no-explicit-any
      const errorMessage = typeof rawErr === 'string'
        ? rawErr
        : rawErr != null
          ? JSON.stringify(rawErr)
          : 'Tool failed';
      record(makeToolFailed(invoked, errorMessage, latency(invocation)));
    }
  }

  function emitPipelineLifecycle(pipeline: string, stage: 'start' | 'finish' | 'fail', args?: Record<string, unknown>, outputSummary?: string, error?: string, correlationId?: string) {
    const session = opts.sessionSupplier();
    if (!session) return;
    const started = makePipelineStarted(session.id, session.provider, pipeline, args, correlationId);
    if (stage === 'start') {
      record(started);
    } else if (stage === 'finish') {
      record(makePipelineFinished(started, outputSummary, undefined));
    } else if (stage === 'fail') {
      record(makePipelineFailed(started, error || 'Pipeline failed', undefined));
    }
  }

  function emitApproval(toolId: string, approvalId: string, phase: 'requested' | 'decided', decision?: 'approved' | 'rejected' | 'expired', notes?: string, diffPreview?: string) {
    const session = opts.sessionSupplier();
    if (!session) return;
    if (phase === 'requested') {
      record(makeApprovalRequested(session.id, session.provider, toolId, approvalId, diffPreview));
    } else {
      const req = makeApprovalRequested(session.id, session.provider, toolId, approvalId); // temp baseline
      record(makeApprovalDecided(req, decision || 'approved', notes));
    }
  }

  function emitHealthSnapshot(status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown', message: string | null, pollIntervalMs: number) {
    const session = opts.sessionSupplier();
    record(makeHealthSnapshot(session?.id, session?.provider, status, message, pollIntervalMs));
  }

  function emitCapabilityLoaded(capabilityCount: number, enabledCount: number, disabledCount: number, previewCount: number) {
    const session = opts.sessionSupplier();
    record(makeCapabilityLoaded(session?.id, session?.provider, capabilityCount, enabledCount, disabledCount, previewCount));
  }

  function latency(invocation: ToolInvocationRecord): number | undefined {
    if (!invocation.finishedAt) return undefined;
    return new Date(invocation.finishedAt).getTime() - new Date(invocation.startedAt).getTime();
  }

  return {
    emitSessionCreated,
    emitSessionUpdated,
    emitMessageSent,
    emitToolLifecycle,
    emitPipelineLifecycle,
    emitApproval,
    emitHealthSnapshot,
    emitCapabilityLoaded,
    envelopeAndRecord
  };
}

/**
 * Standalone helper for emitting tool lifecycle events without factory.
 * Used by assistantStore for queue-integrated tool execution.
 */
export function emitToolLifecycle(params: {
  sessionId: string;
  toolId: string;
  phase: 'invoked' | 'completed' | 'failed';
  repoPath?: string;
  parameters?: Record<string, unknown>;
  durationMs?: number;
  errorMessage?: string;
}): void {
  // TODO(T014-Standalone): Wire to persistent store once IPC handler available
  console.debug('[Telemetry]', params.phase, params.toolId, params.durationMs ? `${params.durationMs}ms` : '');
}

// Usage pattern (example):
// const emitter = createTelemetryEmitter({
//   provider: store.activeProvider,
//   sessionSupplier: () => store.session,
//   eventSink: evt => store.telemetryEvents.push(evt)
// });
// emitter.emitSessionCreated();
