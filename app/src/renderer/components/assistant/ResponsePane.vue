<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useAssistantStore } from '@/stores/assistantStore';
import type { TaskEnvelope } from '@shared/assistant/types';

type ContextReadResult = {
  path: string;
  repoRelativePath: string;
  content: string;
  encoding: string;
  size: number;
  lastModified: string;
  truncated: boolean;
};

const props = defineProps<{
  result: ContextReadResult | null;
  error?: string | null;
  isBusy?: boolean;
}>();

const hasResult = computed(() => Boolean(props.result));
const tasks = computed<TaskEnvelope[]>(() => assistantStore.tasks || []);
const provenance = computed<Record<string, unknown> | null>(() => assistantStore.provenance);
const latestTask = computed<TaskEnvelope | null>(() => tasks.value.length ? tasks.value[tasks.value.length - 1] : null);
const hasTasks = computed(() => tasks.value.length > 0);

function formatTimestamp(iso: string): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

// streaming partials
const assistantStore = useAssistantStore();
const streamingContent = ref<string | null>(null);
const streaming = ref(false);
let unsubscribeStream: (() => void) | null = null;

onMounted(() => {
  unsubscribeStream = assistantStore.consumeStreamEvents();
  // subscribe will return a function that handles events internally; we mimic partial updates
  // For now the bridge calls will not update this local streamingContent unless payload has { partial }
  // The consumeStreamEvents bridge currently just forwards payload to listener; to keep this safe,
  // we'll patch consumeStreamEvents to accept our listener in future. For now, assume payloads are handled elsewhere.
});

onUnmounted(() => {
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
});

function cancelStream() {
  if (unsubscribeStream) {
    unsubscribeStream();
    unsubscribeStream = null;
  }
  streaming.value = false;
  streamingContent.value = null;
}

function formatProvenance(value: Record<string, unknown> | null): Array<{ key: string; value: string }> {
  if (!value) return [];
  const keys: Array<keyof typeof value> = ['repoRoot', 'featureBranch', 'specificationPath', 'langchainSessionId'];
  return keys
    .filter(k => typeof value[k] === 'string' && (value[k] as string).length > 0)
    .map(k => ({ key: k as string, value: String(value[k]) }));
}

function taskStatusLabel(task: TaskEnvelope): string {
  const status = task.status || 'unknown';
  const streaming = task.streaming ? 'streaming' : '';
  return [status, streaming].filter(Boolean).join(' ');
}
</script>

<template>
  <section class="space-y-3">
    <header class="flex items-center justify-between">
      <div>
        <h4 class="text-xs font-semibold text-secondary-700 uppercase">Context Preview</h4>
        <p class="text-[11px] text-secondary-500">Shows the latest repository artifact returned by the assistant.</p>
      </div>
      <span v-if="isBusy" class="text-[11px] text-secondary-600">Loading…</span>
    </header>

    <!-- Provenance Metadata -->
    <div v-if="formatProvenance(provenance).length" class="border border-surface-variant rounded-m3-md bg-surface-1 p-3 space-y-2">
      <p class="text-[11px] font-semibold text-secondary-700">Provenance</p>
      <ul class="space-y-1">
        <li v-for="item in formatProvenance(provenance)" :key="item.key" class="text-[11px] text-secondary-600 flex gap-2">
          <span class="font-mono text-secondary-800">{{ item.key }}:</span>
          <span class="truncate" :title="item.value">{{ item.value }}</span>
        </li>
      </ul>
    </div>

    <!-- Latest Task Summary -->
    <div v-if="hasTasks && latestTask" class="border border-secondary-200 rounded-m3-md bg-white p-3 space-y-2 shadow-elevation-1">
      <div class="flex items-center justify-between">
        <p class="text-[11px] font-semibold text-secondary-700">Latest Task</p>
        <span class="text-[10px] text-secondary-500">{{ taskStatusLabel(latestTask) }}</span>
      </div>
      <p v-if="latestTask.actionType" class="text-[11px] text-secondary-600">Action: {{ latestTask.actionType }}</p>
      <p v-if="latestTask.output?.summary" class="text-[11px] text-secondary-600 whitespace-pre-wrap">{{ latestTask.output.summary }}</p>
      <p v-else-if="latestTask.output?.content" class="text-[11px] text-secondary-600 whitespace-pre-wrap">{{ latestTask.output.content }}</p>
      <div v-if="latestTask.cost" class="text-[11px] text-secondary-500">Cost: {{ latestTask.cost.total ?? latestTask.cost.estimated ?? '—' }}</div>
      <div v-if="latestTask.error" class="text-[11px] text-error-600">Error: {{ latestTask.error }}</div>
    </div>

    <div v-if="error" class="bg-error-50 border border-error-200 text-error-700 text-xs rounded-m3-md px-3 py-2">
      {{ error }}
    </div>

    <div
      v-if="hasResult && result"
      class="border border-surface-variant bg-white rounded-m3-md shadow-elevation-1 divide-y divide-surface-variant"
    >
      <div class="px-4 py-3 space-y-1">
        <p class="text-xs font-semibold text-secondary-900 flex items-center gap-2">
          <span class="font-mono text-secondary-700">{{ result.repoRelativePath || result.path }}</span>
        </p>
        <p class="text-[11px] text-secondary-600">
          {{ formatSize(result.size) }} · {{ result.encoding }} · {{ formatTimestamp(result.lastModified) }}
        </p>
        <p
          v-if="result.truncated"
          class="text-[11px] text-warning bg-warning-container border border-outline rounded-m3-md px-2 py-1"
        >Preview truncated for safety. Download locally for full contents.</p>
      </div>
      <div class="px-4 py-3">
        <div v-if="streamingContent" class="mb-2">
          <div class="text-[11px] text-secondary-500 mb-1">Partial response (streaming)...</div>
          <pre class="text-xs font-mono whitespace-pre-wrap break-words bg-surface-1 rounded-m3-md border border-surface-variant p-3 max-h-72 overflow-y-auto">{{ streamingContent }}</pre>
          <div class="flex justify-end mt-2">
            <button class="px-3 py-1 text-[11px] bg-secondary-200 rounded-m3-md" @click="cancelStream">Cancel</button>
          </div>
        </div>
        <pre v-else class="text-xs font-mono whitespace-pre-wrap break-words bg-surface-1 rounded-m3-md border border-surface-variant p-3 max-h-72 overflow-y-auto">{{ result.content }}</pre>
      </div>
    </div>

    <div v-else class="border border-dashed border-surface-variant rounded-m3-md px-3 py-4 text-xs text-secondary-500">
      No context artifact loaded yet. Request a file to preview its contents here.
    </div>
  </section>
</template>
