<template>
  <div v-if="operation" class="operation-progress">
    <div class="flex items-center gap-3 p-4 rounded-m3-md bg-primary-50 border border-primary-200">
      <!-- Spinner -->
      <div class="spinner">
        <svg class="animate-spin h-5 w-5 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Progress Info -->
      <div class="flex-1">
        <div class="flex items-center justify-between mb-1">
          <p class="text-sm font-medium text-primary-900">{{ operation.message }}</p>
          <span v-if="operation.progress !== undefined" class="text-xs font-medium text-primary-700">
            {{ Math.round(operation.progress) }}%
          </span>
        </div>

        <!-- Progress Bar -->
        <div v-if="operation.progress !== undefined" class="w-full bg-primary-100 rounded-full h-1.5 overflow-hidden">
          <div 
            class="bg-primary-600 h-1.5 rounded-full transition-all duration-300 ease-out"
            :style="{ width: `${operation.progress}%` }"
          ></div>
        </div>

        <!-- Streaming Text (if available) -->
        <div v-if="props.streamingText" class="mt-2 p-2 rounded-m3-sm bg-primary-100/50 max-h-20 overflow-y-auto">
          <p class="text-xs text-primary-900 font-mono whitespace-pre-wrap">{{ props.streamingText }}</p>
        </div>

        <!-- Elapsed Time -->
        <p class="text-xs text-primary-600 mt-1">
          Elapsed: {{ elapsedTime }}s
        </p>
      </div>

      <!-- Cancel Button (if cancelable) -->
      <button
        v-if="operation.cancelable"
        @click="handleCancel"
        class="px-3 py-1.5 text-xs font-medium text-error-700 bg-error-50 border border-error-200 rounded-m3-sm hover:bg-error-100 transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useContextKitStore, type OperationProgress } from '@/stores/contextKitStore';

const contextKitStore = useContextKitStore();

interface Props {
  operation: OperationProgress | null;
  streamingText?: string;
}

const props = defineProps<Props>();

const elapsedSeconds = ref(0);
let intervalId: number | null = null;

const elapsedTime = computed(() => {
  return (elapsedSeconds.value / 1000).toFixed(1);
});

function startTimer() {
  stopTimer();
  if (props.operation) {
    intervalId = window.setInterval(() => {
      if (props.operation) {
        elapsedSeconds.value = Date.now() - props.operation.startTime;
      }
    }, 100);
  }
}

function stopTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function handleCancel() {
  contextKitStore.cancelCurrentOperation();
}

watch(() => props.operation, (newOp) => {
  if (newOp) {
    elapsedSeconds.value = 0;
    startTimer();
  } else {
    stopTimer();
  }
}, { immediate: true });

onMounted(() => {
  if (props.operation) {
    startTimer();
  }
});

onUnmounted(() => {
  stopTimer();
});
</script>

<style scoped>
.operation-progress {
  margin-bottom: 1rem;
}

.spinner svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
