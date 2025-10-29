import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type {
  AssistantPipelineName,
  AssistantProvider,
  AssistantSession,
  ConversationTurn,
  PendingAction,
  ToolInvocationRecord
} from '@shared/assistant/types';
import type {
  CreateSessionPayload,
  ExecuteToolPayload,
  MessageResponse,
  ResolvePendingActionPayload,
  SendMessagePayload,
  ToolExecutionResponse,
  RunPipelinePayload
} from '@/../preload/assistantBridge';

function assertAssistantBridge(): typeof window.api.assistant {
  if (!window.api?.assistant) {
    throw new Error('Assistant bridge is unavailable. Ensure context isolation bridge is registered.');
  }
  return window.api.assistant;
}

function nowIso(): string {
  return new Date().toISOString();
}

const PIPELINE_TOOL_ID = 'pipeline.run';
const CONTEXT_READ_TOOL_ID = 'context.read';
const PIPELINE_SESSION_PROMPT = 'You are a guard-railed operator for context repository pipelines. '
  + 'Confirm scope, execute only allowlisted commands, and summarise results for humans.';

interface ContextReadResult {
  path: string;
  repoRelativePath: string;
  content: string;
  encoding: string;
  size: number;
  lastModified: string;
  truncated: boolean;
}

export const useAssistantStore = defineStore('assistant-safe-tools', () => {
  const session = ref<AssistantSession | null>(null);
  const conversation = ref<ConversationTurn[]>([]);
  const pendingApprovals = ref<PendingAction[]>([]);
  const activePendingId = ref<string | null>(null);
  const telemetry = ref<ToolInvocationRecord[]>([]);
  const isBusy = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<string | null>(null);
  const contextReadResult = ref<ContextReadResult | null>(null);
  const contextReadError = ref<string | null>(null);

  const hasSession = computed(() => Boolean(session.value));
  const activeProvider = computed<AssistantProvider | null>(() => session.value?.provider ?? null);
  const activeTools = computed(() => session.value?.activeTools ?? []);
  const pendingCount = computed(() => pendingApprovals.value.length);
  const activePending = computed<PendingAction | null>(() => {
    if (!activePendingId.value) return null;
    return pendingApprovals.value.find(p => p.id === activePendingId.value) ?? null;
  });

  function applySession(nextSession: AssistantSession) {
    session.value = nextSession;
    conversation.value = [...nextSession.messages];
    pendingApprovals.value = [...nextSession.pendingApprovals];
    lastUpdated.value = nowIso();
  }

  function appendMessage(turn: ConversationTurn) {
    conversation.value = [...conversation.value, turn];
    if (session.value) {
      session.value = {
        ...session.value,
        messages: conversation.value,
        updatedAt: turn.timestamp
      };
    }
  }

  function openPendingApproval(id: string) {
    activePendingId.value = id;
  }

  function closePendingApproval() {
    activePendingId.value = null;
  }

  function getPendingById(id: string) {
    return pendingApprovals.value.find(p => p.id === id);
  }

  function addPendingLocally(pending: PendingAction) {
    pendingApprovals.value = [...pendingApprovals.value, pending];
  }

  async function createSession(payload: CreateSessionPayload) {
    const bridge = assertAssistantBridge();
    isBusy.value = true;
    error.value = null;
    try {
      const created = await bridge.createSession(payload);
      applySession(created);
      telemetry.value = [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create assistant session.';
      error.value = message;
      throw err;
    } finally {
      isBusy.value = false;
    }
  }

  async function sendMessage(payload: SendMessagePayload) {
    const bridge = assertAssistantBridge();
    if (!session.value) {
      throw new Error('No active assistant session. Create a session before sending messages.');
    }

    isBusy.value = true;
    error.value = null;
    const timestamp = nowIso();
    appendMessage({
      role: 'user',
      content: payload.content,
      timestamp,
      metadata: payload.attachments ? { attachments: payload.attachments } : undefined
    });

    try {
      const response: MessageResponse = await bridge.sendMessage(session.value.id, payload);
      appendMessage(response.message);
      lastUpdated.value = nowIso();
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Assistant message failed.';
      error.value = message;
      throw err;
    } finally {
      isBusy.value = false;
    }
  }

  async function executeTool(payload: ExecuteToolPayload) {
    const bridge = assertAssistantBridge();
    if (!session.value) {
      throw new Error('No active assistant session. Create a session before executing tools.');
    }

    isBusy.value = true;
    error.value = null;
    try {
      const result: ToolExecutionResponse = await bridge.executeTool(session.value.id, payload);
      if (result.session) {
        applySession(result.session);
      } else if (result.conversation) {
        conversation.value = [...result.conversation];
      }

      if (result.pending) {
        pendingApprovals.value = [...pendingApprovals.value, result.pending];
      }
      if (result.error) {
        error.value = result.error;
      }
      lastUpdated.value = nowIso();
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tool execution failed.';
      error.value = message;
      throw err;
    } finally {
      isBusy.value = false;
    }
  }

  async function ensurePipelineSession(provider: AssistantProvider): Promise<AssistantSession> {
    const requiredTools = [PIPELINE_TOOL_ID, CONTEXT_READ_TOOL_ID];

    if (session.value && session.value.provider === provider) {
      const hasAllTools = requiredTools.every(toolId => session.value?.activeTools?.some(tool => tool.id === toolId));
      if (hasAllTools) {
        return session.value;
      }
    }

    await createSession({
      provider,
      systemPrompt: PIPELINE_SESSION_PROMPT,
      activeTools: requiredTools
    });

    if (!session.value) {
      throw new Error('Failed to initialise assistant session.');
    }
    return session.value;
  }

  async function runPipeline(options: { repoPath: string; pipeline: AssistantPipelineName; args?: Record<string, unknown>; provider?: AssistantProvider }) {
    if (!options.repoPath) {
      throw new Error('Repository path is required to run a pipeline.');
    }

    const provider = options.provider ?? 'azure-openai';
    const bridge = assertAssistantBridge();
    const activeSession = await ensurePipelineSession(provider);

    isBusy.value = true;
    error.value = null;

    const payload: RunPipelinePayload = {
      repoPath: options.repoPath,
      pipeline: options.pipeline,
      ...(options.args ? { args: options.args } : {})
    };

    try {
      const response = await bridge.runPipeline(activeSession.id, payload);
      lastUpdated.value = nowIso();
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Pipeline execution failed.';
      error.value = message;
      throw err;
    } finally {
      try {
        await refreshTelemetry(true);
      } catch {
        // TODO: surface telemetry refresh failures once dedicated UI is available.
      }
      isBusy.value = false;
    }
  }

  async function readContextFile(options: { repoPath: string; path: string; encoding?: string; provider?: AssistantProvider }) {
    if (!options.repoPath) {
      throw new Error('Repository path is required to read context files.');
    }
    if (!options.path || options.path.trim().length === 0) {
      throw new Error('A relative file path is required to read context files.');
    }

    const provider = options.provider ?? 'azure-openai';
    const bridge = assertAssistantBridge();
    const activeSession = await ensurePipelineSession(provider);

    isBusy.value = true;
    error.value = null;
    contextReadError.value = null;

    const parameters: Record<string, unknown> = { path: options.path.trim() };
    if (options.encoding) {
      parameters.encoding = options.encoding;
    }

    try {
      const response = await bridge.executeTool(activeSession.id, {
        toolId: CONTEXT_READ_TOOL_ID,
        repoPath: options.repoPath,
        parameters
      });

      if (response.session) {
        applySession(response.session);
      } else if (response.conversation) {
        conversation.value = [...response.conversation];
      }

      if (response.error) {
        contextReadError.value = response.error;
        contextReadResult.value = null;
        throw new Error(response.error);
      }

      contextReadResult.value = normaliseContextReadResult(response.result ?? null);
      lastUpdated.value = nowIso();
      await refreshTelemetry(true);
      return contextReadResult.value;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Context read failed.';
      error.value = message;
      if (!contextReadError.value) {
        contextReadError.value = message;
      }
      throw err;
    } finally {
      isBusy.value = false;
    }
  }

  async function resolvePendingAction(actionId: string, payload: ResolvePendingActionPayload) {
    const bridge = assertAssistantBridge();
    if (!session.value) {
      throw new Error('No active assistant session.');
    }

    isBusy.value = true;
    error.value = null;
    try {
      const action = await bridge.resolvePendingAction(session.value.id, actionId, payload);
      pendingApprovals.value = pendingApprovals.value
        .filter(item => item.id !== actionId)
        .concat(action.approvalState === 'pending' ? [action] : []);
      lastUpdated.value = nowIso();
      return action;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Approval decision failed.';
      error.value = message;
      throw err;
    } finally {
      isBusy.value = false;
    }
  }

  async function approvePending(actionId: string, notes?: string) {
    return resolvePendingAction(actionId, { decision: 'approve', notes });
  }

  async function rejectPending(actionId: string, notes?: string) {
    return resolvePendingAction(actionId, { decision: 'reject', notes });
  }

  async function refreshPendingApprovals() {
    // Ensure the store aligns with the server-provided session state where possible.
    if (session.value) {
      pendingApprovals.value = [...(session.value.pendingApprovals ?? [])];
      lastUpdated.value = nowIso();
    }
  }

  async function refreshTelemetry(force = false) {
    const bridge = assertAssistantBridge();
    if (!session.value) {
      return;
    }

    if (!force && telemetry.value.length > 0) {
      return;
    }

    try {
      const records = await bridge.listTelemetry(session.value.id);
      telemetry.value = records;
      lastUpdated.value = nowIso();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load telemetry records.';
      error.value = message;
      // TODO: Surface telemetry refresh failure in UI once dashboard view is built.
    }
  }

  function consumeStreamEvents() {
    const bridge = assertAssistantBridge();
    return bridge.onStreamEvent(payload => {
      // TODO: Map backend streaming payloads onto session state once streaming endpoints are implemented.
      void payload;
    });
  }

  function reset() {
    session.value = null;
    conversation.value = [];
    pendingApprovals.value = [];
    telemetry.value = [];
    error.value = null;
    lastUpdated.value = null;
    contextReadResult.value = null;
    contextReadError.value = null;
  }

  return {
    session,
    conversation,
    pendingApprovals,
    telemetry,
    isBusy,
    error,
    lastUpdated,
    contextReadResult,
    contextReadError,
    hasSession,
    activeProvider,
    activeTools,
    pendingCount,
    createSession,
    sendMessage,
    executeTool,
    runPipeline,
    resolvePendingAction,
    readContextFile,
    refreshTelemetry,
    consumeStreamEvents,
    reset
    ,
    // Approval helpers
    activePendingId,
    activePending,
    openPendingApproval,
    closePendingApproval,
    getPendingById,
    addPendingLocally,
    approvePending,
    rejectPending,
    refreshPendingApprovals
  };
});

function normaliseContextReadResult(result: Record<string, unknown> | null | undefined): ContextReadResult | null {
  if (!result) {
    return null;
  }

  return {
    path: typeof result.path === 'string' ? result.path : '',
    repoRelativePath: typeof result.repoRelativePath === 'string' ? result.repoRelativePath : '',
    content: typeof result.content === 'string' ? result.content : '',
    encoding: typeof result.encoding === 'string' ? result.encoding : 'utf-8',
    size: typeof result.size === 'number' ? result.size : 0,
    lastModified: typeof result.lastModified === 'string' ? result.lastModified : '',
    truncated: Boolean(result.truncated)
  };
}
