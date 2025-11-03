<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAIStore } from '../stores/aiStore';
import { useContextStore } from '../stores/contextStore';

type AssistantMode = 'improvement' | 'clarification' | 'general';

interface Props {
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: []; 'open-settings': []; 'open-unified': [] }>();

const aiStore = useAIStore();
const contextStore = useContextStore();

const question = ref('');
const mode = ref<AssistantMode>('general');
const focusActive = ref(false);
// T045: Deprecation notice state
const showDeprecationNotice = ref(true);

const activeEntity = computed(() => contextStore.activeEntity);
const canFocusActive = computed(() => Boolean(contextStore.activeEntityId));
const isSendDisabled = computed(() => aiStore.isLoading || !question.value.trim());

function resetComposer() {
  if (!props.show) {
    question.value = '';
    focusActive.value = false;
    mode.value = 'general';
  }
}

watch(() => props.show, async (visible) => {
  if (visible) {
    await aiStore.initialize();
    // T045: Show deprecation notice when modal opens
    showDeprecationNotice.value = true;
  }
  resetComposer();
});

onMounted(async () => {
  if (props.show) {
    await aiStore.initialize();
  }
});

function quickPrompt(type: 'improvement' | 'clarification') {
  if (type === 'improvement') {
    mode.value = 'improvement';
    if (activeEntity.value) {
      question.value = `Suggest improvements for ${activeEntity.value.id} to stay aligned with the constitution and dependencies.`;
      focusActive.value = true;
    } else {
      question.value = 'Review the roadmap and suggest improvements to keep everything aligned.';
    }
  } else {
    mode.value = 'clarification';
    if (activeEntity.value) {
      question.value = `Clarify the purpose, dependencies, and outstanding risks for ${activeEntity.value.id}.`;
      focusActive.value = true;
    } else {
      question.value = 'Clarify how the current context pieces fit together and what is missing.';
    }
  }
}

async function sendQuestion() {
  if (isSendDisabled.value) {
    return;
  }

  const focusId = focusActive.value && contextStore.activeEntityId ? contextStore.activeEntityId : undefined;
  await aiStore.ask(question.value, { mode: mode.value, focusId });
  question.value = '';
}

function handleKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    sendQuestion();
  }
}

function closeModal() {
  emit('close');
}

