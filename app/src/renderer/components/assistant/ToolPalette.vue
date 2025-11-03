<template>
  <div class="tool-palette flex flex-col h-full" data-assistant-focus="tool-palette">
    <!-- Compact Header -->
    <div class="px-3 py-2 border-b border-surface-variant bg-surface-tint">
      <h3 class="text-xs font-semibold text-secondary-900 uppercase tracking-wide">
        Tools
      </h3>
    </div>

    <!-- Tool List - Compact Cards -->
    <div v-if="availableTools.length > 0" class="flex-1 overflow-auto">
      <button
        v-for="tool in availableTools"
        :key="tool.id"
        :disabled="!isToolEnabled(tool.id)"
        :title="tool.description"
        class="w-full px-3 py-2.5 border-b border-surface-variant hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left group"
        :class="isToolEnabled(tool.id) ? 'bg-surface' : 'bg-surface-dim'"
        @click="selectTool(tool)"
      >
        <div class="flex items-start gap-2">
          <!-- Status Indicator -->
          <div class="flex-shrink-0 mt-0.5">
            <div
              v-if="isToolEnabled(tool.id)"
              class="w-2 h-2 rounded-full bg-success-500"
              title="Available"
            />
            <div
              v-else
              class="w-2 h-2 rounded-full bg-secondary-300"
              title="Unavailable"
            />
          </div>
          
          <!-- Tool Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-secondary-900 truncate">
                {{ tool.title }}
              </span>
              <span
                v-if="tool.requiresApproval"
                class="flex-shrink-0 text-xs text-tertiary-700"
                title="Requires approval"
              >
                🔒
              </span>
            </div>
            <p class="text-xs text-secondary-600 mt-0.5 line-clamp-2">
              {{ tool.description }}
            </p>
          </div>

          <!-- Chevron for enabled tools -->
          <div v-if="isToolEnabled(tool.id)" class="flex-shrink-0 text-secondary-400 group-hover:text-primary-600 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    </div>

    <!-- Empty State -->
    <div v-else class="flex-1 flex items-center justify-center text-secondary-500 text-sm">
      No tools configured
    </div>

    <!-- Tool Invocation Dialog -->
    <teleport to="body">
      <div
        v-if="selectedTool"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40"
        @click.self="selectedTool = null"
      >
        <div class="w-full max-w-lg bg-surface rounded-m3-xl shadow-elevation-3 overflow-hidden">
          <!-- Modal Header -->
          <div class="px-6 py-4 bg-primary-50 border-b border-primary-100">
            <h3 class="text-base font-semibold text-secondary-900">
              {{ selectedTool.title }}
            </h3>
            <p v-if="selectedTool.description" class="text-xs text-secondary-600 mt-1">
              {{ selectedTool.description }}
            </p>
          </div>

          <!-- Modal Body -->
          <div class="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <!-- Parameters Form -->
            <div
              v-for="(schema, paramName) in toolParameters"
              :key="paramName"
              class="space-y-1.5"
            >
              <label class="block text-sm font-medium text-secondary-900">
                {{ schema.title || paramName }}
                <span v-if="isRequired(paramName)" class="text-error-600 ml-1">*</span>
              </label>
              <p v-if="schema.description" class="text-xs text-secondary-600">
                {{ schema.description }}
              </p>

              <!-- String/Text Input -->
              <input
                v-if="schema.type === 'string' && !schema.enum"
                v-model="parameterValues[paramName]"
                :placeholder="schema.default?.toString() || 'Enter value...'"
                type="text"
                class="w-full px-3 py-2 text-sm border border-outline rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />

              <!-- Enum/Select -->
              <select
                v-else-if="schema.enum"
                v-model="parameterValues[paramName]"
                class="w-full px-3 py-2 text-sm border border-outline rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-surface"
              >
                <option value="">Choose an option...</option>
                <option v-for="opt in schema.enum" :key="opt" :value="opt">
                  {{ opt }}
                </option>
              </select>

              <!-- Number Input -->
              <input
                v-else-if="schema.type === 'number' || schema.type === 'integer'"
                v-model.number="parameterValues[paramName]"
                :placeholder="schema.default?.toString() || '0'"
                :min="schema.minimum"
                :max="schema.maximum"
                type="number"
                class="w-full px-3 py-2 text-sm border border-outline rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />

              <!-- Boolean Checkbox -->
              <label v-else-if="schema.type === 'boolean'" class="flex items-center gap-2">
                <input
                  v-model="parameterValues[paramName]"
                  type="checkbox"
                />
                <span class="text-sm">{{ schema.title || paramName }}</span>
              </label>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="px-6 py-4 bg-surface-tint border-t border-surface-variant flex items-center justify-between gap-3">
            <button 
              class="px-4 py-2 text-sm font-medium rounded-m3-md border border-outline text-secondary-700 hover:bg-surface-variant transition-colors" 
              @click="selectedTool = null"
            >
              Cancel
            </button>
            <button
              :disabled="!canInvoke"
              class="px-5 py-2 text-sm font-medium rounded-m3-md bg-primary text-white hover:bg-primary-700 active:bg-primary-800 disabled:bg-surface-variant disabled:text-secondary-400 disabled:cursor-not-allowed transition-all shadow-sm"
              @click="handleInvoke"
            >
              Run Tool
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ToolDescriptor, JsonSchemaDefinition } from '@shared/assistant/types';

interface Props {
  sessionId?: string;
  activeTools: ToolDescriptor[];
  capabilities: Record<string, { status: string }>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'invoke-tool': [toolId: string, parameters: Record<string, unknown>];
}>();

// Local state
const selectedTool = ref<ToolDescriptor | null>(null);
const parameterValues = ref<Record<string, unknown>>({});

// Computed
const availableTools = computed(() => props.activeTools);

const toolParameters = computed((): Record<string, JsonSchemaDefinition> => {
  if (!selectedTool.value) return {};
  const schema = selectedTool.value.inputSchema;
  return (schema.properties as Record<string, JsonSchemaDefinition>) || {};
});

const requiredParams = computed((): string[] => {
  if (!selectedTool.value) return [];
  return selectedTool.value.inputSchema.required || [];
});

const canInvoke = computed(() => {
  if (!selectedTool.value) return false;
  
  // Check all required parameters have values
  return requiredParams.value.every(paramName => {
    const value = parameterValues.value[paramName];
    return value !== undefined && value !== null && value !== '';
  });
});

// Methods
function isToolEnabled(toolId: string): boolean {
  // Check if tool capability is enabled
  const capabilityKey = toolId; // Assume toolId matches capability key
  return props.capabilities[capabilityKey]?.status === 'enabled';
}

function isRequired(paramName: string): boolean {
  return requiredParams.value.includes(paramName);
}

function selectTool(tool: ToolDescriptor) {
  if (!isToolEnabled(tool.id)) return;
  
  selectedTool.value = tool;
  parameterValues.value = {};
  
  // Initialize with defaults
  const schema = tool.inputSchema;
  if (schema.properties) {
    Object.entries(schema.properties).forEach(([key, propSchema]) => {
      const prop = propSchema as JsonSchemaDefinition;
      if (prop.default !== undefined) {
        parameterValues.value[key] = prop.default;
      }
    });
  }
}

function handleInvoke() {
  if (!selectedTool.value || !canInvoke.value) return;
  
  emit('invoke-tool', selectedTool.value.id, { ...parameterValues.value });
  selectedTool.value = null;
  parameterValues.value = {};
}

// Reset when session changes
watch(() => props.sessionId, () => {
  selectedTool.value = null;
  parameterValues.value = {};
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>