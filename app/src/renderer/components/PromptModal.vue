<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  show: boolean;
  prompt?: string;
  entityId?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const isCopied = ref(false);
const copyError = ref<string | null>(null);

const promptLines = computed(() => {
  if (!props.prompt) return [];
  return props.prompt.split('\n');
});

async function copyToClipboard() {
  if (!props.prompt) return;
  
  try {
    const result = await window.api.clipboard.writeText(props.prompt);
    if (result.ok) {
      isCopied.value = true;
      copyError.value = null;
      setTimeout(() => {
        isCopied.value = false;
      }, 2000);
    } else {
      copyError.value = result.error || 'Failed to copy';
    }
  } catch (error: any) {
    copyError.value = error.message || 'Failed to copy';
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click="handleBackdropClick"
      >
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden border border-surface-variant">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-surface-variant bg-surface-2 flex-shrink-0">
            <div>
              <h2 class="text-xl font-semibold text-secondary-900">Generated Prompt</h2>
              <p v-if="entityId" class="text-sm text-secondary-600 mt-1">Entity: {{ entityId }}</p>
            </div>
            <button
              @click="emit('close')"
              class="p-2 hover:bg-surface-3 rounded-m3-md transition-colors text-secondary-600 hover:text-secondary-900"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 bg-surface">
            <div v-if="!prompt" class="text-center text-secondary-500 py-8">
              No prompt content available
            </div>
            <div v-else class="bg-surface-2 rounded-m3-md border border-surface-variant p-4">
              <pre class="text-sm font-mono text-secondary-900 whitespace-pre-wrap break-words">{{ prompt }}</pre>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-6 py-5 border-t border-surface-variant bg-surface-2 flex-shrink-0">
            <div class="text-sm text-secondary-600">
              <span v-if="prompt">{{ promptLines.length }} lines, {{ prompt.length }} characters</span>
              <span v-if="copyError" class="text-error-600 ml-4">{{ copyError }}</span>
            </div>
            <div class="flex gap-3">
              <button
                @click="copyToClipboard"
                :disabled="!prompt"
                class="px-5 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-m3-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-elevation-2 hover:shadow-elevation-3 flex items-center gap-2"
              >
                <svg v-if="!isCopied" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                {{ isCopied ? 'Copied!' : 'Copy to Clipboard' }}
              </button>
              <button
                @click="emit('close')"
                class="px-5 py-2.5 text-sm font-medium text-secondary-700 hover:bg-surface-3 rounded-m3-md transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div > div,
.modal-leave-active > div > div {
  transition: transform 0.2s ease;
}

.modal-enter-from > div > div {
  transform: scale(0.95);
}

.modal-leave-to > div > div {
  transform: scale(0.95);
}
</style>
