import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type {
  AssistantPipelineName,
  AssistantProvider,
  AssistantSession,
  AssistantSessionExtended,
  ConversationTurn,
  PendingAction,
  ToolInvocationRecord,
  TaskEnvelope,
  CapabilityProfile
} from '@shared/assistant/types';
import type { AssistantTelemetryEvent } from '@shared/assistant/telemetry';

export interface CreateSessionPayload {
  provider: AssistantProvider;
  systemPrompt: string;
  activeTools?: string[];
}

export interface SendMessagePayload {
  content: string;
  attachments?: string[];
}

export interface ExecuteToolPayload {
  toolId: string;
  repoPath: string;
  parameters?: Record<string, unknown>;
  requireApproval?: boolean;
}

export interface ResolvePendingActionPayload {
  decision: 'approve' | 'reject';
  notes?: string;
}

export interface MessageResponse {
  message: ConversationTurn;
  provider: AssistantProvider;
  logprobs?: Array<Record<string, unknown>> | null;
  usage?: Record<string, unknown> | null;
}

export interface ToolExecutionResponse {
  result?: Record<string, unknown>;
  pending?: PendingAction | null;
  telemetryId?: string;
  error?: string;
  conversation?: ConversationTurn[];
  session?: AssistantSession;
}

export interface RunPipelinePayload {
  repoPath: string;
  pipeline: AssistantPipelineName;
  args?: Record<string, unknown>;
}

export interface HealthStatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message?: string;
  timestamp: string;
}

export interface AssistantBridgeAPI {
  createSession(payload: CreateSessionPayload): Promise<AssistantSessionExtended>;
  sendMessage(sessionId: string, payload: SendMessagePayload & { mode?: 'general' | 'improvement' | 'clarification' }): Promise<TaskEnvelope | null>;
  executeTool(sessionId: string, payload: ExecuteToolPayload): Promise<ToolExecutionResponse>;
  resolvePendingAction(sessionId: string, actionId: string, payload: ResolvePendingActionPayload): Promise<PendingAction>;
  listTelemetry(sessionId: string): Promise<ToolInvocationRecord[]>;
  onStreamEvent(listener: (payload: unknown) => void): () => void;
  runPipeline(sessionId: string, payload: RunPipelinePayload): Promise<ToolExecutionResponse>;
  startTaskStream(sessionId: string, taskId: string): Promise<{ ok: boolean; error?: string | null; taskId: string }>;
  cancelTaskStream(sessionId: string, taskId: string): Promise<{ ok: boolean; error?: string | null; taskId: string }>;
  // T016: Extended telemetry and capability endpoints
  listTelemetryEvents(sessionId: string): Promise<AssistantTelemetryEvent[]>;
  fetchCapabilityManifest(): Promise<CapabilityProfile>;
  getHealthStatus(): Promise<HealthStatusResponse>;
  getGatingStatus(repoPath: string): Promise<import('@shared/assistant/types').GatingStatus>;
}

export function createAssistantBridge(ipcRenderer: IpcRenderer): AssistantBridgeAPI {
  const subscribe = (channel: string, listener: (payload: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, payload: unknown) => listener(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };

  return {
    createSession: (payload) => ipcRenderer.invoke('assistant:createSession', payload),
    sendMessage: (sessionId, payload) => ipcRenderer.invoke('assistant:sendMessage', { sessionId, ...payload }),
    executeTool: (sessionId, payload) => ipcRenderer.invoke('assistant:executeTool', { sessionId, ...payload }),
    resolvePendingAction: (sessionId, actionId, payload) =>
      ipcRenderer.invoke('assistant:resolvePendingAction', { sessionId, actionId, ...payload }),
    listTelemetry: (sessionId) => ipcRenderer.invoke('assistant:listTelemetry', { sessionId }),
    onStreamEvent: (listener) => subscribe('assistant:stream-event', listener),
    runPipeline: (sessionId, payload) => ipcRenderer.invoke('assistant:pipelineRun', { sessionId, ...payload }),
    startTaskStream: (sessionId, taskId) => ipcRenderer.invoke('assistant:task:startStream', { sessionId, taskId }),
    cancelTaskStream: (sessionId, taskId) => ipcRenderer.invoke('assistant:task:cancelStream', { sessionId, taskId }),
    // T016: Extended endpoints
    listTelemetryEvents: (sessionId) => ipcRenderer.invoke('assistant:listTelemetryEvents', { sessionId }),
    fetchCapabilityManifest: () => ipcRenderer.invoke('assistant:fetchCapabilityManifest'),
    getHealthStatus: () => ipcRenderer.invoke('assistant:getHealthStatus'),
    getGatingStatus: (repoPath: string) => ipcRenderer.invoke('assistant:getGatingStatus', { repoPath })
  };
}

// Note: Granular streaming events can be added when backend streaming payloads are standardized.
// Current stream event structure supports assistant chunk, error, and completion events.
