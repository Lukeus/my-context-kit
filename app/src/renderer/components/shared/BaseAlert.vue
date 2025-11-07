<script setup lang="ts">
/**
 * BaseAlert Component
 * 
 * Unified alert/banner system with severity-based styling, icons, actions, and transitions.
 * Replaces 5+ duplicate alert implementations across the app.
 * 
 * @example
 * <BaseAlert
 *   severity="error"
 *   title="Service Unavailable"
 *   message="The Context Kit service is not responding."
 *   dismissible
 *   action-label="Retry"
 *   :action-callback="handleRetry"
 *   @dismiss="clearError"
 * />
 */

import { computed } from 'vue';

// NOTE: Internal component-only type; do not export to avoid barrel duplication issues.
type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

interface Props {
  severity?: AlertSeverity;
  title?: string;
  message: string;
  dismissible?: boolean;
  actionLabel?: string;
  actionCallback?: () => void | Promise<void>;
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'info',
  dismissible: true
});

const emit = defineEmits<{ dismiss: [] }>();

const severityConfig = computed(() => {
  const configs = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      icon: 'text-blue-600',
      actionBg: 'bg-blue-600 hover:bg-blue-700',
      actionText: 'text-white',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-900',
      icon: 'text-green-600',
      actionBg: 'bg-green-600 hover:bg-green-700',
      actionText: 'text-white',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-900',
      icon: 'text-orange-600',
      actionBg: 'bg-orange-600 hover:bg-orange-700',
      actionText: 'text-white',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    error: {
      bg: 'bg-error-50',
      border: 'border-error-200',
      text: 'text-error-900',
      icon: 'text-error-600',
      actionBg: 'bg-error-600 hover:bg-error-700',
      actionText: 'text-white',
      iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  };
  return configs[props.severity];
});

async function handleAction() {
  if (props.actionCallback) {
    await props.actionCallback();
  }
}
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
      class="rounded-m3-md border p-4 shadow-elevation-1"
      :class="[severityConfig.bg, severityConfig.border]"
      role="alert"
      :aria-live="severity === 'error' ? 'assertive' : 'polite'"
    >
      <div class="flex items-start gap-3">
        <!-- Icon -->
        <svg
          v-if="!icon"
          class="w-5 h-5 flex-shrink-0"
          :class="severityConfig.icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            :d="severityConfig.iconPath"
          />
        </svg>
        <span v-else class="text-xl flex-shrink-0">{{ icon }}</span>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <h4 v-if="title" class="text-sm font-semibold mb-1" :class="severityConfig.text">
            {{ title }}
          </h4>
          <p class="text-sm" :class="severityConfig.text">
            {{ message }}
          </p>

          <!-- Action Button -->
          <button
            v-if="actionLabel && actionCallback"
            @click="handleAction"
            class="mt-3 text-xs font-semibold px-3 py-1.5 rounded-m3-md transition-colors"
            :class="[severityConfig.actionBg, severityConfig.actionText]"
          >
            {{ actionLabel }}
          </button>
        </div>

        <!-- Dismiss Button -->
        <button
          v-if="dismissible"
          @click="emit('dismiss')"
          class="flex-shrink-0 text-secondary-400 hover:text-secondary-600 p-1 rounded-m3-sm hover:bg-surface-3 transition-colors"
          aria-label="Dismiss alert"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>
