<script setup lang="ts">
import { computed } from 'vue';
import { useContextKitErrors, type ErrorInfo } from '@/composables/useContextKitErrors';

const props = defineProps<{
  error: string | Error | unknown | null;
  show?: boolean;
}>();

const emit = defineEmits<{
  'dismiss': [];
  'retry'?: [];
}>();

const { parseError, getSeverityIcon, getSeverityColors } = useContextKitErrors();

const errorInfo = computed<ErrorInfo | null>(() => {
  if (!props.error) return null;
  return parseError(props.error);
});

const colors = computed(() => {
  if (!errorInfo.value) return null;
  return getSeverityColors(errorInfo.value.severity);
});

const iconPath = computed(() => {
  if (!errorInfo.value) return '';
  return getSeverityIcon(errorInfo.value.severity);
});

const shouldShow = computed(() => {
  return props.show !== undefined ? props.show && errorInfo.value : errorInfo.value;
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="shouldShow && errorInfo && colors"
      class="rounded-m3-md border p-4 shadow-elevation-1"
      :class="[colors.bg, colors.border]"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <!-- Icon -->
        <svg
          class="w-5 h-5 flex-shrink-0 mt-0.5"
          :class="colors.icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPath" />
        </svg>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-semibold" :class="colors.text">
            {{ errorInfo.title }}
          </h4>
          
          <p class="text-sm mt-1" :class="colors.text">
            {{ errorInfo.message }}
          </p>
          
          <p v-if="errorInfo.suggestion" class="text-sm mt-2 font-medium" :class="colors.text">
            💡 {{ errorInfo.suggestion }}
          </p>

          <!-- Actions -->
          <div v-if="errorInfo.recoveryAction || emit" class="flex gap-2 mt-3">
            <button
              v-if="errorInfo.recoveryAction"
              @click="errorInfo.recoveryAction"
              class="px-3 py-1.5 text-xs font-semibold rounded-m3-md transition-colors"
              :class="[
                errorInfo.severity === 'error' ? 'bg-error-600 hover:bg-error-700 text-white' :
                errorInfo.severity === 'warning' ? 'bg-warning hover:bg-warning-hover text-on-warning' :
                'bg-primary hover:bg-primary-hover text-on-primary'
              ]"
            >
              {{ errorInfo.recoveryLabel || 'Retry' }}
            </button>
            
            <button
              @click="emit('dismiss')"
              class="px-3 py-1.5 text-xs font-medium rounded-m3-md transition-colors"
              :class="[
                errorInfo.severity === 'error' ? 'text-error-700 hover:bg-error-100' :
                errorInfo.severity === 'warning' ? 'text-warning hover:bg-warning-container' :
                'text-primary hover:bg-primary-container'
              ]"
            >
              Dismiss
            </button>
          </div>
        </div>

        <!-- Close button -->
        <button
          @click="emit('dismiss')"
          class="flex-shrink-0 text-secondary-400 hover:text-secondary-600 transition-colors p-1 rounded-m3-md hover:bg-surface-3"
          aria-label="Close error"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>
