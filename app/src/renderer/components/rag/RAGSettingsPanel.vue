<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRAGStore } from '../../stores/ragStore';
import { useSnackbarStore } from '../../stores/snackbarStore';

const ragStore = useRAGStore();
const snackbarStore = useSnackbarStore();

const isIndexing = ref(false);
const showAdvanced = ref(false);

onMounted(async () => {
  await ragStore.loadSettings();
});

const statusColor = computed(() => {
  if (!ragStore.isIndexed.value) return 'text-warning-600';
  return ragStore.settings.enabled ? 'text-success-600' : 'text-secondary-600';
});

const statusIcon = computed(() => {
  if (ragStore.indexing.inProgress) return '⏳';
  if (!ragStore.isIndexed.value) return '⚠️';
  return ragStore.settings.enabled ? '✅' : '⭕';
});

const statusText = computed(() => {
  if (ragStore.indexing.inProgress) return 'Indexing...';
  if (!ragStore.isIndexed.value) return 'Not Indexed';
  return ragStore.settings.enabled ? 'Enabled & Ready' : 'Disabled';
});

async function handleToggle() {
  try {
    const success = await ragStore.toggleEnabled();
    if (success) {
      const message = ragStore.settings.enabled
        ? 'RAG enabled! Context-aware responses will use semantic search.'
        : 'RAG disabled. Using standard responses.';
      snackbarStore.show(message, 'success');
    } else {
      snackbarStore.show('Failed to toggle RAG', 'error');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    snackbarStore.show(message, 'error');
  }
}

async function handleIndex() {
  isIndexing.value = true;
  try {
    const success = await ragStore.indexRepository((progress) => {
      // Progress is tracked in the store
    });
    
    if (success) {
      snackbarStore.show(`Successfully indexed ${ragStore.stats.documentCount} documents`, 'success');
    } else {
      snackbarStore.show('Failed to index repository', 'error');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexing failed';
    snackbarStore.show(message, 'error');
  } finally {
    isIndexing.value = false;
  }
}

async function handleClearIndex() {
  try {
    const success = await ragStore.clearIndex();
    if (success) {
      snackbarStore.show('Index cleared successfully', 'success');
    } else {
      snackbarStore.show('Failed to clear index', 'error');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clear index';
    snackbarStore.show(message, 'error');
  }
}

async function handleUpdateTopK(value: number) {
  try {
    await ragStore.updateSettings({ topK: value });
    snackbarStore.show(`Top-K updated to ${value}`, 'success');
  } catch (error) {
    snackbarStore.show('Failed to update settings', 'error');
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}
</script>

<template>
  <div class="bg-surface-1 rounded-m3-lg p-6 border border-surface-variant shadow-elevation-2">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-m3-md bg-primary-100 flex items-center justify-center">
          <span class="text-2xl">🔍</span>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-secondary-900">RAG System</h3>
          <p class="text-sm text-secondary-600">Retrieval-Augmented Generation</p>
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
                :checked="ragStore.settings.enabled"
                @change="handleToggle"
                :disabled="!ragStore.isIndexed"
                class="sr-only peer"
              />
              <!-- Material 3 Toggle Switch -->
              <div class="w-12 h-7 bg-surface-variant rounded-m3-md-full peer-checked:bg-primary-600 peer-disabled:opacity-50 transition-all duration-300 shadow-elevation-1">
                <div class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-m3-md-full shadow-elevation-2 transform transition-transform duration-300 peer-checked:translate-x-5"></div>
              </div>
            </div>
            <div class="ml-4">
              <span class="text-sm font-medium text-secondary-900 group-hover:text-primary-700 transition-colors">
                Enable RAG for AI Responses
              </span>
              <p class="text-xs text-secondary-600 mt-0.5">
                Use semantic search to find relevant context before responding
              </p>
            </div>
          </label>
        </div>
      </div>

      <!-- Not Indexed Warning -->
      <div v-if="!ragStore.isIndexed" class="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-m3-md flex items-start gap-2">
        <svg class="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-warning-800">Repository Not Indexed</p>
          <p class="text-xs text-warning-700 mt-1">
            You need to index the repository before using RAG. Click "Index Repository" below.
          </p>
        </div>
      </div>

      <!-- Indexing Progress -->
      <div v-if="ragStore.indexing.inProgress && ragStore.indexingProgress" class="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-m3-md">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-primary-800">Indexing Repository...</span>
          <span class="text-sm font-bold text-primary-900">{{ ragStore.indexingProgress.percentage }}%</span>
        </div>
        <div class="w-full bg-primary-100 rounded-m3-md-full h-2 overflow-hidden">
          <div 
            class="h-full bg-primary-600 transition-all duration-300 rounded-m3-md-full"
            :style="{ width: `${ragStore.indexingProgress.percentage}%` }"
          ></div>
        </div>
        <p class="text-xs text-primary-700 mt-2" v-if="ragStore.indexingProgress.currentEntity">
          Processing: {{ ragStore.indexingProgress.currentEntity }}
        </p>
      </div>

      <!-- Benefits -->
      <div v-if="ragStore.isIndexed && !ragStore.settings.enabled" class="mt-4 space-y-2">
        <p class="text-xs font-medium text-secondary-700 uppercase tracking-wide">Benefits of RAG:</p>
        <div class="grid grid-cols-2 gap-2">
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>40% fewer tokens</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>More relevant answers</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Automatic citations</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-secondary-700">
            <svg class="w-4 h-4 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Scales to large repos</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Index Management -->
    <div class="bg-surface-2 rounded-m3-md p-4 mb-5 border border-surface-variant">
      <h4 class="text-sm font-semibold text-secondary-900 mb-3">Index Management</h4>
      
      <!-- Stats -->
      <div v-if="ragStore.isIndexed" class="mb-4 p-3 bg-surface-3 rounded-m3-md">
        <div class="flex items-center justify-between">
          <span class="text-sm text-secondary-700">Documents Indexed</span>
          <span class="text-lg font-bold text-primary-600">{{ formatNumber(ragStore.stats.documentCount) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        <button 
          @click="handleIndex"
          :disabled="ragStore.indexing.inProgress"
          class="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-variant disabled:text-secondary-500 text-white rounded-m3-md text-sm font-medium transition-colors shadow-elevation-1"
        >
          <span v-if="ragStore.indexing.inProgress">Indexing...</span>
          <span v-else>{{ ragStore.isIndexed ? 'Re-index' : 'Index Repository' }}</span>
        </button>
        <button 
          v-if="ragStore.isIndexed"
          @click="handleClearIndex"
          :disabled="ragStore.indexing.inProgress"
          class="px-4 py-2 bg-surface-3 hover:bg-surface-variant disabled:opacity-50 text-secondary-800 rounded-m3-md border border-surface-variant text-sm font-medium transition-colors"
        >
          Clear Index
        </button>
      </div>

      <!-- Error Display -->
      <div v-if="ragStore.indexing.error" class="mt-3 p-3 bg-error-50 border border-error-200 rounded-m3-md">
        <p class="text-sm text-error-800">{{ ragStore.indexing.error }}</p>
      </div>
    </div>

    <!-- Advanced Settings -->
    <div>
      <button 
        @click="showAdvanced = !showAdvanced"
        class="w-full flex items-center justify-between px-4 py-3 bg-surface-2 hover:bg-surface-3 rounded-m3-md transition-colors border border-surface-variant text-sm font-medium text-secondary-900"
      >
        <span class="flex items-center gap-2">
          ⚙️ Advanced Settings
        </span>
        <svg 
          class="w-5 h-5 transform transition-transform" 
          :class="{ 'rotate-180': showAdvanced }"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Advanced Settings Panel -->
      <div v-if="showAdvanced" class="mt-3 space-y-3 animate-fadeIn">
        <!-- Top-K Setting -->
        <div class="bg-surface-2 rounded-m3-md p-4 border border-surface-variant">
          <div class="flex items-center justify-between mb-3">
            <div>
              <label class="text-sm font-medium text-secondary-900">Top-K Results</label>
              <p class="text-xs text-secondary-600 mt-0.5">Number of relevant documents to retrieve</p>
            </div>
            <span class="text-lg font-bold text-primary-600">{{ ragStore.settings.topK }}</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="20" 
            :value="ragStore.settings.topK"
            @input="handleUpdateTopK(($event.target as HTMLInputElement).valueAsNumber)"
            class="w-full h-2 bg-surface-variant rounded-m3-md-full appearance-none cursor-pointer accent-primary-600"
          />
          <div class="flex justify-between text-xs text-secondary-600 mt-1">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        <!-- Auto Index Toggle -->
        <div class="bg-surface-2 rounded-m3-md p-4 border border-surface-variant">
          <label class="flex items-center cursor-pointer group">
            <input 
              type="checkbox" 
              :checked="ragStore.settings.autoIndex"
              @change="ragStore.updateSettings({ autoIndex: !ragStore.settings.autoIndex })"
              class="w-4 h-4 text-primary-600 bg-surface-variant border-surface-variant rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
            />
            <div class="ml-3">
              <span class="text-sm font-medium text-secondary-900 group-hover:text-primary-700 transition-colors">
                Auto-index on repository load
              </span>
              <p class="text-xs text-secondary-600 mt-0.5">
                Automatically index when opening a repository
              </p>
            </div>
          </label>
        </div>

        <!-- Show Sources Toggle -->
        <div class="bg-surface-2 rounded-m3-md p-4 border border-surface-variant">
          <label class="flex items-center cursor-pointer group">
            <input 
              type="checkbox" 
              :checked="ragStore.settings.showSources"
              @change="ragStore.updateSettings({ showSources: !ragStore.settings.showSources })"
              class="w-4 h-4 text-primary-600 bg-surface-variant border-surface-variant rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
            />
            <div class="ml-3">
              <span class="text-sm font-medium text-secondary-900 group-hover:text-primary-700 transition-colors">
                Show source documents
              </span>
              <p class="text-xs text-secondary-600 mt-0.5">
                Display sources panel with relevance scores
              </p>
            </div>
          </label>
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
            <strong>How it works:</strong> RAG indexes your repository's entities as semantic vectors. When you ask a question, 
            it retrieves only the most relevant context instead of sending the entire repository.
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

/* Custom range slider styling for Material 3 */
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgb(var(--primary-600));
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgb(var(--primary-600));
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