function openSettings() {
  emit('open-settings');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[960px] max-w-[95vw] max-h-[92vh] flex flex-col border border-surface-variant">
          <!-- T045: Deprecation Notice -->
          <div
            v-if="showDeprecationNotice"
            class="px-4 py-3 bg-warning-container border-b border-warning flex items-start justify-between"
            role="alert"
          >
            <div class="flex items-start gap-3">
              <span class="text-2xl">⚠️</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-on-warning-container">
                  This assistant interface is deprecated
                </p>
                <p class="text-xs text-on-warning-container mt-1">
                  Please use the new Unified Assistant for better performance, streaming support, and enhanced features.
                </p>
                <button
                  class="mt-2 text-xs px-3 py-1 rounded-m3-sm bg-warning text-on-warning hover:bg-warning/80 transition-colors"
                  @click="emit('open-unified')"
                >
                  Switch to Unified Assistant
                </button>
              </div>
            </div>
            <button
              class="p-1 text-on-warning-container hover:bg-warning/20 rounded"
              aria-label="Dismiss deprecation notice"
              @click="showDeprecationNotice = false"
            >
              ✕
            </button>
          </div>
          
          <!-- Header -->
          <div class="px-6 py-5 border-b border-surface-variant bg-surface-2 flex items-center justify-between">
            <div>
              <h2 class="text-xl font-semibold text-secondary-900">Context Assistant</h2>
              <p class="text-sm text-secondary-600 mt-1">Grounded suggestions and clarifications from the entire repository snapshot.</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="p-2 rounded-m3-md text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 transition-colors"
                title="AI Settings"
                @click.stop="openSettings"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.25 6.75a.75.75 0 011.5 0v.61a5.001 5.001 0 012.757 1.633l.432-.249a.75.75 0 11.75 1.299l-.432.249c.098.396.148.81.148 1.233s-.05.837-.148 1.233l.432.249a.75.75 0 11-.75 1.299l-.432-.249A5.001 5.001 0 0112.75 16.64v.61a.75.75 0 01-1.5 0v-.61a5.001 5.001 0 01-2.757-1.633l-.432.249a.75.75 0 01-.75-1.299l.432-.249A5.008 5.008 0 017.25 12c0-.423.05-.837.148-1.233l-.432-.249a.75.75 0 01.75-1.299l.432.249A5.001 5.001 0 0111.25 7.36v-.61zM12 9.75A2.25 2.25 0 1014.25 12 2.253 2.253 0 0012 9.75z" />
                </svg>
              </button>
              <button
                class="p-2 rounded-m3-md text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 transition-colors"
                title="Close assistant"
                @click.stop="closeModal"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Error banner -->
          <div v-if="aiStore.error" class="mx-6 mt-4 mb-2 bg-error-50 border border-error-200 rounded-m3-md px-4 py-3 flex items-start gap-3">
            <svg class="w-5 h-5 text-error-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
            <div class="flex-1">
              <p class="text-sm text-error-700 font-medium">{{ aiStore.error }}</p>
              <button
                class="mt-2 text-xs text-error-600 hover:text-error-800 underline"
                @click="aiStore.acknowledgeError()"
              >Dismiss</button>
            </div>
          </div>

          <!-- Conversation -->
          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-surface">
            <div v-if="!aiStore.hasConversation && !aiStore.isLoading" class="text-sm text-secondary-600 bg-surface-2 border border-dashed border-surface-variant rounded-m3-md p-5">
              <p class="font-semibold text-secondary-800 mb-2">Try asking:</p>
              <ul class="list-disc list-inside space-y-1">
                <li>"Summarize the current feature landscape and any gaps."</li>
                <li>"Which tasks look risky based on the constitution rules?"</li>
                <li>"Clarify how <span class="font-mono">FEAT-001</span> impacts services and packages."</li>
              </ul>
            </div>

            <div
              v-for="message in aiStore.conversation"
              :key="message.id"
              class="rounded-m3-md border px-4 py-3 shadow-elevation-1"
              :class="message.role === 'assistant' ? 'bg-primary-50 border-primary-100' : 'bg-surface-1 border-surface-variant'"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span
                    class="px-2 py-0.5 text-xs font-semibold rounded-m3-md"
                    :class="message.role === 'assistant' ? 'bg-primary-100 text-primary-700' : 'bg-secondary-200 text-secondary-700'"
                  >
                    {{ message.role === 'assistant' ? 'Assistant' : 'You' }}
                  </span>
                  <span class="text-xs text-secondary-500 uppercase tracking-wide">{{ message.mode }}</span>
                  <span v-if="message.focusId" class="text-xs text-secondary-500">Focus: {{ message.focusId }}</span>
                </div>
                <span class="text-[10px] text-secondary-400 uppercase tracking-wide">{{ new Date(message.createdAt).toLocaleTimeString() }}</span>
              </div>

              <p class="text-sm text-secondary-900 leading-relaxed whitespace-pre-wrap">{{ message.content }}</p>

              <div v-if="message.suggestions && message.suggestions.length" class="mt-3">
                <h4 class="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-1">Improvement ideas</h4>
                <ul class="space-y-1">
                  <li
                    v-for="suggestion in message.suggestions"
                    :key="`${message.id}-${suggestion.target}`"
                    class="text-sm bg-primary-50 border border-primary-100 rounded-m3-md px-3 py-2"
                  >
                    <div class="font-semibold text-primary-800 flex items-center gap-2">
                      <span class="font-mono text-xs bg-primary-200 text-primary-800 px-2 py-0.5 rounded-m3-md">{{ suggestion.target }}</span>
                      <span>{{ suggestion.suggestion }}</span>
                    </div>
                    <p v-if="suggestion.impact" class="text-xs text-primary-700 mt-1">Impact: {{ suggestion.impact }}</p>
                  </li>
                </ul>
              </div>

              <div v-if="message.clarifications && message.clarifications.length" class="mt-3">
                <h4 class="text-xs font-semibold text-tertiary-800 uppercase tracking-wide mb-1">Clarifications needed</h4>
                <ul class="space-y-1">
                  <li
                    v-for="(item, index) in message.clarifications"
                    :key="`${message.id}-clarify-${index}`"
                    class="text-sm bg-tertiary-50 border border-tertiary-200 rounded-m3-md px-3 py-2 text-tertiary-900"
                  >{{ item }}</li>
                </ul>
              </div>

              <div v-if="message.followUps && message.followUps.length" class="mt-3">
                <h4 class="text-xs font-semibold text-secondary-700 uppercase tracking-wide mb-1">Suggested follow-ups</h4>
                <ul class="space-y-1">
                  <li
                    v-for="(item, index) in message.followUps"
                    :key="`${message.id}-follow-${index}`"
                    class="text-xs bg-surface-3 border border-surface-variant rounded-m3-md px-3 py-2 text-secondary-800"
                  >{{ item }}</li>
                </ul>
              </div>

              <div v-if="message.references && message.references.length" class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="(reference, index) in message.references"
                  :key="`${message.id}-ref-${index}`"
                  class="px-3 py-1 text-xs bg-secondary-100 text-secondary-800 rounded-m3-md border border-secondary-200"
                  :title="reference.note || ''"
                >{{ reference.type }} · {{ reference.id }}</span>
              </div>
            </div>

            <div v-if="aiStore.isLoading" class="flex items-center gap-2 text-sm text-secondary-600">
              <span class="inline-block animate-spin rounded-m3-md-full h-4 w-4 border-2 border-secondary-300 border-t-secondary-600"></span>
              Thinking through the repository snapshot...
            </div>
          </div>

          <!-- Composer -->
          <div class="border-t border-surface-variant bg-surface-2 px-6 py-5 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2 bg-surface-3 border border-surface-variant rounded-m3-md px-2 py-1">
                <button
                  <script setup lang="ts">
                  // DEPRECATED COMPONENT (T086)
                  // ---------------------------------------------------------------------------
                  // This legacy modal has been superseded by the unified assistant implementation.
                  // It remains as a minimal stub until all tests referencing it (US1 legacy tests)
                  // are migrated or removed. It should not be used for new features.
                  // TODO(T086-Final): Delete this file after confirming no test or runtime references.
                  // See `UnifiedAssistant.vue` + `assistantStore` for the active implementation.

                  interface Props { show: boolean }
                  defineProps<Props>();
                  const emit = defineEmits<{ close: []; 'open-unified': [] }>();

                  function openUnified() {
                    emit('open-unified');
                  }

                  function dismiss() {
                    emit('close');
  transform: scale(0.95);
}

.modal-leave-to > div > div {
                    <div v-if="show" class="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                      <div class="bg-surface rounded-m3-lg shadow-xl w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
                        <header class="px-5 py-4 border-b border-outline-variant flex items-center justify-between bg-primary-container">
                          <h2 class="text-lg font-semibold text-on-primary-container flex items-center gap-2">
                            <span>Legacy Assistant (Deprecated)</span>
                            <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-error-container text-on-error-container">Deprecated</span>
                          </h2>
                          <button @click="dismiss" class="px-2 py-1 text-sm rounded-m3-md bg-surface-variant text-on-surface-variant hover:bg-surface-variant/80">×</button>
                        </header>
                        <div class="p-6 space-y-4 overflow-y-auto text-sm">
                          <p class="text-on-surface-variant">This legacy modal has been replaced by the Unified Assistant with tooling, approvals, telemetry, and migration features.</p>
                          <ul class="list-disc pl-5 space-y-1 text-on-surface-variant">
                            <li>No new features will be added here.</li>
                            <li>Existing sessions have been migrated automatically.</li>
                            <li>Use the Unified Assistant for edit suggestions & tool execution.</li>
                          </ul>
                          <button @click="openUnified" class="px-4 py-2 rounded-m3-md bg-tertiary-container text-on-tertiary-container hover:bg-tertiary-container/80">Open Unified Assistant</button>
                        </div>
                        <footer class="px-5 py-3 border-t border-outline-variant text-xs text-on-surface-variant">
                          Scheduled for removal after telemetry & tests finalize (see task T086).
                        </footer>
                      </div>
                    </div>
                  :disabled="isSendDisabled"
