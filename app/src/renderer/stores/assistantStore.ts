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
  CapabilityProfile,
  GatingStatus
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
import { makeHealthSnapshot, type AssistantTelemetryEvent } from '@shared/assistant/telemetry';
import { createCapabilityCache, isCapabilityEnabled as checkCapabilityEnabled, getEnabledCapabilities } from '@/services/langchain/capabilities';
import { createQueueManager, type QueueManager, type QueueEvent } from '@/services/assistant/queueManager';
import { emitToolLifecycle } from '@/services/assistant/telemetryEmitter';
import { getToolSafety, validateInvocation, updateClassificationFromManifest, resetClassification } from '@/services/assistant/toolClassification';
import { sanitizePrompt } from '@/services/assistant/promptSanitizer';
import { fetchManifest as fetchCapabilityManifest } from '@/services/sidecar/manifest';
// T069: Auto legacy migration trigger
import { ensureLegacyMigration } from '@/services/assistant/migrationAdapter';
import { CONCURRENCY_LIMIT } from '@shared/assistant/constants';
// T054: Error normalization
import { errorNormalizationAdapter } from '@/utils/errorNormalizationAdapter';
import type { NormalizedError } from '@shared/errorNormalization';

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

// NOTE(T003): We intentionally avoid augmenting global ImportMeta type inline to prevent conflicts.
// Access env vars through a typed helper to satisfy TS without polluting global declarations.
function getViteEnvFlag(name: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = (import.meta as any)?.env;
    return env ? env[name] : undefined;
  } catch {
    return undefined;
  }
}

interface ContextReadResult {
  path: string;
  repoRelativePath: string;
  content: string;
  encoding: string;
  size: number;
  lastModified: string;
  truncated: boolean;
}

// T039: Edit suggestion types
export interface EditSuggestion {
  id: string;
  sessionId: string;
  turnIndex: number;
  targetId?: string;
  filePath: string;
  summary: string;
  updatedContent: string;
  status: 'pending' | 'approved' | 'rejected' | 'applying' | 'applied' | 'failed';
  error?: string;
  createdAt: string;
  resolvedAt?: string;
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
  // Extended telemetry events (T013): health snapshots & future non-tool events
  const telemetryEvents = ref<AssistantTelemetryEvent[]>([]);
  const isBusy = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<string | null>(null);
  const contextReadResult = ref<ContextReadResult | null>(null);
  const contextReadError = ref<string | null>(null);
  const activeAgentProfile = ref<AgentProfile | null>(null);
  // T039: Edit suggestions state
  const editSuggestions = ref<EditSuggestion[]>([]);
  // Feature flag (T003): Controls availability of unified assistant UI. Reads from Vite env.
  // NOTE: This flag should be used by renderer components to conditionally render unified assistant.
  // TODO(Unification Cleanup): Remove flag once legacy aiStore is fully removed.
  const flagValue = getViteEnvFlag('VITE_UNIFIED_ASSISTANT_ENABLED');
  const unifiedAssistantEnabled = ref<boolean>(
    Boolean(flagValue) && ['true', '1', 'on', 'yes'].includes(String(flagValue).toLowerCase())
  );

  // Health state (T016)
  const health = ref<NormalisedHealth | null>(null);
  const healthPollerInstance = createHealthPoller({ intervalMs: 10000 });
  let healthUnsubscribe: (() => void) | null = null;
  let lastEmittedHealthStatus: LangChainHealthStatus | null = null; // prevent duplicate emissions

  // Capability cache (T020)
  const capabilityProfile = ref<CapabilityProfile | null>(null);
  const capabilityCache = createCapabilityCache();
  const capabilityLoading = ref(false);

  // Gating status (FR-040)
  const gatingStatus = ref<GatingStatus | null>(null);
  const gatingLoading = ref(false);

  // Sidecar state (Phase 4)
  const sidecarStatus = ref<'stopped' | 'starting' | 'running' | 'error' | 'stopping'>('stopped');
  const sidecarBaseUrl = ref<string | null>(null);
  const sidecarHealthy = ref(false);

  // Queue manager (T012)
  const queueManager: QueueManager = createQueueManager({ concurrency: CONCURRENCY_LIMIT });
  const _queueUnsubscribe = queueManager.on((event: QueueEvent) => {
    // Wire queue events to telemetry
    try {
      const sessionId = session.value?.id;
      if (!sessionId) return;
      if (event.kind === 'task.started') {
        // TODO(T012-Telemetry): Map task metadata to tool invocation telemetry
        console.debug('Queue task started:', event.taskId);
      } else if (event.kind === 'task.finished') {
        console.debug('Queue task finished:', event.taskId, event.status, `${event.durationMs}ms`);
      }
    } catch (err) {
      console.warn('Failed to emit queue telemetry:', err);
    }
  });

