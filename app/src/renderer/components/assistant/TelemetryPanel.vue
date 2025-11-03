<template>
  <div class="telemetry-panel p-4" data-assistant-focus="telemetry-panel">
    <div class="mb-4">
      <h3 class="text-sm font-semibold text-secondary-900 mb-1">
        Session Telemetry
      </h3>
      <p class="text-xs text-secondary-600">
        Performance metrics and execution history
      </p>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-2 gap-2 mb-4">
      <div class="p-3 rounded-m3-md bg-surface-variant border border-surface-variant text-center">
        <div class="text-xl font-bold text-primary-600">{{ stats.total }}</div>
        <div class="text-xs text-secondary-600 mt-1">Total Invocations</div>
      </div>
      <div class="p-3 rounded-m3-md bg-surface-variant border border-surface-variant text-center">
        <div class="text-xl font-bold text-primary-600">{{ stats.succeeded }}</div>
        <div class="text-xs text-secondary-600 mt-1">Successful</div>
      </div>
      <div class="p-3 rounded-m3-md bg-surface-variant border border-surface-variant text-center">
        <div class="text-xl font-bold text-error-600">{{ stats.failed }}</div>
        <div class="text-xs text-secondary-600 mt-1">Failed</div>
      </div>
      <div class="p-3 rounded-m3-md bg-surface-variant border border-surface-variant text-center">
        <div class="text-xl font-bold text-tertiary-600">{{ averageDuration }}ms</div>
        <div class="text-xs text-secondary-600 mt-1">Avg Duration</div>
      </div>
    </div>

    <!-- Success Rate -->
    <div class="mb-4">
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="text-secondary-700">Success Rate</span>
        <span class="font-semibold">{{ successRate }}%</span>
      </div>
      <div class="w-full h-2 bg-surface-variant rounded-m3-full overflow-hidden">
        <div
          :style="{ width: `${successRate}%` }"
          :class="[
            'h-full transition-all duration-300',
            successRate >= 90 ? 'bg-primary-600' :
            successRate >= 70 ? 'bg-tertiary-600' :
            'bg-error-600'
          ]"
        />
      </div>
    </div>

    <!-- Invocation List -->
    <div v-if="telemetryRecords.length > 0" class="space-y-2">
      <h4 class="text-xs font-semibold text-secondary-700 uppercase mb-2">
        Recent Invocations
      </h4>
      <div
        v-for="record in telemetryRecords"
        :key="record.toolId + record.startedAt"
        class="p-3 rounded-m3-md border border-surface-variant hover:bg-surface-variant transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="text-sm font-medium text-secondary-900">
              {{ record.toolId }}
            </div>
            <div class="text-xs text-secondary-600 mt-1">
              Started: {{ formatTime(record.startedAt) }}
            </div>
            <div v-if="record.finishedAt" class="text-xs text-secondary-600">
              Duration: {{ calculateDuration(record) }}ms
            </div>
          </div>
          <span
            :class="[
              'inline-flex items-center px-2 py-0.5 rounded-m3-sm text-xs font-medium',
              record.status === 'succeeded' ? 'bg-primary-100 text-primary-700' :
              record.status === 'failed' ? 'bg-error-100 text-error-700' :
              record.status === 'aborted' ? 'bg-tertiary-100 text-tertiary-700' :
              'bg-surface-variant text-secondary-600'
            ]"
          >
            {{ record.status }}
          </span>
        </div>
        
        <!-- Error Details -->
        <div v-if="record.status === 'failed' && record.metadata?.error" class="mt-2 text-xs text-error-700 bg-error-50 p-2 rounded">
          {{ record.metadata.error }}
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8 text-secondary-500 text-sm">
      No telemetry data yet
    </div>

    <!-- Export Button -->
    <div v-if="telemetryRecords.length > 0" class="mt-4 pt-4 border-t border-surface-variant">
      <button class="px-4 py-2 rounded-m3-md bg-surface-variant hover:bg-surface-variant-hover transition-colors text-sm font-medium w-full" @click="handleExport">
        📥 Export Telemetry
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ToolInvocationRecord } from '@shared/assistant/types';

interface Props {
  sessionId?: string;
  telemetry: ToolInvocationRecord[];
}

const props = defineProps<Props>();

// Computed
const telemetryRecords = computed(() => props.telemetry || []);

const stats = computed(() => {
  const total = telemetryRecords.value.length;
  const succeeded = telemetryRecords.value.filter(r => r.status === 'succeeded').length;
  const failed = telemetryRecords.value.filter(r => r.status === 'failed').length;
  const aborted = telemetryRecords.value.filter(r => r.status === 'aborted').length;
  
  return { total, succeeded, failed, aborted };
});

const successRate = computed(() => {
  const { total, succeeded } = stats.value;
  return total > 0 ? Math.round((succeeded / total) * 100) : 0;
});

const averageDuration = computed(() => {
  const completed = telemetryRecords.value.filter(r => r.finishedAt);
  if (completed.length === 0) return 0;
  
  const totalDuration = completed.reduce((sum, record) => {
    return sum + calculateDuration(record);
  }, 0);
  
  return Math.round(totalDuration / completed.length);
});

// Methods
function calculateDuration(record: ToolInvocationRecord): number {
  if (!record.finishedAt) return 0;
  const start = new Date(record.startedAt).getTime();
  const end = new Date(record.finishedAt).getTime();
  return end - start;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString();
}

function handleExport() {
  // Convert telemetry to JSON and download
  const data = JSON.stringify(telemetryRecords.value, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `telemetry-${props.sessionId || 'session'}-${Date.now()}.json`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
</script>
