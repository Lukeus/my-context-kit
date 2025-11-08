<template>
  <div class="tool-result p-4 rounded-m3-md border" :class="resultClasses">
    <!-- Header -->
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <span class="text-lg">{{ statusIcon }}</span>
        <div>
          <h4 class="text-sm font-semibold text-secondary-900">
            {{ toolId }}
          </h4>
          <div class="text-xs text-secondary-600 mt-0.5">
            {{ formatTimestamp(startedAt) }} • {{ formatDuration(duration) }}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <ProviderBadge v-if="provider" :provider="provider" />
        <button
          v-if="canExpand"
          class="p-1.5 rounded-m3-sm hover:bg-surface-variant transition-colors text-secondary-600"
          :title="expanded ? 'Collapse' : 'Expand'"
          @click="toggleExpanded"
        >
          {{ expanded ? '▼' : '▶' }}
        </button>
      </div>
    </div>

    <!-- Status Message -->
    <div v-if="status === 'failed' && error" class="mb-3">
      <div class="text-sm font-medium text-error-700 mb-1">
        {{ error.userMessage }}
      </div>
      <div v-if="error.suggestedAction" class="text-xs text-error-600 italic">
        {{ error.suggestedAction }}
      </div>
      <div v-if="error.retryable" class="mt-2">
        <button
          class="px-3 py-1.5 text-xs rounded-m3-md bg-error-100 text-error-700 hover:bg-error-200 transition-colors"
          @click="handleRetry"
        >
          🔄 Retry
        </button>
      </div>
    </div>

    <!-- Result Content -->
    <div v-if="status === 'succeeded' && result" class="space-y-2">
      <!-- Summarized Output (T059) -->
      <div v-if="isTruncated && !expanded" class="text-sm text-secondary-700">
        <div class="font-medium mb-1">Summary:</div>
        <div class="bg-surface-variant rounded-m3-sm p-3">
          {{ summarizedOutput }}
        </div>
        <button
          class="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
          @click="expanded = true"
        >
          Show full output →
        </button>
      </div>

      <!-- Full Output -->
      <div v-else class="text-sm">
        <div v-if="result.output" class="bg-surface-variant rounded-m3-sm p-3 font-mono text-xs overflow-x-auto">
          <pre class="whitespace-pre-wrap">{{ formatOutput(result.output) }}</pre>
        </div>
        <div v-if="result.artifacts && Array.isArray(result.artifacts) && result.artifacts.length > 0" class="mt-2">
          <div class="text-xs font-medium text-secondary-700 mb-1">Artifacts:</div>
          <div class="space-y-1">
            <div
              v-for="(artifact, idx) in result.artifacts"
              :key="idx"
              class="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-m3-sm"
            >
              {{ artifact }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pending State -->
    <div v-if="status === 'pending'" class="flex items-center gap-2 text-sm text-secondary-600">
      <span class="animate-spin">⏳</span>
      <span>Executing...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ToolInvocationRecord, AssistantProvider } from '@shared/assistant/types';
import { classifyError, type ClassifiedError } from '@/services/assistant/errorClassifier';
import ProviderBadge from './ProviderBadge.vue';

interface Props {
  toolId: string;
  status: ToolInvocationRecord['status'];
  startedAt: string;
  finishedAt?: string;
  result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  provider?: AssistantProvider;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  retry: [];
}>();

const expanded = ref(false);

// Computed
const duration = computed(() => {
  if (!props.finishedAt) return 0;
  const start = new Date(props.startedAt).getTime();
  const end = new Date(props.finishedAt).getTime();
  return end - start;
});

const statusIcon = computed(() => {
  switch (props.status) {
    case 'succeeded': return '✅';
    case 'failed': return '❌';
    case 'aborted': return '⚠️';
    default: return '⏳';
  }
});

const resultClasses = computed(() => ({
  'border-primary-200 bg-primary-50': props.status === 'succeeded',
  'border-error-200 bg-error-50': props.status === 'failed',
  'border-tertiary-200 bg-tertiary-50': props.status === 'aborted',
  'border-surface-variant bg-surface': props.status === 'pending'
}));

const error = computed((): ClassifiedError | null => {
  if (props.status !== 'failed' || !props.metadata?.error) return null;
  return classifyError(props.metadata.error);
});

const outputText = computed(() => {
  if (!props.result?.output) return '';
  return String(props.result.output);
});

const isTruncated = computed(() => outputText.value.length > 500);

const canExpand = computed(() => isTruncated.value || (props.result?.artifacts && Array.isArray(props.result.artifacts) && props.result.artifacts.length > 0));

const summarizedOutput = computed(() => {
  if (!isTruncated.value) return outputText.value;
  return outputText.value.substring(0, 500) + '...';
});

// Methods
function formatTimestamp(iso: string): string {
  return formatTime(iso);
}

function formatDuration(ms: number): string {
  if (ms === 0) return 'Running...';
  return formatDurationHelper(ms);
}

function formatOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  return JSON.stringify(output, null, 2);
}

function toggleExpanded() {
  expanded.value = !expanded.value;
}

function handleRetry() {
  emit('retry');
}
</script>
