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
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30"
        @click="handleBackdropClick"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Generated Prompt</h2>
              <p v-if="entityId" class="text-sm text-gray-600 mt-1">Entity: {{ entityId }}</p>
            </div>
            <button
              @click="emit('close')"
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="!prompt" class="text-center text-gray-500 py-8">
              No prompt content available
            </div>
            <div v-else class="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <pre class="text-sm font-mono text-gray-800 whitespace-pre-wrap break-words">{{ prompt }}</pre>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div class="text-sm text-gray-600">
              <span v-if="prompt">{{ promptLines.length }} lines, {{ prompt.length }} characters</span>
              <span v-if="copyError" class="text-red-600 ml-4">{{ copyError }}</span>
            </div>
            <div class="flex gap-3">
              <button
                @click="copyToClipboard"
                :disabled="!prompt"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
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

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
  transition: transform 0.2s ease;
}

.modal-enter-from .bg-white {
  transform: scale(0.95);
}

.modal-leave-to .bg-white {
  transform: scale(0.95);
}
</style>
