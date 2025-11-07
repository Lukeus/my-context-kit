<template>
  <div
    v-if="show"
    :class="['fallback-banner', `fallback-banner-${severity}`]"
    role="alert"
    :aria-live="severity === 'error' ? 'assertive' : 'polite'"
  >
    <div class="fallback-banner-icon">
      {{ icon }}
    </div>
    <div class="fallback-banner-content">
      <div class="fallback-banner-title">
        {{ title }}
      </div>
      <div class="fallback-banner-message">
        {{ message }}
      </div>
      <div v-if="showActions" class="fallback-banner-actions">
        <button
          v-if="canRetry"
          class="fallback-banner-button fallback-banner-button-primary"
          @click="handleRetry"
        >
          Retry Connection
        </button>
        <button
          v-if="canDismiss"
          class="fallback-banner-button fallback-banner-button-secondary"
          @click="handleDismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
    <button
      v-if="closable"
      class="fallback-banner-close"
      aria-label="Close banner"
      @click="handleClose"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface Props {
  show?: boolean;
  severity?: 'info' | 'warning' | 'error';
  title?: string;
  message: string;
  closable?: boolean;
  canRetry?: boolean;
  canDismiss?: boolean;
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  severity: 'warning',
  title: '',
  closable: true,
  canRetry: true,
  canDismiss: false,
  showActions: true
});

const emit = defineEmits<{
  close: [];
  retry: [];
  dismiss: [];
}>();

const icon = computed(() => {
  switch (props.severity) {
    case 'error':
      return '⚠️';
    case 'warning':
      return '⚡';
    case 'info':
      return 'ℹ️';
    default:
      return '⚡';
  }
});

function handleClose() {
  emit('close');
}

function handleRetry() {
  emit('retry');
}

function handleDismiss() {
  emit('dismiss');
}
</script>

<style scoped>
.fallback-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid;
  margin-bottom: 16px;
  animation: slide-down 0.3s ease-out;
}

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fallback-banner-info {
  background-color: #E3F2FD;
  border-color: #2196F3;
  color: #1565C0;
}

.fallback-banner-warning {
  background-color: #FFF3E0;
  border-color: #FF9800;
  color: #E65100;
}

.fallback-banner-error {
  background-color: #FFEBEE;
  border-color: #F44336;
  color: #C62828;
}

.fallback-banner-icon {
  font-size: 24px;
  flex-shrink: 0;
  line-height: 1;
}

.fallback-banner-content {
  flex: 1;
  min-width: 0;
}

.fallback-banner-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.fallback-banner-message {
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.9;
}

.fallback-banner-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.fallback-banner-button {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.fallback-banner-button-primary {
  background-color: currentColor;
  color: white;
  opacity: 0.9;
}

.fallback-banner-button-primary:hover {
  opacity: 1;
}

.fallback-banner-button-secondary {
  background-color: transparent;
  border-color: currentColor;
  color: currentColor;
  opacity: 0.7;
}

.fallback-banner-button-secondary:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.05);
}

.fallback-banner-close {
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
  opacity: 0.5;
  transition: opacity 0.2s;
  color: currentColor;
}

.fallback-banner-close:hover {
  opacity: 1;
}

/* Accessibility */
.fallback-banner:focus-within {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
