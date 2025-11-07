<template>
  <div class="transcript-filters flex items-center gap-3 px-4 py-2 bg-surface-container border-b border-outline-variant">
    <!-- Role filter -->
    <div class="filter-group flex items-center gap-2">
      <label for="role-filter" class="text-xs font-medium text-on-surface">Role:</label>
      <select
        id="role-filter"
        v-model="localFilters.role"
        @change="emitFilters"
        class="text-xs px-2 py-1 rounded-m3-sm bg-surface-container-high text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="all">All</option>
        <option value="user">User</option>
        <option value="assistant">Assistant</option>
        <option value="system">System</option>
      </select>
    </div>

    <!-- Tool invocation filter -->
    <div class="filter-group flex items-center gap-2">
      <label for="tool-filter" class="text-xs font-medium text-on-surface">Tools:</label>
      <select
        id="tool-filter"
        v-model="localFilters.toolType"
        @change="emitFilters"
        class="text-xs px-2 py-1 rounded-m3-sm bg-surface-container-high text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="all">All</option>
        <option value="with-tools">With Tools</option>
        <option value="without-tools">Without Tools</option>
      </select>
    </div>

    <!-- Date range filter -->
    <div class="filter-group flex items-center gap-2">
      <label for="date-filter" class="text-xs font-medium text-on-surface">Date:</label>
      <select
        id="date-filter"
        v-model="localFilters.dateRange"
        @change="emitFilters"
        class="text-xs px-2 py-1 rounded-m3-sm bg-surface-container-high text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="all">All Time</option>
        <option value="today">Today</option>
        <option value="week">Last 7 Days</option>
        <option value="month">Last 30 Days</option>
      </select>
    </div>

    <!-- Search input -->
    <div class="filter-group flex items-center gap-2 flex-1">
      <label for="search-filter" class="text-xs font-medium text-on-surface">Search:</label>
      <input
        id="search-filter"
        v-model="localFilters.searchQuery"
        @input="emitFiltersDebounced"
        type="text"
        placeholder="Search content..."
        class="text-xs px-2 py-1 rounded-m3-sm bg-surface-container-high text-on-surface border border-outline focus:outline-none focus:ring-2 focus:ring-primary flex-1 min-w-0"
      />
    </div>

    <!-- Clear filters button -->
    <button
      v-if="hasActiveFilters"
      @click="clearFilters"
      class="text-xs px-3 py-1 rounded-m3-sm bg-tertiary-container text-on-tertiary-container hover:bg-tertiary hover:text-on-tertiary transition-colors"
      aria-label="Clear all filters"
    >
      Clear
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

export interface TranscriptFilters {
  role: 'all' | 'user' | 'assistant' | 'system';
  toolType: 'all' | 'with-tools' | 'without-tools';
  dateRange: 'all' | 'today' | 'week' | 'month';
  searchQuery: string;
}

interface Props {
  filters?: TranscriptFilters;
}

const props = withDefaults(defineProps<Props>(), {
  filters: () => ({
    role: 'all',
    toolType: 'all',
    dateRange: 'all',
    searchQuery: ''
  })
});

const emit = defineEmits<{
  'update:filters': [filters: TranscriptFilters];
}>();

const localFilters = ref<TranscriptFilters>({ ...props.filters });

// Watch for external filter changes
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters };
}, { deep: true });

const hasActiveFilters = computed(() => {
  return (
    localFilters.value.role !== 'all' ||
    localFilters.value.toolType !== 'all' ||
    localFilters.value.dateRange !== 'all' ||
    localFilters.value.searchQuery.length > 0
  );
});

function emitFilters() {
  emit('update:filters', { ...localFilters.value });
}

// Debounce search input
let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
function emitFiltersDebounced() {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  
  debounceTimeout = setTimeout(() => {
    emitFilters();
  }, 300);
}

function clearFilters() {
  localFilters.value = {
    role: 'all',
    toolType: 'all',
    dateRange: 'all',
    searchQuery: ''
  };
  emitFilters();
}
</script>

<style scoped>
.transcript-filters {
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-group {
  min-width: 0;
}

select,
input {
  cursor: pointer;
  transition: all 0.2s ease;
}

select:hover,
input:hover {
  border-color: var(--md-sys-color-primary);
}

input::placeholder {
  color: var(--md-sys-color-on-surface-variant);
  opacity: 0.6;
}

@media (max-width: 768px) {
  .transcript-filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-group {
    width: 100%;
  }
  
  .filter-group select,
  .filter-group input {
    flex: 1;
  }
}
</style>
