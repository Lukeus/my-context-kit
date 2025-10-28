<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SpecKitEntityPreview } from '@shared/speckit';

const props = defineProps<{
  preview: SpecKitEntityPreview | null;
  isLoading?: boolean;
}>();

const renderedMarkdown = ref('');
const isRendering = ref(false);

const metadata = computed(() => {
  if (!props.preview) {
    return null;
  }
  return {
    releaseTag: props.preview.source.releaseTag,
    commit: props.preview.source.commit,
    path: props.preview.source.path,
    entityType: props.preview.entityType,
  };
});

function fallbackMarkdown(source: string): string {
  return source
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br/><br/>');
}

async function renderMarkdown(content: string): Promise<void> {
  if (!content) {
    renderedMarkdown.value = '';
    return;
  }

  isRendering.value = true;
  try {
    const { marked } = await import('marked');

    if (typeof marked.parse === 'function') {
      renderedMarkdown.value = await marked.parse(content);
    } else {
      renderedMarkdown.value = fallbackMarkdown(content);
    }
  } catch (error) {
    console.warn('Falling back to basic markdown rendering:', error);
    renderedMarkdown.value = fallbackMarkdown(content);
  } finally {
    isRendering.value = false;
  }
}

watch(
  () => props.preview?.content,
  async (content) => {
    if (content) {
      await renderMarkdown(content);
    } else {
      renderedMarkdown.value = '';
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="flex h-full flex-col rounded-m3-lg border border-surface-variant bg-surface-1">
    <div class="flex items-center justify-between gap-2 border-b border-surface-variant px-4 py-3">
      <div class="space-y-1 text-xs text-secondary-600" v-if="metadata">
        <div class="font-semibold text-secondary-900">{{ preview?.displayName }}</div>
        <div class="flex flex-wrap gap-3">
          <span class="uppercase tracking-wide">{{ metadata.entityType }}</span>
          <span>Tag: {{ metadata.releaseTag }}</span>
          <span>Commit: {{ metadata.commit }}</span>
          <span class="truncate" :title="metadata.path">{{ metadata.path }}</span>
        </div>
      </div>
      <div v-else class="text-xs text-secondary-500">Select a Spec Kit document to preview</div>
    </div>

    <div class="relative flex-1 overflow-y-auto p-4">
      <div v-if="isLoading || isRendering" class="flex h-full items-center justify-center text-secondary-500">
        Rendering preview…
      </div>
      <div
        v-else-if="preview"
        class="prose max-w-none prose-headings:font-semibold prose-p:text-secondary-800"
        v-html="renderedMarkdown"
      />
      <div v-else class="h-full text-sm text-secondary-500">
        Choose a document from the library to render its markdown preview.
      </div>
    </div>
  </div>
</template>
