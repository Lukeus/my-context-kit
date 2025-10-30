<script setup lang="ts">
import { computed, ref } from 'vue';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

interface BoardColumn {
  id: string;
  label: string;
  statuses: string[];
}

interface KanbanCard {
  id: string;
  title: string;
  status: string;
  typeLabel: string;
  typeKey: TypeFilterId;
}

type TypeFilterId = 'feature' | 'userstory' | 'task';

const typeFilterOptions: Array<{ id: TypeFilterId; label: string }> = [
  { id: 'feature', label: 'Features' },
  { id: 'userstory', label: 'User Stories' },
  { id: 'task', label: 'Tasks' },
];

const typeFilters = ref<Record<TypeFilterId, boolean>>({
  feature: true,
  userstory: true,
  task: true,
});

const boardColumns: BoardColumn[] = [
  { id: 'planned', label: 'Planned', statuses: ['proposed', 'todo', 'backlog', 'ready'] },
  { id: 'active', label: 'In Progress', statuses: ['in-progress', 'doing'] },
  { id: 'blocked', label: 'Needs Attention', statuses: ['blocked', 'needs-review'] },
  { id: 'done', label: 'Done', statuses: ['done', 'completed', 'shipped'] },
];

const features = computed(() => contextStore.entitiesByType.feature ?? []);
const userStories = computed(() => contextStore.entitiesByType.userstory ?? []);
const tasks = computed(() => contextStore.entitiesByType.task ?? []);

function normalizeStatus(rawStatus: string | undefined): string {
  if (!rawStatus) {
    return 'unspecified';
  }
  return rawStatus.toLowerCase();
}

const cards = computed<KanbanCard[]>(() => {
  const featureCards = features.value.map((feature) => ({
    id: feature.id ?? 'unknown-feature',
    title: feature.title ?? feature.name ?? 'Untitled feature',
    status: normalizeStatus(feature.status),
    typeLabel: 'Feature',
    typeKey: 'feature' as const,
  }));

  const storyCards = userStories.value.map((story) => ({
    id: story.id ?? 'unknown-story',
    title: story.title ?? story.name ?? story.iWant ?? 'Untitled story',
    status: normalizeStatus(story.status),
    typeLabel: 'User Story',
    typeKey: 'userstory' as const,
  }));

  const taskCards = tasks.value.map((task) => ({
    id: task.id ?? 'unknown-task',
    title: task.title ?? task.name ?? 'Untitled task',
    status: normalizeStatus(task.status),
    typeLabel: 'Task',
    typeKey: 'task' as const,
  }));

  return [...featureCards, ...storyCards, ...taskCards];
});

const filteredCards = computed(() => cards.value.filter((card) => typeFilters.value[card.typeKey]));
const hasFilteredCards = computed(() => filteredCards.value.length > 0);

const cardsByColumn = computed(() => {
  const grouping: Record<string, KanbanCard[]> = Object.fromEntries(boardColumns.map((column) => [column.id, []]));
  const fallbackColumnId = 'planned';

  filteredCards.value.forEach((card) => {
    const destination = boardColumns.find((column) => column.statuses.includes(card.status));
    const columnId = destination?.id ?? fallbackColumnId;
    grouping[columnId].push(card);
  });

  return grouping;
});

const unassignedCards = computed(() => filteredCards.value.filter((card) => !boardColumns.some((column) => column.statuses.includes(card.status))));

const activeFilterCount = computed(() => Object.values(typeFilters.value).filter(Boolean).length);

function toggleFilter(id: TypeFilterId) {
  typeFilters.value[id] = !typeFilters.value[id];
  if (activeFilterCount.value === 0) {
    typeFilters.value[id] = true;
  }
}

function resetFilters() {
  typeFilters.value = {
    feature: true,
    userstory: true,
    task: true,
  };
}

// Note: Custom filter presets (roadmap vs. execution views) can be added when user workflows require saved views.
// Current filters provide sufficient flexibility for MVP planning board usage.
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <h2 class="text-lg font-semibold text-secondary-900">Kanban Planning Board</h2>
      <p class="text-xs text-secondary-500">Track feature, story, and task states in one view.</p>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-secondary-500 uppercase tracking-[0.2em]">Filter</span>
      <button
        type="button"
        class="px-3 py-1.5 rounded-m3-md border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100 font-semibold"
        @click="resetFilters"
      >
        Show All
      </button>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="option in typeFilterOptions"
          :key="option.id"
          type="button"
          class="px-3 py-1.5 rounded-m3-md border text-xs font-semibold transition-colors"
          :class="typeFilters[option.id] ? 'bg-primary-100 border-primary-200 text-primary-800 shadow-elevation-1' : 'bg-surface border-surface-variant text-secondary-500 hover:bg-surface-2'"
          @click="toggleFilter(option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-4">
      <section
        v-for="column in boardColumns"
        :key="column.id"
        class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-1 flex flex-col overflow-hidden"
      >
        <header class="px-4 py-3 border-b border-primary-100 bg-primary-50 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-primary-800 uppercase tracking-[0.12em]">{{ column.label }}</h3>
          <span class="text-xs text-primary-700">{{ cardsByColumn[column.id].length }}</span>
        </header>
        <div class="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <article
            v-for="card in cardsByColumn[column.id]"
            :key="`${column.id}-${card.id}`"
            class="rounded-m3-md border border-surface-variant bg-surface-2 px-3 py-3 shadow-elevation-1 hover:shadow-elevation-1 transition-shadow"
          >
            <header class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold uppercase tracking-wide text-secondary-500">{{ card.typeLabel }}</span>
              <span class="text-xs font-medium text-secondary-600">{{ card.id }}</span>
            </header>
            <p class="mt-2 text-sm font-medium text-secondary-900">{{ card.title }}</p>
            <p class="mt-1 text-xs text-secondary-500 capitalize">{{ card.status || 'unspecified' }}</p>
          </article>
          <p v-if="cardsByColumn[column.id].length === 0" class="text-xs text-secondary-500 italic">No items in this column yet.</p>
        </div>
      </section>
    </div>

    <p
      v-if="!hasFilteredCards"
      class="text-xs text-secondary-500 italic"
    >
      No work items match the current filters.
    </p>

    <section v-if="unassignedCards.length" class="rounded-m3-md border border-warning-200 bg-warning-50 px-4 py-3">
      <h3 class="text-sm font-semibold text-warning-900 mb-2">Items without a mapped status</h3>
      <ul class="space-y-2">
        <li
          v-for="card in unassignedCards"
          :key="`unassigned-${card.id}`"
          class="text-xs text-warning-800"
        >
          <strong>{{ card.typeLabel }}</strong> {{ card.id }} — {{ card.title }} <span class="italic">({{ card.status || 'unspecified' }})</span>
        </li>
      </ul>
      <p class="mt-2 text-[11px] text-warning-700">Note: Status mappings can be customized per repository when workflow variations require different swimlane configurations.</p>
    </section>
  </div>
</template>
