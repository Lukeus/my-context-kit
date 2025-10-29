<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '@/stores/agentStore';
import { useContextStore } from '@/stores/contextStore';
import type { AgentProfile } from '@shared/agents/types';

const agentStore = useAgentStore();
const contextStore = useContextStore();

const { selectedAgentId, availableAgents, isLoading, error } = storeToRefs(agentStore);

const showDropdown = ref(false);
const searchQuery = ref('');
const buttonRef = ref<HTMLElement | null>(null);
const dropdownStyle = ref({ top: '0px', left: '0px', width: '0px' });

const selectedAgent = computed(() => 
  availableAgents.value.find(a => a.id === selectedAgentId.value) ?? null
);

const filteredAgents = computed(() => {
  if (!searchQuery.value.trim()) {
    return availableAgents.value;
  }
  
  const query = searchQuery.value.toLowerCase();
  return availableAgents.value.filter(agent =>
    agent.metadata.name.toLowerCase().includes(query) ||
    agent.metadata.description.toLowerCase().includes(query) ||
    agent.id.toLowerCase().includes(query) ||
    agent.metadata.tags.some(tag => tag.toLowerCase().includes(query))
  );
});

const builtInAgents = computed(() => 
  filteredAgents.value.filter(a => a.metadata.isBuiltIn)
);

const customAgents = computed(() => 
  filteredAgents.value.filter(a => !a.metadata.isBuiltIn)
);

onMounted(async () => {
  // Only load agents if repository is configured
  if (contextStore.repoPath) {
    await agentStore.loadAgents();
  }
});

// Watch for repository path changes and reload agents
watch(
  () => contextStore.repoPath,
  async (newPath, oldPath) => {
    if (newPath && newPath !== oldPath) {
      await agentStore.loadAgents();
    }
  }
);

async function selectAgent(agentId: string) {
  await agentStore.selectAgent(agentId);
  showDropdown.value = false;
  searchQuery.value = '';
}

