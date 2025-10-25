import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useContextStore } from './contextStore';

type AssistantMode = 'improvement' | 'clarification' | 'general';

interface AssistantSuggestion {
  target: string;
  suggestion: string;
  impact?: string;
}

interface AssistantReference {
  type: string;
  id: string;
  note?: string;
}

interface AssistantEdit {
  targetId?: string;
  filePath: string;
  summary: string;
  updatedContent: string;
  status?: 'pending' | 'applying' | 'applied' | 'failed';
  error?: string;
}

interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  mode: AssistantMode;
  focusId?: string;
  suggestions?: AssistantSuggestion[];
  clarifications?: string[];
  followUps?: string[];
  references?: AssistantReference[];
  edits?: AssistantEdit[];
}

interface AssistantUsage {
  timestamp: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface AskOptions {
  mode: AssistantMode;
  focusId?: string;
}

interface SnapshotPrinciple {
  id?: string;
  title?: string;
  nonNegotiable: boolean;
  appliesTo: string[];
}

interface SnapshotGovernance {
  id: string;
  name: string;
  status: string;
  version: string;
  principles: SnapshotPrinciple[];
  complianceRules: Record<string, unknown>[];
}

interface SnapshotFeatureLink {
  id: string;
  title: string;
  status: string;
  owner?: string;
  type?: string;
}

interface SnapshotFeature {
  id: string;
  title: string;
  status: string;
  domain: string;
  objective: string;
  userStories: string[];
  specs: string[];
  tasks: string[];
  requires: string[];
  linkedUserStories: SnapshotFeatureLink[];
  linkedSpecs: SnapshotFeatureLink[];
  linkedTasks: SnapshotFeatureLink[];
}

interface SnapshotUserStory {
  id: string;
  title: string;
  status: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
}

interface SnapshotSpec {
  id: string;
  title: string;
  status: string;
  type: string;
  related: Record<string, unknown>;
}

interface SnapshotTask {
  id: string;
  title: string;
  status: string;
  owner: string;
  doneCriteria: string[];
  acceptanceCriteria: string[];
}

interface SnapshotService {
  id: string;
  name: string;
  status: string;
  dependencies: string[];
  consumers: string[];
}

interface SnapshotPackage {
  id: string;
  name: string;
  status: string;
  uses: Record<string, unknown>;
}

interface SnapshotParseError {
  _file: string;
  parseError: string;
  id: string;
  _type: string;
}

interface AssistantSnapshot {
  generatedAt: string;
  totals: {
    features: number;
    userStories: number;
    specs: number;
    tasks: number;
    services: number;
    packages: number;
    governance: number;
  };
  governance: SnapshotGovernance[];
  features: SnapshotFeature[];
  userStories: SnapshotUserStory[];
  specs: SnapshotSpec[];
  tasks: SnapshotTask[];
  services: SnapshotService[];
  packages: SnapshotPackage[];
  parseErrors: SnapshotParseError[];
}

interface AssistantUsageSummary {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface AssistantResponse {
  ok: boolean;
  answer?: string;
  improvements?: AssistantSuggestion[];
  clarifications?: string[];
  followUps?: string[];
  references?: AssistantReference[];
  usage?: AssistantUsageSummary;
  snapshot?: AssistantSnapshot;
  error?: string;
  rawContent?: string;
  edits?: AssistantEdit[];
}

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export const useAIStore = defineStore('ai', () => {
  const contextStore = useContextStore();

  const conversation = ref<AssistantMessage[]>([]);
  const lastSnapshot = ref<AssistantSnapshot | null>(null);
  const usageHistory = ref<AssistantUsage[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isInitialized = ref(false);
  const isEnabled = ref(false);
  const activeStreamId = ref<string | null>(null);

  const hasConversation = computed(() => conversation.value.length > 0);

  async function initialize() {
    if (isInitialized.value) {
      return;
    }

    await contextStore.initializeStore();

    try {
      const result = await window.api.ai.getConfig(contextStore.repoPath);
      if (result.ok && result.config) {
        isEnabled.value = Boolean(result.config.enabled);
      } else {
        isEnabled.value = false;
      }
    } catch {
      isEnabled.value = false;
    }

    isInitialized.value = true;
  }

  function appendMessage(message: AssistantMessage) {
    conversation.value.push(message);
  }

  function updateAssistantMessage(messageId: string, payload: Partial<AssistantMessage>) {
    const index = conversation.value.findIndex(item => item.id === messageId);
    if (index >= 0) {
      conversation.value[index] = {
        ...conversation.value[index],
        ...payload
      };
    }
  }

  function recordUsage(usage?: AssistantUsageSummary) {
    if (!usage) {
      return;
    }

    usageHistory.value.push({
      timestamp: new Date().toISOString(),
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0)
    });
  }

  function findLatestAssistantWithPendingEdits() {
    for (let i = conversation.value.length - 1; i >= 0; i -= 1) {
      const message = conversation.value[i];
      if (message.role !== 'assistant') {
        continue;
      }
      if (!message.edits || message.edits.length === 0) {
        continue;
      }
      const hasPending = message.edits.some(edit => edit.status === 'pending' || edit.status === 'failed');
      if (hasPending) {
        return message;
      }
    }
    return null;
  }

  async function handleLocalCommand(rawCommand: string, options: AskOptions): Promise<boolean> {
    const normalized = rawCommand.toLowerCase();
    const applyPattern = /^(apply|accept)(?:\s+all)?\s+(?:the\s+)?(edits|changes)$/;

    if (!applyPattern.test(normalized)) {
      return false;
    }

    const userMessageId = generateId('user');
    appendMessage({
      id: userMessageId,
      role: 'user',
      content: rawCommand,
      createdAt: new Date().toISOString(),
      mode: options.mode,
      focusId: options.focusId,
      suggestions: [],
      clarifications: [],
      followUps: [],
      references: [],
      edits: []
    });

    const targetAssistant = findLatestAssistantWithPendingEdits();

    if (!targetAssistant) {
      const assistantMessageId = generateId('assistant');
      appendMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: 'There are no pending edits to apply right now.',
        createdAt: new Date().toISOString(),
        mode: options.mode,
        focusId: options.focusId,
        suggestions: [],
        clarifications: [],
        followUps: [],
        references: [],
        edits: []
      });
      return true;
    }

    const pendingIndexes = targetAssistant.edits
      ?.map((edit, index) => ({ edit, index }))
      .filter(item => item.edit.status === 'pending' || item.edit.status === 'failed') ?? [];

    if (pendingIndexes.length === 0) {
      const assistantMessageId = generateId('assistant');
      appendMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: 'All suggested edits have already been applied.',
        createdAt: new Date().toISOString(),
        mode: options.mode,
        focusId: options.focusId,
        suggestions: [],
        clarifications: [],
        followUps: [],
        references: [],
        edits: []
      });
      return true;
    }

