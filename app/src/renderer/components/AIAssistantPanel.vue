<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAIStore } from '../stores/aiStore';
import { useContextStore } from '../stores/contextStore';

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
});

watch(() => contextStore.activeEntityId, (id) => {
  if (!id) {
    focusActive.value = false;
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

function openSettings() {
  emit('open-settings');
}

function applyEdit(messageId: string, editIndex: number) {
  aiStore.applyEdit(messageId, editIndex);
}
</script>

<template>
  <div class="h-full flex flex-col bg-surface-1 text-secondary-900">
    <div class="px-4 py-4 border-b border-surface-variant bg-surface-2 flex items-start justify-between gap-3">
      <div class="space-y-1 min-w-0">
        <h2 class="text-base font-semibold text-secondary-900">Context Assistant</h2>
        <p class="text-xs text-secondary-600">Grounded recommendations and answers from the active repository snapshot.</p>
      </div>
      <button
        class="p-2 rounded-m3-md text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 transition-colors"
        title="AI Settings"
        @click="openSettings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.25 6.75a.75.75 0 011.5 0v.61a5.001 5.001 0 012.757 1.633l.432-.249a.75.75 0 11.75 1.299l-.432.249c.098.396.148.81.148 1.233s-.05.837-.148 1.233l.432.249a.75.75 0 11-.75 1.299l-.432-.249A5.001 5.001 0 0112.75 16.64v.61a.75.75 0 01-1.5 0v-.61a5.001 5.001 0 01-2.757-1.633l-.432.249a.75.75 0 01-.75-1.299l.432-.249A5.008 5.008 0 017.25 12c0-.423.05-.837.148-1.233l-.432-.249a.75.75 0 01.75-1.299l.432.249A5.001 5.001 0 0111.25 7.36v-.61zM12 9.75A2.25 2.25 0 1014.25 12 2.253 2.253 0 0012 9.75z" />
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
      <div v-if="!aiStore.hasConversation && !aiStore.isLoading" class="text-xs text-secondary-600 bg-surface-2 border border-dashed border-surface-variant rounded-m3-lg p-4">
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
        class="rounded-m3-lg border px-3 py-2.5 shadow-elevation-1"
        :class="message.role === 'assistant' ? 'bg-primary-50 border-primary-100' : 'bg-surface-1 border-surface-variant'"
      >
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="px-2 py-0.5 text-[11px] font-semibold rounded-m3-full"
              :class="message.role === 'assistant' ? 'bg-primary-100 text-primary-700' : 'bg-secondary-200 text-secondary-700'"
            >
              {{ message.role === 'assistant' ? 'Assistant' : 'You' }}
            </span>
            <span class="text-[11px] text-secondary-500 uppercase tracking-wide">{{ message.mode }}</span>
            <span v-if="message.focusId" class="text-[11px] text-secondary-500">Focus: {{ message.focusId }}</span>
          </div>
          <span class="text-[10px] text-secondary-400 uppercase tracking-wide">{{ new Date(message.createdAt).toLocaleTimeString() }}</span>
        </div>

        <p class="text-xs text-secondary-900 leading-relaxed whitespace-pre-wrap">{{ message.content }}</p>

        <div v-if="message.suggestions && message.suggestions.length" class="mt-2 space-y-1">
          <h4 class="text-[10px] font-semibold text-primary-700 uppercase tracking-wide">Improvement ideas</h4>
          <ul class="space-y-1">
            <li
              v-for="suggestion in message.suggestions"
              :key="`${message.id}-${suggestion.target}`"
              class="text-xs bg-primary-50 border border-primary-100 rounded-m3-md px-2.5 py-2"
            >
              <div class="font-semibold text-primary-800 flex items-center gap-2">
                <span class="font-mono text-[10px] bg-primary-200 text-primary-800 px-2 py-0.5 rounded-m3-full">{{ suggestion.target }}</span>
                <span>{{ suggestion.suggestion }}</span>
              </div>
              <p v-if="suggestion.impact" class="text-[10px] text-primary-700 mt-1">Impact: {{ suggestion.impact }}</p>
            </li>
          </ul>
        </div>

        <div v-if="message.clarifications && message.clarifications.length" class="mt-2 space-y-1">
          <h4 class="text-[10px] font-semibold text-tertiary-800 uppercase tracking-wide">Clarifications needed</h4>
          <ul class="space-y-1">
            <li
              v-for="(item, index) in message.clarifications"
              :key="`${message.id}-clarify-${index}`"
              class="text-xs bg-tertiary-50 border border-tertiary-200 rounded-m3-md px-2.5 py-2 text-tertiary-900"
            >{{ item }}</li>
          </ul>
        </div>

        <div v-if="message.followUps && message.followUps.length" class="mt-2 space-y-1">
          <h4 class="text-[10px] font-semibold text-secondary-700 uppercase tracking-wide">Suggested follow-ups</h4>
          <ul class="space-y-1">
            <li
              v-for="(item, index) in message.followUps"
              :key="`${message.id}-follow-${index}`"
              class="text-[11px] bg-surface-3 border border-surface-variant rounded-m3-md px-2.5 py-1.5 text-secondary-800"
            >{{ item }}</li>
          </ul>
        </div>

        <div v-if="message.references && message.references.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="(reference, index) in message.references"
            :key="`${message.id}-ref-${index}`"
            class="px-2.5 py-1 text-[10px] bg-secondary-100 text-secondary-800 rounded-m3-full border border-secondary-200"
            :title="reference.note || ''"
          >{{ reference.type }} · {{ reference.id }}</span>
        </div>

        <div v-if="message.edits && message.edits.length" class="mt-3 space-y-2">
          <h4 class="text-[10px] font-semibold text-secondary-700 uppercase tracking-wide">Proposed edits</h4>
          <div
            v-for="(edit, editIndex) in message.edits"
            :key="`${message.id}-edit-${editIndex}`"
            class="border border-surface-variant bg-surface-3 rounded-m3-md p-3 space-y-2"
          >
            <div class="flex items-center justify-between gap-2">
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
            <pre class="bg-surface-1 border border-surface-variant rounded-m3-md p-2 text-[10px] text-secondary-700 overflow-auto max-h-48 whitespace-pre-wrap">{{ edit.updatedContent }}</pre>
            <div class="flex items-center justify-between gap-2">
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
            <!-- TODO: Replace raw content preview with a proper diff viewer once diff utilities are available. -->
          </div>
        </div>
      </div>

      <div v-if="aiStore.isLoading" class="flex items-center gap-2 text-xs text-secondary-600">
        <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-secondary-300 border-t-secondary-600"></span>
        Thinking through the repository snapshot...
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
