<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

const generatedPrompt = ref<string>('');
const isGeneratingPrompt = ref(false);
const promptError = ref<string | null>(null);
const isCopied = ref(false);

async function generatePrompt() {
  if (!contextStore.activeEntity || !contextStore.repoPath) return;
  
  isGeneratingPrompt.value = true;
  promptError.value = null;
  
  try {
    const result = await window.api.context.generate(
      contextStore.repoPath,
      [contextStore.activeEntity.id]
    );
    
    if (result.ok && result.generated && result.generated.length > 0) {
      generatedPrompt.value = result.generated[0].content || 'No content generated';
    } else {
      promptError.value = result.error || 'Failed to generate prompt';
    }
  } catch (error: any) {
    promptError.value = error.message || 'Failed to generate prompt';
  } finally {
    isGeneratingPrompt.value = false;
  }
}

async function copyPromptToClipboard() {
  if (!generatedPrompt.value) return;
  
  try {
    const result = await window.api.clipboard.writeText(generatedPrompt.value);
    if (result.ok) {
      isCopied.value = true;
      setTimeout(() => {
        isCopied.value = false;
      }, 2000);
    }
  } catch (error) {
    // Silently fail
  }
}

// Watch for entity changes and regenerate prompt
watch(
  () => contextStore.activeEntityId,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Clear previous prompt and regenerate for new entity
      generatedPrompt.value = '';
      promptError.value = null;
      isCopied.value = false;
      generatePrompt();
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-surface">
    <div class="flex-1 overflow-y-auto p-6">
      <!-- Loading State -->
      <div v-if="isGeneratingPrompt" class="flex flex-col items-center justify-center py-12">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-surface-variant border-t-primary-600 mb-4"></div>
        <p class="text-sm text-secondary-700 font-medium">Generating prompt...</p>
      </div>
      
      <!-- Error State -->
      <div v-else-if="promptError" class="p-4 bg-error-50 border border-error-200 rounded-m3-lg">
        <p class="text-sm text-error-900 font-semibold">Error generating prompt:</p>
        <p class="text-sm text-error-700 mt-1">{{ promptError }}</p>
        <button
          @click="generatePrompt"
          class="mt-3 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 transition-all"
        >
          Retry
        </button>
      </div>
      
      <!-- Empty State -->
      <div v-else-if="!generatedPrompt" class="flex flex-col items-center justify-center py-12 text-center">
        <svg class="w-16 h-16 text-secondary-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm text-secondary-600 mb-4">No prompt generated yet</p>
        <button
          @click="generatePrompt"
          :disabled="!contextStore.activeEntity"
          class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-elevation-2 hover:shadow-elevation-3"
        >
          Generate Prompt
        </button>
      </div>
      
      <!-- Prompt Content -->
      <div v-else class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-secondary-900">Generated Prompt for {{ contextStore.activeEntity?.id }}</h3>
          <div class="flex items-center gap-2">
            <button
              @click="generatePrompt"
              :disabled="isGeneratingPrompt"
              class="px-3 py-1.5 text-xs font-medium text-secondary-700 hover:text-secondary-900 bg-surface-2 hover:bg-surface-3 rounded-m3-md transition-all"
            >
              <svg class="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </button>
            <button
              @click="copyPromptToClipboard"
              class="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-m3-md hover:bg-primary-700 transition-all shadow-elevation-1 hover:shadow-elevation-2 flex items-center gap-1.5"
            >
              <svg v-if="!isCopied" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ isCopied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
        
        <div class="bg-surface-2 rounded-m3-lg border border-surface-variant p-4">
          <pre class="text-sm font-mono text-secondary-900 whitespace-pre-wrap break-words leading-relaxed">{{ generatedPrompt }}</pre>
        </div>
        
        <div class="text-xs text-secondary-600">
          {{ generatedPrompt.split('\n').length }} lines, {{ generatedPrompt.length }} characters
        </div>
      </div>
    </div>
  </div>
</template>