    const summaryMessageId = generateId('assistant');
    appendMessage({
      id: summaryMessageId,
      role: 'assistant',
      content: `Applying ${pendingIndexes.length} pending edit(s)...`,
      createdAt: new Date().toISOString(),
      mode: options.mode,
      focusId: options.focusId,
      suggestions: [],
      clarifications: [],
      followUps: [],
      references: [],
      edits: []
    });

    for (const { index } of pendingIndexes) {
      // eslint-disable-next-line no-await-in-loop -- Applying edits sequentially to avoid conflicting writes.
      await applyEdit(targetAssistant.id, index);
    }

    const refreshedAssistant = conversation.value.find(message => message.id === targetAssistant.id);
    const attemptedIndexes = new Set(pendingIndexes.map(item => item.index));
    const appliedCount = refreshedAssistant?.edits
      ?.filter((edit, idx) => attemptedIndexes.has(idx) && edit.status === 'applied').length ?? 0;
    const failedCount = refreshedAssistant?.edits
      ?.filter((edit, idx) => attemptedIndexes.has(idx) && edit.status === 'failed').length ?? 0;
    const stillPending = refreshedAssistant?.edits
      ?.some((edit, idx) => attemptedIndexes.has(idx) && edit.status === 'pending') ?? false;

    let summary = `Finished applying edits. Applied ${appliedCount} item(s)`;
    if (failedCount > 0) {
      summary += `, ${failedCount} failed`;
    }
    summary += '.';
    if (stillPending) {
      summary += ' Some edits remain pending.';
    }

