<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAIStore } from '../stores/aiStore';
import { useContextStore } from '../stores/contextStore';
import { ModalHeader } from './shared';

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
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[960px] max-w-[95vw] max-h-[92vh] flex flex-col border border-surface-variant">
          <!-- T045: Deprecation Notice -->
          <div v-if="showDeprecationNotice" class="px-4 py-3 bg-warning-container border-b border-warning flex items-start justify-between" role="alert">
            <div class="flex items-start gap-3">
              <span class="text-2xl">⚠️</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-on-warning-container">This assistant interface is deprecated</p>
                <p class="text-xs text-on-warning-container mt-1">Please use the new Unified Assistant for better performance, streaming support, and enhanced features.</p>
                <button class="mt-2 text-xs px-3 py-1 rounded-m3-sm bg-warning text-on-warning hover:bg-warning/80 transition-colors" @click="emit('open-unified')">Switch to Unified Assistant</button>
              </div>
            </div>
            <button class="p-1 text-on-warning-container hover:bg-warning/20 rounded" aria-label="Dismiss deprecation notice" @click="showDeprecationNotice = false">✕</button>
          </div>

          <!-- Header -->
          <ModalHeader
            title="Context Assistant"
            subtitle="Grounded suggestions and clarifications from the entire repository snapshot."
            variant="modal"
            @close="closeModal"
          >
            <template #actions>
              <button class="p-2 rounded-m3-md text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50" title="AI Settings" aria-label="Open AI settings" @click.stop="openSettings">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.25 6.75a.75.75 0 011.5 0v.61a5.001 5.001 0 012.757 1.633l.432-.249a.75.75 0 11.75 1.299l-.432.249c.098.396.148.81.148 1.233s-.05.837-.148 1.233l.432.249a.75.75 0 11-.75 1.299l-.432-.249A5.001 5.001 0 0112.75 16.64v.61a.75.75 0 01-1.5 0v-.61a5.001 5.001 0 01-2.757-1.633l-.432.249a.75.75 0 01-.75-1.299l.432-.249A5.008 5.008 0 017.25 12c0-.423.05-.837.148-1.233l-.432-.249a.75.75 0 01.75-1.299l.432.249A5.001 5.001 0 0111.25 7.36v-.61zM12 9.75A2.25 2.25 0 1014.25 12 2.253 2.253 0 0012 9.75z" />
                </svg>
              </button>
            </template>
          </ModalHeader>

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
                <button class="text-xs px-2 py-1 rounded-m3-sm bg-primary-50 hover:bg-primary-100 text-primary-700 font-medium" @click="quickPrompt('improvement')">Suggest Improvements</button>
                <button class="text-xs px-2 py-1 rounded-m3-sm bg-tertiary-50 hover:bg-tertiary-100 text-tertiary-700 font-medium" @click="quickPrompt('clarification')">Request Clarification</button>
              </div>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-1 text-xs text-secondary-700">
                  <input type="checkbox" v-model="focusActive" :disabled="!canFocusActive" />
                  <span>Focus active</span>
                </label>
                <select v-model="mode" class="text-xs px-2 py-1 border border-surface-variant rounded-m3-md bg-surface-1">
                  <option value="general">General</option>
                  <option value="improvement">Improvement</option>
                  <option value="clarification">Clarification</option>
                </select>
              </div>
            </div>
            <div>
              <textarea
                v-model="question"
                @keydown="handleKeydown"
                rows="3"
                class="w-full text-sm px-3 py-2 border border-surface-variant rounded-m3-md bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Ask for guidance, improvements, or clarifications... (Ctrl+Enter to send)"
              />
            </div>
            <div class="flex items-center justify-end gap-3">
              <button class="px-4 py-2 rounded-m3-md text-sm bg-surface-variant hover:bg-surface-variant/80 text-secondary-800" @click="closeModal">Close</button>
              <button class="px-4 py-2 rounded-m3-md text-sm bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50" :disabled="isSendDisabled" @click="sendQuestion">Send</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  <!-- TODO(T086-Final): Remove entire legacy modal after UnifiedAssistant fully replaces usage & tests. -->
</template>
<script setup lang="ts">
// DEPRECATED COMPONENT (T086)
// ---------------------------------------------------------------------------
// This legacy modal has been superseded by the unified assistant implementation.
// It remains as a minimal stub until all tests referencing it (legacy usage) are
// migrated or removed. It should not be used for new features.
// TODO(T086-Final): Delete this file after confirming no test or runtime references.
// See `UnifiedAssistant.vue` + `assistantStore` for the active implementation.

import { ref, computed, onMounted } from 'vue';
import { useAIStore } from '@/stores/aiStore';
import ModalHeader from '@/components/ModalHeader.vue';

interface Props { show: boolean }
const props = defineProps<Props>();
const emit = defineEmits<{ close: []; 'open-unified': [] }>();

const aiStore = useAIStore();

// Local state
const question = ref('');
const mode = ref<'general' | 'improvement' | 'clarification'>('general');
const focusActive = ref(false);
const showDeprecationNotice = ref(true);

// Computed
const canFocusActive = computed(() => !!aiStore.activeEntityId);
const isSendDisabled = computed(() => !question.value.trim() || aiStore.isLoading);

function closeModal() { emit('close'); }
function openSettings() { aiStore.openSettings(); }

function quickPrompt(targetMode: 'improvement' | 'clarification') {
  mode.value = targetMode;
  if (targetMode === 'improvement') {
    question.value = 'Review current focus and suggest actionable improvements with impact reasoning.';
  } else if (targetMode === 'clarification') {
    question.value = 'Identify unclear or ambiguous areas needing clarification within the active focus.';
  }
}

function sendQuestion() {
  if (isSendDisabled.value) return;
  aiStore.ask({
    content: question.value.trim(),
    mode: mode.value,
    focusId: focusActive.value && canFocusActive.value ? aiStore.activeEntityId : undefined,
  });
  question.value = '';
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendQuestion();
  }
}

onMounted(() => {
  // Provide a gentle reminder of deprecation in telemetry (if available)
  // TODO(T086-Telemetry): Route this to assistant telemetry service once unified.
  if (aiStore.addTelemetryEvent) {
    try {
      aiStore.addTelemetryEvent({
        type: 'legacy.modal.viewed',
        timestamp: Date.now(),
        metadata: { component: 'AIAssistantModal' }
      });
    } catch {/* ignore */}
  }
});
</script>
