<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '@/stores/agentStore';
import { useContextStore } from '@/stores/contextStore';
import type { AgentProfile, AgentCapabilityTag, AgentComplexity, AgentMergeConflict, AgentSyncSettings as AgentSyncSettingsType } from '@shared/agents/types';
import AgentProfileEditor from './AgentProfileEditor.vue';
import AgentCard from './AgentCard.vue';
import AgentSyncPanel from './AgentSyncPanel.vue';
import ConflictResolutionDialog from './ConflictResolutionDialog.vue';
import AgentSyncSettings from './AgentSyncSettings.vue';

const agentStore = useAgentStore();
const contextStore = useContextStore();

const { 
  availableAgents, 
  selectedAgentId, 
  isLoading, 
  error,
  builtInAgents,
  customAgents 
} = storeToRefs(agentStore);

const searchQuery = ref('');
const selectedTag = ref<AgentCapabilityTag | 'all'>('all');
const selectedComplexity = ref<AgentComplexity | 'all'>('all');
const viewMode = ref<'grid' | 'list'>('grid');
const showEditor = ref(false);
const editingAgent = ref<AgentProfile | null>(null);
const showDeleteConfirm = ref(false);
const deletingAgentId = ref<string | null>(null);
const isDeleting = ref(false);
const isRefreshing = ref(false);
const showConflicts = ref(false);
const conflicts = ref<AgentMergeConflict[]>([]);
const showSettings = ref(false);