function toggleDropdown() {
  if (!showDropdown.value && buttonRef.value) {
    // Calculate position before opening
    const rect = buttonRef.value.getBoundingClientRect();
    dropdownStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`
    };
  }
  showDropdown.value = !showDropdown.value;
  if (!showDropdown.value) {
    searchQuery.value = '';
  }
}

function closeDropdown() {
  showDropdown.value = false;
  searchQuery.value = '';
}
</script>

<template>
  <div class="relative">
    <!-- Selector Button -->
    <button
      ref="buttonRef"
      class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-surface-variant rounded-m3-md bg-surface-1 hover:bg-surface-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
      :class="{ 'border-primary-500': showDropdown }"
      :disabled="isLoading"
      @click="toggleDropdown"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span v-if="selectedAgent?.metadata.icon" class="text-lg flex-shrink-0">
          {{ selectedAgent.metadata.icon }}
        </span>
        <span v-else class="flex-shrink-0 text-secondary-500">🤖</span>
        
        <div class="flex-1 text-left min-w-0">
          <div class="font-medium text-secondary-900 truncate">
            {{ selectedAgent?.metadata.name ?? (contextStore.repoPath ? 'Select Agent' : 'Configure Repository') }}
          </div>
          <div v-if="selectedAgent" class="text-[11px] text-secondary-600 truncate">
            {{ selectedAgent.metadata.description }}
          </div>
          <div v-else-if="!contextStore.repoPath" class="text-[11px] text-secondary-500 truncate">
            Set up a repository first
          </div>
        </div>
      </div>
      
      <svg 
        class="w-4 h-4 text-secondary-600 flex-shrink-0 transition-transform"
        :class="{ 'rotate-180': showDropdown }"
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Error Message -->
    <div v-if="error" class="mt-1 text-xs text-error-700 bg-error-50 border border-error-200 rounded-m3-md px-2 py-1">
      {{ error }}
    </div>

    <!-- Dropdown Menu -->
    <Teleport to="body">
      <div
        v-if="showDropdown"
        class="fixed inset-0 z-40"
        @click="closeDropdown"
      />
      
      <Transition name="dropdown">
        <div
          v-if="showDropdown"
          class="fixed z-50 bg-white border border-surface-variant rounded-m3-lg shadow-elevation-2 max-h-[400px] overflow-hidden flex flex-col"
          :style="{ top: dropdownStyle.top, left: dropdownStyle.left, width: dropdownStyle.width }"
        >
        <!-- Search -->
        <div class="p-3 border-b border-surface-variant">
          <input
            v-model="searchQuery"
            type="text"
            class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Search agents..."
            @click.stop
          />
        </div>

        <!-- Agent List -->
        <div class="overflow-y-auto">
          <!-- Built-in Agents -->
          <div v-if="builtInAgents.length > 0" class="py-2">
            <div class="px-4 py-1.5 text-[10px] font-semibold text-secondary-500 uppercase tracking-wide">
              Built-in Agents
            </div>
            <button
              v-for="agent in builtInAgents"
              :key="agent.id"
              class="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
              :class="{
                'bg-primary-50 hover:bg-primary-100': selectedAgentId === agent.id
              }"
              @click.stop="selectAgent(agent.id)"
            >
              <span class="text-lg flex-shrink-0 mt-0.5">
                {{ agent.metadata.icon ?? '🤖' }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-secondary-900">
                    {{ agent.metadata.name }}
                  </span>
                  <span
                    v-if="agent.metadata.complexity"
                    class="px-1.5 py-0.5 text-[10px] font-medium rounded-m3-full bg-secondary-100 text-secondary-700"
                  >
                    {{ agent.metadata.complexity }}
                  </span>
                </div>
                <div class="text-xs text-secondary-600 mt-0.5">
                  {{ agent.metadata.description }}
                </div>
                <div v-if="agent.metadata.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="tag in agent.metadata.tags.slice(0, 3)"
                    :key="tag"
                    class="px-1.5 py-0.5 text-[10px] bg-secondary-50 text-secondary-600 rounded-m3-full"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              <svg
                v-if="selectedAgentId === agent.id"
                class="w-5 h-5 text-primary-600 flex-shrink-0 mt-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>

          <!-- Custom Agents -->
          <div v-if="customAgents.length > 0" class="py-2">
            <div class="px-4 py-1.5 text-[10px] font-semibold text-secondary-500 uppercase tracking-wide">
              Custom Agents
            </div>
            <button
              v-for="agent in customAgents"
              :key="agent.id"
              class="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left"
              :class="{
                'bg-primary-50 hover:bg-primary-100': selectedAgentId === agent.id
              }"
              @click.stop="selectAgent(agent.id)"
            >
              <span class="text-lg flex-shrink-0 mt-0.5">
                {{ agent.metadata.icon ?? '⚡' }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-secondary-900">
                    {{ agent.metadata.name }}
                  </span>
                  <span class="px-1.5 py-0.5 text-[10px] font-medium rounded-m3-full bg-tertiary-100 text-tertiary-700">
                    Custom
                  </span>
                </div>
                <div class="text-xs text-secondary-600 mt-0.5">
                  {{ agent.metadata.description }}
                </div>
                <div v-if="agent.metadata.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="tag in agent.metadata.tags.slice(0, 3)"
                    :key="tag"
                    class="px-1.5 py-0.5 text-[10px] bg-secondary-50 text-secondary-600 rounded-m3-full"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              <svg
                v-if="selectedAgentId === agent.id"
                class="w-5 h-5 text-primary-600 flex-shrink-0 mt-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>

          <!-- No Results -->
          <div
            v-if="filteredAgents.length === 0"
            class="px-4 py-8 text-center text-sm text-secondary-500"
          >
            No agents found matching "{{ searchQuery }}"
          </div>
        </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
