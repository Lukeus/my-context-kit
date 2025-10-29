<script setup lang="ts">
import { computed } from 'vue';
import type { AgentProfile, AgentComplexity } from '@shared/agents/types';

interface Props {
  agent: AgentProfile;
  isSelected: boolean;
  viewMode?: 'grid' | 'list';
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  viewMode: 'grid',
  showActions: true
});

const emit = defineEmits<{
  select: [agentId: string];
  edit: [agent: AgentProfile];
  delete: [agentId: string];
  duplicate: [agent: AgentProfile];
}>();

function getComplexityColor(complexity?: AgentComplexity): string {
  switch (complexity) {
    case 'basic': return 'bg-green-100 text-green-700';
    case 'intermediate': return 'bg-yellow-100 text-yellow-700';
    case 'advanced': return 'bg-red-100 text-red-700';
    default: return 'bg-secondary-100 text-secondary-700';
  }
}

const isBuiltIn = computed(() => props.agent.metadata.isBuiltIn);
const iconDisplay = computed(() => props.agent.metadata.icon || (isBuiltIn.value ? '🤖' : '⚡'));
</script>

<template>
  <!-- Grid View -->
  <div
    v-if="viewMode === 'grid'"
    class="group border border-surface-variant rounded-m3-xl p-5 bg-white hover:shadow-elevation-2 transition-all duration-200 cursor-pointer"
    :class="{ 'ring-2 ring-primary-600 shadow-elevation-2': isSelected }"
    @click="emit('select', agent.id)"
  >
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="text-2xl">{{ iconDisplay }}</span>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="font-medium text-sm text-secondary-900">{{ agent.metadata.name }}</h4>
            <span
              v-if="isSelected"
              class="text-[10px] px-2 py-0.5 rounded-m3-full font-semibold bg-primary-600 text-white"
            >
              ACTIVE
            </span>
          </div>
          <div class="flex items-center gap-1 mt-0.5">
            <span
              v-if="agent.metadata.complexity"
              class="text-[10px] px-1.5 py-0.5 rounded-m3-full font-medium"
              :class="getComplexityColor(agent.metadata.complexity)"
            >
              {{ agent.metadata.complexity }}
            </span>
            <span
              v-if="!isBuiltIn"
              class="text-[10px] px-1.5 py-0.5 rounded-m3-full font-medium bg-tertiary-100 text-tertiary-700"
            >
              Custom
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <p class="text-xs text-secondary-600 mb-3">{{ agent.metadata.description }}</p>
    
    <div v-if="agent.metadata.tags.length > 0" class="flex flex-wrap gap-1 mb-3">
      <span
        v-for="tag in agent.metadata.tags.slice(0, 3)"
        :key="tag"
        class="px-1.5 py-0.5 text-[10px] bg-secondary-50 text-secondary-600 rounded-m3-full"
      >
        {{ tag }}
      </span>
    </div>

    <div v-if="showActions" class="flex items-center justify-end gap-2">
      <button
        v-if="isBuiltIn"
        class="text-xs text-primary-600 hover:text-primary-700 font-medium"
        @click.stop="emit('duplicate', agent)"
      >
        Duplicate
      </button>
      <template v-else>
        <button
          class="text-xs text-secondary-600 hover:text-secondary-700 font-medium"
          @click.stop="emit('edit', agent)"
        >
          Edit
        </button>
        <button
          class="text-xs text-error-600 hover:text-error-700 font-medium"
          @click.stop="emit('delete', agent.id)"
        >
          Delete
        </button>
      </template>
    </div>
  </div>

  <!-- List View -->
  <div
    v-else
    class="flex items-center gap-3 border border-surface-variant rounded-m3-lg p-3 bg-white hover:bg-surface-1 transition-colors cursor-pointer"
    :class="{ 'ring-2 ring-primary-500': isSelected }"
    @click="emit('select', agent.id)"
  >
    <span class="text-xl flex-shrink-0">{{ iconDisplay }}</span>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <h4 class="font-medium text-sm text-secondary-900">{{ agent.metadata.name }}</h4>
        <span
          v-if="isSelected"
          class="text-[10px] px-2 py-0.5 rounded-m3-full font-semibold bg-primary-600 text-white"
        >
          ACTIVE
        </span>
        <span
          v-if="agent.metadata.complexity"
          class="text-[10px] px-1.5 py-0.5 rounded-m3-full font-medium"
          :class="getComplexityColor(agent.metadata.complexity)"
        >
          {{ agent.metadata.complexity }}
        </span>
        <span
          v-if="!isBuiltIn"
          class="text-[10px] px-1.5 py-0.5 rounded-m3-full font-medium bg-tertiary-100 text-tertiary-700"
        >
          Custom
        </span>
      </div>
      <p class="text-xs text-secondary-600 truncate">{{ agent.metadata.description }}</p>
    </div>
    <div v-if="showActions" class="flex items-center gap-2">
      <button
        v-if="isBuiltIn"
        class="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1"
        @click.stop="emit('duplicate', agent)"
      >
        Duplicate
      </button>
      <template v-else>
        <button
          class="text-xs text-secondary-600 hover:text-secondary-700 font-medium px-2 py-1"
          @click.stop="emit('edit', agent)"
        >
          Edit
        </button>
        <button
          class="text-xs text-error-600 hover:text-error-700 font-medium px-2 py-1"
          @click.stop="emit('delete', agent.id)"
        >
          Delete
        </button>
      </template>
    </div>
  </div>
</template>
