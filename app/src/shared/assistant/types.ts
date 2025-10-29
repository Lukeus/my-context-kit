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
