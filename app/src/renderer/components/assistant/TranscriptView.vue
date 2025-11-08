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
  <section class="space-y-4">
    <div v-if="entries.length === 0" class="flex items-center justify-center py-12">
      <p class="text-body-sm text-secondary-500">{{ emptyMessage || 'No transcript available yet.' }}</p>
    </div>

    <ol v-else class="space-y-4">
      <li
        v-for="(entry, index) in entries"
        :key="`${entry.timestamp}-${index}`"
        class="group relative"
      >
        <!-- Role Indicator Bar -->
        <div
          class="absolute left-0 top-0 bottom-0 w-1 rounded-l"
          :class="entry.role === 'user' ? 'bg-primary-500' : 'bg-secondary-300'"
        />
        
        <div class="pl-4 space-y-2">
          <!-- Header -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span
                class="text-label-sm font-medium"
                :class="entry.role === 'user' ? 'text-secondary-900' : 'text-secondary-700'"
              >
                {{ roleLabel(entry.role) }}
              </span>
              <span
                v-if="isQueued(entry)"
                class="text-label-sm px-1.5 py-0.5 rounded bg-warning-100 text-warning-800"
                title="Queued due to service health degradation; will resend automatically when healthy."
              >
                Queued
              </span>
            </div>
            <span class="text-label-sm text-secondary-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {{ formatTimestamp(entryTimestamp(entry)) }}
            </span>
          </div>

          <!-- Content -->
          <div class="space-y-2">
            <div 
              class="text-body-md text-secondary-900 prose prose-sm max-w-none
                     prose-headings:text-secondary-900 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2
                     prose-p:my-1 prose-p:leading-relaxed prose-p:text-body-md
                     prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline
                     prose-code:bg-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-m3-xs prose-code:text-label-md prose-code:font-mono prose-code:text-secondary-800
                     prose-pre:bg-surface-2 prose-pre:border prose-pre:border-outline prose-pre:rounded-m3-sm prose-pre:p-2 prose-pre:overflow-x-auto prose-pre:my-2
                     prose-ul:my-1 prose-ul:pl-4 prose-ol:my-1 prose-ol:pl-4 prose-li:my-0.5
                     prose-blockquote:border-l-2 prose-blockquote:border-primary-400 prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-secondary-700 prose-blockquote:my-2
                     prose-strong:text-secondary-900 prose-strong:font-semibold
                     prose-table:border-collapse prose-table:border prose-table:border-outline prose-table:my-2
                     prose-th:bg-surface-2 prose-th:border prose-th:border-outline prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold prose-th:text-label-md
                     prose-td:border prose-td:border-outline prose-td:px-2 prose-td:py-1 prose-td:text-body-sm"
              v-html="renderMarkdown(entry.content)"
            />

            <!-- Metadata (hidden by default, shown on hover) -->
            <div class="opacity-0 group-hover:opacity-100 transition-opacity space-y-1 mt-2">
              <p v-if="taskBadge(taskForEntry(entry))" class="text-label-sm text-secondary-500">
                Task: {{ taskBadge(taskForEntry(entry)) }}
              </p>
              <div v-if="referenceList(entry.metadata).length" class="space-y-0.5">
                <p class="text-label-sm font-medium text-secondary-700">References</p>
                <ul class="space-y-0.5">
                  <li
                    v-for="reference in referenceList(entry.metadata)"
                    :key="reference.path"
                    class="text-label-sm text-secondary-600 flex items-center gap-2"
                  >
                    <span class="font-mono text-secondary-800">{{ reference.path }}</span>
                    <span v-if="reference.title" class="text-secondary-500">· {{ reference.title }}</span>
                  </li>
                </ul>
              </div>
              <p v-if="usageSummary(entry.metadata)" class="text-label-sm text-secondary-500">
                Usage: {{ usageSummary(entry.metadata) }}
              </p>
            </div>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>
