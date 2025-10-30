<script setup lang="ts">
import { computed, ref } from 'vue';
import { useContextStore } from '../stores/contextStore';
import { useImpactStore } from '../stores/impactStore';
import { useGitStore } from '../stores/gitStore';
import KanbanBoard from './KanbanBoard.vue';

const props = defineProps<{
  lastValidationStatus: 'success' | 'error' | null;
  lastValidationAt: string | null;
  lastGraphRefresh: string | null;
}>();

const emit = defineEmits<{
  'run-validation': [];
  'refresh-graph': [];
  'open-impact': [];
  'open-git': [];
  'open-assistant': [];
  'open-diff': [];
  'open-prompts': [];
  'create-repo': [];
}>();

const contextStore = useContextStore();
const impactStore = useImpactStore();
const gitStore = useGitStore();
const activeTab = ref<'overview' | 'kanban'>('overview');

const entityTypeBreakdown = computed(() => {
  const groups = contextStore.entitiesByType;
  return Object.entries(groups)
    .map(([type, list]) => ({
      type,
      count: list.length,
    }))
    .filter(entry => entry.count > 0)
    .sort((a, b) => b.count - a.count);
});

const activeRepoLabel = computed(() => contextStore.getActiveRepoMeta()?.label || 'Unconfigured');
const activeRepoPath = computed(() => contextStore.repoPath || 'No repository selected');

const validationBadge = computed(() => {
  if (props.lastValidationStatus === 'success') {
    return { label: 'Healthy', tone: 'bg-primary-100 text-primary-800' };
  }
  if (props.lastValidationStatus === 'error') {
    return { label: 'Attention', tone: 'bg-error-100 text-error-700' };
  }
  return { label: 'Pending', tone: 'bg-secondary-100 text-secondary-700' };
});

const impactIssues = computed(() => impactStore.unresolvedIssues.slice(0, 5));
const changedEntityCount = computed(() => impactStore.changedEntityIds.length);
const impactSummary = computed(() => ({
  totalChanged: impactStore.impactReport?.stats.totalChanged ?? changedEntityCount.value,
  totalImpacted: impactStore.impactReport?.stats.totalImpacted ?? 0,
  unresolved: impactStore.unresolvedCount,
}));

const gitDelta = computed(() => ({
  ahead: gitStore.status?.ahead ?? 0,
  behind: gitStore.status?.behind ?? 0,
  dirty: gitStore.hasUncommittedChanges,
}));

const gitWorkingChanges = computed(() => gitStore.changedFilesCount);

const checklistSummary = computed(() => {
  // Note: Checklist completion metrics require parsing pipeline for generated markdown files.
  // Deferred until checklist tracking becomes a critical workflow requirement.
  return {
    reviewed: 0,
    total: 0,
  };
});

