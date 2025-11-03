<template>
  <div
    v-if="status"
    class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-m3-sm transition-colors"
    :class="badgeClasses"
    :title="tooltipText"
    role="status"
    aria-label="Gating status indicator"
  >
    <span class="inline-block w-1.5 h-1.5 rounded-full" :class="indicatorClass" />
    <span>{{ badgeLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GatingStatus } from '@shared/assistant/types';

interface Props {
  status: GatingStatus | null;
  isClassificationEnforced?: boolean;
  isLimitedReadOnly?: boolean;
  isRetrievalEnabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isClassificationEnforced: false,
  isLimitedReadOnly: false,
  isRetrievalEnabled: false
});

const badgeLabel = computed(() => {
  if (props.isClassificationEnforced && props.isRetrievalEnabled) {
    return 'Gated + RAG';
  }
  if (props.isClassificationEnforced) {
    return 'Classification';
  }
  if (props.isRetrievalEnabled) {
    return 'RAG';
  }
  if (props.isLimitedReadOnly) {
    return 'Read-Only';
  }
  return 'Ungated';
});

const badgeClasses = computed(() => {
  if (props.isClassificationEnforced) {
    return 'bg-warning-container text-on-warning-container border border-warning';
  }
  if (props.isLimitedReadOnly) {
    return 'bg-error-container text-on-error-container border border-error';
  }
  if (props.isRetrievalEnabled) {
    return 'bg-tertiary-container text-on-tertiary-container border border-tertiary';
  }
  return 'bg-surface-variant text-secondary-700 border border-outline-variant';
});

const indicatorClass = computed(() => {
  if (props.isClassificationEnforced) return 'bg-warning';
  if (props.isLimitedReadOnly) return 'bg-error';
  if (props.isRetrievalEnabled) return 'bg-tertiary';
  return 'bg-outline';
});

const tooltipText = computed(() => {
  const parts: string[] = [];
  if (!props.status) return 'Gating status unavailable';
  if (props.isClassificationEnforced) {
    parts.push('Classification enforced: destructive tools require approval & reason');
  }
  if (props.status.sidecarOnly) {
    parts.push('Sidecar-only mode active');
  }
  if (props.status.checksumMatch) {
    parts.push('Embeddings checksum verified (deterministic)');
  }
  if (props.isRetrievalEnabled) {
    parts.push('RAG retrieval enabled');
  } else if (props.status.checksumMatch === false) {
    parts.push('RAG disabled: awaiting checksumMatch=true');
  }
  if (props.isLimitedReadOnly) {
    parts.push('Limited read-only mode (FR-011): classification not enforced');
  }
  if (props.status.updatedAt) {
    parts.push(`Updated: ${new Date(props.status.updatedAt).toLocaleString()}`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'Gating status: default fallback';
});
</script>
