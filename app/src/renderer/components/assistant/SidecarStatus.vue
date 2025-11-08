<template>
  <div class="sidecar-status-wrapper">
    <div class="sidecar-status">
      <div class="status-indicator" :class="statusClass">
        <span class="status-dot"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
      
      <button
        v-if="showTestButton"
        @click="handleTest"
        class="btn-test"
        :disabled="isTesting"
      >
        {{ isTesting ? 'Testing...' : 'Test Configuration' }}
      </button>
      
      <button
        v-if="showStartButton"
        @click="handleStart"
        class="btn-start"
        :disabled="isStarting"
      >
        {{ isStarting ? 'Starting...' : 'Start Sidecar' }}
      </button>
      
      <button
        v-if="showStopButton"
        @click="handleStop"
        class="btn-stop"
        :disabled="isStopping"
      >
        {{ isStopping ? 'Stopping...' : 'Stop Sidecar' }}
      </button>
    </div>
    
    <!-- Validation errors -->
    <div v-if="validationErrors.length > 0" class="validation-errors">
      <div class="error-header">⚠️ Configuration Issues:</div>
      <ul class="error-list">
        <li v-for="(error, index) in validationErrors" :key="index">{{ error }}</li>
      </ul>
    </div>
    
    <!-- Sidecar error -->
    <div v-if="sidecarError" class="sidecar-error">
      <div class="error-header">❌ Error:</div>
      <pre class="error-message">{{ sidecarError }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useAssistantStore } from '@/stores/assistantStore';

const assistantStore = useAssistantStore();
const isTesting = ref(false);
const validationErrors = ref<string[]>([]);

const statusClass = computed(() => {
  switch (assistantStore.sidecarStatus) {
    case 'running':
      return 'status-running';
    case 'error':
      return 'status-error';
    case 'starting':
    case 'stopping':
      return 'status-transitioning';
    default:
      return 'status-stopped';
  }
});

const statusText = computed(() => {
  if (assistantStore.sidecarStatus === 'running') {
    return assistantStore.sidecarHealthy ? 'Sidecar Running' : 'Sidecar Unhealthy';
  }
  return assistantStore.sidecarStatus.charAt(0).toUpperCase() + assistantStore.sidecarStatus.slice(1);
});

const isStarting = computed(() => assistantStore.sidecarStatus === 'starting');
const isStopping = computed(() => assistantStore.sidecarStatus === 'stopping');
const showStartButton = computed(() => 
  assistantStore.sidecarStatus === 'stopped' || assistantStore.sidecarStatus === 'error'
);
const showStopButton = computed(() => assistantStore.sidecarStatus === 'running');
const showTestButton = computed(() => 
  assistantStore.sidecarStatus === 'stopped' || assistantStore.sidecarStatus === 'error'
);
const sidecarError = computed(() => assistantStore.error);

async function handleTest() {
  isTesting.value = true;
  validationErrors.value = [];
  
  try {
    const result = await assistantStore.validateSidecarConfig();
    if (result.valid) {
      validationErrors.value = ['✅ Configuration is valid!'];
      setTimeout(() => {
        validationErrors.value = [];
      }, 3000);
    } else {
      validationErrors.value = result.errors;
    }
  } catch (err) {
    validationErrors.value = ['Failed to validate configuration: ' + (err instanceof Error ? err.message : 'Unknown error')];
  } finally {
    isTesting.value = false;
  }
}

async function handleStart() {
  validationErrors.value = []; // Clear any previous validation errors
  await assistantStore.startSidecar();
}

async function handleStop() {
  validationErrors.value = [];
  await assistantStore.stopSidecar();
}

// Poll health while running
let healthInterval: number | null = null;

onMounted(() => {
  // Check initial status
  assistantStore.checkSidecarHealth();
  
  // Poll health every 5 seconds
  healthInterval = window.setInterval(() => {
    if (assistantStore.sidecarStatus === 'running') {
      assistantStore.checkSidecarHealth();
    }
  }, 5000);
});

onUnmounted(() => {
  if (healthInterval) {
    clearInterval(healthInterval);
  }
});
</script>

<style scoped>
.sidecar-status-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidecar-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-background-soft, #f5f5f5);
  border-radius: 6px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
}

.status-running .status-dot {
  background: #10b981;
  animation: pulse 2s infinite;
}

.status-error .status-dot {
  background: #ef4444;
}

.status-transitioning .status-dot {
  background: #f59e0b;
  animation: blink 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #333);
}

.btn-start,
.btn-stop,
.btn-test {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-start {
  background: #10b981;
  color: white;
}

.btn-start:hover:not(:disabled) {
  background: #059669;
}

.btn-stop {
  background: #ef4444;
  color: white;
}

.btn-stop:hover:not(:disabled) {
  background: #dc2626;
}

.btn-test {
  background: #3b82f6;
  color: white;
}

.btn-test:hover:not(:disabled) {
  background: #2563eb;
}

.btn-start:disabled,
.btn-stop:disabled,
.btn-test:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.validation-errors,
.sidecar-error {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.validation-errors {
  background: #fef3c7;
  border: 1px solid #fbbf24;
}

.validation-errors .error-list li:first-child:last-child {
  color: #047857;
  font-weight: 600;
}

.sidecar-error {
  background: #fee2e2;
  border: 1px solid #ef4444;
}

.error-header {
  font-weight: 600;
  margin-bottom: 6px;
  color: #92400e;
}

.sidecar-error .error-header {
  color: #991b1b;
}

.error-list {
  margin: 0;
  padding-left: 20px;
  color: #92400e;
}

.error-list li {
  margin: 4px 0;
}

.error-message {
  margin: 0;
  color: #991b1b;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}
</style>
