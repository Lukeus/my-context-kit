import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useContextStore } from './contextStore';
import { DEFAULT_PROMPTS, detectModelCapabilities } from '../types/ai-prompts';
import type { AIPromptConfig, ModelCapabilities, TokenProbability } from '../types/ai-prompts';

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
  logprobs?: TokenProbability[] | null;
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
  logprobs?: TokenProbability[] | null;
}

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function looksLikeStructuredPayload(value: string | undefined | null) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```');
}

function resolveAnswer(...candidates: Array<string | undefined | null>) {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const trimmed = candidate.trim();
    if (trimmed.length > 0 && !looksLikeStructuredPayload(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

function resolveList<T>(primary?: T[] | null, fallback?: T[] | null): T[] {
  if (Array.isArray(primary) && primary.length > 0) {
    return primary;
  }
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback;
  }
  return [];
}

function safeParseAssistantJson(raw: string | undefined | null): Partial<AssistantResponse> | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = new Set<string>();
  candidates.add(trimmed);

  const withoutFences = trimmed.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  if (withoutFences) {
    candidates.add(withoutFences);
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed as Partial<AssistantResponse>;
      }
    } catch {
      // ignore parse failures
    }
  }

  return null;
}

function summarizeAssistantData(data: Partial<AssistantResponse>) {
  const segments: string[] = [];

  const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
  if (answer && !looksLikeStructuredPayload(answer)) {
    segments.push(answer);
  }

  if (Array.isArray(data.improvements) && data.improvements.length > 0) {
    const bullets = data.improvements
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const target = 'target' in item && typeof item.target === 'string' ? item.target.trim() : '';
        const suggestion = 'suggestion' in item && typeof item.suggestion === 'string' ? item.suggestion : '';
        const impact = 'impact' in item && typeof item.impact === 'string' && item.impact.trim().length > 0
          ? ` (Impact: ${item.impact})`
          : '';
        return suggestion ? `• ${suggestion}${impact}${target ? ` [${target}]` : ''}` : '';
      })
      .filter(Boolean);
    if (bullets.length > 0) {
      segments.push(['Suggested improvements:', ...bullets].join('\n'));
    }
  }

  if (Array.isArray(data.clarifications) && data.clarifications.length > 0) {
    const bullets = data.clarifications
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map(item => `• ${item}`);
    if (bullets.length > 0) {
      segments.push(['Clarifications needed:', ...bullets].join('\n'));
    }
  }

  if (Array.isArray(data.followUps) && data.followUps.length > 0) {
    const bullets = data.followUps
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map(item => `• ${item}`);
    if (bullets.length > 0) {
      segments.push(['Suggested next steps:', ...bullets].join('\n'));
    }
  }

  return segments.join('\n\n').trim();
}

function sanitizeRawSnippet(raw: string) {
  if (!raw) {
    return '';
  }

  const cleaned = raw
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  if (!cleaned) {
    return '';
  }

  const lines = cleaned.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return '';
  }

  const snippet = lines.slice(0, 6).join('\n');
  return lines.length > 6 ? `${snippet}\n…` : snippet;
}

function sanitizeSuggestions(list: unknown): AssistantSuggestion[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const target = 'target' in item && typeof item.target === 'string' ? item.target.trim() : '';
      const suggestion = 'suggestion' in item && typeof item.suggestion === 'string'
        ? item.suggestion.trim()
        : '';
      const impact = 'impact' in item && typeof item.impact === 'string' ? item.impact.trim() : undefined;
      if (!suggestion) {
        return null;
      }
      return impact ? { target, suggestion, impact } : { target, suggestion };
    })
    .filter((item): item is AssistantSuggestion => Boolean(item));
}

function sanitizeStrings(list: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(item => item.length > 0);
}

function sanitizeReferences(list: unknown): AssistantReference[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const type = 'type' in item && typeof item.type === 'string' ? item.type.trim() : '';
      const id = 'id' in item && typeof item.id === 'string' ? item.id.trim() : '';
      const note = 'note' in item && typeof item.note === 'string' ? item.note.trim() : undefined;
      if (!type || !id) {
        return null;
      }
      return note ? { type, id, note } : { type, id };
    })
    .filter((item): item is AssistantReference => Boolean(item));
}

function sanitizeEdits(list: unknown): AssistantEdit[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(item => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const filePath = 'filePath' in item && typeof item.filePath === 'string' ? item.filePath.trim() : '';
      const updatedContent = 'updatedContent' in item && typeof item.updatedContent === 'string'
        ? item.updatedContent
        : '';
      if (!filePath || !updatedContent) {
        return null;
      }
      const targetId = 'targetId' in item && typeof item.targetId === 'string' ? item.targetId.trim() : undefined;
      const summary = 'summary' in item && typeof item.summary === 'string' ? item.summary : '';
      // Build object with optional targetId property only when defined to align with AssistantEdit
      const edit: AssistantEdit = {
        filePath,
        updatedContent,
        summary,
        status: 'pending'
      };
      if (targetId) {
        edit.targetId = targetId;
      }
      return edit;
    })
    .filter((item): item is AssistantEdit => item !== null);
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
  const prompts = ref<AIPromptConfig>(DEFAULT_PROMPTS);
  const capabilities = ref<ModelCapabilities | null>(null);

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

  // Exported helper to create a stable id for assistant/user messages
  function makeId(prefix: string) {
    return generateId(prefix);
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
      edits: [],
      logprobs: null
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
        edits: [],
        logprobs: null
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
        edits: [],
        logprobs: null
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
      edits: [],
      logprobs: null
    });

    for (const { index } of pendingIndexes) {
       
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
      edits: [],
      logprobs: null
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
      edits: [],
      logprobs: null
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
          : [],
        logprobs: result.logprobs || null
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
      edits: [],
      logprobs: null
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
      edits: [],
      logprobs: null
    });

    try {
      const startRes = await window.api.ai.assistStreamStart(repoPath, trimmedQuestion, options.mode, options.focusId);
      if (!startRes.ok || !startRes.streamId) {
        throw new Error(startRes.error || 'Failed to start streaming');
      }
      activeStreamId.value = startRes.streamId;
      let pendingContent = '';
      let placeholderShown = false;

      let offEndRef: (() => void) | null = null;
      const offEvent = window.api.ai.onAssistStreamEvent((payload: any) => {
        if (payload.streamId !== activeStreamId.value) return;
        if (payload.type === 'delta' && typeof payload.data === 'string') {
          pendingContent += payload.data;
          if (!placeholderShown) {
            placeholderShown = true;
            updateAssistantMessage(assistantMessageId, {
              content: 'Generating response…'
            });
          }
        } else if (payload.type === 'final' && payload.result) {
          const result = payload.result as AssistantResponse;
          const parsedFromAnswer = looksLikeStructuredPayload(result.answer)
            ? safeParseAssistantJson(result.answer)
            : null;
          const parsedFromBuffer = safeParseAssistantJson(pendingContent);
          const fallbackStructured = parsedFromAnswer ?? parsedFromBuffer;

          const resolvedAnswer = resolveAnswer(result.answer, fallbackStructured?.answer as (string | undefined));
          const resolvedImprovements = resolveList<AssistantSuggestion>(
            result.improvements,
            fallbackStructured?.improvements as AssistantSuggestion[] | undefined
          );
          const resolvedClarifications = resolveList<string>(
            result.clarifications,
            fallbackStructured?.clarifications as string[] | undefined
          );
          const resolvedFollowUps = resolveList<string>(
            result.followUps,
            fallbackStructured?.followUps as string[] | undefined
          );
          const resolvedReferences = resolveList<AssistantReference>(
            result.references,
            fallbackStructured?.references as AssistantReference[] | undefined
          );
          const resolvedEdits = resolveList<AssistantEdit>(
            result.edits,
            fallbackStructured?.edits as AssistantEdit[] | undefined
          );

          const normalizedImprovements = sanitizeSuggestions(resolvedImprovements);
          const normalizedClarifications = sanitizeStrings(resolvedClarifications);
          const normalizedFollowUps = sanitizeStrings(resolvedFollowUps);
          const normalizedReferences = sanitizeReferences(resolvedReferences);
          const normalizedEdits = sanitizeEdits(resolvedEdits);

          let finalContent = summarizeAssistantData({
            answer: resolvedAnswer,
            improvements: normalizedImprovements,
            clarifications: normalizedClarifications,
            followUps: normalizedFollowUps
          });

          if (result.ok === false) {
            finalContent = result.error?.trim()
              || finalContent
              || sanitizeRawSnippet(pendingContent)
              || 'Assistant request failed.';
          } else if (!finalContent) {
            finalContent = sanitizeRawSnippet(pendingContent) || 'Assistant returned no readable content.';
          }

          updateAssistantMessage(assistantMessageId, {
            content: finalContent,
            suggestions: normalizedImprovements,
            clarifications: normalizedClarifications,
            followUps: normalizedFollowUps,
            references: normalizedReferences,
            edits: normalizedEdits,
            logprobs: result.logprobs || null
          });
          lastSnapshot.value = result.snapshot ?? null;
          recordUsage(result.usage);
        } else if (payload.type === 'error') {
          const message = payload.error || 'Assistant stream failed.';
          error.value = message;
          updateAssistantMessage(assistantMessageId, {
            content: message,
            clarifications: [message]
          });
          isLoading.value = false;
          activeStreamId.value = null;
          offEvent();
          if (offEndRef) {
            offEndRef();
            offEndRef = null;
          }
        }
      });
      offEndRef = window.api.ai.onAssistStreamEnd((payload: any) => {
        if (payload.streamId !== activeStreamId.value) return;
        isLoading.value = false;
        activeStreamId.value = null;
        offEvent();
        if (offEndRef) {
          offEndRef();
          offEndRef = null;
        }
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
      edits: [],
      logprobs: null
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

  async function loadPrompts() {
    const repoPath = contextStore.repoPath;
    if (!repoPath) return;
    
    try {
      const result = await window.api.fs.readFile(`${repoPath}/.context/ai-prompts.json`);
      if (result.ok && result.content) {
        const parsed = JSON.parse(result.content);
        prompts.value = { ...DEFAULT_PROMPTS, ...parsed };
      }
    } catch {
      prompts.value = DEFAULT_PROMPTS;
    }
  }

  async function savePrompts(newPrompts: AIPromptConfig) {
    const repoPath = contextStore.repoPath;
    if (!repoPath) return { ok: false, error: 'No repository path' };
    
    try {
      await window.api.fs.writeFile(
        `${repoPath}/.context/ai-prompts.json`,
        JSON.stringify(newPrompts, null, 2)
      );
      prompts.value = newPrompts;
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to save prompts' };
    }
  }

  function detectCapabilities(provider: string, model: string) {
    capabilities.value = detectModelCapabilities(provider, model);
  }

  function getSystemPrompt(mode: 'general' | 'improvement' | 'clarification'): string {
    return prompts.value.systemPrompts[mode];
  }

  function getQuickPrompt(type: 'improvement' | 'clarification', hasActiveEntity: boolean, entityId?: string): string {
    const key = hasActiveEntity
      ? `${type}Active` as const
      : `${type}General` as const;
    
    let prompt = prompts.value.quickPrompts[key];
    if (entityId) {
      prompt = prompt.replace('{entityId}', entityId);
    }
    return prompt;
  }

  function resetPromptsToDefault() {
    prompts.value = { ...DEFAULT_PROMPTS };
  }

  return {
    conversation,
    lastSnapshot,
    usageHistory,
    isLoading,
    error,
    isEnabled,
    hasConversation,
    prompts,
    capabilities,
    initialize,
    ask,
    askStream,
    clearConversation,
    acknowledgeError,
    applyEdit,
    addAssistantInfo,
    // new exported helpers for other components to use instead of mutating conversation directly
    appendMessage,
    updateAssistantMessage,
    generateId: makeId,
    loadPrompts,
    savePrompts,
    detectCapabilities,
    getSystemPrompt,
    getQuickPrompt,
    resetPromptsToDefault
  };
});
