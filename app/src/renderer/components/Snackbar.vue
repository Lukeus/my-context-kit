<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  show: boolean;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  action?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
  action: ''
});

const emit = defineEmits<{
  close: [];
  action: [];
}>();

const colorClasses = computed(() => {
  switch (props.type) {
    case 'success':
      return 'bg-success-700 text-white border-success-600';
    case 'warning':
      return 'bg-warning-700 text-white border-warning-600';
    case 'error':
      return 'bg-error-700 text-white border-error-600';
    default:
      return 'bg-surface-4 text-secondary-900 border-surface-variant';
  }
});

const iconClasses = computed(() => {
  switch (props.type) {
    case 'success':
      return 'text-white';
    case 'warning':
      return 'text-white';
    case 'error':
      return 'text-white';
    default:
      return 'text-secondary-700';
  }
});

const icon = computed(() => {
  switch (props.type) {
    case 'success':
      return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
    case 'warning':
      return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
    case 'error':
      return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
    default:
      return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
  }
});
</script>

<template>
  <Transition name="snackbar">
    <div
      v-if="show"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-m3-md border-2 shadow-elevation-3 min-w-[320px] max-w-[560px]"
      :class="colorClasses"
      role="alert"
      aria-live="polite"
    >
      <!-- Icon -->
      <svg
        class="w-5 h-5 flex-shrink-0"
        :class="iconClasses"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          :d="icon"
        />
      </svg>

      <!-- Message -->
      <span class="flex-1 text-sm font-medium">{{ message }}</span>

      <!-- Action Button -->
      <button
        v-if="action"
        @click="emit('action')"
        class="px-3 py-1 text-xs font-semibold rounded-m3-md transition-colors"
        :class="type === 'info' ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-white bg-opacity-20 hover:bg-opacity-30'"
      >
        {{ action }}
      </button>

      <!-- Close Button -->
      <button
        @click="emit('close')"
        class="p-1 rounded-m3-md hover:bg-white hover:bg-opacity-20 transition-colors"
        aria-label="Close"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.snackbar-enter-active,
.snackbar-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.snackbar-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}

.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
