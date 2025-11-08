<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import type { ConversationTurn, TaskEnvelope } from '@shared/assistant/types';

// Configure marked for better code highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
});

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

function isQueued(entry: ConversationTurn): boolean {
  const meta = entry.metadata;
  return !!(meta && typeof meta === 'object' && (meta as Record<string, unknown>).queuedDueToHealth);
}

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string;
  } catch (err) {
    console.error('Markdown render error:', err);
    return content; // Fallback to plain text
  }
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
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold text-secondary-700">{{ roleLabel(entry.role) }}</span>
            <span
              v-if="isQueued(entry)"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-warning-container text-on-warning-container font-medium"
              title="Queued due to service health degradation; will resend automatically when healthy."
            >Queued</span>
          </div>
          <span class="text-[10px] text-secondary-500">{{ formatTimestamp(entryTimestamp(entry)) }}</span>
        </div>
        <div class="px-4 py-3 space-y-2">
          <div 
            class="text-sm text-secondary-900 prose prose-sm max-w-none
                   prose-headings:text-secondary-900 prose-headings:font-semibold
                   prose-p:my-2 prose-p:leading-relaxed
                   prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
                   prose-code:bg-surface-2 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:text-secondary-800
                   prose-pre:bg-surface-2 prose-pre:border prose-pre:border-surface-variant prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto
                   prose-pre:my-3
                   prose-ul:my-2 prose-ol:my-2 prose-li:my-1
                   prose-blockquote:border-l-4 prose-blockquote:border-primary-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-secondary-700
                   prose-strong:text-secondary-900 prose-strong:font-semibold
                   prose-table:border-collapse prose-table:border prose-table:border-surface-variant
                   prose-th:bg-surface-2 prose-th:border prose-th:border-surface-variant prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold
                   prose-td:border prose-td:border-surface-variant prose-td:px-3 prose-td:py-2"
            v-html="renderMarkdown(entry.content)"
          />
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
