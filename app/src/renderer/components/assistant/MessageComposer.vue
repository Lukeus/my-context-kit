<template>
  <div class="space-y-2" data-assistant-focus="message-input">
    <div class="flex items-end gap-2">
      <!-- Text Input -->
      <div class="flex-1">
        <textarea
          ref="inputRef"
          v-model="message"
          :disabled="disabled"
          :placeholder="placeholder"
          class="w-full px-3 py-2 border border-surface-variant rounded-m3-md resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-surface-variant disabled:cursor-not-allowed transition-all"
          style="min-height: 60px; max-height: 200px"
          rows="3"
          aria-label="Message input field"
          @keydown="handleKeyDown"
        />
      </div>

      <!-- Send Button -->
      <button
        :disabled="disabled || !canSend"
        class="flex items-center justify-center w-12 h-12 rounded-m3-full bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-surface-variant disabled:text-secondary-400 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 text-xl"
        data-assistant-focus="send-button"
        aria-label="Send message"
        title="Send message (Ctrl+Enter)"
        @click="handleSend"
      >
        <span v-if="!disabled">➤</span>
        <span v-else>⏳</span>
      </button>
    </div>

    <!-- Controls Row -->
    <div class="flex items-center justify-between mt-2 text-xs text-secondary-600">
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1 cursor-pointer">
          <input
            v-model="streamingEnabledLocal"
            type="checkbox"
            :disabled="disabled"
            @change="handleToggleStreaming"
          />
          <span>Streaming</span>
        </label>
        <span v-if="charCount > 0" :class="{ 'text-error-600': charCount > maxChars }">
          {{ charCount }} / {{ maxChars }}
        </span>
      </div>
      <div class="text-xs text-secondary-500">
        Ctrl+Enter to send
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  disabled?: boolean;
  streamingEnabled?: boolean;
  placeholder?: string;
  maxChars?: number;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  streamingEnabled: true,
  placeholder: 'Ask a question or describe a task...',
  maxChars: 4000
});

const emit = defineEmits<{
  send: [content: string];
  'toggle-streaming': [enabled: boolean];
}>();

// Local state
const message = ref('');
const inputRef = ref<HTMLTextAreaElement | null>(null);
const streamingEnabledLocal = ref(props.streamingEnabled);

// Computed
const charCount = computed(() => message.value.length);
const canSend = computed(() => message.value.trim().length > 0 && charCount.value <= props.maxChars);

// Watch for prop changes
watch(() => props.streamingEnabled, (newVal) => {
  streamingEnabledLocal.value = newVal;
});

// Methods
function handleSend() {
  if (!canSend.value) return;

  const content = message.value.trim();
  emit('send', content);
  message.value = '';

  setTimeout(() => {
    inputRef.value?.focus();
  }, 100);
}

function handleToggleStreaming() {
  emit('toggle-streaming', streamingEnabledLocal.value);
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    handleSend();
  }
}

// Auto-resize textarea
watch(message, () => {
  if (!inputRef.value) return;
  inputRef.value.style.height = 'auto';
  inputRef.value.style.height = `${inputRef.value.scrollHeight}px`;
});
</script>

