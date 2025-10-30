<script setup lang="ts">
import { computed } from 'vue';
import type { SpecKitFetchSummary } from '@shared/speckit';

const props = defineProps<{
  summary?: SpecKitFetchSummary;
  error?: string | null;
  isFetching?: boolean;
}>();

const hasSummary = computed(() => Boolean(props.summary));
const summary = computed(() => props.summary);
const status = computed(() => props.summary?.status);
const warnings = computed(() => props.summary?.warnings ?? []);
const docCount = computed(() => props.summary?.artifacts.docs.length ?? 0);
const templateCount = computed(() => props.summary?.artifacts.templates.length ?? 0);
const memoryCount = computed(() => props.summary?.artifacts.memory.length ?? 0);
const effectiveError = computed(() => props.error ?? props.summary?.status.error ?? null);
const isStale = computed(() => props.summary?.status.stale ?? true);
</script>

<template>
  <div class="space-y-3 rounded-m3-md border border-surface-variant bg-surface-1 p-4 text-sm text-secondary-800">
    <div v-if="isFetching" class="flex items-center gap-2 text-secondary-600">
      <span class="inline-flex h-3 w-3 animate-spin rounded-m3-md-full border-2 border-primary border-t-transparent" />
      <span>Fetching Spec Kit snapshot…</span>
    </div>

    <div v-else-if="effectiveError" class="rounded-m3-md border border-error-200 bg-error-50 px-3 py-2 text-error-700">
      {{ effectiveError }}
    </div>

    <div v-else-if="hasSummary && summary" class="space-y-3">
      <div class="flex flex-wrap gap-4 text-xs md:text-sm">
        <span><strong class="text-secondary-600">Release:</strong> {{ summary.source.releaseTag ?? 'latest' }}</span>
        <span><strong class="text-secondary-600">Commit:</strong> {{ summary.source.commit ?? 'pending' }}</span>
        <span>
          <strong class="text-secondary-600">Fetched:</strong>
          {{ summary.timing.finishedAt ?? 'pending' }}
        </span>
        <span><strong class="text-secondary-600">Duration:</strong> {{ summary.timing.durationMs }} ms</span>
      </div>

      <div class="flex flex-wrap gap-4 text-xs text-secondary-600">
        <span>Docs: {{ docCount }}</span>
        <span>Templates: {{ templateCount }}</span>
        <span>Memory: {{ memoryCount }}</span>
      </div>

      <div v-if="warnings.length" class="space-y-1 rounded-m3-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <div class="font-semibold uppercase tracking-wide">Warnings</div>
        <ul class="list-disc pl-4">
          <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>

      <div v-if="status?.inProgress" class="rounded-m3-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700">
        Fetch currently running — refresh once it completes.
      </div>

      <div v-else-if="isStale" class="rounded-m3-md border border-error-200 bg-error-50 px-3 py-2 text-error-700">
        Cache is older than the freshness window. Fetch again before generating entities.
      </div>

      <div v-else class="rounded-m3-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
        ✓ Cache is fresh and ready for downstream workflows.
      </div>
    </div>

    <div v-else class="rounded-m3-md border border-dashed border-surface-variant px-3 py-2 text-secondary-500">
      No Spec Kit snapshot fetched yet.
    </div>
  </div>
</template>
