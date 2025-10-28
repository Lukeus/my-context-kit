<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SpecKitPipelineReport } from '@shared/speckit';

const props = defineProps<{
  report: SpecKitPipelineReport | null;
  error?: string | null;
  isRunning?: boolean;
  sourcePreviews?: string[];
}>();

const pipelineLabels: Record<keyof SpecKitPipelineReport['pipelines'], string> = {
  validate: 'Validate',
  buildGraph: 'Build Graph',
  impact: 'Impact',
  generate: 'Generate',
};

const pipelineEntries = computed(() => {
  if (!props.report) {
    return [] as Array<{ key: keyof SpecKitPipelineReport['pipelines']; label: string; status: string; error?: string; details?: unknown }>;
  }

  return (Object.entries(props.report.pipelines) as Array<[
    keyof SpecKitPipelineReport['pipelines'],
    SpecKitPipelineReport['pipelines'][keyof SpecKitPipelineReport['pipelines']]
  ]>).map(([key, value]) => ({
    key,
    label: pipelineLabels[key],
    status: value.status,
    error: value.error,
    details: value.details,
  }));
});

const entities = computed(() => props.report?.entities ?? []);
const generatedFiles = computed(() => props.report?.generatedFiles ?? []);
const previewSources = computed(() => props.report?.sourcePreviews ?? props.sourcePreviews ?? []);

const copiedPath = ref<string | null>(null);

function statusClasses(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'failed':
      return 'bg-error-100 text-error-700 border border-error-200';
    case 'running':
      return 'bg-primary-100 text-primary border border-primary-200';
    default:
      return 'bg-secondary-100 text-secondary-700 border border-secondary-200';
  }
}

async function copyPath(path: string): Promise<void> {
  if (!path) {
    return;
  }

  try {
    const result = await window.api.clipboard.writeText(path);
    if (result.ok) {
      copiedPath.value = path;
      window.setTimeout(() => {
        copiedPath.value = null;
      }, 2000);
    }
  } catch (err: unknown) {
    console.error('Failed to copy path', err);
  }
}
</script>

<template>
  <div class="rounded-m3-md border border-surface-variant bg-surface-1 p-4 text-sm text-secondary-800">
    <div v-if="isRunning" class="mb-3 flex items-center gap-2 text-secondary-600">
      <span class="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span>Running Spec Kit pipelines…</span>
    </div>

    <div v-if="error" class="rounded-m3-md border border-error-200 bg-error-50 px-3 py-2 text-error-700">
      {{ error }}
    </div>
    <div v-else-if="report" class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="entry in pipelineEntries"
          :key="entry.key"
          class="rounded-m3-md border border-surface-variant bg-surface px-3 py-3"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold uppercase tracking-wide text-secondary-500">
              {{ entry.label }}
            </span>
            <span :class="['px-2 py-0.5 text-xs rounded-m3-full', statusClasses(entry.status)]">
              {{ entry.status }}
            </span>
          </div>
          <p v-if="entry.error" class="mt-2 text-xs text-error-600">
            {{ entry.error }}
          </p>
          <p
            v-else-if="entry.status === 'succeeded' && entry.key === 'validate' && report.entities.some((entity) => entity.errors.length > 0)"
            class="mt-2 text-xs text-amber-600"
          >
            Validation completed with entity-level warnings.
          </p>
        </div>
      </div>

      <div v-if="entities.length" class="space-y-2">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-secondary-500">Entities</h4>
        <ul class="space-y-2">
          <li
            v-for="entity in entities"
            :key="entity.id"
            class="rounded-m3-md border border-surface-variant bg-surface px-3 py-2"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium text-secondary-900">{{ entity.id }}</span>
              <span class="rounded-m3-full bg-surface-2 px-2 py-0.5 text-[11px] uppercase tracking-wide text-secondary-500">
                {{ entity.type }}
              </span>
              <span :class="['text-xs font-semibold uppercase tracking-wide', entity.status === 'succeeded' ? 'text-emerald-600' : 'text-error-600']">
                {{ entity.status === 'succeeded' ? 'Succeeded' : 'Failed' }}
              </span>
            </div>

            <div v-if="entity.path" class="mt-1 flex flex-wrap items-center gap-2 text-xs text-secondary-600">
              <span class="truncate">{{ entity.path }}</span>
              <button
                type="button"
                class="rounded-m3-full border border-surface-variant px-2 py-0.5 text-[11px] text-secondary-600 hover:bg-surface-2"
                @click="copyPath(entity.path ?? '')"
              >
                Copy path
              </button>
              <span v-if="copiedPath === entity.path" class="text-[11px] text-primary-600">Copied!</span>
            </div>

            <div v-if="entity.sourcePath" class="mt-1 text-xs text-secondary-500">
              Source: {{ entity.sourcePath }}
            </div>

            <ul v-if="entity.errors.length" class="mt-2 list-disc pl-5 text-xs text-error-600">
              <li v-for="errMsg in entity.errors" :key="errMsg">
                {{ errMsg }}
              </li>
            </ul>
          </li>
        </ul>
      </div>

      <div v-if="generatedFiles.length" class="space-y-1 text-xs text-secondary-600">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-secondary-500">Generated Files</h4>
        <ul class="list-disc pl-5">
          <li v-for="file in generatedFiles" :key="file" class="flex items-center gap-2">
            <span class="truncate">{{ file }}</span>
            <button
              type="button"
              class="rounded-m3-full border border-surface-variant px-2 py-0.5 text-[11px] text-secondary-600 hover:bg-surface-2"
              @click="copyPath(file)"
            >
              Copy path
            </button>
            <span v-if="copiedPath === file" class="text-[11px] text-primary-600">Copied!</span>
          </li>
        </ul>
      </div>

      <div v-if="previewSources.length" class="space-y-1 text-xs text-secondary-600">
        <h4 class="text-xs font-semibold uppercase tracking-wide text-secondary-500">Source Previews</h4>
        <ul class="list-disc pl-5">
          <li v-for="preview in previewSources" :key="preview" class="flex items-center gap-2">
            <span class="truncate">{{ preview }}</span>
            <button
              type="button"
              class="rounded-m3-full border border-surface-variant px-2 py-0.5 text-[11px] text-secondary-600 hover:bg-surface-2"
              @click="copyPath(preview)"
            >
              Copy path
            </button>
            <span v-if="copiedPath === preview" class="text-[11px] text-primary-600">Copied!</span>
          </li>
        </ul>
      </div>
    </div>
    <div v-else class="text-xs text-secondary-500">
      Pipeline results will appear here after entity generation.
    </div>
  </div>
</template>
