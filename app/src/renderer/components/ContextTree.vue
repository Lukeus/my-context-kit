<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useContextStore } from '../stores/contextStore';
import { useImpactStore } from '../stores/impactStore';
import { useBuilderStore } from '../stores/builderStore';

const emit = defineEmits<{ 'ask-about-entity': [string] }>();

const contextStore = useContextStore();
const impactStore = useImpactStore();
const builderStore = useBuilderStore();

// Local state
const searchQuery = ref('');
const expandedTypes = ref<Set<string>>(new Set(['governance', 'feature', 'userstory', 'spec', 'task']));

// Helper function to recursively search through entity properties
function searchInValue(value: any, query: string): boolean {
  if (value == null) return false;
  
  if (typeof value === 'string') {
    return value.toLowerCase().includes(query);
  }
  
  if (Array.isArray(value)) {
    return value.some(item => searchInValue(item, query));
  }
  
  if (typeof value === 'object') {
    return Object.values(value).some(val => searchInValue(val, query));
  }
  
  return false;
}

function matchesSearch(entity: any, query: string): boolean {
  // Skip internal/system fields
  const skipFields = ['_type', '_file', 'checksum'];
  
  // Search through all entity properties
  for (const [key, value] of Object.entries(entity)) {
    if (skipFields.includes(key)) continue;
    if (searchInValue(value, query)) return true;
  }
  
  return false;
}

// Computed
const filteredEntitiesByType = computed(() => {
  const entities = contextStore.entitiesByType;
  const query = searchQuery.value.toLowerCase().trim();

  if (!query) return entities;

  const filtered: Record<string, any[]> = {};
  Object.entries(entities).forEach(([type, items]) => {
    filtered[type] = items.filter(entity => matchesSearch(entity, query));
  });

  return filtered;
});

const totalSearchResults = computed(() => {
  if (!searchQuery.value.trim()) return null;
  return Object.values(filteredEntitiesByType.value).reduce((sum, items) => sum + items.length, 0);
});

const entityTypeLabels: Record<string, string> = {
  governance: 'Governance',
  feature: 'Features',
  userstory: 'User Stories',
  spec: 'Specifications',
  task: 'Tasks',
  service: 'Services',
  package: 'Packages'
};

const typesWithCreation = new Set(['feature', 'userstory', 'spec', 'task', 'service', 'package']);

const hasRepoConfigured = computed(() => Boolean(contextStore.repoPath && contextStore.repoPath.trim().length > 0));

// Methods
function toggleType(type: string) {
  if (expandedTypes.value.has(type)) {
    expandedTypes.value.delete(type);
  } else {
    expandedTypes.value.add(type);
  }
}

function isTypeExpanded(type: string): boolean {
  return expandedTypes.value.has(type);
}

function selectEntity(entityId: string) {
  contextStore.setActiveEntity(entityId);
}

function askAI(entityId: string) {
  emit('ask-about-entity', entityId);
}

function getStatusColor(status: string | undefined, type: string): string {
  if (!status) {
    if (type === 'governance') {
      return 'bg-indigo-500';
    }
    return 'bg-gray-400';
  }
  
  const statusColors: Record<string, string> = {
    'proposed': 'bg-blue-400',
    'in-progress': 'bg-yellow-400',
    'doing': 'bg-yellow-400',
    'done': 'bg-green-400',
    'blocked': 'bg-red-400',
    'needs-review': 'bg-orange-400',
    'todo': 'bg-gray-400'
  };

  return statusColors[status] || 'bg-gray-400';
}

function isEntityStale(entityId: string): boolean {
  const staleIds = impactStore.impactReport?.staleIds || [];
  return staleIds.includes(entityId);
}

function hasIssue(entityId: string): boolean {
  const issues = impactStore.impactReport?.issues || [];
  return issues.some(issue => issue.id === entityId);
}

async function loadEntities() {
  await contextStore.initializeStore();
  if (!hasRepoConfigured.value) {
    impactStore.clearChangedEntities();
    return;
  }
  if (contextStore.isLoading) {
    return;
  }
  await contextStore.loadGraph();
}

async function createNewEntity(entityType: string) {
  // Ensure store is initialized before accessing repoPath
  await contextStore.initializeStore();
  builderStore.initBuilder(entityType, {}, contextStore.repoPath);
}

onMounted(() => {
  loadEntities();
});

watch(() => contextStore.repoPath, () => {
  loadEntities();
});

