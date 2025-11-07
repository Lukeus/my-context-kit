<template>
  <div class="tool-queue p-4 space-y-3">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-secondary-900">
        Tool Queue
      </h3>
      <span class="text-xs text-secondary-600">
        {{ activeCount }} active / {{ queuedCount }} queued
      </span>
    </div>

    <!-- Active Tasks -->
    <div v-if="activeTasks.length > 0" class="space-y-2">
      <div class="text-xs font-medium text-secondary-700 uppercase">Active</div>
      <div
        v-for="task in activeTasks"
        :key="task.taskId"
        class="flex items-center gap-3 p-3 rounded-m3-md bg-primary-50 border border-primary-200"
      >
        <span class="animate-spin text-primary-600">⏳</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-secondary-900 truncate">
            {{ task.taskId }}
          </div>
          <div class="text-xs text-secondary-600 mt-0.5">
            Started {{ formatRelativeTime(task) }}
          </div>
        </div>
        <div v-if="extractProgress(task) !== null" class="text-xs text-primary-700">
          {{ extractProgress(task) }}%
        </div>
      </div>
    </div>

    <!-- Queued Tasks -->
    <div v-if="queuedTasks.length > 0" class="space-y-2">
      <div class="text-xs font-medium text-secondary-700 uppercase">Queued</div>
      <div
        v-for="(task, idx) in queuedTasks"
        :key="task.taskId"
        class="flex items-center gap-3 p-3 rounded-m3-md bg-surface-variant border border-surface-variant"
      >
        <span class="text-secondary-500">#{{ idx + 1 }}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-secondary-900 truncate">
            {{ task.taskId }}
          </div>
          <div class="text-xs text-secondary-600 mt-0.5">
            Waiting...
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="activeTasks.length === 0 && queuedTasks.length === 0" class="text-center py-6 text-secondary-500 text-sm">
      No tasks in queue
    </div>

    <!-- Stats -->
    <div v-if="completedCount > 0" class="pt-3 border-t border-surface-variant">
      <div class="text-xs text-secondary-600">
        {{ completedCount }} completed this session
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TaskEnvelope, TaskStatus } from '@shared/assistant/types';
import { formatTime } from '@/services/assistant/timeHelpers'; // Reusable time formatter (T082)

interface Props {
  tasks: TaskEnvelope[];
}

const props = defineProps<Props>();

// Status mapping aligned to TaskStatus union: 'pending' | 'streaming' | 'succeeded' | 'failed'
// We treat 'streaming' as active, 'pending' as queued, and terminal states as completed.
const activeTasks = computed(() => props.tasks.filter(t => t.status === 'streaming'));
const queuedTasks = computed(() => props.tasks.filter(t => t.status === 'pending'));
const completedTasks = computed(() => props.tasks.filter(t => t.status === 'succeeded' || t.status === 'failed'));

const activeCount = computed(() => activeTasks.value.length);
const queuedCount = computed(() => queuedTasks.value.length);
const completedCount = computed(() => completedTasks.value.length);

// Extract progress if present in last output chunk (convention: outputs[].progress)
function extractProgress(task: TaskEnvelope): number | null {
  if (!task.outputs || task.outputs.length === 0) return null;
  const latest = task.outputs[task.outputs.length - 1];
  const val = (latest as Record<string, unknown>).progress;
  return typeof val === 'number' ? val : null;
}

// Relative time using timestamps.created or timestamps.firstResponse fallback
function formatRelativeTime(task: TaskEnvelope): string {
  const iso = task.timestamps?.created || task.timestamps?.firstResponse;
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  if (diffMs < 1000) return 'just now';
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  return `${Math.floor(diffMs / 3600000)}h ago`;
}
</script>