    updateAssistantMessage(summaryMessageId, {
      content: summary
    });

    return true;
  }

  async function ask(question: string, options: AskOptions) {
    await initialize();

    if (!question.trim()) {
      error.value = 'Please enter a question for the assistant.';
      return;
    }

    if (!isEnabled.value) {
      error.value = 'AI assistance is disabled. Enable it in AI settings to continue.';
      return;
    }

    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'Context repository path is not set. Configure a repository before using the assistant.';
      return;
    }

    const trimmedQuestion = question.trim();
    error.value = null;

    const handledLocally = await handleLocalCommand(trimmedQuestion, options);
    if (handledLocally) {
      return;
    }

    isLoading.value = true;
    const userMessageId = generateId('user');
    const assistantMessageId = generateId('assistant');

    appendMessage({
      id: userMessageId,
      role: 'user',
      content: trimmedQuestion,
      createdAt: new Date().toISOString(),
      mode: options.mode,
      focusId: options.focusId,
      edits: []
    });

    appendMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: 'Thinking...'
        + (options.mode === 'improvement' ? ' Generating improvement suggestions.' : ' Drafting a response.'),
      createdAt: new Date().toISOString(),
      mode: options.mode,
      focusId: options.focusId,
      suggestions: [],
      clarifications: [],
      followUps: [],
      references: [],
      edits: []
    });

    try {
      const result = await window.api.ai.assist(repoPath, trimmedQuestion, options.mode, options.focusId) as AssistantResponse;

      if (!result.ok) {
        error.value = result.error || 'Assistant request failed.';
        updateAssistantMessage(assistantMessageId, {
          content: result.error || 'Assistant request failed.',
          suggestions: [],
          clarifications: result.error ? [result.error] : [],
          followUps: [],
          references: [],
          edits: []
        });
        return;
      }

      lastSnapshot.value = result.snapshot ?? null;
      recordUsage(result.usage);

      updateAssistantMessage(assistantMessageId, {
        content: result.answer || 'No direct answer returned.',
        suggestions: Array.isArray(result.improvements) ? result.improvements : [],
        clarifications: Array.isArray(result.clarifications) ? result.clarifications : [],
        followUps: Array.isArray(result.followUps) ? result.followUps : [],
        references: Array.isArray(result.references) ? result.references : [],
        edits: Array.isArray(result.edits)
          ? result.edits.map(edit => ({
              ...edit,
              status: 'pending'
            }))
          : []
      });
    } catch (err: any) {
      const message = err?.message || 'Assistant request failed. Please check the console for details.';
      error.value = message;
      updateAssistantMessage(assistantMessageId, {
        content: message,
        suggestions: [],
        clarifications: [message],
        followUps: [],
        references: [],
        edits: []
      });
    } finally {
      isLoading.value = false;
    }
  }

  async function askStream(question: string, options: AskOptions) {
    await initialize();

    if (!question.trim()) {
      error.value = 'Please enter a question for the assistant.';
      return;
    }

    if (!isEnabled.value) {
      error.value = 'AI assistance is disabled. Enable it in AI settings to continue.';
      return;
    }

    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'Context repository path is not set. Configure a repository before using the assistant.';
      return;
    }

    const trimmedQuestion = question.trim();
    error.value = null;

    const handledLocally = await handleLocalCommand(trimmedQuestion, options);
    if (handledLocally) {
      return;
    }

    isLoading.value = true;
    const userMessageId = generateId('user');
    const assistantMessageId = generateId('assistant');

    appendMessage({
      id: userMessageId,
      role: 'user',
      content: trimmedQuestion,
      createdAt: new Date().toISOString(),
      mode: options.mode,
      focusId: options.focusId,
      edits: []
    });

    appendMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      mode: options.mode,
      focusId: options.focusId,
      suggestions: [],
      clarifications: [],
      followUps: [],
      references: [],
      edits: []
    });

    try {
      const startRes = await window.api.ai.assistStreamStart(repoPath, trimmedQuestion, options.mode, options.focusId);
      if (!startRes.ok || !startRes.streamId) {
        throw new Error(startRes.error || 'Failed to start streaming');
      }
      activeStreamId.value = startRes.streamId;
      const offEvent = window.api.ai.onAssistStreamEvent((payload: any) => {
        if (payload.streamId !== activeStreamId.value) return;
        if (payload.type === 'delta' && typeof payload.data === 'string') {
          updateAssistantMessage(assistantMessageId, {
            content: (conversation.value.find(m => m.id === assistantMessageId)?.content || '') + payload.data
          });
        } else if (payload.type === 'final' && payload.result) {
          const result = payload.result as AssistantResponse;
          updateAssistantMessage(assistantMessageId, {
            content: result.answer || (conversation.value.find(m => m.id === assistantMessageId)?.content || ''),
            suggestions: Array.isArray(result.improvements) ? result.improvements : [],
            clarifications: Array.isArray(result.clarifications) ? result.clarifications : [],
            followUps: Array.isArray(result.followUps) ? result.followUps : [],
            references: Array.isArray(result.references) ? result.references : [],
            edits: Array.isArray(result.edits)
              ? result.edits.map(edit => ({ ...edit, status: 'pending' }))
              : []
          });
          lastSnapshot.value = (result as any).snapshot ?? null;
        } else if (payload.type === 'error') {
          const message = payload.error || 'Assistant stream failed.';
          error.value = message;
          updateAssistantMessage(assistantMessageId, {
            content: message,
            clarifications: [message]
          });
        }
      });
      const offEnd = window.api.ai.onAssistStreamEnd((payload: any) => {
        if (payload.streamId !== activeStreamId.value) return;
        isLoading.value = false;
        activeStreamId.value = null;
        offEvent();
        offEnd();
      });
    } catch (err: any) {
      const message = err?.message || 'Assistant stream failed. Please check the console for details.';
      error.value = message;
      isLoading.value = false;
    }
  }

  async function applyEdit(messageId: string, editIndex: number) {
    const targetMessage = conversation.value.find(item => item.id === messageId && item.role === 'assistant');
    if (!targetMessage || !targetMessage.edits || !targetMessage.edits[editIndex]) {
      return;
    }

    const edit = targetMessage.edits[editIndex];
    if (edit.status === 'applying') {
      return;
    }

    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'Repository path unavailable. Configure a repository before applying edits.';
      return;
    }

    updateAssistantMessage(messageId, {
      edits: targetMessage.edits.map((current, idx) =>
        idx === editIndex
          ? { ...current, status: 'applying', error: undefined }
          : current
      )
    });

    try {
      const result = await window.api.ai.applyEdit(repoPath, edit.filePath, edit.updatedContent, edit.summary);
      if (!result?.ok) {
        const failureReason = result?.error || 'Edit failed without error details.';
        updateAssistantMessage(messageId, {
          edits: targetMessage.edits.map((current, idx) =>
            idx === editIndex
              ? { ...current, status: 'failed', error: failureReason }
              : current
          )
        });
        error.value = failureReason;
        return;
      }

      await contextStore.loadGraph();
      updateAssistantMessage(messageId, {
        edits: targetMessage.edits.map((current, idx) =>
          idx === editIndex
            ? { ...current, status: 'applied' }
            : current
        )
      });
    } catch (err: any) {
      const failureReason = err?.message || 'Failed to apply edit.';
      updateAssistantMessage(messageId, {
        edits: targetMessage.edits.map((current, idx) =>
          idx === editIndex
            ? { ...current, status: 'failed', error: failureReason }
            : current
        )
      });
      error.value = failureReason;
    }
  }

  function addAssistantInfo(content: string) {
    appendMessage({
      id: generateId('assistant'),
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
      mode: 'general',
      suggestions: [],
      clarifications: [],
      followUps: [],
      references: [],
      edits: []
    });
  }

  function clearConversation() {
    conversation.value = [];
    lastSnapshot.value = null;
    usageHistory.value = [];
    error.value = null;
  }

  function acknowledgeError() {
    error.value = null;
  }

  return {
    conversation,
    lastSnapshot,
    usageHistory,
    isLoading,
    error,
    isEnabled,
    hasConversation,
    initialize,
    ask,
    askStream,
    clearConversation,
    acknowledgeError,
    applyEdit,
    addAssistantInfo
  };
});