// Auto-expand types with search results
watch(() => searchQuery.value, (newQuery) => {
  if (newQuery.trim()) {
    // Expand all types that have results
    Object.entries(filteredEntitiesByType.value).forEach(([type, items]) => {
      if (items.length > 0) {
        expandedTypes.value.add(type);
      }
    });
  }
});
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Header -->
    <div class="p-4 border-b border-surface-variant bg-surface-2">
      <h2 class="text-lg font-semibold mb-3 text-primary-700">Context Tree</h2>
      
      <!-- Search -->
      <div class="relative">
        <div class="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Deep search: IDs, titles, descriptions, links..."
          class="w-full pl-10 pr-10 py-2.5 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-surface transition-all"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-secondary-500 hover:text-secondary-900 hover:bg-surface-3 rounded-m3-md transition-colors"
          title="Clear search"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Stats and Actions -->
      <div class="mt-2 flex items-center justify-between gap-2">
        <div class="text-xs text-secondary-600">
          <span v-if="totalSearchResults !== null" class="font-semibold text-primary-700">
            {{ totalSearchResults }} {{ totalSearchResults === 1 ? 'result' : 'results' }} found
          </span>
          <span v-else>
            {{ contextStore.entityCount }} entities
          </span>
        </div>
        <button
          @click="createNewEntity('feature')"
          :disabled="!hasRepoConfigured"
          class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-m3-md bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white transition-all shadow-elevation-1 hover:shadow-elevation-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Create new entity (Ctrl+N)"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New
        </button>
      </div>
    </div>

    <!-- Missing repo state -->
    <div v-if="!hasRepoConfigured" class="flex-1 flex flex-col items-center justify-center text-center px-4">
      <h3 class="text-sm font-semibold text-secondary-700 mb-2">No repository selected</h3>
      <p class="text-xs text-secondary-600">Choose or add a context repository to load entities.</p>
    </div>

    <!-- Loading state -->
    <div v-else-if="contextStore.isLoading" class="flex-1 flex items-center justify-center">
      <div class="text-sm text-secondary-600">Loading...</div>
    </div>

    <!-- Error state -->
    <div v-else-if="contextStore.error" class="flex-1 p-4">
      <div class="text-sm text-error-600">
        {{ contextStore.error }}
      </div>
      <button
        @click="loadEntities"
        class="mt-2 text-sm text-primary-600 hover:underline"
      >
        Retry
      </button>
    </div>

    <!-- Entity tree -->
    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="(entities, type) in filteredEntitiesByType"
        :key="type"
        class="border-b border-surface-variant"
      >
        <!-- Type header -->
        <div class="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-3 transition-colors">
          <button
            @click="toggleType(type)"
            class="flex-1 flex items-center justify-between text-left"
          >
            <span class="text-sm font-medium text-secondary-700">
              {{ entityTypeLabels[type] }}
              <span class="text-secondary-500 ml-1">({{ entities.length }})</span>
            </span>
            <svg
              class="w-4 h-4 text-secondary-600 transform transition-transform"
              :class="{ 'rotate-90': isTypeExpanded(type) }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            v-if="typesWithCreation.has(type)"
            @click.stop="createNewEntity(type)"
            class="ml-2 p-1 text-primary-600 hover:bg-primary-100 rounded-m3-md transition-colors"
            :title="'Create new ' + entityTypeLabels[type].toLowerCase()"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <!-- Entity list -->
        <div v-if="isTypeExpanded(type)" class="bg-surface-1">
          <div v-if="entities.length === 0" class="px-4 py-2 text-sm text-secondary-500">
            No entities
          </div>
          <div
            v-for="entity in entities"
            :key="entity.id"
            class="w-full flex items-center gap-2 hover:bg-primary-50 border-l-3 transition-all relative"
            :class="{
              'border-primary bg-primary-50 shadow-elevation-1': contextStore.activeEntityId === entity.id,
              'border-transparent': contextStore.activeEntityId !== entity.id && !isEntityStale(entity.id),
              'border-tertiary-400': contextStore.activeEntityId !== entity.id && isEntityStale(entity.id)
            }"
          >
            <button
              @click="selectEntity(entity.id)"
              @contextmenu.prevent.stop="askAI(entity.id)"
              class="flex-1 px-4 py-2.5 flex items-center gap-3 text-left"
              :title="'Right-click for AI on ' + entity.id"
            >
              <!-- Status indicator -->
              <span
                class="w-2.5 h-2.5 rounded-m3-md-full flex-shrink-0 shadow-elevation-1"
                :class="getStatusColor(entity.status, entity._type)"
              ></span>

              <!-- Entity info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <div class="text-sm font-medium truncate text-secondary-900">
                    {{ entity._type === 'c4diagram' ? entity.title : entity.id }}
                  </div>
                  <span v-if="entity._type === 'c4diagram' && entity.level" class="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-m3-md flex-shrink-0">
                    {{ entity.level }}
                  </span>
                </div>
                <div class="text-xs text-secondary-600 line-clamp-2 leading-snug">
                  <span v-if="entity._type === 'c4diagram' && entity.system">{{ entity.system }}</span>
                  <span v-else>{{ entity.title || entity.name || entity.iWant || 'Untitled' }}</span>
                </div>
              </div>
            </button>

            <!-- Quick Ask AI action -->
            <button
              class="flex-shrink-0 p-1.5 mr-2 rounded-m3-md text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 transition-colors"
              title="Ask AI about this entity"
              @click="askAI(entity.id)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>

            <!-- Stale/Issue indicator -->
            <div v-if="isEntityStale(entity.id)" class="flex-shrink-0 mr-2" title="Needs review">
              <span class="inline-block w-2.5 h-2.5 rounded-m3-md-full bg-tertiary-500"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="p-4 border-t border-surface-variant bg-surface-2 space-y-2">
      <button
        @click="loadEntities"
        :disabled="contextStore.isLoading"
        class="w-full px-4 py-2.5 text-sm bg-primary text-white rounded-m3-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
      >
        {{ contextStore.isLoading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>
  </div>
</template>
