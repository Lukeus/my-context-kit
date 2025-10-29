<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAIStore } from '../stores/aiStore';
import { useContextStore } from '../stores/contextStore';
import DiffViewer from './DiffViewer.vue';
import TokenProbabilityViewer from './TokenProbabilityViewer.vue';
import ToolPanel from './assistant/ToolPanel.vue';

type AssistantMode = 'improvement' | 'clarification' | 'general';

const emit = defineEmits<{ 'open-settings': [] }>();

const aiStore = useAIStore();
const contextStore = useContextStore();

const question = ref('');
const mode = ref<AssistantMode>('general');
const focusActive = ref(false);

const activeEntity = computed(() => contextStore.activeEntity);
const canFocusActive = computed(() => Boolean(contextStore.activeEntityId));
const isSendDisabled = computed(() => aiStore.isLoading || !question.value.trim());

onMounted(async () => {
  await aiStore.initialize();
  await aiStore.loadPrompts();
  
  // Detect capabilities if config is available
  try {
    const result = await window.api.ai.getConfig(contextStore.repoPath);
    if (result.ok && result.config) {
      aiStore.detectCapabilities(result.config.provider || 'ollama', result.config.model || '');
    }
  } catch {
    // Ignore
  }
});

watch(() => contextStore.activeEntityId, (id) => {
  if (!id) {
    focusActive.value = false;
  }
});

function quickPrompt(type: 'improvement' | 'clarification') {
  const entityId = activeEntity.value?.id;
  const hasEntity = Boolean(entityId);
  
  question.value = aiStore.getQuickPrompt(type, hasEntity, entityId);
  mode.value = type;
  
  if (hasEntity) {
    focusActive.value = true;
  }
}

async function sendQuestion() {
  if (isSendDisabled.value) {
    return;
  }

  const focusId = focusActive.value && contextStore.activeEntityId ? contextStore.activeEntityId : undefined;
  await aiStore.askStream(question.value, { mode: mode.value, focusId });
  question.value = '';
}

function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    sendQuestion();
  }
}

function openSettings() {
  emit('open-settings');
}

async function runValidate() {
  const repoPath = contextStore.repoPath;
  if (!repoPath) return;
  const res = await window.api.context.validate(repoPath);
  aiStore.addAssistantInfo(res.ok ? 'Validation passed ✓' : `Validation failed: ${res.error || 'Unknown error'}`);
}

async function runImpact() {
  const repoPath = contextStore.repoPath;
  const id = contextStore.activeEntityId;
  if (!repoPath || !id) return;
  const res = await window.api.context.impact(repoPath, [id]);
  if (res && res.issues) {
    const stale = Array.isArray(res.stale) ? res.stale.length : (Array.isArray(res.staleIds) ? res.staleIds.length : 0);
    const issues = Array.isArray(res.issues) ? res.issues.length : 0;
    aiStore.addAssistantInfo(`Impact for ${id}: ${stale} stale, ${issues} issues.`);
  } else if (res?.error) {
    aiStore.addAssistantInfo(`Impact failed: ${res.error}`);
  } else {
    aiStore.addAssistantInfo('Impact analysis completed.');
  }
}

async function runGeneratePrompt() {
  const repoPath = contextStore.repoPath;
  const id = contextStore.activeEntityId;
  if (!repoPath || !id) return;
  const res = await window.api.context.generate(repoPath, [id]);
  if (res?.ok) {
    aiStore.addAssistantInfo(`Prompt generated for ${id}. Check generated/prompts folder in the context repo.`);
  } else {
    aiStore.addAssistantInfo(`Prompt generation failed: ${res?.error || 'Unknown error'}`);
  }
}

const editOriginalContent = ref<Record<string, string>>({});

async function loadOriginalContent(filePath: string, messageId: string, editIndex: number) {
  const key = `${messageId}-${editIndex}`;
  if (editOriginalContent.value[key]) {
    return; // Already loaded
  }
  
  const repoPath = contextStore.repoPath;
  if (!repoPath) return;
  
  const fullPath = `${repoPath}/${filePath}`;
  try {
    const result = await window.api.fs.readFile(fullPath);
    if (result.ok && result.content) {
      editOriginalContent.value[key] = result.content;
    }
  } catch (error) {
    console.error('Failed to load original content:', error);
  }
}

function getOriginalContent(messageId: string, editIndex: number): string {
  const key = `${messageId}-${editIndex}`;
  return editOriginalContent.value[key] || '';
}

