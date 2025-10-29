<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useAgentStore } from '@/stores/agentStore';
import { useContextStore } from '@/stores/contextStore';
import type { 
  AgentProfile, 
  AgentCapabilityTag, 
  AgentComplexity,
  AgentToolRequirement 
} from '@shared/agents/types';

interface Props {
  agent?: AgentProfile | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const agentStore = useAgentStore();
const contextStore = useContextStore();

const isEditing = computed(() => !!props.agent);
const isSaving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = reactive<{
  name?: string;
  description?: string;
  systemPrompt?: string;
  tags?: string;
  tools?: string;
}>({});

// Form data
const formData = reactive<{
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  tags: AgentCapabilityTag[];
  complexity: AgentComplexity;
  tools: AgentToolRequirement[];
  temperature: number;
  maxTokens: number;
  enableLogprobs: boolean;
}>({
  id: '',
  name: '',
  description: '',
  icon: '🤖',
  systemPrompt: '',
  tags: [],
  complexity: 'basic',
  tools: [],
  temperature: 0.7,
  maxTokens: 4096,
  enableLogprobs: false
});

const availableTags: AgentCapabilityTag[] = [
  'code-generation',
  'code-review',
  'documentation',
  'testing',
  'refactoring',
  'debugging',
  'analysis',
  'automation'
];

const complexityLevels: AgentComplexity[] = ['basic', 'intermediate', 'advanced'];

const commonIcons = ['🤖', '⚡', '🔧', '📝', '🧪', '🔍', '⚙️', '🎯', '🚀', '💡', '🎨', '🛠️'];

// Available tools
const availableTools = [
  { id: 'pipeline.run', name: 'Pipeline Runner', description: 'Execute context repository pipelines' },
  { id: 'context.read', name: 'Context Reader', description: 'Read context repository files' },
  { id: 'file.read', name: 'File Reader', description: 'Read local files' },
  { id: 'file.write', name: 'File Writer', description: 'Write to local files' },
  { id: 'command.execute', name: 'Command Executor', description: 'Execute shell commands' },
  { id: 'search.code', name: 'Code Search', description: 'Search through codebases' },
  { id: 'git.status', name: 'Git Status', description: 'Check git repository status' },
  { id: 'git.diff', name: 'Git Diff', description: 'View git changes' }
];

// Initialize form with agent data if editing
onMounted(() => {
  if (props.agent) {
    formData.id = props.agent.id;
    formData.name = props.agent.metadata.name;
    formData.description = props.agent.metadata.description;
    formData.icon = props.agent.metadata.icon || '🤖';
    formData.systemPrompt = props.agent.systemPrompt;
    formData.tags = [...props.agent.metadata.tags];
    formData.complexity = props.agent.metadata.complexity || 'basic';
    formData.tools = props.agent.tools ? [...props.agent.tools] : [];
    formData.temperature = props.agent.config?.temperature ?? 0.7;
    formData.maxTokens = props.agent.config?.maxTokens ?? 4096;
    formData.enableLogprobs = props.agent.config?.enableLogprobs ?? false;
  } else {
    // Generate ID for new agent
    formData.id = `custom-agent-${Date.now()}`;
  }
});

function toggleTag(tag: AgentCapabilityTag) {
  const index = formData.tags.indexOf(tag);
  if (index >= 0) {
    formData.tags.splice(index, 1);
  } else {
    formData.tags.push(tag);
  }
}

function addTool() {
  formData.tools.push({
    toolId: '',
    required: false
  });
}

function removeTool(index: number) {
  formData.tools.splice(index, 1);
}

function validateForm(): boolean {
  // Clear previous errors
  Object.keys(fieldErrors).forEach(key => delete fieldErrors[key as keyof typeof fieldErrors]);
  
  let hasErrors = false;
  
  if (!formData.name.trim()) {
    fieldErrors.name = 'Agent name is required';
    hasErrors = true;
  }
  
  if (!formData.description.trim()) {
    fieldErrors.description = 'Agent description is required';
    hasErrors = true;
  }
  
  if (!formData.systemPrompt.trim()) {
    fieldErrors.systemPrompt = 'System prompt is required';
    hasErrors = true;
  } else if (formData.systemPrompt.trim().length < 20) {
    fieldErrors.systemPrompt = 'System prompt must be at least 20 characters';
    hasErrors = true;
  }
  
  if (formData.tags.length === 0) {
    fieldErrors.tags = 'Select at least one capability tag';
    hasErrors = true;
  }
  
  // Validate tools
  for (const tool of formData.tools) {
    if (!tool.toolId) {
      fieldErrors.tools = 'All tools must have a selected tool ID';
      hasErrors = true;
      break;
    }
  }
  
  return !hasErrors;
}

async function saveAgent() {
  error.value = null;
  
  // Validate form
  const isValid = validateForm();
  if (!isValid) {
    error.value = 'Please fix the errors below before saving';
    return;
  }
  
  isSaving.value = true;
  
  try {
    const agentProfile: AgentProfile = {
      id: formData.id,
      systemPrompt: formData.systemPrompt.trim(),
      metadata: {
        name: formData.name.trim(),
        description: formData.description.trim(),
        icon: formData.icon,
        tags: [...formData.tags],
        complexity: formData.complexity,
        isBuiltIn: false
      },
      tools: formData.tools.length > 0 ? [...formData.tools] : undefined,
      config: {
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        enableLogprobs: formData.enableLogprobs
      }
    };
    
    let success: boolean;
    if (isEditing.value) {
      success = await agentStore.updateAgent(agentProfile);
    } else {
      success = await agentStore.createAgent(agentProfile);
    }
    
    if (success) {
      emit('saved');
    } else {
      error.value = agentStore.error || 'Failed to save agent';
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save agent';
    error.value = message;
  } finally {
    isSaving.value = false;
  }
}

function cancel() {
  emit('close');
}
</script>

<template>
  <div class="flex flex-col h-full max-h-[90vh] bg-surface">
    <!-- Header with M3 elevation -->
    <header class="flex items-center justify-between px-6 py-4 bg-primary-600 text-white shadow-elevation-2">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-white/20 rounded-m3-lg">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-semibold">
            {{ isEditing ? 'Edit Agent' : 'Create New Agent' }}
          </h2>
          <p class="text-xs text-white/80">Configure your custom AI agent profile</p>
        </div>
      </div>
      <button
        class="p-2 rounded-m3-full hover:bg-white/10 transition-colors"
        @click="cancel"
        title="Close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- Error Message with M3 styling -->
    <div v-if="error" class="mx-6 mt-4 text-sm text-error-700 bg-error-50 border border-error-200 rounded-m3-lg px-4 py-3 flex items-start gap-3 shadow-sm">
      <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Form with M3 container -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6">
      <!-- Basic Info Section -->
      <section class="bg-white rounded-m3-xl p-5 shadow-elevation-1 border border-surface-variant space-y-4">
        <div class="flex items-center gap-2 pb-2 border-b border-surface-variant">
          <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-base font-semibold text-secondary-900">Basic Information</h3>
        </div>
        
        <!-- Icon Selector with M3 chips -->
        <div>
          <label class="text-xs font-semibold text-secondary-700 block mb-2">Agent Icon</label>
          <div class="flex items-center gap-3">
            <div class="p-3 bg-surface-2 rounded-m3-xl border border-surface-variant">
              <span class="text-4xl">{{ formData.icon }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="icon in commonIcons"
                :key="icon"
                class="text-2xl p-2 rounded-m3-lg transition-all hover:shadow-elevation-1"
                :class="formData.icon === icon 
                  ? 'bg-primary-100 ring-2 ring-primary-500 shadow-elevation-1' 
                  : 'bg-white hover:bg-surface-1 border border-surface-variant'"
                @click="formData.icon = icon"
                type="button"
              >
                {{ icon }}
              </button>
            </div>
          </div>
        </div>

        <!-- Name with M3 text field -->
        <div>
          <label class="text-xs font-semibold text-secondary-700 block mb-2">Agent Name *</label>
          <input
            v-model="formData.name"
            type="text"
            class="w-full px-4 py-3 text-sm border-2 rounded-m3-lg bg-white focus:outline-none focus:shadow-elevation-1 transition-all"
            :class="fieldErrors.name ? 'border-error-500 focus:border-error-600' : 'border-surface-variant focus:border-primary-600'"
            placeholder="e.g., Code Reviewer Pro"
          />
          <p v-if="fieldErrors.name" class="text-xs text-error-600 mt-1">{{ fieldErrors.name }}</p>
        </div>

        <!-- Description with M3 text area -->
        <div>
          <label class="text-xs font-semibold text-secondary-700 block mb-2">Description *</label>
          <textarea
            v-model="formData.description"
            rows="3"
            class="w-full px-4 py-3 text-sm border-2 rounded-m3-lg bg-white focus:outline-none focus:shadow-elevation-1 transition-all resize-none"
            :class="fieldErrors.description ? 'border-error-500 focus:border-error-600' : 'border-surface-variant focus:border-primary-600'"
            placeholder="Briefly describe what this agent does..."
          />
          <p v-if="fieldErrors.description" class="text-xs text-error-600 mt-1">{{ fieldErrors.description }}</p>
        </div>

        <!-- Complexity with M3 dropdown -->
        <div>
          <label class="text-xs font-semibold text-secondary-700 block mb-2">Complexity Level</label>
          <select
            v-model="formData.complexity"
            class="w-full px-4 py-3 text-sm border-2 border-surface-variant rounded-m3-lg bg-white focus:outline-none focus:border-primary-600 focus:shadow-elevation-1 transition-all cursor-pointer"
          >
            <option v-for="level in complexityLevels" :key="level" :value="level">
              {{ level.charAt(0).toUpperCase() + level.slice(1) }}
            </option>
          </select>
          <p class="text-xs text-secondary-500 mt-2">
            Indicates the sophistication of the agent's capabilities
          </p>
        </div>
      </section>

      <!-- Capabilities Section -->
      <section class="bg-white rounded-m3-xl p-5 shadow-elevation-1 space-y-4"
        :class="fieldErrors.tags ? 'border-2 border-error-500' : 'border border-surface-variant'">
        <div class="flex items-center gap-2 pb-2 border-b border-surface-variant">
          <svg class="w-5 h-5" :class="fieldErrors.tags ? 'text-error-600' : 'text-primary-600'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-base font-semibold text-secondary-900">Capabilities *</h3>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in availableTags"
            :key="tag"
            class="px-4 py-2 text-sm font-medium rounded-m3-full transition-all"
            :class="formData.tags.includes(tag) 
              ? 'bg-primary-600 text-white shadow-elevation-1 hover:shadow-elevation-2' 
              : 'bg-surface-1 border-2 border-surface-variant text-secondary-700 hover:border-primary-300 hover:bg-primary-50'"
            @click="toggleTag(tag)"
            type="button"
          >
            {{ tag }}
          </button>
        </div>
        <p class="text-xs" :class="fieldErrors.tags ? 'text-error-600' : 'text-secondary-500'">
          {{ fieldErrors.tags || 'Select one or more tags that describe this agent\'s capabilities' }}
        </p>
      </section>

      <!-- System Prompt Section -->
      <section class="bg-white rounded-m3-xl p-5 shadow-elevation-1 space-y-4"
        :class="fieldErrors.systemPrompt ? 'border-2 border-error-500' : 'border border-surface-variant'">
        <div class="flex items-center gap-2 pb-2 border-b border-surface-variant">
          <svg class="w-5 h-5" :class="fieldErrors.systemPrompt ? 'text-error-600' : 'text-primary-600'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <h3 class="text-base font-semibold text-secondary-900">System Prompt *</h3>
        </div>
        <textarea
          v-model="formData.systemPrompt"
          rows="10"
          class="w-full px-4 py-3 text-sm border-2 rounded-m3-lg bg-surface-1/50 focus:outline-none focus:shadow-elevation-1 focus:bg-white transition-all font-mono resize-none"
          :class="fieldErrors.systemPrompt ? 'border-error-500 focus:border-error-600' : 'border-surface-variant focus:border-primary-600'"
          placeholder="You are a specialized AI assistant that..."
        />
        <p class="text-xs" :class="fieldErrors.systemPrompt ? 'text-error-600' : 'text-secondary-500'">
          {{ fieldErrors.systemPrompt || 'The system prompt defines the agent\'s behavior, personality, and instructions' }}
        </p>
      </section>

      <!-- Tools Section -->
      <section class="bg-white rounded-m3-xl p-5 shadow-elevation-1 border border-surface-variant space-y-4">
        <div class="flex items-center justify-between pb-2 border-b border-surface-variant">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 class="text-base font-semibold text-secondary-900">Required Tools</h3>
          </div>
          <button
            class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-m3-full transition-colors"
            @click="addTool"
            type="button"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Tool
          </button>
        </div>
        
        <div v-if="formData.tools.length === 0" class="text-sm text-secondary-500 bg-surface-1 border-2 border-dashed border-surface-variant rounded-m3-lg px-4 py-6 text-center">
          <svg class="w-10 h-10 mx-auto mb-2 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p>No tools configured yet</p>
          <p class="text-xs text-secondary-400 mt-1">Add tools that this agent requires to function</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="(tool, index) in formData.tools"
            :key="index"
            class="flex items-center gap-3 p-4 bg-surface-1 border-2 border-surface-variant rounded-m3-lg hover:border-primary-300 transition-all"
          >
            <select
              v-model="tool.toolId"
              class="flex-1 px-3 py-2 text-sm border-2 border-surface-variant rounded-m3-lg bg-white focus:outline-none focus:border-primary-600 transition-all cursor-pointer"
            >
              <option value="">Select tool...</option>
              <option v-for="availTool in availableTools" :key="availTool.id" :value="availTool.id">
                {{ availTool.name }}
              </option>
            </select>
            
            <label class="flex items-center gap-2 text-sm text-secondary-700 cursor-pointer">
              <input
                v-model="tool.required"
                type="checkbox"
                class="w-4 h-4 rounded border-2 border-surface-variant text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
              />
              <span>Required</span>
            </label>
            
            <button
              class="p-2 text-error-600 hover:bg-error-50 rounded-m3-full transition-colors"
              @click="removeTool(index)"
              type="button"
              title="Remove tool"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <p class="text-xs" :class="fieldErrors.tools ? 'text-error-600' : 'text-secondary-500'">
          {{ fieldErrors.tools || 'Specify which tools this agent needs access to' }}
        </p>
      </section>

      <!-- Configuration Section -->
      <section class="bg-white rounded-m3-xl p-5 shadow-elevation-1 border border-surface-variant space-y-4">
        <div class="flex items-center gap-2 pb-2 border-b border-surface-variant">
          <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          <h3 class="text-base font-semibold text-secondary-900">Configuration</h3>
        </div>
        
        <!-- Temperature with M3 slider -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-semibold text-secondary-700">Temperature</label>
            <span class="text-sm font-mono text-primary-700 bg-primary-50 px-3 py-1 rounded-m3-full">{{ formData.temperature }}</span>
          </div>
          <input
            v-model.number="formData.temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            class="w-full h-2 bg-surface-2 rounded-m3-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:shadow-elevation-1 hover:[&::-webkit-slider-thumb]:shadow-elevation-2"
          />
          <p class="text-xs text-secondary-500 mt-2">
            Lower = more focused, Higher = more creative (0.0 - 2.0)
          </p>
        </div>

        <!-- Max Tokens -->
        <div>
          <label class="text-sm font-semibold text-secondary-700 block mb-2">Max Tokens</label>
          <input
            v-model.number="formData.maxTokens"
            type="number"
            min="256"
            max="128000"
            step="256"
            class="w-full px-4 py-3 text-sm border-2 border-surface-variant rounded-m3-lg bg-white focus:outline-none focus:border-primary-600 focus:shadow-elevation-1 transition-all"
          />
          <p class="text-xs text-secondary-500 mt-2">
            Maximum response length (256 - 128000)
          </p>
        </div>

        <!-- Enable Logprobs with M3 switch -->
        <div class="p-4 bg-surface-1 rounded-m3-lg border border-surface-variant">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              v-model="formData.enableLogprobs"
              type="checkbox"
              class="w-5 h-5 rounded-md border-2 border-surface-variant text-primary-600 focus:ring-2 focus:ring-primary-500 cursor-pointer"
            />
            <div>
              <span class="text-sm font-medium text-secondary-900 block">Enable log probabilities</span>
              <p class="text-xs text-secondary-500 mt-0.5">
                Include token probability information in responses (advanced)
              </p>
            </div>
          </label>
        </div>
      </section>
    </div>

    <!-- Footer with M3 FAB-style actions -->
    <footer class="flex items-center justify-between px-6 py-4 border-t-2 border-surface-variant bg-white shadow-elevation-2">
      <p class="text-xs text-secondary-500">* Required fields</p>
      <div class="flex items-center gap-3">
        <button
          class="px-5 py-2.5 text-sm font-medium text-secondary-700 hover:bg-surface-2 rounded-m3-lg transition-all"
          :disabled="isSaving"
          @click="cancel"
          type="button"
        >
          Cancel
        </button>
        <button
          class="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 transition-all shadow-elevation-2 hover:shadow-elevation-3 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isSaving"
          @click="saveAgent"
          type="button"
        >
          <svg v-if="!isSaving" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isSaving ? 'Saving...' : (isEditing ? 'Update Agent' : 'Create Agent') }}
        </button>
      </div>
    </footer>
  </div>
</template>
