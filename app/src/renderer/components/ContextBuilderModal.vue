<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useBuilderStore } from '../stores/builderStore';
import { useContextStore } from '../stores/contextStore';
import { EditorView, basicSetup } from 'codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';

const builderStore = useBuilderStore();
const contextStore = useContextStore();

const entityTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    feature: 'Feature',
    userstory: 'User Story',
    spec: 'Specification',
    task: 'Task',
    service: 'Service',
    package: 'Package'
  };
  return labels[builderStore.entityType] || builderStore.entityType;
});

const statusOptions = computed(() => {
  if (builderStore.entityType === 'feature') {
    return ['proposed', 'in-progress', 'done', 'blocked'];
  } else if (builderStore.entityType === 'task') {
    return ['todo', 'doing', 'done', 'blocked', 'needs-review'];
  }
  return ['proposed', 'in-progress', 'done'];
});

// Get unique domains from existing features
const domainOptions = computed(() => {
  const domains = new Set<string>();
  Object.values(contextStore.entities).forEach(entity => {
    if (entity.domain) {
      domains.add(entity.domain);
    }
  });
  return Array.from(domains).sort();
});

// Get entities for relationship selection
const availableFeatures = computed(() => contextStore.entitiesByType.feature);
const availableServices = computed(() => contextStore.entitiesByType.service);
const availablePackages = computed(() => contextStore.entitiesByType.package);

function close() {
  builderStore.closeBuilder();
}

async function handleNext() {
  if (builderStore.currentStep === 1 && !builderStore.partialEntity.id) {
    // Auto-generate ID if not set
    await builderStore.generateNextId();
  }
  
  if (builderStore.currentStep === 4) {
    // Final step - validate and save
    await handleSave();
  } else {
    builderStore.nextStep();
  }
}

async function handleSave() {
  const result = await builderStore.saveEntity();
  if (result.ok) {
    // Reload graph to show new entity
    await contextStore.loadGraph();
  }
}

// Watch for modal open and generate ID
watch(() => builderStore.isOpen, async (isOpen) => {
  if (isOpen) {
    await builderStore.prepareForOpen(contextStore.repoPath);
  }
});

// Watch title changes for domain suggestions
watch(() => builderStore.partialEntity.title, async () => {
  if (builderStore.isOpen && builderStore.currentStep === 1) {
    await builderStore.getSuggestions();
  }
});

// Watch for ID changes to check conflicts
watch(() => builderStore.partialEntity.id, async (newId) => {
  if (newId && builderStore.isOpen) {
    await builderStore.checkIdConflict(newId);
  }
});

function selectSuggestedDomain(domain: string) {
  builderStore.updateField('domain', domain);
  // Refresh suggestions with new domain
  builderStore.getSuggestions();
}

// AI Assist
const aiPrompt = ref('');
const isGenerating = ref(false);
const aiError = ref<string | null>(null);
const tokenUsage = ref<any | null>(null);

async function generateWithAI() {
  if (!aiPrompt.value.trim()) return;
  
  isGenerating.value = true;
  aiError.value = null;
  tokenUsage.value = null;
  
  try {
    const result = await window.api.ai.generate(
      contextStore.repoPath,
      builderStore.entityType,
      aiPrompt.value
    );
    
    if (result.ok && result.entity) {
      // Merge AI-generated data with existing entity
      builderStore.updateEntity(result.entity);
      tokenUsage.value = result.usage;
      aiPrompt.value = ''; // Clear prompt after successful generation
    } else {
      // Show detailed error message
      aiError.value = result.error || 'Failed to generate entity';
    }
  } catch (error: any) {
    // Show the actual error message
    aiError.value = error.message || 'AI generation failed. Please check your configuration.';
    console.error('AI generation error:', error);
  } finally {
    isGenerating.value = false;
  }
}

// Watch domain changes for relationship inference
watch(() => builderStore.partialEntity.domain, async () => {
  if (builderStore.isOpen && builderStore.currentStep === 2) {
    await builderStore.getSuggestions();
  }
});

// Watch feature selection for spec/task suggestions
watch(() => builderStore.partialEntity.feature, async () => {
  if (builderStore.isOpen && builderStore.currentStep === 2) {
    await builderStore.getSuggestions();
  }
});
</script>

