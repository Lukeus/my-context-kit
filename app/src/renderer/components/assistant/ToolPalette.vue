<template>
  <div class="tool-palette flex flex-col h-full bg-surface" data-assistant-focus="tool-palette">
    <!-- Header with description -->
    <div class="px-4 py-3 border-b border-outline">
      <h3 class="text-sm font-medium text-on-surface mb-1">
        Available Tools
      </h3>
      <p class="text-xs text-on-surface-variant">
        Click a tool to add it to your message
      </p>
    </div>

    <!-- Tool List -->
    <div v-if="availableTools.length > 0" class="flex-1 overflow-auto p-3 space-y-2">
      <button
        v-for="tool in availableTools"
        :key="tool.id"
        :disabled="!isToolEnabled(tool.id)"
        :title="tool.description"
        class="w-full px-4 py-3 rounded-m3-md border border-outline hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-outline disabled:hover:bg-transparent text-left group"
        :class="isToolEnabled(tool.id) ? 'bg-surface' : 'bg-surface-dim'"
        @click="handleToolClick(tool)"
      >
        <div class="flex items-start gap-3">
          <!-- Status Indicator -->
          <div class="flex-shrink-0 mt-1">
            <div
              v-if="isToolEnabled(tool.id)"
              class="w-2 h-2 rounded-full bg-success-500"
              title="Available"
            />
            <div
              v-else
              class="w-2 h-2 rounded-full bg-outline"
              title="Unavailable"
            />
          </div>
          
          <!-- Tool Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-on-surface">
                {{ tool.title }}
              </span>
              <span
                v-if="tool.requiresApproval"
                class="flex-shrink-0 px-1.5 py-0.5 text-xs bg-warning-100 text-warning-800 rounded"
                title="Requires approval"
              >
                Requires approval
              </span>
            </div>
            <p class="text-xs text-on-surface-variant line-clamp-2">
              {{ tool.description }}
            </p>
          </div>
        </div>
      </button>
    </div>

    <!-- Empty State -->
    <div v-else class="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <p class="text-sm font-medium">No tools configured</p>
      <p class="text-xs mt-1">Tools will appear here when available</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ToolDescriptor } from '@shared/assistant/types';

interface Props {
  sessionId?: string;
  activeTools: ToolDescriptor[];
  capabilities: Record<string, { status: string }>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'invoke-tool': [toolId: string, parameters: Record<string, unknown>];
}>();

// Computed
const availableTools = computed(() => props.activeTools);

// Methods
function isToolEnabled(toolId: string): boolean {
  // Check if tool capability is enabled
  const capabilityKey = toolId;
  return props.capabilities[capabilityKey]?.status === 'enabled';
}

function handleToolClick(tool: ToolDescriptor) {
  if (!isToolEnabled(tool.id)) return;
  
  // Emit tool invocation with empty parameters
  // The assistant will handle asking for parameters in chat if needed
  emit('invoke-tool', tool.id, {});
}
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