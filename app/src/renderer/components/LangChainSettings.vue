<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useLangChainStore } from '../stores/langchainStore';
import { useSnackbarStore } from '../stores/snackbarStore';

const langchainStore = useLangChainStore();
const snackbarStore = useSnackbarStore();

const isAvailable = ref(false);
const isToggling = ref(false);
const showMetrics = ref(false);

onMounted(async () => {
  await langchainStore.loadSettings();
  isAvailable.value = await langchainStore.checkAvailability();
});

const statusColor = computed(() => {
  if (!isAvailable.value) return 'text-secondary-500';
  return langchainStore.enabled ? 'text-success-600' : 'text-secondary-600';
});

const statusIcon = computed(() => {
  if (!isAvailable.value) return '⚠️';
  return langchainStore.enabled ? '✅' : '⭕';
});

const statusText = computed(() => {
  if (!isAvailable.value) return 'Not Available (set USE_LANGCHAIN=true)';
  return langchainStore.enabled ? 'Enabled' : 'Disabled';
});

async function handleToggle() {
  if (!isAvailable.value) {
    snackbarStore.show('LangChain is not available. Set USE_LANGCHAIN=true environment variable and restart.', 'error');
    return;
  }

  isToggling.value = true;
  try {
    const success = await langchainStore.toggle();
    if (success) {
      const message = langchainStore.enabled 
        ? 'LangChain enabled! Entity generation and AI features will use the new implementation.' 
        : 'LangChain disabled. Using legacy AI implementation.';
      snackbarStore.show(message, 'success');
    } else {
      snackbarStore.show('Failed to toggle LangChain', 'error');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    snackbarStore.show(message, 'error');
  } finally {
    isToggling.value = false;
  }
}

async function handleClearCache() {
  try {
    await langchainStore.clearCache();
    snackbarStore.show('Model cache cleared successfully', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear cache';
    snackbarStore.show(message, 'error');
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatPercentage(percent: number): string {
  return `${percent.toFixed(1)}%`;
}
</script>

<template>
  <div class="bg-surface-1 rounded-m3-lg p-6 border border-surface-variant shadow-elevation-2">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-m3-md bg-primary-100 flex items-center justify-center">
          <span class="text-2xl">🔗</span>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-secondary-900">LangChain Integration</h3>
          <p class="text-sm text-secondary-600">Advanced AI implementation (Experimental)</p>
        </div>
      </div>
      
      <!-- Status Badge -->
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-m3-md-full bg-surface-2 border border-surface-variant">
        <span class="text-lg">{{ statusIcon }}</span>
        <span class="text-sm font-medium" :class="statusColor">{{ statusText }}</span>
      </div>
    </div>

    <!-- Main Toggle -->
    <div class="bg-surface-2 rounded-m3-md p-4 mb-5 border border-surface-variant">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <label class="flex items-center cursor-pointer group">
            <div class="relative">
              <input 
                type="checkbox" 
                :checked="langchainStore.enabled"
                @change="handleToggle"
                :disabled="!isAvailable || isToggling"
                class="sr-only peer"
              />
              <!-- Custom Toggle Switch (Material 3 style) -->
              <div class="w-12 h-7 bg-surface-variant rounded-m3-md-full peer-checked:bg-primary-600 peer-disabled:opacity-50 transition-all duration-300 shadow-elevation-1">
                <div class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-m3-md-full shadow-elevation-2 transform transition-transform duration-300 peer-checked:translate-x-5"></div>
              </div>
            </div>
            <div class="ml-4">
              <span class="text-sm font-medium text-secondary-900 group-hover:text-primary-700 transition-colors">
                Use LangChain for AI Operations
              </span>
              <p class="text-xs text-secondary-600 mt-0.5">
                Enables structured outputs, better streaming, and automatic retries
              </p>
            </div>
          </label>
        </div>
      </div>

      <!-- Availability Warning -->
      <div v-if="!isAvailable" class="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-m3-md flex items-start gap-2">
        <svg class="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-warning-800">LangChain Not Available</p>
          <p class="text-xs text-warning-700 mt-1">
            Set <code class="px-1 py-0.5 bg-warning-100 rounded">USE_LANGCHAIN=true</code> environment variable and restart the app to enable LangChain.
          </p>
        </div>
      </div>

      <!-- Feature Benefits -->
      <div v-if="isAvailable && !langchainStore.enabled" class="mt-4 space-y-2">
        <p class="text-xs font-medium text-secondary-700 uppercase tracking-wide">Benefits of LangChain:</p>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Guaranteed valid entities</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Automatic retries</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Better error handling</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Model caching</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Metrics Section -->
    <div v-if="langchainStore.enabled">
      <button 
        @click="showMetrics = !showMetrics"
        class="w-full flex items-center justify-between px-4 py-3 bg-surface-2 hover:bg-surface-3 rounded-m3-md transition-colors border border-surface-variant text-sm font-medium text-secondary-900"
      >
        <span class="flex items-center gap-2">
          📊 Performance Metrics
          <span v-if="langchainStore.metrics.totalRequests > 0" class="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-m3-md-full">
            {{ formatNumber(langchainStore.metrics.totalRequests) }} requests
          </span>
        </span>
        <svg 
          class="w-5 h-5 transform transition-transform" 
          :class="{ 'rotate-180': showMetrics }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Metrics Details -->
      <div v-if="showMetrics" class="mt-3 space-y-3 animate-fadeIn">
        <!-- Stats Grid -->
        <div class="grid grid-cols-3 gap-3">
          <!-- Success Rate -->
          <div class="bg-surface-2 rounded-m3-md p-3 border border-surface-variant">
            <div class="text-xs text-secondary-600 mb-1">Success Rate</div>
            <div class="text-2xl font-bold" :class="langchainStore.successRate >= 90 ? 'text-success-600' : langchainStore.successRate >= 70 ? 'text-warning-600' : 'text-error-600'">
              {{ formatPercentage(langchainStore.successRate) }}
            </div>
            <div class="text-xs text-secondary-500 mt-1">
              {{ formatNumber(langchainStore.metrics.successfulRequests) }}/{{ formatNumber(langchainStore.metrics.totalRequests) }}
            </div>
          </div>

          <!-- Cache Hit Rate -->
          <div class="bg-surface-2 rounded-m3-md p-3 border border-surface-variant">
            <div class="text-xs text-secondary-600 mb-1">Cache Hit Rate</div>
            <div class="text-2xl font-bold text-primary-600">
              {{ formatPercentage(langchainStore.cacheHitRate) }}
            </div>
            <div class="text-xs text-secondary-500 mt-1">
              {{ formatNumber(langchainStore.metrics.cacheHits) }} hits
            </div>
          </div>

          <!-- Avg Response Time -->
          <div class="bg-surface-2 rounded-m3-md p-3 border border-surface-variant">
            <div class="text-xs text-secondary-600 mb-1">Avg Response</div>
            <div class="text-2xl font-bold text-secondary-900">
              {{ formatTime(langchainStore.metrics.averageResponseTime) }}
            </div>
            <div class="text-xs text-secondary-500 mt-1">
              per request
            </div>
          </div>
        </div>

        <!-- Active Streams -->
        <div v-if="langchainStore.hasActiveStreams" class="bg-primary-50 border border-primary-200 rounded-m3-md p-3 flex items-center gap-2">
          <div class="w-2 h-2 bg-primary-600 rounded-full animate-pulse"></div>
          <span class="text-sm text-primary-800">
            {{ langchainStore.activeStreamCount }} active stream{{ langchainStore.activeStreamCount !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button 
            @click="langchainStore.resetMetrics()"
            class="flex-1 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-secondary-800 rounded-m3-md border border-surface-variant text-sm font-medium transition-colors"
          >
            Reset Metrics
          </button>
          <button 
            @click="handleClearCache"
            class="flex-1 px-4 py-2 bg-surface-2 hover:bg-surface-3 text-secondary-800 rounded-m3-md border border-surface-variant text-sm font-medium transition-colors"
          >
            Clear Cache
          </button>
        </div>
      </div>
    </div>

    <!-- Info Footer -->
    <div class="mt-5 p-3 bg-surface-2 rounded-m3-md border border-surface-variant">
      <div class="flex items-start gap-2">
        <svg class="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="flex-1">
          <p class="text-xs text-secondary-700">
            <strong>Note:</strong> LangChain provides better reliability through structured outputs and automatic error handling. 
            Your legacy AI implementation remains available as a fallback.
          </p>
          <p class="text-xs text-secondary-600 mt-1">
            Learn more: <a href="#" class="text-primary-600 hover:text-primary-700 underline">LangChain Documentation</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

/* Material 3 elevation shadows */
.shadow-elevation-1 {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.shadow-elevation-2 {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
}

code {
  font-family: 'Courier New', monospace;
}
</style>