  const hasSession = computed(() => Boolean(session.value));
  const activeProvider = computed<AssistantProvider | null>(() => session.value?.provider ?? null);
  const activeTools = computed(() => session.value?.activeTools ?? []);
  const pendingCount = computed(() => pendingApprovals.value.length);
  const activePending = computed<PendingAction | null>(() => {
    if (!activePendingId.value) return null;
    return pendingApprovals.value.find(p => p.id === activePendingId.value) ?? null;
  });
  const isUnifiedAssistantActive = computed(() => unifiedAssistantEnabled.value);

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

  // Gating computed flags
  const isClassificationEnforced = computed(() => Boolean(gatingStatus.value?.classificationEnforced));
  const isSidecarOnly = computed(() => gatingStatus.value?.sidecarOnly !== false); // default true until legacy removed
  const checksumMatch = computed(() => Boolean(gatingStatus.value?.checksumMatch));
  const isRetrievalEnabled = computed(() => Boolean(gatingStatus.value?.retrievalEnabled && checksumMatch.value));
  // Only show read-only mode if we have gating status AND the conditions are met
  const isLimitedReadOnlyMode = computed(() => {
    if (!gatingStatus.value) return false; // Don't show badge if no gating status loaded
    return !isClassificationEnforced.value && isSidecarOnly.value;
  });

  // Sidecar computed flags (Phase 4)
  const isSidecarRunning = computed(() => sidecarStatus.value === 'running');
  const canUseSidecar = computed(() => isSidecarRunning.value && sidecarHealthy.value);

  // T048: Atomic transaction wrapper for multi-step state mutations (FR-031)
  let transactionDepth = 0;
  const pendingUpdates: Array<() => void> = [];

  function beginTransaction() {
    transactionDepth++;
  }

  function commitTransaction() {
    transactionDepth--;
    if (transactionDepth === 0 && pendingUpdates.length > 0) {
      // Apply all pending updates atomically
      pendingUpdates.forEach(update => update());
      pendingUpdates.length = 0;
    }
  }

  function runAtomic<T>(fn: () => T): T {
    beginTransaction();
    try {
      const result = fn();
      commitTransaction();
      return result;
    } catch (err) {
      transactionDepth = 0; // Reset on error
      pendingUpdates.length = 0;
      throw err;
    }
  }

  function applySession(nextSession: AssistantSessionExtended) {
    session.value = nextSession;
    conversation.value = [...nextSession.messages];
    pendingApprovals.value = [...nextSession.pendingApprovals];
    tasks.value = [...(nextSession.tasks || [])];
    provenance.value = nextSession.telemetryContext ? { ...nextSession.telemetryContext } : null;
    lastUpdated.value = nowIso();
  }