const allTags: AgentCapabilityTag[] = [
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

const filteredAgents = computed(() => {
  let filtered = [...availableAgents.value];

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(agent =>
      agent.metadata.name.toLowerCase().includes(query) ||
      agent.metadata.description.toLowerCase().includes(query) ||
      agent.id.toLowerCase().includes(query) ||
      agent.metadata.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // Filter by tag
  if (selectedTag.value !== 'all') {
    filtered = filtered.filter(agent =>
      agent.metadata.tags.includes(selectedTag.value as AgentCapabilityTag)
    );
  }

  // Filter by complexity
  if (selectedComplexity.value !== 'all') {
    filtered = filtered.filter(agent =>
      agent.metadata.complexity === selectedComplexity.value
    );
  }

  return filtered;
});

const filteredBuiltIn = computed(() => 
  filteredAgents.value.filter(a => a.metadata.isBuiltIn)
);

const filteredCustom = computed(() => 
  filteredAgents.value.filter(a => !a.metadata.isBuiltIn)
);

onMounted(async () => {
  await agentStore.loadAgents();
});

async function refreshAgents() {
  isRefreshing.value = true;
  try {
    await agentStore.loadAgents(true);
  } finally {
    isRefreshing.value = false;
  }
}

function createNewAgent() {
  editingAgent.value = null;
  showEditor.value = true;
}

function editAgent(agent: AgentProfile) {
  editingAgent.value = agent;
  showEditor.value = true;
}

function closeEditor() {
  showEditor.value = false;
  editingAgent.value = null;
}

async function handleAgentSaved() {
  closeEditor();
  await refreshAgents();
}

function confirmDeleteAgent(agentId: string) {
  deletingAgentId.value = agentId;
  showDeleteConfirm.value = true;
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  deletingAgentId.value = null;
}

async function deleteAgent() {
  if (!deletingAgentId.value) return;

  isDeleting.value = true;
  try {
    const success = await agentStore.deleteAgent(deletingAgentId.value);
    if (success) {
      await refreshAgents();
    }
  } finally {
    isDeleting.value = false;
    cancelDelete();
  }
}

async function selectAgent(agentId: string) {
  await agentStore.selectAgent(agentId);
}

async function duplicateAgent(agent: AgentProfile) {
  const duplicated: AgentProfile = {
    ...agent,
    id: `${agent.id}-copy-${Date.now()}`,
    metadata: {
      ...agent.metadata,
      name: `${agent.metadata.name} (Copy)`,
      isBuiltIn: false
    }
  };
  
  editingAgent.value = duplicated;
  showEditor.value = true;
}


async function handleConflictResolution(resolved: AgentMergeConflict[]) {
  showConflicts.value = false;
  conflicts.value = [];
  await refreshAgents();
}

function handleSettingsSaved(settings: AgentSyncSettingsType) {
  showSettings.value = false;
  // Settings are persisted via localStorage in AgentSyncSettings component
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface-1">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 border-b border-surface-variant bg-white shadow-sm">
      <div>
        <h2 class="text-lg font-semibold text-secondary-900">Agent Library</h2>
        <p class="text-xs text-secondary-600">Create, edit, and select agent profiles • Click a card to set as active</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="p-2 text-secondary-600 hover:bg-surface-2 rounded-m3-full transition-colors relative"
          @click="refreshAgents"
          :disabled="isLoading || isRefreshing"
          title="Refresh agents"
          aria-label="Refresh agents"
        >
          <svg v-if="!isRefreshing" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <svg v-else class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </button>
        <button
          class="p-2 text-secondary-600 hover:bg-surface-2 rounded-m3-full transition-colors"
          @click="showSettings = true"
          title="Sync settings"
          aria-label="Sync settings"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
          @click="createNewAgent"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Agent</span>
        </button>
      </div>
    </header>

    <!-- Error Message -->
    <div v-if="error" class="mx-6 mt-4 text-sm text-error-700 bg-error-50 border border-error-200 rounded-m3-lg px-4 py-3 flex items-start gap-2">
      <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Filters -->
    <div class="px-6 py-4 space-y-3 border-b border-surface-variant bg-white">
      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="w-full pl-10 pr-4 py-2.5 text-sm border border-surface-variant rounded-m3-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Search agents by name, description, or tags..."
        />
      </div>

      <!-- Filter Row -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Tag Filter -->
        <div class="flex-1 min-w-[200px]">
          <select
            v-model="selectedTag"
            class="w-full px-3 py-2.5 text-sm border border-surface-variant rounded-m3-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">All Tags</option>
            <option v-for="tag in allTags" :key="tag" :value="tag">
              {{ tag }}
            </option>
          </select>
        </div>

        <!-- Complexity Filter -->
        <div class="flex-1 min-w-[150px]">
          <select
            v-model="selectedComplexity"
            class="w-full px-3 py-2.5 text-sm border border-surface-variant rounded-m3-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">All Levels</option>
            <option v-for="level in complexityLevels" :key="level" :value="level">
              {{ level.charAt(0).toUpperCase() + level.slice(1) }}
            </option>
          </select>
        </div>

        <!-- View Mode Toggle -->
        <div class="flex items-center border border-surface-variant rounded-m3-lg bg-white overflow-hidden">
          <button
            class="px-3 py-2 transition-all"
            :class="viewMode === 'grid' ? 'bg-primary-600 text-white' : 'text-secondary-600 hover:bg-surface-2'"
            @click="viewMode = 'grid'"
            title="Grid view"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z" />
            </svg>
          </button>
          <button
            class="px-3 py-2 transition-all border-l border-surface-variant"
            :class="viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-secondary-600 hover:bg-surface-2'"
            @click="viewMode = 'list'"
            title="List view"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Agent Lists -->
    <div class="flex-1 overflow-y-auto p-6 space-y-8 bg-surface-1">
      <!-- Built-in Agents -->
      <section v-if="filteredBuiltIn.length > 0">
        <div class="flex items-center gap-2 mb-4">
          <h3 class="text-sm font-semibold text-secondary-700 uppercase tracking-wide">
            Built-in Agents
          </h3>
          <span class="px-2 py-0.5 text-xs font-medium bg-secondary-100 text-secondary-700 rounded-m3-full">
            {{ filteredBuiltIn.length }}
          </span>
        </div>
        
        <!-- Grid/List View using AgentCard -->
        <div :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'">
          <AgentCard
            v-for="agent in filteredBuiltIn"
            :key="agent.id"
            :agent="agent"
            :is-selected="selectedAgentId === agent.id"
            :view-mode="viewMode"
            @select="selectAgent"
            @duplicate="duplicateAgent"
          />
        </div>
      </section>

      <!-- Custom Agents -->
      <section v-if="filteredCustom.length > 0">
        <h3 class="text-sm font-semibold text-secondary-700 uppercase tracking-wide mb-3">
          Custom Agents ({{ filteredCustom.length }})
        </h3>
        
        <!-- Grid/List View using AgentCard -->
        <div :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2'">
          <AgentCard
            v-for="agent in filteredCustom"
            :key="agent.id"
            :agent="agent"
            :is-selected="selectedAgentId === agent.id"
            :view-mode="viewMode"
            @select="selectAgent"
            @edit="editAgent"
            @delete="confirmDeleteAgent"
          />
        </div>
      </section>

      <!-- Empty State -->
      <div
        v-if="filteredAgents.length === 0"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <div class="text-4xl mb-3">🔍</div>
        <h3 class="text-sm font-medium text-secondary-900 mb-1">No agents found</h3>
        <p class="text-xs text-secondary-600 mb-4">
          Try adjusting your filters or create a new agent
        </p>
        <button
          class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-m3-lg hover:bg-primary-700 transition-colors"
          @click="createNewAgent"
        >
          Create New Agent
        </button>
      </div>
    </div>

    <!-- Agent Profile Editor Modal -->
    <Teleport to="body">
      <div
        v-if="showEditor"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="closeEditor"
      >
        <div class="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-m3-xl shadow-elevation-3">
          <AgentProfileEditor
            :agent="editingAgent"
            @close="closeEditor"
            @saved="handleAgentSaved"
          />
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="cancelDelete"
      >
        <div class="w-full max-w-md bg-white rounded-m3-xl shadow-elevation-3 p-6">
          <h3 class="text-lg font-semibold text-secondary-900 mb-2">Delete Agent</h3>
          <p class="text-sm text-secondary-600 mb-6">
            Are you sure you want to delete this agent? This action cannot be undone.
          </p>
          <div class="flex items-center justify-end gap-3">
            <button
              class="px-4 py-2 text-sm font-medium text-secondary-700 hover:text-secondary-900 transition-colors"
              @click="cancelDelete"
            >
              Cancel
            </button>
            <button
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-error-600 text-white rounded-m3-lg hover:bg-error-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isDeleting"
              @click="deleteAgent"
            >
              <svg v-if="isDeleting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isDeleting ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Conflict Resolution Dialog -->
    <ConflictResolutionDialog
      v-if="showConflicts"
      :conflicts="conflicts"
      @close="showConflicts = false"
      @resolve="handleConflictResolution"
    />

    <!-- Agent Sync Settings -->
    <AgentSyncSettings
      v-if="showSettings"
      @close="showSettings = false"
      @save="handleSettingsSaved"
    />
  </div>
</template>
