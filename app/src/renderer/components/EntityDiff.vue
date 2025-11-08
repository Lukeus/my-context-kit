<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useContextStore } from '../stores/contextStore';

const props = defineProps<{ filePath?: string }>();
const contextStore = useContextStore();

const diffText = ref<string>('');
const loading = ref(false);
const error = ref<string | null>(null);
const viewMode = ref<'unified' | 'split'>('split');

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

const parsedDiff = computed(() => {
  if (!diffText.value || diffText.value === 'No changes.') return [];
  
  const lines = diffText.value.split('\n');
  const result: DiffLine[] = [];
  let oldLineNum = 0;
  let newLineNum = 0;
  
  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.substring(1), newLineNum: newLineNum++ });
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.substring(1), oldLineNum: oldLineNum++ });
    } else if (line.startsWith(' ')) {
      result.push({ type: 'context', content: line.substring(1), oldLineNum: oldLineNum++, newLineNum: newLineNum++ });
    } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      result.push({ type: 'header', content: line });
    } else {
      result.push({ type: 'context', content: line, oldLineNum: oldLineNum++, newLineNum: newLineNum++ });
    }
  }
  
  return result;
});

const splitDiff = computed(() => {
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  
  for (const line of parsedDiff.value) {
    if (line.type === 'header') {
      left.push(line);
      right.push(line);
    } else if (line.type === 'remove') {
      left.push(line);
      right.push({ type: 'context', content: '', oldLineNum: undefined, newLineNum: undefined });
    } else if (line.type === 'add') {
      left.push({ type: 'context', content: '', oldLineNum: undefined, newLineNum: undefined });
      right.push(line);
    } else {
      left.push(line);
      right.push(line);
    }
  }
  
  return { left, right };
});

const hasChanges = computed(() => diffText.value && diffText.value !== 'No changes.');

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
      entityFile = found.filePath;
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
  <div class="h-full flex flex-col bg-surface-1">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface-variant bg-surface-2">
      <h3 class="text-sm font-semibold text-secondary-800">Git Diff</h3>
      <div v-if="hasChanges" class="flex items-center gap-2">
        <button
          @click="viewMode = 'unified'"
          class="px-3 py-1.5 text-xs font-medium rounded-m3-md transition-colors"
          :class="viewMode === 'unified' ? 'bg-primary-600 text-white' : 'bg-surface-3 text-secondary-700 hover:bg-surface-4'"
        >
          Unified
        </button>
        <button
          @click="viewMode = 'split'"
          class="px-3 py-1.5 text-xs font-medium rounded-m3-md transition-colors"
          :class="viewMode === 'split' ? 'bg-primary-600 text-white' : 'bg-surface-3 text-secondary-700 hover:bg-surface-4'"
        >
          Split
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4">
      <div v-if="loading" class="text-xs text-secondary-600">Loading diff…</div>
      <div v-else-if="error" class="text-xs text-error-600">{{ error }}</div>
      <div v-else-if="!hasChanges" class="text-xs text-secondary-600">No changes detected</div>
      
      <!-- Unified View -->
      <div v-else-if="viewMode === 'unified'" class="font-mono text-xs bg-surface-2 border border-surface-variant rounded-m3-md overflow-hidden">
        <div
          v-for="(line, idx) in parsedDiff"
          :key="idx"
          class="flex"
          :class="{
            'bg-success-container': line.type === 'add',
            'bg-error-50': line.type === 'remove',
            'bg-secondary-100': line.type === 'header'
          }"
        >
          <span class="px-3 py-1 text-secondary-500 select-none min-w-[60px] text-right border-r border-surface-variant">
            <span v-if="line.oldLineNum" class="inline-block w-6">{{ line.oldLineNum }}</span>
            <span v-if="line.newLineNum" class="inline-block w-6 ml-1">{{ line.newLineNum }}</span>
          </span>
          <span class="px-3 py-1 flex-1 whitespace-pre"
            :class="{
              'text-on-success-container': line.type === 'add',
              'text-error-800': line.type === 'remove',
              'text-secondary-700 font-semibold': line.type === 'header'
            }"
          >{{ line.content }}</span>
        </div>
      </div>
      
      <!-- Split View -->
      <div v-else class="grid grid-cols-2 gap-2">
        <!-- Left (Original) -->
        <div class="border border-surface-variant rounded-m3-md overflow-hidden">
          <div class="bg-error-100 border-b border-error-200 px-3 py-2 text-xs font-semibold text-error-900">Original</div>
          <div class="font-mono text-xs bg-surface-2">
            <div
              v-for="(line, idx) in splitDiff.left"
              :key="idx"
              class="flex"
              :class="{
                'bg-error-50': line.type === 'remove',
                'bg-secondary-100': line.type === 'header',
                'opacity-30': !line.content && line.type !== 'header'
              }"
            >
              <span class="px-3 py-1 text-secondary-500 select-none w-12 text-right border-r border-surface-variant">
                {{ line.oldLineNum || '' }}
              </span>
              <span class="px-3 py-1 flex-1 whitespace-pre"
                :class="{
                  'text-error-800': line.type === 'remove',
                  'text-secondary-700 font-semibold': line.type === 'header'
                }"
              >{{ line.content || '\u00A0' }}</span>
            </div>
          </div>
        </div>
        
        <!-- Right (Modified) -->
        <div class="border border-surface-variant rounded-m3-md overflow-hidden">
          <div class="bg-success-container border-b border-outline px-3 py-2 text-xs font-semibold text-on-success-container">Modified</div>
          <div class="font-mono text-xs bg-surface-2">
            <div
              v-for="(line, idx) in splitDiff.right"
              :key="idx"
              class="flex"
              :class="{
                'bg-success-container': line.type === 'add',
                'bg-secondary-100': line.type === 'header',
                'opacity-30': !line.content && line.type !== 'header'
              }"
            >
              <span class="px-3 py-1 text-secondary-500 select-none w-12 text-right border-r border-surface-variant">
                {{ line.newLineNum || '' }}
              </span>
              <span class="px-3 py-1 flex-1 whitespace-pre"
                :class="{
                  'text-on-success-container': line.type === 'add',
                  'text-secondary-700 font-semibold': line.type === 'header'
                }"
              >{{ line.content || '\u00A0' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
