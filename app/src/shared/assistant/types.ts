export type AssistantProvider = 'azure-openai' | 'ollama';

export type AssistantPipelineName = 'validate' | 'build-graph' | 'impact' | 'generate';

export type AssistantRole = 'system' | 'user' | 'assistant';

export type ToolCapability = 'read' | 'write' | 'execute' | 'git';

export type ToolInvocationStatus = 'pending' | 'succeeded' | 'failed' | 'aborted';

export type PendingApprovalState = 'pending' | 'approved' | 'rejected' | 'expired';

export interface JsonSchemaDefinition {
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: string[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: JsonSchemaDefinition | JsonSchemaDefinition[];
  properties?: Record<string, JsonSchemaDefinition>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaDefinition;
  anyOf?: JsonSchemaDefinition[];
  allOf?: JsonSchemaDefinition[];
  oneOf?: JsonSchemaDefinition[];
  [key: string]: unknown;
}

export interface ConversationTurn {
  role: AssistantRole;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
}

export interface ToolDescriptor {
  id: string;
  title: string;
  description: string;
  capability: ToolCapability;
  requiresApproval: boolean;
  allowedProviders: AssistantProvider[];
  inputSchema: JsonSchemaDefinition;
  outputSchema: JsonSchemaDefinition;
}

export interface ToolInvocationRecord {
  id: string;
  sessionId: string;
  toolId: string;
  status: ToolInvocationStatus;
  parameters: Record<string, unknown>;
  resultSummary?: string;
  startedAt: string;
  finishedAt?: string;
  provider: AssistantProvider;
  metadata?: Record<string, unknown>;
}

export interface PendingAction {
  id: string;
  sessionId: string;
  toolId: string;
  createdAt: string;
  expiresAt: string;
  approvalState: PendingApprovalState;
  diffPreview?: string;
  metadata?: Record<string, unknown>;
}

export interface AssistantSession {
  id: string;
  provider: AssistantProvider;
  systemPrompt: string;
  messages: ConversationTurn[];
  activeTools: ToolDescriptor[];
  pendingApprovals: PendingAction[];
  telemetryId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// LangChain Integration Data Model Extensions (Phase 2 T004)
// ---------------------------------------------------------------------------
// Derived from specs/001-langchain-backend-integration/data-model.md and
// contracts/assistant-langchain.yaml. These types will support foundational
// client wrappers and session orchestration. TODO: Remove legacy duplication
// when unified assistant architecture merges aiStore.

export type CapabilityStatus = 'enabled' | 'disabled' | 'preview';

export interface CapabilityEntry {
  status: CapabilityStatus;
  fallback?: string; // Optional fallback action identifier
  rolloutNotes?: string; // Short notes on rollout phase
}

export interface CapabilityProfile {
  profileId: string;
  lastUpdated: string; // ISO timestamp
  capabilities: Record<string, CapabilityEntry>;
}

export type TaskStatus = 'pending' | 'streaming' | 'succeeded' | 'failed';

export interface TaskTimestamps {
  created?: string; // when task accepted
  firstResponse?: string; // when first stream token arrived
  completed?: string; // success or failure terminal time
}

export type TaskActionType = 'prompt' | 'tool-execution' | 'approval' | 'fallback';

export interface TaskEnvelope {
  taskId: string;
  status: TaskStatus;
  actionType: TaskActionType; // Constrained to known action types
  provenance?: Record<string, unknown>; // cost summaries, approval metadata, etc
  // TODO(StreamOutput): Replace generic Record with discriminated union for tokens vs final structured outputs.
  outputs: Array<Record<string, unknown>>; // streamed chunks or structured tool results
  timestamps?: TaskTimestamps;
}

export interface AssistantSessionExtended extends AssistantSession {
  capabilityProfile?: CapabilityProfile; // Loaded during bootstrap
  telemetryContext?: Record<string, unknown>; // Correlation identifiers TODO(TelemetryTyping): introduce structured type
  capabilityFlags?: Record<string, CapabilityEntry>; // Convenience mirror of profile.capabilities
  tasks?: TaskEnvelope[]; // Aggregated LangChain task envelopes
}

// Utility guard helpers
export function isTaskStreaming(t: TaskEnvelope): boolean {
  return t.status === 'streaming';
}

export function isCapabilityEnabled(entry?: CapabilityEntry): boolean {
  return !!entry && entry.status === 'enabled';
}

export function deriveCapabilityFlags(profile?: CapabilityProfile): Record<string, CapabilityEntry> {
  return profile?.capabilities ? { ...profile.capabilities } : {};
}

export interface ProviderRuntimeSettings {
  id: AssistantProvider;
  displayName: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
  maxCompletionTokens: number;
  temperature: number;
  enableLogprobs: boolean;
  tools: ToolDescriptor[];
}

export interface ProviderConfigurationResult {
  providers: Record<AssistantProvider, ProviderRuntimeSettings>;
  disabledTools: Record<string, AssistantProvider[]>;
}
