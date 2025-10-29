import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type {
  AssistantPipelineName,
  AssistantProvider,
  AssistantSession,
  ConversationTurn,
  PendingAction,
  ToolInvocationRecord
} from '@shared/assistant/types';

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

export interface AssistantBridgeAPI {
  createSession(payload: CreateSessionPayload): Promise<AssistantSession>;
  sendMessage(sessionId: string, payload: SendMessagePayload): Promise<MessageResponse>;
  executeTool(sessionId: string, payload: ExecuteToolPayload): Promise<ToolExecutionResponse>;
  resolvePendingAction(sessionId: string, actionId: string, payload: ResolvePendingActionPayload): Promise<PendingAction>;
  listTelemetry(sessionId: string): Promise<ToolInvocationRecord[]>;
  onStreamEvent(listener: (payload: unknown) => void): () => void;
  runPipeline(sessionId: string, payload: RunPipelinePayload): Promise<ToolExecutionResponse>;
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
    runPipeline: (sessionId, payload) => ipcRenderer.invoke('assistant:pipelineRun', { sessionId, ...payload })
  };
}

// TODO: Expand bridge with granular streaming events once backend emits typed updates.
