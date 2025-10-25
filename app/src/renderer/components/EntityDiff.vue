<script setup lang="ts">
import { onMounted, ref } from 'vue';
import path from 'path-browserify';
import { useContextStore } from '../stores/contextStore';

const props = defineProps<{ filePath?: string }>();
const contextStore = useContextStore();

const diffText = ref<string>('');
const loading = ref(false);
const error = ref<string | null>(null);

async function loadDiff() {
  loading.value = true;
  error.value = null;
  diffText.value = '';

  try {
    const repoDir = contextStore.repoPath;
    const active = contextStore.activeEntity;
    if (!repoDir || !active) {
      error.value = 'No active entity or repository.';
      return;
    }

    let entityFile: string | undefined = props.filePath;
    if (!entityFile) {
      const found = await window.api.fs.findEntityFile(repoDir, active._type, active.id);
      if (!found.ok || !found.filePath) {
        error.value = found.error || 'Entity file not found.';
        return;
      }
      const projectRoot = path.dirname(repoDir);
      entityFile = path.relative(projectRoot, found.filePath);
    }

    const result = await window.api.git.diff(repoDir, entityFile);
    if (!result.ok) {
      error.value = result.error || 'Diff failed.';
      return;
    }
    diffText.value = result.diff || 'No changes.';
  } catch (e: any) {
    error.value = e?.message || 'Failed to load diff.';
  } finally {
    loading.value = false;
  }
}

onMounted(loadDiff);
</script>

<template>
  <div class="h-full overflow-auto p-4">
    <div v-if="loading" class="text-xs text-secondary-600">Loading diff…</div>
    <div v-else-if="error" class="text-xs text-error-600">{{ error }}</div>
    <pre v-else class="text-[11px] leading-5 bg-surface-1 border border-surface-variant rounded-m3-md p-3 whitespace-pre-wrap">{{ diffText }}</pre>
  </div>
</template>
