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

    isLoading.value = true;
    error.value = null;

    const trimmedQuestion = question.trim();
    const userMessageId = generateId('user');
    const assistantMessageId = generateId('assistant');

    appendMessage({
      id: userMessageId,
      role: 'user',
      content: trimmedQuestion,
      createdAt: new Date().toISOString(),
      mode: options.mode,
      focusId: options.focusId
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
      references: []
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
          references: []
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
        references: Array.isArray(result.references) ? result.references : []
      });
    } catch (err: any) {
      const message = err?.message || 'Assistant request failed. Please check the console for details.';
      error.value = message;
      updateAssistantMessage(assistantMessageId, {
        content: message,
        suggestions: [],
        clarifications: [message],
        followUps: [],
        references: []
      });
    } finally {
      isLoading.value = false;
    }
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
    clearConversation,
    acknowledgeError
  };
});