function applyEdit(messageId: string, editIndex: number) {
  aiStore.applyEdit(messageId, editIndex);
}

function requestEditForSuggestion(suggestion: any) {
  const prompt = `Please generate the complete YAML edit to implement this improvement:
Target: ${suggestion.target}
Suggestion: ${suggestion.suggestion}
${suggestion.impact ? `Impact: ${suggestion.impact}` : ''}

Provide the complete updated YAML file content for ${suggestion.target}.`;
  question.value = prompt;
  focusActive.value = true;
  mode.value = 'improvement';
}
</script>

<template>
  <div class="h-full flex flex-col bg-surface-1 text-secondary-900">
    <!-- Material Design Header -->
    <div class="px-4 py-3 border-b border-surface-variant bg-surface-2 shadow-elevation-1 flex items-center justify-between gap-2">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary-600 rounded-m3-lg shadow-elevation-1">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h2 class="text-sm font-semibold text-secondary-900">Context Assistant</h2>
          <p class="text-xs text-secondary-600">AI-powered repository insights</p>
        </div>
      </div>
      <button
        class="p-2 rounded-m3-full text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 transition-colors"
        title="AI Settings"
        @click="openSettings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <div v-if="aiStore.error" class="m-4 bg-error-50 border border-error-200 rounded-m3-md px-3 py-3 flex items-start gap-2">
      <svg class="w-4 h-4 text-error-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
      <div class="flex-1">
        <p class="text-xs text-error-700 font-medium">{{ aiStore.error }}</p>
        <button
          class="mt-2 text-[11px] text-error-600 hover:text-error-800 underline"
          @click="aiStore.acknowledgeError()"
        >Dismiss</button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
      <ToolPanel />

      <div v-if="!aiStore.hasConversation && !aiStore.isLoading" class="text-xs text-secondary-600 bg-surface-2 border border-dashed border-surface-variant rounded-m3-lg p-4">
        <p class="font-semibold text-secondary-800 mb-2">Try asking:</p>
        <ul class="list-disc list-inside space-y-1">
          <li v-for="(q, i) in aiStore.prompts.exampleQuestions" :key="i">{{ q }}</li>
        </ul>
      </div>

      <!-- User Message -->
      <div
        v-for="message in aiStore.conversation"
        :key="message.id"
        class="space-y-3"
      >
        <div v-if="message.role === 'user'" class="flex justify-end">
          <div class="max-w-[85%] bg-primary-600 text-white rounded-m3-xl px-4 py-3 shadow-elevation-2">
            <div class="flex items-center gap-2 mb-1.5">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
              <span class="text-xs font-semibold">You</span>
              <span class="text-[10px] opacity-75 ml-auto">{{ new Date(message.createdAt).toLocaleTimeString() }}</span>
            </div>
            <p class="text-sm leading-relaxed whitespace-pre-wrap">{{ message.content }}</p>
          </div>
        </div>

        <!-- Assistant Message -->
        <div v-else class="flex justify-start">
          <div class="max-w-[95%] bg-white rounded-m3-xl shadow-elevation-2 border border-surface-variant overflow-hidden">
            <!-- Message Header -->
            <div class="bg-primary-50 px-4 py-2.5 border-b border-primary-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-primary-600 rounded-m3-lg">
                  <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span class="text-xs font-semibold text-primary-900">AI Assistant</span>
                <span v-if="message.mode" class="text-[10px] px-2 py-0.5 bg-primary-100 text-primary-700 rounded-m3-full">{{ message.mode }}</span>
                <span v-if="message.focusId" class="text-[10px] text-primary-600">· {{ message.focusId }}</span>
              </div>
              <span class="text-[10px] text-primary-600">{{ new Date(message.createdAt).toLocaleTimeString() }}</span>
            </div>

            <!-- Message Content -->
            <div class="px-4 py-3">
              <div class="prose prose-sm max-w-none">
                <p class="text-sm text-secondary-900 leading-relaxed whitespace-pre-wrap mb-0">{{ message.content }}</p>
              </div>
            </div>

            <!-- Suggestions with Action Buttons -->
            <div v-if="message.suggestions && message.suggestions.length" class="px-4 pb-3">
              <div class="bg-primary-50 rounded-m3-lg border border-primary-200 p-3 space-y-2">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-4 h-4 text-primary-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <h4 class="text-xs font-semibold text-primary-900">Suggested Improvements</h4>
                </div>
                <div class="space-y-2">
                  <div
                    v-for="(suggestion, idx) in message.suggestions"
                    :key="`${message.id}-${suggestion.target}-${idx}`"
                    class="bg-white rounded-m3-md p-3 border border-primary-100 space-y-2"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-mono text-xs font-semibold bg-primary-100 text-primary-800 px-2 py-0.5 rounded">{{ suggestion.target }}</span>
                        </div>
                        <p class="text-sm text-secondary-900 leading-snug">{{ suggestion.suggestion }}</p>
                        <p v-if="suggestion.impact" class="text-xs text-secondary-600 mt-1">
                          <span class="font-semibold">Impact:</span> {{ suggestion.impact }}
                        </p>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 pt-2 border-t border-primary-100">
                      <button
                        @click="requestEditForSuggestion(suggestion)"
                        class="flex-1 px-3 py-2 text-xs font-semibold bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 transition-all shadow-sm"
                      >
                        Request Edit
                      </button>
                      <button
                        class="px-3 py-2 text-xs font-medium text-secondary-700 hover:bg-surface-2 rounded-m3-lg transition-all border border-surface-variant"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Clarifications -->
            <div v-if="message.clarifications && message.clarifications.length" class="px-4 pb-3">
              <div class="bg-yellow-50 rounded-m3-lg border border-yellow-200 p-3 space-y-2">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-4 h-4 text-yellow-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                  <h4 class="text-xs font-semibold text-yellow-900">Clarifications Needed</h4>
                </div>
                <div class="space-y-1.5">
                  <div
                    v-for="(item, index) in message.clarifications"
                    :key="`${message.id}-clarify-${index}`"
                    class="bg-white rounded-m3-md p-2.5 border border-yellow-100"
                  >
                    <p class="text-sm text-secondary-900">{{ item }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Follow-ups -->
            <div v-if="message.followUps && message.followUps.length" class="px-4 pb-3">
              <div class="bg-secondary-50 rounded-m3-lg border border-secondary-200 p-3">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-4 h-4 text-secondary-700" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                  </svg>
                  <h4 class="text-xs font-semibold text-secondary-900">Suggested Next Steps</h4>
                </div>
                <div class="space-y-1.5">
                  <button
                    v-for="(item, index) in message.followUps"
                    :key="`${message.id}-follow-${index}`"
                    class="w-full text-left bg-white rounded-m3-md p-2.5 border border-secondary-100 hover:border-secondary-300 hover:bg-secondary-50 transition-all text-sm text-secondary-900"
                  >
                    {{ item }}
                  </button>
                </div>
              </div>
            </div>

            <!-- References -->
            <div v-if="message.references && message.references.length" class="px-4 pb-3">
              <div class="flex items-center gap-2 mb-2">
                <svg class="w-3.5 h-3.5 text-secondary-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                <h4 class="text-xs font-semibold text-secondary-700">References</h4>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(reference, index) in message.references"
                  :key="`${message.id}-ref-${index}`"
                  class="px-2.5 py-1 text-xs bg-secondary-100 text-secondary-800 rounded-m3-md border border-secondary-200 hover:bg-secondary-200 transition-colors cursor-pointer"
                  :title="reference.note || ''"
                >{{ reference.type }} · {{ reference.id }}</span>
              </div>
            </div>

            <!-- Proposed Edits -->
            <div v-if="message.edits && message.edits.length" class="px-4 pb-3">
              <div class="flex items-center gap-2 mb-3">
                <svg class="w-4 h-4 text-secondary-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" />
                </svg>
                <h4 class="text-xs font-semibold text-secondary-900">Proposed File Changes</h4>
              </div>
          <div
            v-for="(edit, editIndex) in message.edits"
            :key="`${message.id}-edit-${editIndex}`"
            class="space-y-2"
            @vue:mounted="loadOriginalContent(edit.filePath, message.id, editIndex)"
          >
            <div class="flex items-center justify-between gap-2 px-3 py-2 bg-surface-2 border border-surface-variant rounded-t-m3-md">
              <div class="flex flex-col">
                <span class="text-[11px] font-semibold text-secondary-800">{{ edit.filePath }}</span>
                <span v-if="edit.summary" class="text-[11px] text-secondary-600">{{ edit.summary }}</span>
              </div>
              <span
                class="text-[10px] uppercase tracking-wide rounded-m3-full px-2 py-0.5"
                :class="{
                  'bg-primary-100 text-primary-700': edit.status === 'applied',
                  'bg-error-100 text-error-700': edit.status === 'failed',
                  'bg-secondary-200 text-secondary-700': edit.status === 'pending',
                  'bg-secondary-300 text-secondary-800 animate-pulse': edit.status === 'applying'
                }"
              >{{ edit.status }}</span>
            </div>
            <DiffViewer
              v-if="getOriginalContent(message.id, editIndex)"
              :original="getOriginalContent(message.id, editIndex)"
              :modified="edit.updatedContent"
              :file-path="edit.filePath"
              language="yaml"
            />
            <div v-else class="bg-surface-1 border border-surface-variant rounded-m3-md p-3 text-xs text-secondary-600">
              Loading original file...
            </div>
            <div class="flex items-center justify-between gap-2 px-3 py-2 bg-surface-2 border border-surface-variant rounded-b-m3-md">
              <span v-if="edit.error" class="text-[10px] text-error-600">{{ edit.error }}</span>
              <div class="flex-1"></div>
              <button
                class="px-3 py-1.5 text-[11px] font-medium rounded-m3-full"
                :class="edit.status === 'applied'
                  ? 'bg-primary-100 text-primary-700 border border-primary-200'
                  : 'bg-primary-600 text-white hover:bg-primary-700 shadow-elevation-1'
                "
                :disabled="edit.status === 'applying' || edit.status === 'applied'"
                @click="applyEdit(message.id, editIndex)"
              >
                {{ edit.status === 'applied' ? 'Applied' : edit.status === 'applying' ? 'Applying…' : 'Apply edit' }}
              </button>
            </div>
              </div>
            </div>
            
            <!-- Token Probabilities -->
            <div class="px-4 pb-3">
              <TokenProbabilityViewer :logprobs="message.logprobs" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="aiStore.isLoading" class="flex items-center gap-2 text-xs text-secondary-600">
        <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-secondary-300 border-t-secondary-600"></span>
        Streaming response…
      </div>
    </div>

    <div class="border-t border-surface-variant bg-surface-2 px-4 py-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 bg-surface-3 border border-surface-variant rounded-m3-full px-2 py-1">
          <button
            v-for="option in ['general', 'improvement', 'clarification']"
            :key="option"
            class="px-3 py-1 text-[11px] font-medium rounded-m3-full transition-colors"
            :class="mode === option ? 'bg-primary-600 text-white shadow-elevation-1' : 'text-secondary-700 hover:bg-surface-4'"
            @click="mode = option as AssistantMode"
          >{{ option }}</button>
        </div>
        <label class="flex items-center gap-2 text-[11px] text-secondary-700">
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-surface-variant text-primary-600 focus:ring-primary-400"
            v-model="focusActive"
            :disabled="!canFocusActive"
          />
          <span>
            Focus on {{ canFocusActive ? activeEntity?.id : 'active entity (select one)' }}
          </span>
        </label>
      </div>

      <textarea
        v-model="question"
        rows="4"
        class="w-full px-3.5 py-3 bg-surface-1 border border-surface-variant rounded-m3-lg text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-elevation-1"
        placeholder="Ask for improvements or clarifications across the context repository..."
        @keydown="handleKeydown"
      ></textarea>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-[11px] text-secondary-600">
          <button
            class="px-3 py-1.5 bg-surface-3 hover:bg-surface-4 rounded-m3-full border border-surface-variant transition-colors"
            @click="quickPrompt('improvement')"
          >Suggest improvements</button>
          <button
            class="px-3 py-1.5 bg-surface-3 hover:bg-surface-4 rounded-m3-full border border-surface-variant transition-colors"
            @click="quickPrompt('clarification')"
          >Ask for clarifications</button>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-2 text-[11px] text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 rounded-m3-lg"
            @click="aiStore.clearConversation()"
          >Clear conversation</button>
          <button
            class="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white rounded-m3-lg transition-all shadow-elevation-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSendDisabled"
            @click="sendQuestion"
          >
            {{ aiStore.isLoading ? 'Sending…' : 'Send (Ctrl+Enter)' }}
          </button>
        </div>
      </div>

      <div v-if="aiStore.usageHistory.length" class="text-[10px] text-secondary-500">
        Last response: {{ aiStore.usageHistory[aiStore.usageHistory.length - 1].totalTokens }} tokens • prompt {{ aiStore.usageHistory[aiStore.usageHistory.length - 1].promptTokens }}, completion {{ aiStore.usageHistory[aiStore.usageHistory.length - 1].completionTokens }}
      </div>
    </div>
  </div>
</template>
