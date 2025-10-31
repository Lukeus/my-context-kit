<script setup lang="ts">
import { ref, computed } from 'vue';
import { useContextKitStore } from '@/stores/contextKitStore';
import ErrorAlert from './ErrorAlert.vue';
import OperationProgress from './OperationProgress.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'close': [];
  'send-to-assistant': [prompt: string];
}>();

const contextKitStore = useContextKitStore();

const selectedSpecId = ref<string>('');
const targetAgent = ref<'codegen' | 'review' | 'test'>('codegen');
const isBuilding = ref(false);
const generatedPrompt = ref<string>('');

const availableSpecs = computed(() => {
  return Array.from(contextKitStore.generatedSpecs.entries()).map(([id, spec]) => ({
    id,
    label: spec.spec_id,
    title: spec.title || 'Untitled',
  }));
});

const agentOptions = [
  { value: 'codegen', label: 'Code Generation', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { value: 'review', label: 'Code Review', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { value: 'test', label: 'Test Generation', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
] as const;

async function buildPrompt() {
  if (!selectedSpecId.value) return;

  isBuilding.value = true;
  try {
    const result = await contextKitStore.promptifySpec(selectedSpecId.value, targetAgent.value);
    if (result) {
      generatedPrompt.value = result.prompt;
    }
  } finally {
    isBuilding.value = false;
  }
}

function copyToClipboard() {
  navigator.clipboard.writeText(generatedPrompt.value);
}

function sendToAssistant() {
  emit('send-to-assistant', generatedPrompt.value);
  handleClose();
}

function handleClose() {
  // Reset state
  selectedSpecId.value = '';
  targetAgent.value = 'codegen';
  generatedPrompt.value = '';
  
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 bg-primary-700 text-white">
          <div>
            <h2 class="text-xl font-semibold">Prompt Builder</h2>
            <p class="text-sm text-white/80">Transform specs into agent-optimized prompts</p>
          </div>
          <button
            @click="handleClose"
            class="text-white hover:bg-white/10 rounded-m3-full p-2 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-6 py-6">
          <div class="max-w-3xl mx-auto space-y-6">
            <!-- Spec Selection -->
            <div>
              <label class="block text-sm font-medium text-secondary-700 mb-3">
                Select Specification
              </label>
              <select
                v-model="selectedSpecId"
                class="w-full px-4 py-3 rounded-m3-md border border-surface-variant bg-surface-1 text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                :disabled="isBuilding"
              >
                <option value="">Choose a spec...</option>
                <option 
                  v-for="spec in availableSpecs" 
                  :key="spec.id" 
                  :value="spec.id"
                >
                  {{ spec.label }} - {{ spec.title }}
                </option>
              </select>
            </div>

            <!-- Target Agent Selection -->
            <div>
              <label class="block text-sm font-medium text-secondary-700 mb-3">
                Target Agent Type
              </label>
              <div class="grid gap-3 sm:grid-cols-3">
                <button
                  v-for="option in agentOptions"
                  :key="option.value"
                  @click="targetAgent = option.value"
                  :disabled="isBuilding"
                  class="flex flex-col items-center p-4 rounded-m3-lg border transition-all disabled:opacity-50"
                  :class="targetAgent === option.value
                    ? 'bg-primary-50 border-primary-600 shadow-elevation-1'
                    : 'bg-surface-1 border-surface-variant hover:bg-surface-2'"
                >
                  <div 
                    class="p-2 rounded-m3-md mb-2"
                    :class="targetAgent === option.value ? 'bg-primary-600 text-white' : 'bg-surface-2 text-secondary-600'"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="option.icon" />
                    </svg>
                  </div>
                  <span 
                    class="text-sm font-semibold"
                    :class="targetAgent === option.value ? 'text-primary-900' : 'text-secondary-700'"
                  >
                    {{ option.label }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Build Button -->
            <div class="flex justify-center">
              <button
                @click="buildPrompt"
                :disabled="!selectedSpecId || isBuilding"
                class="px-6 py-3 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isBuilding ? 'Building Prompt...' : 'Build Prompt' }}
              </button>
            </div>

            <!-- Generated Prompt Preview -->
            <div v-if="generatedPrompt" class="space-y-3">
              <div class="flex items-center justify-between">
                <label class="block text-sm font-medium text-secondary-700">
                  Generated Prompt
                </label>
                <div class="flex gap-2">
                  <button
                    @click="copyToClipboard"
                    class="px-3 py-1.5 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 text-xs font-medium transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                  <button
                    @click="sendToAssistant"
                    class="px-3 py-1.5 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors"
                  >
                    <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Send to AI Assistant
                  </button>
                </div>
              </div>
              
              <div class="relative">
                <pre class="p-4 rounded-m3-lg bg-surface-3 border border-surface-variant text-sm text-secondary-900 overflow-x-auto max-h-96">{{ generatedPrompt }}</pre>
              </div>

              <div class="p-4 rounded-m3-md bg-primary-50 border border-primary-200">
                <p class="text-sm font-medium text-primary-900">Prompt Optimized</p>
                <p class="text-xs text-primary-700 mt-1">
                  This prompt is tailored for {{ agentOptions.find(o => o.value === targetAgent)?.label }} tasks.
                </p>
              </div>
            </div>

            <!-- Progress Display -->
            <OperationProgress :operation="contextKitStore.currentOperation" />

            <!-- Error Display -->
            <ErrorAlert 
              :error="contextKitStore.lastError"
              @dismiss="contextKitStore.clearError()"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end px-6 py-4 bg-surface-1 border-t border-surface-variant gap-2">
          <button
            @click="handleClose"
            class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
