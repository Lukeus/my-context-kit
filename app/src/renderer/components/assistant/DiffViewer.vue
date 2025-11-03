<template>
  <div class="diff-viewer bg-surface rounded-m3-md border border-outline-variant overflow-hidden">
    <!-- Header with toggle -->
    <div class="diff-header flex items-center justify-between px-4 py-2 bg-surface-container-highest border-b border-outline-variant">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-on-surface">{{ title || 'Code Changes' }}</span>
        <span v-if="isTruncated" class="text-xs text-on-surface-variant">(Truncated)</span>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          v-if="hasSummarization"
          @click="toggleView"
          class="text-xs px-3 py-1 rounded-m3-sm bg-secondary-container text-on-secondary-container hover:bg-secondary hover:text-on-secondary transition-colors"
          :aria-label="viewMode === 'full' ? 'Show summary' : 'Show full diff'"
        >
          {{ viewMode === 'full' ? 'Summarize' : 'Show Full' }}
        </button>
        
        <button
          @click="copyToClipboard"
          class="text-xs px-3 py-1 rounded-m3-sm bg-tertiary-container text-on-tertiary-container hover:bg-tertiary hover:text-on-tertiary transition-colors"
          aria-label="Copy diff to clipboard"
        >
          Copy
        </button>
      </div>
    </div>

    <!-- Diff content -->
    <div class="diff-content overflow-x-auto">
      <pre v-if="viewMode === 'full'" class="p-4 text-sm font-mono text-on-surface whitespace-pre-wrap break-words">{{ fullDiff }}</pre>
      <pre v-else class="p-4 text-sm font-mono text-on-surface whitespace-pre-wrap break-words">{{ summarizedDiff }}</pre>
    </div>

    <!-- Truncation notice -->
    <div v-if="isTruncated && viewMode === 'summarized'" class="truncation-notice px-4 py-2 bg-warning-container text-on-warning-container text-xs border-t border-outline-variant">
      ⚠️ Output truncated for display. Switch to "Show Full" to see complete diff.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { summarizeDiff } from '@/services/assistant/diffSummarizer';

interface Props {
  title?: string;
  fullDiff: string;
  maxLines?: number;
  maxChars?: number;
}

const props = withDefaults(defineProps<Props>(), {
  maxLines: 100,
  maxChars: 5000
});

const viewMode = ref<'full' | 'summarized'>('summarized');

const summarizedDiff = computed(() => {
  if (!props.fullDiff) return '';
  
  const result = summarizeDiff(props.fullDiff, {
    maxLines: props.maxLines,
    maxBytes: props.maxChars
  });
  
  // TODO: Check DiffSummary type definition to ensure correct property access
  return typeof result === 'string' ? result : result.summary;
});

const isTruncated = computed(() => {
  return summarizedDiff.value !== props.fullDiff;
});

const hasSummarization = computed(() => {
  return isTruncated.value;
});

function toggleView() {
  viewMode.value = viewMode.value === 'full' ? 'summarized' : 'full';
}

async function copyToClipboard() {
  const textToCopy = viewMode.value === 'full' 
    ? props.fullDiff 
    : summarizedDiff.value;
  
  try {
    await navigator.clipboard.writeText(textToCopy);
    // TODO: Show success toast
    console.log('Diff copied to clipboard');
  } catch (error) {
    console.error('Failed to copy diff:', error);
    // TODO: Show error toast
  }
}
</script>

<style scoped>
.diff-viewer {
  max-height: 600px;
  display: flex;
  flex-direction: column;
}

.diff-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.diff-content pre {
  margin: 0;
  line-height: 1.5;
}

/* Syntax highlighting for diff (basic) */
.diff-content pre :deep(.diff-addition) {
  background-color: rgba(0, 255, 0, 0.1);
  color: #22c55e;
}

.diff-content pre :deep(.diff-deletion) {
  background-color: rgba(255, 0, 0, 0.1);
  color: #ef4444;
}

.diff-content pre :deep(.diff-context) {
  color: var(--md-sys-color-on-surface);
  opacity: 0.7;
}
</style>