  function appendMessage(turn: ConversationTurn) {
    console.log('[Assistant] appendMessage called with:', turn);
    console.log('[Assistant] conversation before:', conversation.value.length);
    conversation.value = [...conversation.value, turn];
    console.log('[Assistant] conversation after:', conversation.value.length);
    if (session.value) {
      session.value = {
        ...session.value,
        messages: conversation.value,
        updatedAt: turn.timestamp
      };
      console.log('[Assistant] session.messages updated:', session.value.messages.length);
    } else {
      console.warn('[Assistant] No session.value when appending message');
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
        // T013: Emit telemetry event when status changes or every poll if degraded/unhealthy persists
        try {
          const statusChanged = snapshot.status !== lastEmittedHealthStatus;
          const forceEmit = snapshot.status === 'unhealthy' || snapshot.status === 'degraded';
          if (statusChanged || forceEmit) {
            const evt = makeHealthSnapshot(session.value?.id, session.value?.provider, snapshot.status, snapshot.message, 10000);
            telemetryEvents.value = [...telemetryEvents.value, evt];
            lastEmittedHealthStatus = snapshot.status;
          }
        } catch (err) {
          console.warn('Failed to emit health snapshot telemetry:', err);
        }
      });
      healthPollerInstance.start();
    }
    
    // Apply agent profile if provided
    const sessionPayload = agentProfile ? applyAgentProfile(payload, agentProfile) : payload;
      // Sanitize system prompt (FR-035)
      if (sessionPayload.systemPrompt) {
        const result = sanitizePrompt(sessionPayload.systemPrompt);
        if (!result.valid) {
          error.value = `System prompt rejected: ${result.reasons.join(', ')}`;
          throw new Error(error.value);
        }
        sessionPayload.systemPrompt = result.sanitized;
      }
    
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

      // Load gating status (FR-040) - non-blocking
      const repoPathForGating = (created.telemetryContext && typeof created.telemetryContext.repoRoot === 'string')
        ? created.telemetryContext.repoRoot as string
        : undefined;
      if (repoPathForGating) {
        loadGatingStatus(repoPathForGating).catch(err => {
          console.warn('Failed to load gating status:', err);
        });
      }

      // AUTO MIGRATION (T069): Perform one-time migration of legacy aiStore data if present.
      // Non-blocking; errors logged but do not affect session creation.
      ensureLegacyMigration({ dryRun: false }).then(results => {
        if (results.length === 0) {
          console.debug('[Migration] No legacy sessions detected - skipped.');
          return;
        }
        const summary = results.map(r => `${r.record.id}:${r.success ? 'ok' : 'fail'}`).join(', ');
        console.info('[Migration] Legacy migration attempted →', summary);
      }).catch(err => {
        console.warn('[Migration] ensureLegacyMigration failed:', err);
      });
    } catch (err: unknown) {
      // T054: Normalize error for consistent shape and telemetry
      const normalized = errorNormalizationAdapter(err);
      error.value = normalized.userMessage;
      // Emit telemetry with errorCode
      // TODO(T054): Add errorCode support to emitToolLifecycle type definition
      if (session.value?.id) {
        emitToolLifecycle({
          sessionId: session.value.id,
          toolId: 'session.create',
          phase: 'failed',
          errorMessage: `[${normalized.code}] ${normalized.message}`
        });
      }
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
      // Sanitize system prompt (FR-035)
      let sanitizedPrompt = systemPrompt;
      if (sanitizedPrompt) {
        const result = sanitizePrompt(sanitizedPrompt);
        if (!result.valid) {
          throw new Error(`Agent system prompt rejected: ${result.reasons.join(', ')}`);
        }
        sanitizedPrompt = result.sanitized;
      }
    
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
      systemPrompt: sanitizedPrompt,
      activeTools: activeTools || payload.activeTools,
      ...config
    };
  }

  async function sendMessage(id: string, payload: SendMessagePayload & { mode?: 'general' | 'improvement' | 'clarification'; }) {
    const bridge = assertAssistantBridge();
    if (!session.value) {
      throw new Error('No active assistant session. Create a session before sending messages.');
    }

    // T016: When service unhealthy, allow queuing non-tool user messages with degraded flag instead of hard-blocking.
    // This preserves UX continuity; responses will be attempted once service recovers.
    const degraded = !canExecuteRisky.value;
    if (degraded) {
      console.warn('[Assistant] Service unhealthy; queuing user message for deferred processing.');
    }

    isBusy.value = true;
    error.value = null;
    const timestamp = nowIso();
    appendMessage({
      role: 'user',
      content: payload.content,
      timestamp,
      metadata: {
        ...(payload.attachments ? { attachments: payload.attachments } : {}),
        ...(degraded ? { queuedDueToHealth: true } : {})
      }
    });

    try {
      if (degraded) {
        // Queue logic: we do not attempt immediate send; return null envelope.
        // TODO(T016-Retry): Implement health-based retry queue for deferred messages.
        lastUpdated.value = nowIso();
        return null as any as TaskEnvelope; // placeholder; UI can display queued status.
      }
      const envelope = await bridge.sendMessage(session.value.id, payload);
      console.log('[Assistant] sendMessage response:', envelope);
      
      if (envelope) {
        // T048: Use atomic transaction for multi-step state update (task + message append)
        runAtomic(() => {
          // TODO(T012): MessageResponse may not have TaskEnvelope structure yet.
          // Cast to TaskEnvelope only if the response structure matches.
          const taskEnvelope = envelope as unknown as TaskEnvelope;
          
          console.log('[Assistant] TaskEnvelope:', {
            hasTaskId: !!taskEnvelope.taskId,
            hasOutputs: !!taskEnvelope.outputs,
            outputsLength: Array.isArray(taskEnvelope.outputs) ? taskEnvelope.outputs.length : 0,
            firstOutput: Array.isArray(taskEnvelope.outputs) && taskEnvelope.outputs.length > 0 ? taskEnvelope.outputs[0] : null
          });
          
          // Only add to tasks if it has the expected TaskEnvelope structure
          if (taskEnvelope.taskId) {
            tasks.value = [...tasks.value, taskEnvelope];
          }
          
          // Extract assistant response - handle both MessageResponse and TaskEnvelope formats
          // TODO(T012): Align MessageResponse type definition with actual response structure
          const outputs = (taskEnvelope as any)?.outputs;
          if (outputs && Array.isArray(outputs) && outputs.length > 0) {
            console.log('[Assistant] Processing outputs:', outputs);
            const output = outputs[0];
            // Check multiple possible formats
            if (output.type === 'text' && typeof output.content === 'string') {
              console.log('[Assistant] Adding text message from output.content:', output.content);
              appendMessage({
                role: 'assistant',
                content: output.content,
                timestamp: output.timestamp || nowIso(),
                metadata: { taskId: taskEnvelope.taskId }
              });
            } else if (typeof output.text === 'string') {
              // Alternative format: { text: string }
              console.log('[Assistant] Adding text message from output.text:', output.text);
              appendMessage({
                role: 'assistant',
                content: output.text,
                timestamp: output.timestamp || nowIso(),
                metadata: { taskId: taskEnvelope.taskId }
              });
            } else if (typeof output === 'string') {
              // Direct string format
              console.log('[Assistant] Adding text message from direct string:', output);
              appendMessage({
                role: 'assistant',
                content: output,
                timestamp: nowIso(),
                metadata: { taskId: taskEnvelope.taskId }
              });
            } else {
              console.warn('[Assistant] Unknown output format:', output);
            }
          } else {
            console.warn('[Assistant] No outputs or invalid outputs array in response');
          }
          // TODO(StreamMerge T012): merge streaming updates into tasks
          
          lastUpdated.value = nowIso();
        });
      }
      return envelope;
    } catch (err: unknown) {
      // T054: Normalize error for consistent shape and telemetry
      const normalized = errorNormalizationAdapter(err);
      error.value = normalized.userMessage;
      // Emit telemetry with errorCode
      // TODO(T054): Add errorCode support to emitToolLifecycle type definition
      if (session.value?.id) {
        emitToolLifecycle({
          sessionId: session.value.id,
          toolId: 'message.send',
          phase: 'failed',
          errorMessage: `[${normalized.code}] ${normalized.message}`
        });
      }
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

      // Tool safety classification enforcement (FR-032)
      const safetyClass = getToolSafety(payload.toolId);
      if (safetyClass === 'mutating' || safetyClass === 'destructive') {
        // Approval gating: must have explicit approval in payload
        const approvalProvided = !!payload.parameters?.approval;
        const reasonRaw = payload.parameters?.reason;
        const reason = typeof reasonRaw === 'string' ? reasonRaw : undefined;
        try {
          validateInvocation(payload.toolId, approvalProvided, reason, {
            gating: gatingStatus.value ?? null,
            reasonMinLength: 8
          });
        } catch (err) {
          error.value = err instanceof Error ? err.message : String(err);
          throw err;
        }
      }

    // T012: Enqueue tool execution through queue manager
    const task = queueManager.enqueue('tool', async () => {
      isBusy.value = true;
      error.value = null;
      const sessionId = session.value!.id;
      console.log('[assistantStore.executeTool] Using sessionId:', sessionId, 'from session:', session.value);
      const startTime = Date.now();
      
      try {
        // Emit tool.invoked telemetry
        emitToolLifecycle({
          sessionId,
          toolId: payload.toolId,
          phase: 'invoked',
          repoPath: payload.repoPath,
          parameters: payload.parameters
        });

        console.log('[assistantStore.executeTool] Calling bridge.executeTool with sessionId:', sessionId);
        const result: ToolExecutionResponse = await bridge.executeTool(sessionId, payload);
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
          // Emit tool.failed telemetry
          emitToolLifecycle({
            sessionId,
            toolId: payload.toolId,
            phase: 'failed',
            errorMessage: result.error,
            durationMs: Date.now() - startTime
          });
        } else {
          // Emit tool.completed telemetry
          emitToolLifecycle({
            sessionId,
            toolId: payload.toolId,
            phase: 'completed',
            durationMs: Date.now() - startTime
          });
        }
        lastUpdated.value = nowIso();
        return result;
      } catch (err: unknown) {
        // T054: Normalize error for consistent shape and telemetry
        const normalized = errorNormalizationAdapter(err);
        error.value = normalized.userMessage;
        // Emit tool.failed telemetry with errorCode
        // TODO(T054): Add errorCode support to emitToolLifecycle type definition
        emitToolLifecycle({
          sessionId,
          toolId: payload.toolId,
          phase: 'failed',
          errorMessage: `[${normalized.code}] ${normalized.message}`,
          durationMs: Date.now() - startTime
        });
        throw err;
      } finally {
        isBusy.value = false;
      }
    }, { toolId: payload.toolId, repoPath: payload.repoPath });

    return task.action();
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

    // T012: Enqueue pipeline execution through queue manager
    const task = queueManager.enqueue('pipeline', async () => {
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
        // Refresh gating status after pipeline runs that could mutate embeddings (TODO: restrict to embeddings pipeline once added)
        loadGatingStatus(options.repoPath).catch(err => console.warn('Gating status refresh failed:', err));
        return response;
      } catch (err: unknown) {
        // T054: Normalize error for consistent shape and telemetry
        const normalized = errorNormalizationAdapter(err);
        error.value = normalized.userMessage;
        // Emit telemetry with errorCode
        // TODO(T054): Add errorCode support to emitToolLifecycle type definition
        if (session.value?.id) {
          emitToolLifecycle({
            sessionId: session.value.id,
            toolId: PIPELINE_TOOL_ID,
            phase: 'failed',
            errorMessage: `[${normalized.code}] ${normalized.message}`
          });
        }
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
    }, { pipeline: options.pipeline, repoPath: options.repoPath });

    return task.action();
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
      // T054: Normalize error for consistent shape and telemetry
      const normalized = errorNormalizationAdapter(err);
      error.value = normalized.userMessage;
      if (!contextReadError.value) {
        contextReadError.value = normalized.userMessage;
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
      
      // T048: Use atomic transaction for multi-step state update
      runAtomic(() => {
        pendingApprovals.value = pendingApprovals.value
          .filter(item => item.id !== actionId)
          .concat(action.approvalState === 'pending' ? [action] : []);
        lastUpdated.value = nowIso();
      });
      
      return action;
    } catch (err: unknown) {
      // T054: Normalize error for consistent shape and telemetry
      const normalized = errorNormalizationAdapter(err);
      error.value = normalized.userMessage;
      throw err;
    } finally {
      isBusy.value = false;
    }
  }

  async function approvePending(
    actionId: string, 
    notes?: string,
    metadata?: ResolvePendingActionPayload['metadata']
  ) {
    return resolvePendingAction(actionId, { decision: 'approve', notes, metadata });
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
      // T054: Normalize error for consistent shape and telemetry
      const normalized = errorNormalizationAdapter(err);
      error.value = normalized.userMessage;
      console.warn('Telemetry refresh failed:', normalized.message);
    }
  }

  function consumeStreamEvents() {
    const bridge = assertAssistantBridge();
    return bridge.onStreamEvent((payload: unknown) => {
      // T012: Merge streaming TaskEnvelope chunks.
      // Expected payload shape (proposed): { taskId, type: 'chunk'|'error'|'complete', content?, metadata? }
      // Fallback to logging if structure unknown.
      try {
        if (!payload || typeof payload !== 'object') {
          console.debug('Stream payload not object:', payload);
          return;
        }
        const data = payload as Record<string, unknown>;
        const taskId = typeof data.taskId === 'string' ? data.taskId : undefined;
        if (!taskId) {
          console.debug('Stream payload missing taskId:', payload);
          return;
        }
        const type = typeof data.type === 'string' ? data.type : undefined;
        const chunkContent = data.content;
        mergeStreamingTask(taskId, type, chunkContent, data);
      } catch (err) {
        console.warn('Stream merge failed:', err);
      }
    });
  }

  function reset() {
    session.value = null;
    conversation.value = [];
    pendingApprovals.value = [];
    telemetry.value = [];
    telemetryEvents.value = [];
    error.value = null;
    lastUpdated.value = null;
    contextReadResult.value = null;
    contextReadError.value = null;
    activeAgentProfile.value = null;
    tasks.value = [];
    provenance.value = null;
    editSuggestions.value = []; // T039: Clear edit suggestions
  }

  function getQueueSnapshot() {
    return queueManager.getSnapshot();
  }

  function setQueueConcurrency(limit: number) {
    queueManager.setConcurrency(limit);
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

  async function synchroniseToolClassification(forceRefresh = false): Promise<void> {
    try {
      const { index } = await fetchCapabilityManifest({ forceRefresh });
      updateClassificationFromManifest(index);
    } catch (err) {
      console.warn('Failed to synchronise tool classification from manifest:', err);
      resetClassification();
    }
  }

  // Capability management (T020)
  async function loadCapabilities(): Promise<void> {
    if (capabilityLoading.value) return;
    capabilityLoading.value = true;
    try {
      const profile = await capabilityCache.fetch();
      capabilityProfile.value = profile;
      await synchroniseToolClassification();
    } catch (err) {
      console.error('Failed to load capability profile:', err);
      capabilityProfile.value = null;
      resetClassification();
    } finally {
      capabilityLoading.value = false;
    }
  }

  // Gating status loader (FR-040)
  // TODO(GatingPeriodicRefresh): Add background polling to refresh gating status every N seconds when sidecar active.
  // TODO(GatingIntegration T028C): Call after embeddings pipeline completes to pick up checksumMatch=true updates.
  // TODO(GatingRepoPath): Integrate with contextStore to auto-detect active repo path when unified.
  async function loadGatingStatus(repoPath?: string): Promise<void> {
    if (!repoPath) {
      // TODO(GatingRepoPath): Accept active repo path from contextStore once unified
      return;
    }
    if (gatingLoading.value) return;
    gatingLoading.value = true;
    try {
      const bridge = assertAssistantBridge();
      const status = await bridge.getGatingStatus(repoPath);
      gatingStatus.value = status;
    } catch (err) {
      console.warn('Failed to load gating status:', err);
      gatingStatus.value = {
        classificationEnforced: false,
        sidecarOnly: true,
        checksumMatch: false,
        retrievalEnabled: false,
        updatedAt: nowIso(),
        source: 'fallback-load-error',
        version: '0.1.0'
      };
    } finally {
      gatingLoading.value = false;
    }
  }

  async function refreshCapabilities(): Promise<void> {
    capabilityLoading.value = true;
    try {
      const profile = await capabilityCache.refresh();
      capabilityProfile.value = profile;
      await synchroniseToolClassification(true);
    } catch (err) {
      console.error('Failed to refresh capability profile:', err);
      resetClassification();
    } finally {
      capabilityLoading.value = false;
    }
  }

  function clearCapabilities(): void {
    capabilityCache.clear();
    capabilityProfile.value = null;
    resetClassification();
  }

  // T039: Edit suggestion workflow
  function addEditSuggestion(params: {
    turnIndex: number;
    targetId?: string;
    filePath: string;
    summary: string;
    updatedContent: string;
  }): EditSuggestion {
    if (!session.value) {
      throw new Error('Cannot add edit suggestion without active session');
    }

    const edit: EditSuggestion = {
      id: crypto.randomUUID(),
      sessionId: session.value.id,
      turnIndex: params.turnIndex,
      targetId: params.targetId,
      filePath: params.filePath,
      summary: params.summary,
      updatedContent: params.updatedContent,
      status: 'pending',
      createdAt: nowIso()
    };

    editSuggestions.value.push(edit);
    return edit;
  }

  async function approveEditSuggestion(editId: string): Promise<void> {
    const edit = editSuggestions.value.find(e => e.id === editId);
    if (!edit) {
      throw new Error(`Edit suggestion not found: ${editId}`);
    }

    if (edit.status !== 'pending') {
      throw new Error(`Edit suggestion already processed: ${edit.status}`);
    }

    // Update status to approved - application will happen separately
    edit.status = 'approved';
    edit.resolvedAt = nowIso();
  }

  async function rejectEditSuggestion(editId: string): Promise<void> {
    const edit = editSuggestions.value.find(e => e.id === editId);
    if (!edit) {
      throw new Error(`Edit suggestion not found: ${editId}`);
    }

    if (edit.status !== 'pending') {
      throw new Error(`Edit suggestion already processed: ${edit.status}`);
    }

    edit.status = 'rejected';
    edit.resolvedAt = nowIso();
  }

  async function applyEditSuggestion(editId: string): Promise<void> {
    const edit = editSuggestions.value.find(e => e.id === editId);
    if (!edit) {
      throw new Error(`Edit suggestion not found: ${editId}`);
    }

    if (edit.status !== 'approved') {
      throw new Error(`Edit must be approved before applying: ${edit.status}`);
    }

    try {
      edit.status = 'applying';
      
      // TODO: Implement actual file write through IPC
      // This would call something like: await window.api.fs.writeFile(edit.filePath, edit.updatedContent)
      console.log('TODO: Apply edit to file:', edit.filePath);
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      edit.status = 'applied';
    } catch (err) {
      edit.status = 'failed';
      edit.error = err instanceof Error ? err.message : 'Failed to apply edit';
      throw err;
    }
  }

  async function applyAllApprovedEdits(): Promise<void> {
    const approvedEdits = editSuggestions.value.filter(e => e.status === 'approved');
    
    for (const edit of approvedEdits) {
      try {
        await applyEditSuggestion(edit.id);
      } catch (err) {
        console.error(`Failed to apply edit ${edit.id}:`, err);
        // Continue with other edits even if one fails
      }
    }
  }

  function clearEditSuggestions(): void {
    editSuggestions.value = [];
  }

  function getEditSuggestionsByTurn(turnIndex: number): EditSuggestion[] {
    return editSuggestions.value.filter(e => e.turnIndex === turnIndex);
  }

  function getPendingEditSuggestions(): EditSuggestion[] {
    return editSuggestions.value.filter(e => e.status === 'pending');
  }

  // Sidecar management (Phase 4)
  
  /**
   * Get sidecar configuration from dedicated sidecar config file.
   * Falls back to legacy AI settings if sidecar config doesn't exist.
   */
  async function getSidecarConfig(repoPath?: string) {
    try {
      const path = repoPath || (typeof window !== 'undefined' && window.api ? 
        await window.api.app.getDefaultRepoPath().then(r => r.path) : undefined);
      
      if (!path) {
        // Fallback to default Ollama config
        return {
          provider: 'ollama' as const,
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        };
      }
      
      // Try to load sidecar-specific config first
      try {
        const sidecarConfigResult = await window.api.fs.readFile(`${path}/.context-kit/sidecar-config.json`);
        if (sidecarConfigResult.ok && sidecarConfigResult.content) {
          const config = JSON.parse(sidecarConfigResult.content);
          const provider = config.provider || 'ollama';
          
          // Fetch API key if using Azure OpenAI
          let apiKey: string | undefined;
          if (provider === 'azure-openai') {
            try {
              const credResult = await window.api.ai.getCredentials('sidecar-' + provider);
              apiKey = credResult.hasCredentials ? 'STORED' : undefined;
            } catch (err) {
              console.warn('Failed to check sidecar API key:', err);
            }
          }
          
          return {
            provider: provider,
            endpoint: config.endpoint || 'http://localhost:11434',
            model: config.model || 'llama2',
            apiKey: apiKey,
            apiVersion: config.apiVersion || '2024-02-15-preview',
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens,
          };
        }
      } catch {
        console.log('No sidecar config found, falling back to legacy AI settings');
      }
      
      // Fallback to legacy AI config
      const result = await window.api.ai.getConfig(path);
      
      if (result.ok && result.config) {
        const provider = result.config.provider || 'ollama';
        
        // Fetch API key if using Azure OpenAI
        let apiKey: string | undefined;
        if (provider === 'azure-openai') {
          try {
            const credResult = await window.api.ai.getCredentials(provider);
            apiKey = credResult.hasCredentials ? 'STORED' : undefined;
          } catch (err) {
            console.warn('Failed to check API key:', err);
          }
        }
        
        return {
          provider: provider,
          endpoint: result.config.endpoint || 'http://localhost:11434',
          model: result.config.model || 'llama2',
          apiKey: apiKey,
          apiVersion: result.config.apiVersion || '2024-02-15-preview',
          temperature: result.config.temperature || 0.7,
          maxTokens: result.config.maxTokens,
        };
      }
      
      // Final fallback to defaults
      return {
        provider: 'ollama' as const,
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        temperature: 0.7,
      };
    } catch (err) {
      console.warn('Failed to load sidecar config, using defaults:', err);
      return {
        provider: 'ollama' as const,
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        temperature: 0.7,
      };
    }
  }
  
  /**
   * Validate sidecar configuration before starting.
   * Checks endpoint reachability, API key presence, etc.
   */
  async function validateSidecarConfig() {
    try {
      const config = await getSidecarConfig();
      const errors: string[] = [];
      
      // Validate endpoint URL format
      try {
        new URL(config.endpoint);
      } catch {
        errors.push('Invalid endpoint URL format');
        return { valid: false, errors, config };
      }
      
      // Check if model is specified
      if (!config.model || config.model.trim() === '') {
        errors.push('Model name is required');
      }
      
      // For Azure OpenAI, check API key
      if (config.provider === 'azure-openai') {
        if (!config.apiKey) {
          errors.push('API key is required for Azure OpenAI. Please configure it in AI Settings.');
        }
      }
      
      // For Ollama, try to verify endpoint is reachable
      if (config.provider === 'ollama') {
        try {
          // Simple health check - try to fetch the endpoint
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch(config.endpoint, {
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (!response.ok && response.status !== 404) {
            // 404 is acceptable - it means server is running but endpoint doesn't exist
            errors.push(`Ollama endpoint returned status ${response.status}`);
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            errors.push('Ollama endpoint timeout. Make sure Ollama is running.');
          } else {
            errors.push('Failed to reach Ollama endpoint. Make sure Ollama is running.');
          }
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        config
      };
    } catch (err) {
      return {
        valid: false,
        errors: ['Failed to load configuration: ' + (err instanceof Error ? err.message : 'Unknown error')],
        config: null
      };
    }
  }
  
  async function startSidecar() {
    try {
      sidecarStatus.value = 'starting';
      
      // Validate config before starting
      const validation = await validateSidecarConfig();
      if (!validation.valid) {
        sidecarStatus.value = 'error';
        error.value = 'Configuration validation failed:\n' + validation.errors.join('\n');
        return;
      }
      
      const result = await window.api.sidecar.start();
      if (result.success) {
        sidecarStatus.value = 'running';
        sidecarBaseUrl.value = result.baseUrl || null;
        await checkSidecarHealth();
      } else {
        sidecarStatus.value = 'error';
        error.value = result.error || 'Failed to start sidecar';
      }
    } catch (err) {
      console.error('Failed to start sidecar:', err);
      sidecarStatus.value = 'error';
      error.value = err instanceof Error ? err.message : 'Failed to start sidecar';
    }
  }

  async function stopSidecar() {
    try {
      sidecarStatus.value = 'stopping';
      await window.api.sidecar.stop();
      sidecarStatus.value = 'stopped';
      sidecarBaseUrl.value = null;
      sidecarHealthy.value = false;
    } catch (err) {
      console.error('Failed to stop sidecar:', err);
      error.value = err instanceof Error ? err.message : 'Failed to stop sidecar';
    }
  }

  async function checkSidecarHealth() {
    try {
      const result = await window.api.sidecar.health();
      sidecarHealthy.value = result.healthy;
    } catch {
      sidecarHealthy.value = false;
    }
  }

  return {
    session,
    conversation,
    pendingApprovals,
    telemetry,
    telemetryEvents,
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
    unifiedAssistantEnabled,
    isUnifiedAssistantActive,
    hasSession,
    activeProvider,
    activeTools,
    pendingCount,
    // T039: Edit suggestions exports
    editSuggestions,
    addEditSuggestion,
    approveEditSuggestion,
    rejectEditSuggestion,
    applyEditSuggestion,
    applyAllApprovedEdits,
    clearEditSuggestions,
    getEditSuggestionsByTurn,
    getPendingEditSuggestions,
    // Capability exports (T020)
    capabilityProfile,
    capabilityLoading,
    hasCapabilities,
    enabledCapabilities,
    isCapabilityEnabled,
    loadCapabilities,
    refreshCapabilities,
    clearCapabilities,
    // Gating status exports
    gatingStatus,
    gatingLoading,
    loadGatingStatus,
    isClassificationEnforced,
    isSidecarOnly,
    checksumMatch,
    isRetrievalEnabled,
    isLimitedReadOnlyMode,
    // Sidecar exports (Phase 4)
    sidecarStatus,
    sidecarBaseUrl,
    sidecarHealthy,
    isSidecarRunning,
    canUseSidecar,
    getSidecarConfig,
    validateSidecarConfig,
    startSidecar,
    stopSidecar,
    checkSidecarHealth,
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
    reset,
    // Queue management (T012)
    getQueueSnapshot,
    setQueueConcurrency,
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

// T012: Helper to merge streaming updates into tasks list.
function mergeStreamingTask(taskId: string, eventType: string | undefined, chunkContent: unknown, _data: Record<string, unknown>) {
  // Access store instance directly - called from within store context
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = require('./assistantStore') as { useAssistantStore: typeof useAssistantStore };
  const s = store.useAssistantStore();
  const tasks = s.tasks as unknown as { value: TaskEnvelope[] };
  const existingIndex = tasks.value.findIndex(t => t.taskId === taskId);
  const now = new Date().toISOString();

  if (existingIndex === -1) {
    // Create new streaming task envelope.
    const envelope: TaskEnvelope = {
      taskId,
      status: eventType === 'error' ? 'failed' : eventType === 'complete' ? 'succeeded' : 'streaming',
      actionType: 'prompt', // TODO(T012-ActionType): derive from payload metadata when available
      outputs: chunkContent ? [{ chunk: chunkContent }] : [],
      timestamps: { created: now, firstResponse: chunkContent ? now : undefined, completed: eventType === 'complete' || eventType === 'error' ? now : undefined }
    };
    tasks.value = [...tasks.value, envelope];
    return;
  }

  const current = tasks.value[existingIndex];
  const outputs = [...current.outputs];
  if (chunkContent) {
    outputs.push({ chunk: chunkContent });
  }
  const updated: TaskEnvelope = {
    ...current,
    status: eventType === 'error' ? 'failed' : eventType === 'complete' ? 'succeeded' : current.status,
    outputs,
    timestamps: {
      created: current.timestamps?.created || now,
      firstResponse: current.timestamps?.firstResponse || (chunkContent ? now : undefined),
      completed: eventType === 'complete' || eventType === 'error' ? now : current.timestamps?.completed
    }
  };
  tasks.value = tasks.value.map(t => (t.taskId === taskId ? updated : t));
}

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
