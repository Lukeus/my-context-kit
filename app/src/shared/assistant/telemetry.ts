// Telemetry event model extensions (T006)
// -----------------------------------------------------------------------------
// These types extend the assistant telemetry surface for unified session +
// sidecar tool interactions. They will be produced by the main process
// (assistantSessionManager) and consumed by renderer stores for analytics.
// TODO(Telemetry-Phase2): Add discriminated unions for stream vs batch events.

export type TelemetryEventKind =
  | 'session.created'
  | 'session.updated'
  | 'message.sent'
  | 'tool.invoked'
  | 'tool.completed'
  | 'tool.failed'
  | 'approval.requested'
  | 'approval.decided'
  | 'health.snapshot'
  | 'capability.loaded'
  | 'pipeline.started'
  | 'pipeline.finished'
  | 'pipeline.failed';

export interface TelemetryBaseEvent {
  id: string;              // unique identifier
  kind: TelemetryEventKind; // classification
  sessionId?: string;      // optional for pre-session events
  timestamp: string;       // ISO time
  provider?: string;       // provider id (azure-openai, ollama)
  correlationId?: string;  // links related events
  latencyMs?: number;      // duration when applicable
  errorCode?: string;      // error classification code (VALIDATION_ERROR, TIMEOUT, etc.)
  meta?: Record<string, unknown>; // arbitrary structured metadata
}

export interface ToolTelemetryEvent extends TelemetryBaseEvent {
  kind: 'tool.invoked' | 'tool.completed' | 'tool.failed';
  toolId: string;
  parameters?: Record<string, unknown>;
  resultSummary?: string;
  error?: string;
}

export interface PipelineTelemetryEvent extends TelemetryBaseEvent {
  kind: 'pipeline.started' | 'pipeline.finished' | 'pipeline.failed';
  pipeline: string;
  args?: Record<string, unknown>;
  error?: string;
  outputSummary?: string;
}

export interface ApprovalTelemetryEvent extends TelemetryBaseEvent {
  kind: 'approval.requested' | 'approval.decided';
  toolId: string;
  approvalId: string;
  decision?: 'approved' | 'rejected' | 'expired';
  notes?: string;
}

export interface HealthSnapshotTelemetryEvent extends TelemetryBaseEvent {
  kind: 'health.snapshot';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message?: string;
  pollIntervalMs?: number;
}

export interface CapabilityLoadedTelemetryEvent extends TelemetryBaseEvent {
  kind: 'capability.loaded';
  capabilityCount: number;
  enabledCount: number;
  disabledCount: number;
  previewCount: number;
}

export type AssistantTelemetryEvent =
  | TelemetryBaseEvent
  | ToolTelemetryEvent
  | PipelineTelemetryEvent
  | ApprovalTelemetryEvent
  | HealthSnapshotTelemetryEvent
  | CapabilityLoadedTelemetryEvent;

export interface TelemetryEnvelope {
  events: AssistantTelemetryEvent[];
  generatedAt: string;
  sessionId?: string;
  version: string; // schema version for evolvability
}

// Helper to narrow an event kind to its interface
export function isToolEvent(e: AssistantTelemetryEvent): e is ToolTelemetryEvent {
  return e.kind === 'tool.invoked' || e.kind === 'tool.completed' || e.kind === 'tool.failed';
}

export function isPipelineEvent(e: AssistantTelemetryEvent): e is PipelineTelemetryEvent {
  return e.kind === 'pipeline.started' || e.kind === 'pipeline.finished' || e.kind === 'pipeline.failed';
}

export function isApprovalEvent(e: AssistantTelemetryEvent): e is ApprovalTelemetryEvent {
  return e.kind === 'approval.requested' || e.kind === 'approval.decided';
}

export function isHealthSnapshotEvent(e: AssistantTelemetryEvent): e is HealthSnapshotTelemetryEvent {
  return e.kind === 'health.snapshot';
}

export function isCapabilityLoadedEvent(e: AssistantTelemetryEvent): e is CapabilityLoadedTelemetryEvent {
  return e.kind === 'capability.loaded';
}

// Factory helpers (T011) -----------------------------------------------------
// Centralised creation ensures consistent timestamps, ids, and meta usage.

