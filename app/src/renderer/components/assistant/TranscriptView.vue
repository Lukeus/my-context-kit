<script setup lang="ts">
import { computed } from 'vue';
import type { ConversationTurn, TaskEnvelope } from '@shared/assistant/types';

const props = defineProps<{
  transcript: ConversationTurn[];
  tasks?: TaskEnvelope[]; // optional list of task envelopes for associating with assistant turns
  isBusy?: boolean;
  emptyMessage?: string;
}>();

const entries = computed(() => props.transcript ?? []);
const taskIndexByTimestamp = computed(() => {
  const map = new Map<string, TaskEnvelope>();
  (props.tasks || []).forEach(task => {
    const ts = task.timestamp || task.createdAt || '';
    if (ts) map.set(ts, task);
  });
  return map;
});

function taskForEntry(entry: ConversationTurn): TaskEnvelope | null {
  // Simple heuristic: match exact timestamp of task creation or fallback to last task for assistant role
  const direct = taskIndexByTimestamp.value.get(entry.timestamp);
  if (direct) return direct;
  if (entry.role === 'assistant' && (props.tasks && props.tasks.length)) {
    return props.tasks[props.tasks.length - 1];
  }
  return null;
}

function taskBadge(task: TaskEnvelope | null): string | null {
  if (!task) return null;
  const parts: string[] = [];
  if (task.actionType) parts.push(task.actionType);
  if (task.status) parts.push(task.status);
  if (task.streaming) parts.push('streaming');
  return parts.join(' · ');
}

function roleLabel(role: ConversationTurn['role']): string {
  switch (role) {
    case 'system':
      return 'System';
    case 'user':
      return 'Operator';
    case 'assistant':
    default:
      return 'Assistant';
  }
}

function formatTimestamp(iso?: string): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return iso;
  }
}

function referenceList(metadata: Record<string, unknown> | null | undefined): Array<{ path: string; title?: string }> {
  const raw = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).references : null;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(item => (typeof item === 'object' && item !== null ? item : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map(item => ({
      path: typeof item.path === 'string' ? item.path : 'unknown',
      title: typeof item.title === 'string' ? item.title : undefined
    }));
}

function usageSummary(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const usage = (metadata as Record<string, unknown>).usage;
  if (!usage || typeof usage !== 'object') {
    return null;
  }
  const prompt = typeof (usage as Record<string, unknown>).promptTokens === 'number' ? (usage as Record<string, unknown>).promptTokens : null;
  const completion = typeof (usage as Record<string, unknown>).completionTokens === 'number' ? (usage as Record<string, unknown>).completionTokens : null;
  const total = typeof (usage as Record<string, unknown>).totalTokens === 'number' ? (usage as Record<string, unknown>).totalTokens : null;
  if (prompt === null && completion === null && total === null) {
    return null;
  }
  const parts: string[] = [];
  if (prompt !== null) {
    parts.push(`prompt ${prompt}`);
  }
  if (completion !== null) {
    parts.push(`completion ${completion}`);
  }
  if (total !== null) {
    parts.push(`total ${total}`);
  }
  return parts.join(' · ');
}

function entryTimestamp(entry: ConversationTurn): string {
  const meta = entry.metadata;
  if (meta && typeof meta === 'object' && typeof (meta as Record<string, unknown>).timestamp === 'string') {
    return (meta as Record<string, unknown>).timestamp as string;
  }
  return entry.timestamp;
}
</script>

<template>
  <section class="space-y-3">
    <header class="flex items-center justify-between">
      <div>
        <h4 class="text-xs font-semibold text-secondary-700 uppercase">Transcript</h4>
        <p class="text-[11px] text-secondary-500">Chronological log of operator requests and assistant responses.</p>
      </div>
      <span v-if="isBusy" class="text-[11px] text-secondary-600">Updating…</span>
    </header>

    <div v-if="entries.length === 0" class="border border-dashed border-surface-variant rounded-m3-md px-3 py-4 text-xs text-secondary-500">
      {{ emptyMessage || 'No transcript available yet.' }}
    </div>

    <ol v-else class="space-y-3">
      <li
        v-for="(entry, index) in entries"
        :key="`${entry.timestamp}-${index}`"
        class="border border-surface-variant rounded-m3-md bg-white shadow-elevation-1 divide-y divide-surface-variant"
      >
        <div class="px-4 py-2 flex items-center justify-between bg-surface-2">
          <span class="text-[11px] font-semibold text-secondary-700">{{ roleLabel(entry.role) }}</span>
          <span class="text-[10px] text-secondary-500">{{ formatTimestamp(entryTimestamp(entry)) }}</span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <p class="text-sm text-secondary-900 whitespace-pre-wrap">{{ entry.content }}</p>
          <p v-if="taskBadge(taskForEntry(entry))" class="text-[10px] text-secondary-500">Task: {{ taskBadge(taskForEntry(entry)) }}</p>
          <div v-if="referenceList(entry.metadata).length" class="space-y-1">
            <p class="text-[11px] font-semibold text-secondary-700">References</p>
            <ul class="space-y-1">
              <li
                v-for="reference in referenceList(entry.metadata)"
                :key="reference.path"
                class="text-[11px] text-secondary-600 flex items-center gap-2"
              >
                <span class="font-mono text-secondary-800">{{ reference.path }}</span>
                <span v-if="reference.title" class="text-secondary-500">· {{ reference.title }}</span>
              </li>
            </ul>
          </div>
          <p v-if="usageSummary(entry.metadata)" class="text-[11px] text-secondary-500">Usage: {{ usageSummary(entry.metadata) }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>