function formatTimestamp(value: string | null) {
  if (!value) return 'Never';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function setActiveTab(tab: 'overview' | 'kanban') {
  activeTab.value = tab;
}
</script>

<template>
  <div class="h-full overflow-auto bg-gradient-to-br from-surface via-surface-1 to-surface-2">
    <div class="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div class="flex flex-wrap items-center gap-2 justify-between">
        <div class="flex items-center gap-2">
          <button type="button" class="px-4 py-2 text-sm font-semibold rounded-m3-md border transition-all"
            :class="activeTab === 'overview' ? 'bg-primary-100 text-primary-800 border-primary-200 shadow-elevation-1' : 'bg-surface text-secondary-700 border-surface-variant hover:bg-surface-2'"
            @click="setActiveTab('overview')">
            Overview
          </button>
          <button type="button" class="px-4 py-2 text-sm font-semibold rounded-m3-md border transition-all"
            :class="activeTab === 'kanban' ? 'bg-primary-100 text-primary-800 border-primary-200 shadow-elevation-1' : 'bg-surface text-secondary-700 border-surface-variant hover:bg-surface-2'"
            @click="setActiveTab('kanban')">
            Planning Board
          </button>
        </div>
        <button type="button"
          class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all flex items-center justify-center gap-2"
          @click="emit('create-repo')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Context Repository
        </button>
      </div>

      <section class="rounded-m3-md border border-surface-variant shadow-elevation-3 bg-surface-1 overflow-hidden">
        <div
          class="bg-primary-700/90 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-white/60">Active Repository</p>
            <h1 class="text-2xl font-bold tracking-tight mt-1">{{ activeRepoLabel }}</h1>
            <p class="text-sm text-white/80 truncate">{{ activeRepoPath }}</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="px-4 py-2 rounded-m3-md bg-white text-primary-700 text-sm font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all"
              @click="emit('run-validation')">
              Run Validation
            </button>
            <button
              class="px-4 py-2 rounded-m3-md bg-white/10 text-white text-sm font-semibold border border-white/30 hover:bg-white/20 transition-colors"
              @click="emit('open-git')">
              Open Git
            </button>

          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 px-6 py-5 backdrop-blur">
          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Validation cadence</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">{{ formatTimestamp(lastValidationAt) }}</p>
            <span class="inline-flex items-center gap-2 text-[11px] font-semibold px-2.5 py-1 rounded-m3-md mt-3"
              :class="validationBadge.tone">
              <span class="inline-flex h-2 w-2 rounded-m3-md-full bg-current"></span>
              {{ validationBadge.label }}
            </span>
          </div>
          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Graph freshness</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">{{ formatTimestamp(lastGraphRefresh) }}</p>
            <button class="mt-3 text-xs font-semibold text-primary-700 hover:text-primary-900"
              @click="emit('refresh-graph')">
              Refresh graph
            </button>
          </div>
          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Changed entities</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">{{ impactSummary.totalChanged }}</p>
            <button class="mt-3 text-xs font-semibold text-primary-700 hover:text-primary-900"
              @click="emit('open-impact')">
              Review impact
            </button>
          </div>
          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Git delta</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">
              <span class="mr-3">↑ {{ gitDelta.ahead }}</span>
              <span>↓ {{ gitDelta.behind }}</span>
            </p>
            <p class="text-xs text-secondary-500 mt-1">Working tree changes: {{ gitWorkingChanges }}</p>
            <span class="inline-flex items-center gap-2 text-[11px] font-semibold px-2.5 py-1 rounded-m3-md mt-3"
              :class="gitDelta.dirty ? 'bg-error-100 text-error-700' : 'bg-secondary-100 text-secondary-700'">
              <span class="inline-flex h-2 w-2 rounded-m3-md-full bg-current"></span>
              {{ gitDelta.dirty ? `${gitWorkingChanges} files modified` : 'Working tree clean' }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'overview'" class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div class="space-y-6">
          <div class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2">
            <div class="px-6 py-4 border-b border-surface-variant flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-secondary-900">Workstream</h2>
                <p class="text-xs text-secondary-500">Keep delivery on track with pipeline and impact insights.</p>
              </div>
              <button
                class="px-3 py-1.5 rounded-m3-md text-xs font-semibold border border-primary-200 text-primary-700 hover:bg-primary-50"
                @click="emit('open-prompts')">
                Generate prompts
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
                <div class="rounded-m3-md border border-surface-variant bg-surface-1 px-4 py-4">
                  <p class="text-xs text-secondary-600 uppercase tracking-[0.15em]">Entity coverage</p>
                  <ul class="mt-3 space-y-2">
                    <li v-for="entry in entityTypeBreakdown" :key="entry.type"
                      class="flex items-center justify-between text-sm">
                      <span class="font-medium text-secondary-800 capitalize">{{ entry.type }}</span>
                      <span class="text-secondary-600">{{ entry.count }}</span>
                    </li>
                  </ul>
                  <p v-if="!entityTypeBreakdown.length" class="text-sm text-secondary-500 mt-3">No entities detected
                    yet.</p>
                </div>
                <div class="rounded-m3-md border border-surface-variant bg-surface-1 px-4 py-4">
                  <p class="text-xs text-secondary-600 uppercase tracking-[0.15em]">Impact focus</p>
                  <p class="text-2xl font-semibold text-secondary-900 mt-2">{{ impactSummary.unresolved }}</p>
                  <p class="text-sm text-secondary-600">Unresolved issues flagged by the last impact analysis.</p>
                  <p class="text-xs text-secondary-500 mt-1">Tracked changed entities: {{ impactSummary.totalChanged }}
                  </p>
                  <ul class="mt-3 space-y-2">
                    <li v-for="issue in impactIssues" :key="issue.id + issue.message"
                      class="text-xs text-secondary-600 border border-surface-variant rounded-m3-md px-3 py-2">
                      <span class="font-semibold text-secondary-800">{{ issue.id }}</span> — {{ issue.message }}
                    </li>
                  </ul>
                  <p v-if="!impactIssues.length" class="text-sm text-secondary-500 mt-3">Run impact analysis to populate
                    this list.</p>
                </div>
              </div>
              <div class="rounded-m3-md border border-surface-variant bg-surface-1 px-4 py-4">
                <p class="text-xs text-secondary-600 uppercase tracking-[0.15em]">Quick actions</p>
                <div class="mt-3 grid gap-3 md:grid-cols-3">
                  <button
                    class="rounded-m3-md border border-primary-200 bg-primary-50 text-primary-800 px-3 py-3 text-sm font-semibold hover:bg-primary-100 transition-colors"
                    @click="emit('run-validation')">
                    Validate schema
                  </button>
                  <button
                    class="rounded-m3-md border border-secondary-200 bg-secondary-50 text-secondary-800 px-3 py-3 text-sm font-semibold hover:bg-secondary-100 transition-colors"
                    @click="emit('open-impact')">
                    Review impact
                  </button>
                  <button
                    class="rounded-m3-md border border-surface-variant bg-surface px-3 py-3 text-sm font-semibold text-secondary-800 hover:bg-surface-2 transition-colors"
                    @click="emit('open-git')">
                    Open git panel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2">
            <div class="px-6 py-4 border-b border-surface-variant">
              <h2 class="text-lg font-semibold text-secondary-900">Insights</h2>
              <p class="text-xs text-secondary-500">Surface next-best actions and automated assistive flows.</p>
            </div>
            <div class="p-6 space-y-4">
              <div class="rounded-m3-md border border-surface-variant bg-surface-1 px-4 py-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-xs text-secondary-600 uppercase tracking-[0.15em]">AI assistant</p>
                    <h3 class="text-base font-semibold text-secondary-900 mt-1">Contextual nudges</h3>
                    <p class="text-sm text-secondary-600 mt-1">Pull curated suggestions for the selected entity or repo.
                    </p>
                  </div>
                  <button
                    class="px-3 py-1.5 rounded-m3-md text-xs font-semibold border border-primary-200 text-primary-700 hover:bg-primary-50"
                    @click="emit('open-assistant')">
                    Summon AI
                  </button>
                </div>
                <p class="mt-3 text-xs text-secondary-500">Select an entity to populate AI guidance in the assistant
                  panel.</p>
              </div>

              <div class="rounded-m3-md border border-surface-variant bg-surface-1 px-4 py-4">
                <p class="text-xs text-secondary-600 uppercase tracking-[0.15em]">Checklist health</p>
                <p class="text-2xl font-semibold text-secondary-900 mt-2">{{ checklistSummary.reviewed }} / {{
                  checklistSummary.total }}</p>
                <p class="text-sm text-secondary-600">Checklist completion across generated prompt artifacts.</p>
                <p class="text-xs text-secondary-500 mt-2">Note: Checklist metrics will be available once parsing pipeline is integrated.</p>
              </div>

              <div class="rounded-m3-md border border-surface-variant bg-surface-1 px-4 py-4">
                <p class="text-xs text-secondary-600 uppercase tracking-[0.15em]">Diff focus</p>
                <p class="text-sm text-secondary-600">Inspect the latest changes before committing.</p>
                <button
                  class="mt-3 px-3 py-1.5 rounded-m3-md text-xs font-semibold border border-secondary-200 text-secondary-700 hover:bg-secondary-50"
                  @click="emit('open-diff')">
                  Open diff viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-else>
        <KanbanBoard />
      </section>
    </div>
  </div>
</template>
