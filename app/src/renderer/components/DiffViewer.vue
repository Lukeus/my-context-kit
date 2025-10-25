<script setup lang="ts">
import { computed } from 'vue';
import DiffMatchPatch from 'diff-match-patch';

const props = defineProps<{
  original: string;
  modified: string;
  filePath: string;
  language?: string;
}>();

const dmp = new DiffMatchPatch();

interface DiffLine {
  type: 'equal' | 'delete' | 'insert';
  originalLineNum: number | null;
  modifiedLineNum: number | null;
  content: string;
}

const diffLines = computed((): DiffLine[] => {
  const diffs = dmp.diff_main(props.original, props.modified);
  dmp.diff_cleanupSemantic(diffs);

  const lines: DiffLine[] = [];
  let originalLineNum = 1;
  let modifiedLineNum = 1;

  for (const [operation, text] of diffs) {
    const textLines = text.split('\n');
    
    for (let i = 0; i < textLines.length; i++) {
      // Skip empty last line from split
      if (i === textLines.length - 1 && textLines[i] === '') {
        continue;
      }

      if (operation === 0) { // Equal
        lines.push({
          type: 'equal',
          originalLineNum: originalLineNum++,
          modifiedLineNum: modifiedLineNum++,
          content: textLines[i]
        });
      } else if (operation === -1) { // Delete
        lines.push({
          type: 'delete',
          originalLineNum: originalLineNum++,
          modifiedLineNum: null,
          content: textLines[i]
        });
      } else if (operation === 1) { // Insert
        lines.push({
          type: 'insert',
          originalLineNum: null,
          modifiedLineNum: modifiedLineNum++,
          content: textLines[i]
        });
      }
    }
  }

  return lines;
});

const stats = computed(() => {
  const additions = diffLines.value.filter(l => l.type === 'insert').length;
  const deletions = diffLines.value.filter(l => l.type === 'delete').length;
  const unchanged = diffLines.value.filter(l => l.type === 'equal').length;
  
  return { additions, deletions, unchanged };
});
</script>

<template>
  <div class="diff-viewer bg-surface-1 border border-surface-variant rounded-m3-lg overflow-hidden shadow-elevation-2">
    <!-- Header -->
    <div class="px-4 py-3 bg-surface-2 border-b border-surface-variant flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="text-sm font-medium text-secondary-900">{{ filePath }}</span>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span class="px-2 py-1 rounded-m3-full bg-green-100 text-green-800 font-medium">
          +{{ stats.additions }}
        </span>
        <span class="px-2 py-1 rounded-m3-full bg-red-100 text-red-800 font-medium">
          -{{ stats.deletions }}
        </span>
        <span class="text-secondary-600">
          {{ stats.unchanged }} unchanged
        </span>
      </div>
    </div>

    <!-- Diff Content -->
    <div class="overflow-auto max-h-96 font-mono text-xs">
      <table class="w-full border-collapse">
        <tbody>
          <tr
            v-for="(line, index) in diffLines"
            :key="index"
            :class="{
              'bg-red-50': line.type === 'delete',
              'bg-green-50': line.type === 'insert',
              'bg-surface-1': line.type === 'equal'
            }"
          >
            <!-- Original line number -->
            <td
              class="w-10 px-2 py-1 text-right text-secondary-500 select-none border-r border-surface-variant"
              :class="{
                'bg-red-100': line.type === 'delete',
                'bg-surface-2': line.type === 'equal' || line.type === 'insert'
              }"
            >
              {{ line.originalLineNum || '' }}
            </td>

            <!-- Modified line number -->
            <td
              class="w-10 px-2 py-1 text-right text-secondary-500 select-none border-r border-surface-variant"
              :class="{
                'bg-green-100': line.type === 'insert',
                'bg-surface-2': line.type === 'equal' || line.type === 'delete'
              }"
            >
              {{ line.modifiedLineNum || '' }}
            </td>

            <!-- Indicator -->
            <td
              class="w-6 px-1 py-1 text-center select-none border-r border-surface-variant"
              :class="{
                'text-red-700 bg-red-100': line.type === 'delete',
                'text-green-700 bg-green-100': line.type === 'insert',
                'text-secondary-400 bg-surface-2': line.type === 'equal'
              }"
            >
              <span v-if="line.type === 'delete'">-</span>
              <span v-else-if="line.type === 'insert'">+</span>
              <span v-else>&nbsp;</span>
            </td>

            <!-- Content -->
            <td
              class="px-3 py-1 whitespace-pre"
              :class="{
                'text-red-900': line.type === 'delete',
                'text-green-900': line.type === 'insert',
                'text-secondary-800': line.type === 'equal'
              }"
            >{{ line.content || ' ' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer hint -->
    <div class="px-4 py-2 bg-surface-2 border-t border-surface-variant text-xs text-secondary-600">
      <span class="font-medium text-green-700">Green</span> lines will be added, 
      <span class="font-medium text-red-700">red</span> lines will be removed
    </div>
  </div>
</template>