<template>
  <div v-if="builderStore.isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div class="bg-surface-1 rounded-m3-xl shadow-elevation-5 w-full max-w-3xl max-h-[90vh] flex flex-col border border-surface-variant">
      <!-- Header -->
      <div class="px-6 py-5 border-b border-surface-variant flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-secondary-900">Create New {{ entityTypeLabel }}</h2>
          <p class="text-sm text-secondary-600 mt-1">Step {{ builderStore.currentStep }} of {{ builderStore.totalSteps }}</p>
        </div>
        <button @click="close" class="text-secondary-500 hover:text-secondary-900 transition-colors p-1 rounded-m3-sm hover:bg-surface-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="px-6 py-3 border-b border-surface-variant bg-surface-2">
        <div class="flex items-center justify-between text-xs text-secondary-600 mb-2">
          <span :class="builderStore.currentStep >= 1 ? 'text-primary-600 font-semibold' : ''">Basic Info</span>
          <span :class="builderStore.currentStep >= 2 ? 'text-primary-600 font-semibold' : ''">Relationships</span>
          <span :class="builderStore.currentStep >= 3 ? 'text-primary-600 font-semibold' : ''">Details</span>
          <span :class="builderStore.currentStep >= 4 ? 'text-primary-600 font-semibold' : ''">Review</span>
        </div>
        <div class="w-full bg-surface-4 rounded-m3-full h-2 shadow-inner">
          <div class="bg-primary-600 h-2 rounded-m3-full transition-all duration-300 shadow-elevation-1" 
               :style="{ width: `${(builderStore.currentStep / builderStore.totalSteps) * 100}%` }"></div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="builderStore.errorMessage" class="mx-6 mt-4 p-4 bg-tertiary-50 border border-tertiary-300 rounded-m3-md shadow-elevation-1">
        <p class="text-tertiary-900 text-sm font-medium">⚠ {{ builderStore.errorMessage }}</p>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto px-6 py-6 bg-surface">
        <!-- Loading Overlay -->
        <div v-if="builderStore.isBusy"
             class="absolute inset-0 bg-surface bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-10">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-surface-variant border-t-primary-600"></div>
            <p class="text-sm text-secondary-700 font-medium mt-3">{{ builderStore.busyMessage }}</p>
          </div>
        </div>
        
        <!-- Step 1: Basic Info -->
        <div v-if="builderStore.currentStep === 1" class="space-y-5">
          <!-- AI Assist Panel -->
          <div class="p-4 bg-gradient-to-r from-purple-50 to-primary-50 rounded-m3-lg border-2 border-purple-200 shadow-elevation-2">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 class="text-sm font-semibold text-secondary-900">✨ AI Assist</h3>
            </div>
            <textarea 
              v-model="aiPrompt"
              rows="2"
              placeholder="Describe what you want to create... (e.g., 'User authentication with Google OAuth')"
              class="w-full px-4 py-3 bg-white border border-purple-300 rounded-m3-md text-secondary-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-secondary-500 shadow-elevation-1"
              :disabled="isGenerating"
            ></textarea>
            <div class="flex items-center justify-between mt-3">
              <div class="text-xs text-purple-700 font-medium">
                <span v-if="tokenUsage" class="flex items-center gap-1">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  {{ tokenUsage.total_tokens }} tokens
                </span>
              </div>
              <button 
                @click="generateWithAI"
                :disabled="!aiPrompt.trim() || isGenerating"
                class="px-4 py-2 text-xs font-medium bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-surface-3 disabled:text-secondary-400 text-white rounded-m3-lg transition-all shadow-elevation-1 hover:shadow-elevation-2 flex items-center gap-2"
              >
                <span v-if="isGenerating" class="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                {{ isGenerating ? 'Generating...' : 'Generate with AI' }}
              </button>
            </div>
            <p v-if="aiError" class="text-xs text-error-700 font-medium mt-2">⚠ {{ aiError }}</p>
          </div>

          <!-- Template Selection -->
          <div v-if="builderStore.availableTemplates.length > 0" class="p-4 bg-surface-2 rounded-m3-lg border border-surface-variant shadow-elevation-1">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-secondary-900">📋 Quick Start Templates</h3>
              <button 
                v-if="builderStore.selectedTemplate"
                @click="builderStore.clearTemplate()"
                class="text-xs font-medium text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 px-2 py-1 rounded-m3-sm transition-all"
              >
                Clear template
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="template in builderStore.availableTemplates.slice(0, 4)"
                :key="template.filename"
                @click.prevent="builderStore.applyTemplate(template)"
                class="p-3 text-left rounded-m3-md transition-all"
                :class="builderStore.selectedTemplate?.filename === template.filename 
                  ? 'bg-primary-600 text-white ring-2 ring-primary-400 shadow-elevation-2' 
                  : 'bg-surface-3 text-secondary-800 hover:bg-surface-4 hover:shadow-elevation-1'"
                :title="template.description"
              >
                <div class="flex items-center gap-2">
                  <span class="text-lg">{{ template.icon || '📄' }}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-semibold truncate">{{ template.name }}</div>
                    <div class="text-xs opacity-75 truncate">{{ template.description }}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">ID</label>
            <input 
              v-model="builderStore.partialEntity.id"
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              :class="builderStore.idConflict.conflict ? 'border-error-500 focus:ring-error-500' : 'border-surface-variant focus:ring-primary-500'"
              placeholder="Auto-generated"
            />
            <p v-if="builderStore.idConflict.conflict" class="text-xs text-error-700 font-medium mt-2">
              ⚠ {{ builderStore.idConflict.message }}
            </p>
            <p v-else class="text-xs text-secondary-600 mt-2">Unique identifier for this {{ entityTypeLabel.toLowerCase() }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Title *</label>
            <input 
              v-model="builderStore.partialEntity.title"
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="Enter a descriptive title"
              required
            />
          </div>

          <div v-if="builderStore.entityType === 'feature' || builderStore.entityType === 'spec'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Domain</label>
            <input 
              v-model="builderStore.partialEntity.domain"
              type="text" 
              list="domains"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="e.g., auth, ui, data, api"
            />
            <datalist id="domains">
              <option v-for="domain in domainOptions" :key="domain" :value="domain" />
            </datalist>
            
            <!-- Domain Suggestions -->
            <div v-if="builderStore.suggestions.domains.length > 0" class="mt-3">
              <p class="text-xs text-secondary-700 font-medium mb-2">Suggested domains:</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="suggestion in builderStore.suggestions.domains.slice(0, 5)"
                  :key="suggestion.domain"
                  @click.prevent="selectSuggestedDomain(suggestion.domain)"
                  class="px-3 py-1.5 text-xs font-medium rounded-m3-full transition-all shadow-elevation-1 hover:shadow-elevation-2"
                  :class="{
                    'bg-primary-600 text-white hover:bg-primary-700': suggestion.confidence === 'high',
                    'bg-primary-500 text-white hover:bg-primary-600': suggestion.confidence === 'medium',
                    'bg-secondary-300 text-secondary-900 hover:bg-secondary-400': suggestion.confidence === 'low'
                  }"
                  :title="suggestion.reason"
                >
                  {{ suggestion.domain }}
                  <span v-if="suggestion.confidence === 'high'" class="ml-1">✨</span>
                </button>
              </div>
            </div>
            
            <p class="text-xs text-secondary-600 mt-2">Functional area or domain this belongs to</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-secondary-800 mb-2">Status</label>
            <select 
              v-model="builderStore.partialEntity.status"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
            >
              <option value="">Select status</option>
              <option v-for="status in statusOptions" :key="status" :value="status">
                {{ status }}
              </option>
            </select>
          </div>

          <div v-if="builderStore.entityType === 'feature'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Objective</label>
            <textarea 
              v-model="builderStore.partialEntity.objective"
              rows="3"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="What is the goal of this feature?"
            ></textarea>
          </div>
        </div>

        <!-- Step 2: Relationships -->
        <div v-if="builderStore.currentStep === 2" class="space-y-5">
          <p class="text-sm text-secondary-700 font-medium mb-4">Link this {{ entityTypeLabel.toLowerCase() }} to related entities (optional)</p>

          <div v-if="builderStore.entityType === 'userstory'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Feature</label>
            <select 
              v-model="builderStore.partialEntity.feature"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
            >
              <option value="">Select a feature</option>
              <option v-for="feature in availableFeatures" :key="feature.id" :value="feature.id">
                {{ feature.id }} - {{ feature.title }}
              </option>
            </select>
            
            <!-- Feature Suggestions -->
            <div v-if="builderStore.suggestions.features.length > 0" class="mt-3">
              <p class="text-xs text-secondary-700 font-medium mb-2">✨ Recommended features:</p>
              <div class="space-y-2 max-h-32 overflow-y-auto">
                <button
                  v-for="suggestion in builderStore.suggestions.features.slice(0, 5)"
                  :key="suggestion.id"
                  @click.prevent="builderStore.updateField('feature', suggestion.id)"
                  class="w-full text-left px-3 py-2.5 rounded-m3-md text-sm transition-all shadow-elevation-1 hover:shadow-elevation-2"
                  :class="{
                    'bg-primary-600 hover:bg-primary-700 text-white': suggestion.confidence === 'high',
                    'bg-primary-500 hover:bg-primary-600 text-white': suggestion.confidence === 'medium',
                    'bg-secondary-300 hover:bg-secondary-400 text-secondary-900': suggestion.confidence === 'low'
                  }"
                >
                  <div class="font-medium">{{ suggestion.id }}</div>
                  <div class="text-xs opacity-90">{{ suggestion.title }}</div>
                  <div class="text-xs opacity-75 mt-0.5">{{ suggestion.reason }}</div>
                </button>
              </div>
            </div>
          </div>

          <div v-if="builderStore.entityType === 'task'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Related Feature</label>
            <select 
              v-model="builderStore.partialEntity.relatedFeature"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
            >
              <option value="">Select a feature</option>
              <option v-for="feature in availableFeatures" :key="feature.id" :value="feature.id">
                {{ feature.id }} - {{ feature.title }}
              </option>
            </select>
          </div>

          <div v-if="builderStore.entityType === 'feature'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Required Services</label>
            <div class="space-y-2 max-h-40 overflow-y-auto">
              <label v-for="service in availableServices" :key="service.id" class="flex items-center text-sm text-secondary-800 hover:text-secondary-900 cursor-pointer hover:bg-surface-2 px-2 py-1 rounded-m3-sm transition-colors">
                <input type="checkbox" :value="service.id" 
                       v-model="builderStore.partialEntity.requires"
                       class="mr-3 h-5 w-5 rounded-m3-xs bg-surface-2 border-surface-variant text-primary-600 focus:ring-2 focus:ring-primary-400">
                {{ service.id }} - {{ service.name }}
              </label>
            </div>
          </div>
        </div>

        <!-- Step 3: Details -->
        <div v-if="builderStore.currentStep === 3" class="space-y-5">
          <div v-if="builderStore.entityType === 'userstory'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">As a... *</label>
            <input 
              v-model="builderStore.partialEntity.asA"
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="end user, developer, admin..."
            />
          </div>

          <div v-if="builderStore.entityType === 'userstory'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">I want... *</label>
            <input 
              v-model="builderStore.partialEntity.iWant"
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="to be able to..."
            />
          </div>

          <div v-if="builderStore.entityType === 'userstory'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">So that... *</label>
            <input 
              v-model="builderStore.partialEntity.soThat"
              type="text" 
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="I can achieve..."
            />
          </div>

          <div v-if="builderStore.entityType === 'task'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Description</label>
            <textarea 
              v-model="builderStore.partialEntity.description"
              rows="4"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="Describe what needs to be done..."
            ></textarea>
          </div>

          <div v-if="builderStore.entityType === 'spec'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Type</label>
            <select 
              v-model="builderStore.partialEntity.type"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
            >
              <option value="">Select type</option>
              <option value="technical">Technical</option>
              <option value="api">API</option>
              <option value="ui">UI</option>
              <option value="data">Data</option>
            </select>
          </div>

          <div v-if="builderStore.entityType === 'spec'">
            <label class="block text-sm font-medium text-secondary-800 mb-2">Content</label>
            <textarea 
              v-model="builderStore.partialEntity.content"
              rows="6"
              class="w-full px-4 py-3 bg-surface-2 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-elevation-1 hover:shadow-elevation-2"
              placeholder="Detailed specification content..."
            ></textarea>
          </div>
        </div>

        <!-- Step 4: Review -->
        <div v-if="builderStore.currentStep === 4" class="space-y-5">
          <div>
            <h3 class="text-sm font-semibold text-secondary-900 mb-2">YAML Preview</h3>
            <pre class="bg-surface-3 text-secondary-800 p-4 rounded-m3-md text-xs overflow-x-auto border border-surface-variant shadow-elevation-1">{{ builderStore.yamlPreview }}</pre>
          </div>

          <!-- Validation Results -->
          <div v-if="builderStore.validationState.errors && builderStore.validationState.errors.length > 0" 
               class="bg-error-50 border border-error-300 rounded-m3-md p-4 shadow-elevation-1">
            <p class="text-error-700 text-sm font-semibold mb-2">Validation Errors:</p>
            <ul class="text-error-600 text-xs space-y-1 font-medium">
              <li v-for="(error, idx) in builderStore.validationState.errors" :key="idx">• {{ error }}</li>
            </ul>
          </div>

          <div v-if="builderStore.validationState.warnings && builderStore.validationState.warnings.length > 0" 
               class="bg-tertiary-50 border border-tertiary-300 rounded-m3-md p-4 shadow-elevation-1">
            <p class="text-tertiary-800 text-sm font-semibold mb-2">Warnings:</p>
            <ul class="text-tertiary-700 text-xs space-y-1 font-medium">
              <li v-for="(warning, idx) in builderStore.validationState.warnings" :key="idx">• {{ warning }}</li>
            </ul>
          </div>

          <div v-if="builderStore.validationState.valid" 
               class="bg-green-50 border border-green-300 rounded-m3-md p-4 shadow-elevation-1">
            <p class="text-green-700 text-sm font-semibold">✓ Ready to create</p>
          </div>

          <!-- Git Integration Options -->
          <div class="space-y-3 mt-4 pt-5 border-t border-surface-variant">
            <h4 class="text-sm font-semibold text-secondary-900 mb-3">Git Options</h4>
            
            <label class="flex items-center text-sm text-secondary-800 hover:text-secondary-900 cursor-pointer hover:bg-surface-2 px-2 py-2 rounded-m3-sm transition-colors">
              <input 
                type="checkbox" 
                v-model="builderStore.autoCommit"
                class="mr-3 h-5 w-5 rounded-m3-xs bg-surface-2 border-surface-variant text-primary-600 focus:ring-2 focus:ring-primary-400"
              />
              <div>
                <div class="font-medium">Auto-commit after creation</div>
                <div class="text-xs text-secondary-600 mt-0.5">Commit: feat({{ builderStore.partialEntity.id }}): {{ builderStore.partialEntity.title }}</div>
              </div>
            </label>

            <label 
              v-if="builderStore.entityType === 'feature'"
              class="flex items-center text-sm text-secondary-800 hover:text-secondary-900 cursor-pointer hover:bg-surface-2 px-2 py-2 rounded-m3-sm transition-colors"
            >
              <input 
                type="checkbox" 
                v-model="builderStore.createBranch"
                class="mr-3 h-5 w-5 rounded-m3-xs bg-surface-2 border-surface-variant text-primary-600 focus:ring-2 focus:ring-primary-400"
              />
              <div>
                <div class="font-medium">Create feature branch</div>
                <div class="text-xs text-secondary-600 mt-0.5">Branch: feature/{{ builderStore.partialEntity.id }}-{{ (builderStore.partialEntity.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 30) }}</div>
              </div>
            </label>

            <label 
              v-if="builderStore.entityType === 'feature'"
              class="flex items-center text-sm text-secondary-800 hover:text-secondary-900 cursor-pointer hover:bg-surface-2 px-2 py-2 rounded-m3-sm transition-colors"
            >
              <input 
                type="checkbox" 
                v-model="builderStore.createRelatedEntities"
                @change="builderStore.relatedEntitiesToCreate = builderStore.createRelatedEntities ? [{ type: 'userstory', count: 1 }] : []"
                class="mr-3 h-5 w-5 rounded-m3-xs bg-surface-2 border-surface-variant text-primary-600 focus:ring-2 focus:ring-primary-400"
              />
              <div>
                <div class="font-medium">Create related entities after this</div>
                <div class="text-xs text-secondary-600 mt-0.5">Wizard will guide you to create user stories and tasks</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-5 border-t border-surface-variant bg-surface-2 flex items-center justify-between">
        <button 
          @click="builderStore.prevStep"
          v-if="builderStore.currentStep > 1"
          class="px-5 py-2.5 text-sm font-medium text-secondary-700 hover:text-secondary-900 hover:bg-surface-3 rounded-m3-lg transition-all"
        >
          ← Back
        </button>
        <div v-else></div>

        <div class="flex items-center gap-3">
          <button 
            @click="close"
            class="px-5 py-2.5 text-sm font-medium text-secondary-700 hover:text-secondary-900 hover:bg-surface-3 rounded-m3-lg transition-all"
          >
            Cancel
          </button>
          <button 
            @click="handleNext"
            :disabled="!builderStore.canProceed || builderStore.isGenerating"
            class="px-5 py-2.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 active:bg-primary-800 disabled:bg-surface-3 disabled:text-secondary-400 text-white rounded-m3-lg transition-all shadow-elevation-2 hover:shadow-elevation-3"
          >
            <span v-if="builderStore.isGenerating">Creating...</span>
            <span v-else-if="builderStore.currentStep < 4">Next →</span>
            <span v-else>Create {{ entityTypeLabel }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