let _eventCounter = 0; // Simple monotonic fallback id when crypto.randomUUID unavailable.

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  _eventCounter += 1;
  return `${prefix}-${Date.now()}-${_eventCounter}`;
}

function base(kind: TelemetryEventKind, sessionId?: string, provider?: string, correlationId?: string): TelemetryBaseEvent {
  // Return explicitly typed TelemetryBaseEvent; downstream factories will override `kind` via specific literal narrowing.
  return {
    id: newId('te'),
    kind: kind as TelemetryEventKind,
    sessionId,
    timestamp: new Date().toISOString(),
    provider,
    correlationId
  };
}

export function makeSessionCreated(sessionId: string, provider?: string): TelemetryBaseEvent {
  return { ...base('session.created', sessionId, provider) };
}

export function makeSessionUpdated(sessionId: string, provider?: string, meta?: Record<string, unknown>): TelemetryBaseEvent {
  return { ...base('session.updated', sessionId, provider), meta };
}

export function makeMessageSent(sessionId: string, provider: string | undefined, correlationId: string | undefined, contentLength: number): TelemetryBaseEvent {
  return { ...base('message.sent', sessionId, provider, correlationId), meta: { contentLength } };
}

export function makeToolInvoked(sessionId: string, provider: string | undefined, toolId: string, parameters: Record<string, unknown>, correlationId?: string): ToolTelemetryEvent {
  const b = base('tool.invoked', sessionId, provider, correlationId);
  return { ...b, kind: 'tool.invoked', toolId, parameters };
}

export function makeToolCompleted(invoked: ToolTelemetryEvent, resultSummary?: string, latencyMs?: number): ToolTelemetryEvent {
  return { ...invoked, kind: 'tool.completed', resultSummary, latencyMs };
}

export function makeToolFailed(invoked: ToolTelemetryEvent, error: string, latencyMs?: number): ToolTelemetryEvent {
  return { ...invoked, kind: 'tool.failed', error, latencyMs };
}

export function makePipelineStarted(sessionId: string, provider: string | undefined, pipeline: string, args?: Record<string, unknown>, correlationId?: string): PipelineTelemetryEvent {
  const b = base('pipeline.started', sessionId, provider, correlationId);
  return { ...b, kind: 'pipeline.started', pipeline, args };
}

export function makePipelineFinished(started: PipelineTelemetryEvent, outputSummary?: string, latencyMs?: number): PipelineTelemetryEvent {
  return { ...started, kind: 'pipeline.finished', outputSummary, latencyMs };
}

export function makePipelineFailed(started: PipelineTelemetryEvent, error: string, latencyMs?: number): PipelineTelemetryEvent {
  return { ...started, kind: 'pipeline.failed', error, latencyMs };
}

export function makeApprovalRequested(sessionId: string, provider: string | undefined, toolId: string, approvalId: string, diffPreview?: string): ApprovalTelemetryEvent {
  const b = base('approval.requested', sessionId, provider);
  return { ...b, kind: 'approval.requested', toolId, approvalId, meta: diffPreview ? { diffPreview } : undefined };
}

export function makeApprovalDecided(requested: ApprovalTelemetryEvent, decision: 'approved' | 'rejected' | 'expired', notes?: string): ApprovalTelemetryEvent {
  return { ...requested, kind: 'approval.decided', decision, notes };
}

export function makeHealthSnapshot(sessionId: string | undefined, provider: string | undefined, status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown', message: string | null, pollIntervalMs: number): HealthSnapshotTelemetryEvent {
  const b = base('health.snapshot', sessionId, provider);
  return { ...b, kind: 'health.snapshot', status, message: message || undefined, pollIntervalMs };
}

export function makeCapabilityLoaded(sessionId: string | undefined, provider: string | undefined, capabilityCount: number, enabledCount: number, disabledCount: number, previewCount: number): CapabilityLoadedTelemetryEvent {
  const b = base('capability.loaded', sessionId, provider);
  return { ...b, kind: 'capability.loaded', capabilityCount, enabledCount, disabledCount, previewCount };
}

export function makeEnvelope(sessionId: string | undefined, events: AssistantTelemetryEvent[]): TelemetryEnvelope {
  return { events, generatedAt: new Date().toISOString(), sessionId, version: '1.0.0' };
}

// TODO(T011-Validation): Add runtime guards ensuring event kind/shape consistency before dispatch.
