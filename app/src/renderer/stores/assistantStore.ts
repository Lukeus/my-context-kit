import { computed, ref } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import type {
  AssistantPipelineName,
  AssistantProvider,
  AssistantSessionExtended,
  ConversationTurn,
  PendingAction,
  ToolInvocationRecord,
  TaskEnvelope,
  CapabilityProfile
} from '@shared/assistant/types';
import type {
  CreateSessionPayload,
  ExecuteToolPayload,
  ResolvePendingActionPayload,
  SendMessagePayload,
  ToolExecutionResponse,
  RunPipelinePayload
} from '@/../preload/assistantBridge';
import type { AgentProfile } from '@shared/agents/types';
import { useAgentStore } from './agentStore';
import { createHealthPoller, type NormalisedHealth, type LangChainHealthStatus } from '@/services/langchain/health';
import { createCapabilityCache, isCapabilityEnabled as checkCapabilityEnabled, getEnabledCapabilities } from '@/services/langchain/capabilities';

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
  // Get access to agent store
  const agentStore = useAgentStore();
  const { selectedAgent } = storeToRefs(agentStore);
  
  const session = ref<AssistantSessionExtended | null>(null);
  const tasks = ref<TaskEnvelope[]>([]);
  const provenance = ref<Record<string, unknown> | null>(null);
  const conversation = ref<ConversationTurn[]>([]);
  const pendingApprovals = ref<PendingAction[]>([]);
  const activePendingId = ref<string | null>(null);
  const telemetry = ref<ToolInvocationRecord[]>([]);
  const isBusy = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<string | null>(null);
  const contextReadResult = ref<ContextReadResult | null>(null);
  const contextReadError = ref<string | null>(null);
  const activeAgentProfile = ref<AgentProfile | null>(null);

  // Health state (T016)
  const health = ref<NormalisedHealth | null>(null);
  const healthPollerInstance = createHealthPoller({ intervalMs: 10000 });
  let healthUnsubscribe: (() => void) | null = null;

  // Capability cache (T020)
  const capabilityProfile = ref<CapabilityProfile | null>(null);
  const capabilityCache = createCapabilityCache();
  const capabilityLoading = ref(false);

  const hasSession = computed(() => Boolean(session.value));
  const activeProvider = computed<AssistantProvider | null>(() => session.value?.provider ?? null);
  const activeTools = computed(() => session.value?.activeTools ?? []);
  const pendingCount = computed(() => pendingApprovals.value.length);
  const activePending = computed<PendingAction | null>(() => {
    if (!activePendingId.value) return null;
    return pendingApprovals.value.find(p => p.id === activePendingId.value) ?? null;
  });

  // Health computed flags (T016)
  const healthStatus = computed<LangChainHealthStatus>(() => health.value?.status ?? 'unknown');
  const isHealthy = computed(() => healthStatus.value === 'healthy');
  const isDegraded = computed(() => healthStatus.value === 'degraded');
  const isUnhealthy = computed(() => healthStatus.value === 'unhealthy');
  const canExecuteRisky = computed(() => isHealthy.value || isDegraded.value);
  const healthMessage = computed<string | null>(() => {
    if (!health.value) return null;
    if (isUnhealthy.value) return health.value.message || 'LangChain service is currently unavailable. Operations will use local fallbacks.';
    if (isDegraded.value) return health.value.message || 'LangChain service is experiencing degraded performance.';
    return health.value.message;
  });

  // Capability computed (T020)
  const hasCapabilities = computed(() => Boolean(capabilityProfile.value));
  const enabledCapabilities = computed(() => getEnabledCapabilities(capabilityProfile.value));
  const isCapabilityEnabled = computed(() => (capabilityId: string) => {
    return checkCapabilityEnabled(capabilityProfile.value, capabilityId);
  });

  function applySession(nextSession: AssistantSessionExtended) {
    session.value = nextSession;
    conversation.value = [...nextSession.messages];
    pendingApprovals.value = [...nextSession.pendingApprovals];
    tasks.value = [...(nextSession.tasks || [])];
    provenance.value = nextSession.telemetryContext ? { ...nextSession.telemetryContext } : null;
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

  async function createSession(payload: CreateSessionPayload, agentProfile?: AgentProfile) {
    const bridge = assertAssistantBridge();
    isBusy.value = true;
    error.value = null;

    // Start health polling on first session creation (T016)
    if (!healthUnsubscribe) {
      healthUnsubscribe = healthPollerInstance.on(snapshot => {
        health.value = snapshot;
        // TODO(T016-Telemetry): log health transitions to telemetry writer
      });
      healthPollerInstance.start();
    }
    
    // Apply agent profile if provided
    const sessionPayload = agentProfile ? applyAgentProfile(payload, agentProfile) : payload;
    
    try {
      const created = await bridge.createSession(sessionPayload) as AssistantSessionExtended;
      applySession(created);
      telemetry.value = [];
      tasks.value = [...(created.tasks || [])];
      provenance.value = created.telemetryContext ? { ...created.telemetryContext } : null;
      
      // Store active agent profile
      activeAgentProfile.value = agentProfile ?? null;

      // Load capability profile (T020) - non-blocking
      loadCapabilities().catch(err => {
        console.warn('Failed to load capability profile:', err);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create assistant session.';
      error.value = message;
      throw err;
    } finally {
      isBusy.value = false;
    }
  }
  
  /**
   * Apply agent profile configuration to session payload
   */
  function applyAgentProfile(payload: CreateSessionPayload, agent: AgentProfile): CreateSessionPayload {
    // Use agent's system prompt
    const systemPrompt = agent.systemPrompt || payload.systemPrompt;
    
    // Use agent's tool requirements
    const activeTools = agent.tools
      ? agent.tools.filter(t => t.required).map(t => t.toolId)
      : payload.activeTools;
    
    // Apply agent configuration
    const config: Record<string, unknown> = {};
    if (agent.config?.temperature !== undefined) {
      config.temperature = agent.config.temperature;
    }
    if (agent.config?.maxTokens !== undefined) {
      config.maxTokens = agent.config.maxTokens;
    }
    if (agent.config?.enableLogprobs !== undefined) {
      config.enableLogprobs = agent.config.enableLogprobs;
    }
    
    return {
      ...payload,
      systemPrompt,
      activeTools: activeTools || payload.activeTools,
      ...config
    };
  }

  async function sendMessage(payload: SendMessagePayload & { mode?: 'general' | 'improvement' | 'clarification' }) {
    const bridge = assertAssistantBridge();
    if (!session.value) {
      throw new Error('No active assistant session. Create a session before sending messages.');
    }

    // Block risky operations when unhealthy (T016)
    if (!canExecuteRisky.value) {
      const fallback = 'LangChain service unavailable. Message dispatch blocked. Please retry when service recovers.';
      error.value = fallback;
      throw new Error(fallback);
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
      const envelope = await bridge.sendMessage(session.value.id, payload);
      if (envelope) {
        // Double-cast to work around TypeScript inference issue with global window.api types
        tasks.value = [...tasks.value, envelope as unknown as TaskEnvelope];
        // TODO(StreamMerge T012): merge streaming updates into tasks
      }
      lastUpdated.value = nowIso();
      return envelope;
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

    // Block risky tool execution when unhealthy (T016)
    if (!canExecuteRisky.value && payload.toolId !== CONTEXT_READ_TOOL_ID) {
      const fallback = 'LangChain service unavailable. Tool execution blocked. Safe read-only operations may proceed.';
      error.value = fallback;
      throw new Error(fallback);
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

  async function ensurePipelineSession(provider: AssistantProvider, agent?: AgentProfile): Promise<AssistantSessionExtended> {
    const requiredTools = [PIPELINE_TOOL_ID, CONTEXT_READ_TOOL_ID];

    if (session.value && session.value.provider === provider) {
      const hasAllTools = requiredTools.every(toolId => session.value?.activeTools?.some(tool => tool.id === toolId));
      if (hasAllTools && (!agent || activeAgentProfile.value?.id === agent.id)) {
        return session.value;
      }
    }

    await createSession({
      provider,
      systemPrompt: agent?.systemPrompt || PIPELINE_SESSION_PROMPT,
      activeTools: requiredTools
    }, agent);

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
    
    // Use the currently selected agent from agentStore
    const agent = selectedAgent.value;
    const activeSession = await ensurePipelineSession(provider, agent || undefined);

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
      } catch (refreshError) {
        // Telemetry refresh failures are logged but do not block pipeline execution.
        console.warn('Failed to refresh telemetry after pipeline run:', refreshError);
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
    
    // Use the currently selected agent from agentStore
    const agent = selectedAgent.value;
    const activeSession = await ensurePipelineSession(provider, agent || undefined);

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
        applySession(response.session as AssistantSessionExtended);
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
      console.warn('Telemetry refresh failed:', message);
    }
  }

  function consumeStreamEvents() {
    const bridge = assertAssistantBridge();
    return bridge.onStreamEvent(payload => {
      // Note: Stream event handling can be enhanced when backend emits structured streaming data.
      // Current implementation supports basic assistant chunk, error, and completion events.
      console.debug('Received stream event:', payload);
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
    activeAgentProfile.value = null;
    tasks.value = [];
    provenance.value = null;
  }

  function stopHealthPolling() {
    if (healthUnsubscribe) {
      healthUnsubscribe();
      healthUnsubscribe = null;
    }
    healthPollerInstance.stop();
    health.value = null;
  }

  function retryHealth() {
    // Manually trigger immediate poll and reset backoff
    healthPollerInstance.stop();
    healthPollerInstance.start();
  }

  // Capability management (T020)
  async function loadCapabilities(): Promise<void> {
    if (capabilityLoading.value) return;
    capabilityLoading.value = true;
    try {
      const profile = await capabilityCache.fetch();
      capabilityProfile.value = profile;
    } catch (err) {
      console.error('Failed to load capability profile:', err);
      capabilityProfile.value = null;
    } finally {
      capabilityLoading.value = false;
    }
  }

  async function refreshCapabilities(): Promise<void> {
    capabilityLoading.value = true;
    try {
      const profile = await capabilityCache.refresh();
      capabilityProfile.value = profile;
    } catch (err) {
      console.error('Failed to refresh capability profile:', err);
    } finally {
      capabilityLoading.value = false;
    }
  }

  function clearCapabilities(): void {
    capabilityCache.clear();
    capabilityProfile.value = null;
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
    activeAgentProfile,
    tasks,
    provenance,
    health,
    healthStatus,
    isHealthy,
    isDegraded,
    isUnhealthy,
    canExecuteRisky,
    healthMessage,
    hasSession,
    activeProvider,
    activeTools,
    pendingCount,
    // Capability exports (T020)
    capabilityProfile,
    capabilityLoading,
    hasCapabilities,
    enabledCapabilities,
    isCapabilityEnabled,
    loadCapabilities,
    refreshCapabilities,
    clearCapabilities,
    // Actions
    createSession,
    sendMessage,
    executeTool,
    runPipeline,
    resolvePendingAction,
    readContextFile,
    refreshTelemetry,
    consumeStreamEvents,
    stopHealthPolling,
    retryHealth,
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
