<script setup lang="ts">
import { ref, computed } from 'vue';
import { useContextKitStore } from '@/stores/contextKitStore';
import { useContextStore } from '@/stores/contextStore';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'close': [];
  'spec-generated': [specId: string];
}>();

const contextKitStore = useContextKitStore();
const contextStore = useContextStore();

const currentStep = ref(1);
const selectedEntityIds = ref<string[]>([]);
const userPrompt = ref('');
const includeRag = ref(true);
const isGenerating = ref(false);
const generatedSpec = ref<any>(null);
const errorMessage = ref<string | null>(null);

const allEntities = computed(() => {
  const entities: Array<{ id: string; type: string; title?: string }> = [];
  Object.entries(contextStore.entitiesByType).forEach(([type, list]) => {
    list.forEach((entity: any) => {
      entities.push({
        id: entity.id,
        type,
        title: entity.title || entity.name || entity.id,
      });
    });
  });
  return entities;
});

const canProceedToStep2 = computed(() => selectedEntityIds.value.length > 0);
const canProceedToStep3 = computed(() => userPrompt.value.trim().length > 0);

function toggleEntity(entityId: string) {
  const index = selectedEntityIds.value.indexOf(entityId);
  if (index > -1) {
    selectedEntityIds.value.splice(index, 1);
  } else {
    selectedEntityIds.value.push(entityId);
  }
}

