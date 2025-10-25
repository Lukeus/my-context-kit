<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useContextStore } from '../stores/contextStore';
import { useImpactStore } from '../stores/impactStore';
import { useBuilderStore } from '../stores/builderStore';

const contextStore = useContextStore();
const impactStore = useImpactStore();
const builderStore = useBuilderStore();

// Local state
const searchQuery = ref('');
const expandedTypes = ref<Set<string>>(new Set(['governance', 'feature', 'userstory', 'spec', 'task']));

// Computed
const filteredEntitiesByType = computed(() => {
  const entities = contextStore.entitiesByType;
  const query = searchQuery.value.toLowerCase();

  if (!query) return entities;

  const filtered: Record<string, any[]> = {};
  Object.entries(entities).forEach(([type, items]) => {
    filtered[type] = items.filter(entity => 
      (entity.id?.toLowerCase().includes(query)) ||
      (entity.title?.toLowerCase().includes(query)) ||
      (entity.name?.toLowerCase().includes(query))
    );
  });

  return filtered;
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
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Header -->
    <div class="p-4 border-b border-surface-variant bg-surface-2">
      <h2 class="text-lg font-semibold mb-3 text-primary-700">Context Tree</h2>
      
      <!-- Search -->
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search entities..."
        class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface transition-all"
      />
      
      <!-- Stats -->
      <div class="mt-2 text-xs text-secondary-600">
        {{ contextStore.entityCount }} entities
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
            class="ml-2 p-1 text-primary-600 hover:bg-primary-100 rounded transition-colors"
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
          <button
            v-for="entity in entities"
            :key="entity.id"
            @click="selectEntity(entity.id)"
            class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-primary-50 text-left border-l-3 transition-all relative"
            :class="{
              'border-primary bg-primary-50 shadow-elevation-1': contextStore.activeEntityId === entity.id,
              'border-transparent': contextStore.activeEntityId !== entity.id,
              'bg-tertiary-50 border-tertiary-300': isEntityStale(entity.id) && contextStore.activeEntityId !== entity.id,
              'ring-1 ring-tertiary-300': isEntityStale(entity.id)
            }"
          >
            <!-- Status indicator -->
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-elevation-1"
              :class="getStatusColor(entity.status, entity._type)"
            ></span>

            <!-- Entity info -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate" :class="isEntityStale(entity.id) ? 'text-tertiary-900' : 'text-secondary-900'">
                {{ entity.id }}
              </div>
              <div class="text-xs truncate" :class="isEntityStale(entity.id) ? 'text-tertiary-700' : 'text-secondary-600'">
                {{ entity.title || entity.name || entity.iWant || 'Untitled' }}
              </div>
            </div>

            <!-- Stale/Issue indicator -->
            <div v-if="isEntityStale(entity.id)" class="flex-shrink-0">
              <svg class="w-4 h-4 text-tertiary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="p-4 border-t border-surface-variant bg-surface-2 space-y-2">
      <button
        @click="loadEntities"
        :disabled="contextStore.isLoading"
        class="w-full px-4 py-2.5 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
      >
        {{ contextStore.isLoading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>
  </div>
</template>
