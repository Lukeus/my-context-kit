<script setup lang="ts">
import { ref, computed } from 'vue';
import { useContextStore } from '../stores/contextStore';

const emit = defineEmits<{
  close: [];
}>();

const contextStore = useContextStore();

const repoName = ref('');
const parentDirectory = ref('');
const projectPurpose = ref('');
const constitutionSummary = ref('');
const isCreating = ref(false);
const isGeneratingSummary = ref(false);
const error = ref<string | null>(null);
const success = ref(false);
const warning = ref<string | null>(null);

const isValid = computed(() => {
  return repoName.value.trim().length > 0 && parentDirectory.value.trim().length > 0;
});

async function browseFolderLocation() {
  try {
    const result = await window.api.dialog.selectDirectory();
    if (result.ok && Array.isArray(result.paths) && result.paths.length > 0) {
      parentDirectory.value = result.paths[0];
    } else if (!result.ok) {
      error.value = result.error || 'Unable to open directory picker';
    }
  } catch (err: any) {
    error.value = err?.message || 'Unable to open directory picker';
  }
}

async function generateSummary() {
  if (!projectPurpose.value.trim()) return;
  
  isGeneratingSummary.value = true;
  error.value = null;
  
  try {
    // Use a temporary directory for AI call (we'll use the target directory once created)
    const tempDir = contextStore.repoPath || parentDirectory.value;
    
    const prompt = `Generate a concise constitution summary (2-3 sentences) for a project with the following purpose:\n\n${projectPurpose.value}\n\nThe summary should describe the system's governing principles and what it aims to enforce.`;
    
    const result = await window.api.ai.assist(
      tempDir,
      prompt,
      'general'
    );
    
    if (result.ok && result.answer) {
      constitutionSummary.value = result.answer.trim();
    } else {
      error.value = result.error || 'Failed to generate summary';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to generate summary with AI';
  } finally {
    isGeneratingSummary.value = false;
  }
}

async function createRepository() {
  if (!isValid.value) return;
  
  isCreating.value = true;
  error.value = null;
  success.value = false;
  warning.value = null;
  
  try {
    const result = await window.api.context.scaffoldNewRepo(
      parentDirectory.value,
      repoName.value.trim(),
      projectPurpose.value.trim(),
      constitutionSummary.value.trim()
    );
    
    if (!result.ok) {
      error.value = result.error || 'Failed to create repository';
      return;
    }
    
    success.value = true;
    warning.value = result.warning || null;
    
    // Add to registry and activate
    if (result.path) {
      await contextStore.addRepository({
        label: repoName.value.trim(),
        path: result.path
      });
    }
    
    // Close modal after brief delay
    if (!warning.value) {
      setTimeout(() => {
        emit('close');
      }, 1500);
    }
  } catch (err: any) {
    error.value = err.message || 'An unexpected error occurred';
  } finally {
    isCreating.value = false;
  }
}

function close() {
  if (!isCreating.value) {
    emit('close');
  }
}
</script>

<template>
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="close"
  >
    <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden border border-surface-variant">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-surface-variant bg-surface-2 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 class="text-xl font-semibold text-secondary-900">Create New Context Repository</h2>
          <p class="text-sm text-secondary-600 mt-1">Scaffold a new context repo with all required structure</p>
        </div>
        <button 
          @click="close" 
          :disabled="isCreating"
          class="p-2 hover:bg-surface-3 rounded-m3-md transition-colors disabled:opacity-50 text-secondary-600 hover:text-secondary-900"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Success Message -->
        <div 
          v-if="success" 
          class="p-4 bg-green-50 border border-green-200 rounded-m3-md flex items-start gap-3"
        >
          <svg class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-green-900">Repository Created Successfully!</h3>
            <p class="text-sm text-green-700 mt-1">Your new context repository has been scaffolded and activated.</p>
            <p v-if="warning" class="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-m3-md px-3 py-2 mt-2">
              {{ warning }}
            </p>
          </div>
        </div>

        <!-- Error Message -->
        <div 
          v-if="error" 
          class="p-4 bg-error-50 border border-error-200 rounded-m3-md flex items-start gap-3"
        >
          <svg class="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-error-900">Error Creating Repository</h3>
            <p class="text-sm text-error-700 mt-1">{{ error }}</p>
          </div>
        </div>

        <!-- Repository Name -->
        <div>
          <label for="repoName" class="block text-sm font-semibold text-secondary-900 mb-2">
            Repository Name
          </label>
          <input
            id="repoName"
            v-model="repoName"
            type="text"
            placeholder="my-project-context"
            :disabled="isCreating || success"
            class="w-full px-4 py-2.5 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-surface-2 disabled:cursor-not-allowed"
          />
          <p class="text-xs text-secondary-600 mt-1.5">
            This will be the folder name for your context repository
          </p>
        </div>

        <!-- Parent Directory -->
        <div>
          <label for="parentDir" class="block text-sm font-semibold text-secondary-900 mb-2">
            Parent Directory
          </label>
          <div class="flex gap-2">
            <input
              id="parentDir"
              v-model="parentDirectory"
              type="text"
              placeholder="Select where to create the repository..."
              :disabled="isCreating || success"
              class="flex-1 px-4 py-2.5 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-surface-2 disabled:cursor-not-allowed"
              readonly
            />
            <button
              @click="browseFolderLocation"
              :disabled="isCreating || success"
              class="px-4 py-2.5 text-sm font-semibold rounded-m3-md bg-secondary-100 hover:bg-secondary-200 text-secondary-900 border border-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Browse
            </button>
          </div>
          <p class="text-xs text-secondary-600 mt-1.5">
            The repository will be created at: <code class="text-xs bg-surface-2 px-1.5 py-0.5 rounded-m3-md">{{ parentDirectory || '...' }}/{{ repoName || '...' }}</code>
          </p>
        </div>

        <!-- Project Purpose -->
        <div>
          <label for="projectPurpose" class="block text-sm font-semibold text-secondary-900 mb-2">
            Project Purpose <span class="text-secondary-500 font-normal">(Optional)</span>
          </label>
          <textarea
            id="projectPurpose"
            v-model="projectPurpose"
            rows="3"
            placeholder="Describe what system/application you're building context for..."
            :disabled="isCreating || success"
            class="w-full px-4 py-2.5 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-surface-2 disabled:cursor-not-allowed resize-none"
          ></textarea>
          <p class="text-xs text-secondary-600 mt-1.5">
            Describe your project to help AI generate a constitution summary
          </p>
        </div>

        <!-- Constitution Summary -->
        <div>
          <label for="constitutionSummary" class="flex items-center justify-between text-sm font-semibold text-secondary-900 mb-2">
            <span>Constitution Summary <span class="text-secondary-500 font-normal">(Optional)</span></span>
            <button
              v-if="projectPurpose.trim()"
              @click="generateSummary"
              :disabled="isGeneratingSummary || isCreating || success"
              class="text-xs px-3 py-1.5 font-semibold rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <svg v-if="isGeneratingSummary" class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {{ isGeneratingSummary ? 'Generating...' : 'Generate with AI' }}
            </button>
          </label>
          <textarea
            id="constitutionSummary"
            v-model="constitutionSummary"
            rows="3"
            placeholder="A brief summary of the project's governing principles and purpose..."
            :disabled="isCreating || success || isGeneratingSummary"
            class="w-full px-4 py-2.5 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-surface-2 disabled:cursor-not-allowed resize-none"
          ></textarea>
          <p class="text-xs text-secondary-600 mt-1.5">
            This will be used in the auto-generated constitution file
          </p>
        </div>

        <!-- Info Box -->
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-m3-md">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="text-sm text-blue-900">
              <p class="font-semibold mb-1">What gets created:</p>
              <ul class="space-y-1 text-blue-800">
                <li>• Complete folder structure for entities (features, specs, tasks, etc.)</li>
                <li>• Pipeline scripts for validation, graph building, and impact analysis</li>
                <li>• Handlebars templates for documentation and code generation</li>
                <li>• Schema files for entity validation</li>
                <li v-if="constitutionSummary.trim()" class="text-primary-700 font-medium">• Constitution file with your project summary</li>
                <li>• Git repository initialized with initial commit</li>
                <li>• README and .gitignore files</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-5 bg-surface-2 border-t border-surface-variant flex items-center justify-end gap-3 flex-shrink-0">
        <button
          @click="close"
          :disabled="isCreating"
          class="px-5 py-2.5 text-sm font-medium rounded-m3-md text-secondary-700 hover:bg-surface-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          @click="createRepository"
          :disabled="!isValid || isCreating || success"
          class="px-5 py-2.5 text-sm font-medium rounded-m3-md bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-elevation-2 hover:shadow-elevation-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="isCreating" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else-if="success" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span v-if="isCreating">Creating...</span>
          <span v-else-if="success">Created!</span>
          <span v-else>Create Repository</span>
        </button>
      </div>
    </div>
  </div>
</template>