function nextStep() {
  if (currentStep.value < 4) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

async function generateSpec() {
  if (!contextStore.repoPath) {
    errorMessage.value = 'No repository configured';
    return;
  }

  isGenerating.value = true;
  errorMessage.value = null;

  try {
    const result = await contextKitStore.generateSpec(
      contextStore.repoPath,
      selectedEntityIds.value,
      userPrompt.value,
      undefined,
      includeRag.value
    );

    if (result) {
      generatedSpec.value = result;
      currentStep.value = 4;
    } else {
      errorMessage.value = contextKitStore.lastError || 'Failed to generate specification';
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    isGenerating.value = false;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function handleClose() {
  // Reset wizard state
  currentStep.value = 1;
  selectedEntityIds.value = [];
  userPrompt.value = '';
  includeRag.value = true;
  generatedSpec.value = null;
  errorMessage.value = null;
  
  emit('close');
}

function handleFinish() {
  if (generatedSpec.value) {
    emit('spec-generated', generatedSpec.value.spec_id);
  }
  handleClose();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 bg-primary-700 text-white">
          <div>
            <h2 class="text-xl font-semibold">Generate Specification</h2>
            <p class="text-sm text-white/80">Step {{ currentStep }} of 4</p>
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

        <!-- Progress Steps -->
        <div class="flex items-center justify-center gap-2 px-6 py-4 bg-surface-1 border-b border-surface-variant">
          <div 
            v-for="step in 4" 
            :key="step"
            class="flex items-center"
          >
            <div 
              class="flex items-center justify-center w-8 h-8 rounded-m3-full text-sm font-semibold transition-colors"
              :class="step === currentStep 
                ? 'bg-primary-600 text-white' 
                : step < currentStep 
                ? 'bg-primary-200 text-primary-800' 
                : 'bg-surface-3 text-secondary-600'"
            >
              {{ step }}
            </div>
            <div 
              v-if="step < 4"
              class="w-16 h-1 mx-2 rounded-m3-full transition-colors"
              :class="step < currentStep ? 'bg-primary-600' : 'bg-surface-3'"
            ></div>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-6 py-6">
          <!-- Step 1: Select Entities -->
          <div v-if="currentStep === 1" class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-secondary-900">Select Entities</h3>
              <p class="text-sm text-secondary-600 mt-1">
                Choose the context entities to include in your specification
              </p>
            </div>

            <div v-if="allEntities.length === 0" class="text-center py-8 text-secondary-500">
              <p>No entities found in repository</p>
              <p class="text-xs mt-1">Make sure your repository is properly configured</p>
            </div>

            <div v-else class="space-y-2 max-h-96 overflow-y-auto">
              <button
                v-for="entity in allEntities"
                :key="entity.id"
                @click="toggleEntity(entity.id)"
                class="w-full flex items-center gap-3 p-3 rounded-m3-md border transition-colors text-left"
                :class="selectedEntityIds.includes(entity.id)
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-surface-variant bg-surface-1 hover:bg-surface-2'"
              >
                <div 
                  class="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                  :class="selectedEntityIds.includes(entity.id)
                    ? 'border-primary-600 bg-primary-600'
                    : 'border-surface-variant'"
                >
                  <svg 
                    v-if="selectedEntityIds.includes(entity.id)"
                    class="w-4 h-4 text-white" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div class="flex-1">
                  <p class="font-medium text-secondary-900">{{ entity.id }}</p>
                  <p class="text-xs text-secondary-600">{{ entity.type }} • {{ entity.title }}</p>
                </div>
              </button>
            </div>

            <div v-if="selectedEntityIds.length > 0" class="p-3 rounded-m3-md bg-primary-50 border border-primary-200">
              <p class="text-sm font-medium text-primary-900">
                {{ selectedEntityIds.length }} {{ selectedEntityIds.length === 1 ? 'entity' : 'entities' }} selected
              </p>
            </div>
          </div>

          <!-- Step 2: Describe Requirement -->
          <div v-else-if="currentStep === 2" class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-secondary-900">Describe Requirement</h3>
              <p class="text-sm text-secondary-600 mt-1">
                Provide natural language description of what you want to specify
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-secondary-700 mb-2">
                Your Prompt
              </label>
              <textarea
                v-model="userPrompt"
                rows="10"
                class="w-full px-4 py-3 rounded-m3-md border border-surface-variant bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                placeholder="Example: Generate a detailed technical specification for implementing a REST API endpoint for user authentication with JWT tokens. Include API contract, error handling, security considerations, and test cases."
              ></textarea>
            </div>

            <div class="flex items-center gap-3 p-3 rounded-m3-md bg-surface-1 border border-surface-variant">
              <input
                v-model="includeRag"
                type="checkbox"
                id="includeRag"
                class="w-4 h-4 text-primary-600 rounded"
              />
              <label for="includeRag" class="text-sm text-secondary-900 cursor-pointer">
                Include RAG context (retrieves relevant documentation and examples)
              </label>
            </div>
          </div>

          <!-- Step 3: Review & Generate -->
          <div v-else-if="currentStep === 3" class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-secondary-900">Review & Generate</h3>
              <p class="text-sm text-secondary-600 mt-1">
                Confirm your selections before generating the specification
              </p>
            </div>

            <div class="space-y-4">
              <div class="p-4 rounded-m3-md bg-surface-1 border border-surface-variant">
                <h4 class="text-sm font-semibold text-secondary-900 mb-2">Selected Entities</h4>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="entityId in selectedEntityIds"
                    :key="entityId"
                    class="px-3 py-1 rounded-m3-full bg-primary-100 text-primary-800 text-sm font-medium"
                  >
                    {{ entityId }}
                  </span>
                </div>
              </div>

              <div class="p-4 rounded-m3-md bg-surface-1 border border-surface-variant">
                <h4 class="text-sm font-semibold text-secondary-900 mb-2">Prompt</h4>
                <p class="text-sm text-secondary-700 whitespace-pre-wrap">{{ userPrompt }}</p>
              </div>

              <div class="p-4 rounded-m3-md bg-surface-1 border border-surface-variant">
                <h4 class="text-sm font-semibold text-secondary-900 mb-2">Options</h4>
                <p class="text-sm text-secondary-700">
                  RAG Context: <span class="font-medium">{{ includeRag ? 'Enabled' : 'Disabled' }}</span>
                </p>
              </div>
            </div>

            <div v-if="errorMessage" class="p-4 rounded-m3-md bg-error-50 border border-error-200">
              <p class="text-sm font-medium text-error-700">Error</p>
              <p class="text-sm text-error-600 mt-1">{{ errorMessage }}</p>
            </div>
          </div>

          <!-- Step 4: Results -->
          <div v-else-if="currentStep === 4" class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-secondary-900">Specification Generated</h3>
              <p class="text-sm text-secondary-600 mt-1">
                Your specification has been created successfully
              </p>
            </div>

            <div v-if="generatedSpec" class="space-y-4">
              <div class="p-4 rounded-m3-md bg-success-container border border-outline">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p class="text-sm font-medium text-on-success-container">
                    Spec ID: {{ generatedSpec.spec_id }}
                  </p>
                </div>
                <p class="text-xs text-success mt-1">
                  Generated in {{ generatedSpec.duration_ms }}ms
                </p>
              </div>

              <div class="p-4 rounded-m3-md bg-surface-1 border border-surface-variant max-h-96 overflow-y-auto">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-sm font-semibold text-secondary-900">Content</h4>
                  <button
                    @click="copyToClipboard(generatedSpec.spec_content)"
                    class="text-xs text-primary-700 hover:text-primary-900 font-medium"
                  >
                    Copy to Clipboard
                  </button>
                </div>
                <pre class="text-sm text-secondary-700 whitespace-pre-wrap font-mono">{{ generatedSpec.spec_content }}</pre>
              </div>

              <div class="p-4 rounded-m3-md bg-surface-1 border border-surface-variant">
                <h4 class="text-sm font-semibold text-secondary-900 mb-2">Related Entities</h4>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="entityId in generatedSpec.related_entities"
                    :key="entityId"
                    class="px-3 py-1 rounded-m3-full bg-primary-container text-on-primary-container text-sm"
                  >
                    {{ entityId }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 bg-surface-1 border-t border-surface-variant">
          <button
            v-if="currentStep > 1 && currentStep < 4"
            @click="prevStep"
            class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            Back
          </button>
          <div v-else></div>

          <div class="flex gap-2">
            <button
              @click="handleClose"
              class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
            >
              {{ currentStep === 4 ? 'Close' : 'Cancel' }}
            </button>

            <button
              v-if="currentStep === 1"
              @click="nextStep"
              :disabled="!canProceedToStep2"
              class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>

            <button
              v-else-if="currentStep === 2"
              @click="nextStep"
              :disabled="!canProceedToStep3"
              class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>

            <button
              v-else-if="currentStep === 3"
              @click="generateSpec"
              :disabled="isGenerating"
              class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isGenerating ? 'Generating...' : 'Generate Specification' }}
            </button>

            <button
              v-else-if="currentStep === 4"
              @click="handleFinish"
              class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
