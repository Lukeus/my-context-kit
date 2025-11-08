<template>
  <div
    v-if="suggestions.length > 0"
    class="absolute bottom-full left-0 right-0 mb-1 bg-surface-bright rounded-m3-sm shadow-elevation-3 border border-outline overflow-hidden z-50"
    role="listbox"
    :aria-label="ariaLabel"
  >
    <div class="px-2 py-1.5 bg-surface-2 border-b border-outline">
      <p class="text-label-sm text-secondary-600">Available Commands</p>
    </div>
    <ul class="max-h-48 overflow-y-auto">
      <li
        v-for="(suggestion, index) in suggestions"
        :key="suggestion.hashtag"
        class="px-3 py-2 cursor-pointer transition-colors hover:bg-surface-2"
        :class="{ 'bg-primary-50': index === selectedIndex }"
        role="option"
        :aria-selected="index === selectedIndex"
        @click="$emit('select', suggestion)"
        @mouseenter="$emit('hover', index)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-body-sm font-medium text-secondary-900">
              {{ suggestion.hashtag }}
            </p>
            <p class="text-label-sm text-secondary-600 truncate">
              {{ suggestion.description }}
            </p>
          </div>
          <span class="text-label-sm text-secondary-500 font-mono flex-shrink-0">
            {{ getToolShortName(suggestion.tool) }}
          </span>
        </div>
      </li>
    </ul>
    <div class="px-2 py-1 bg-surface-1 border-t border-outline">
      <p class="text-label-sm text-secondary-500">
        <kbd class="px-1 py-0.5 rounded bg-surface-3 text-secondary-700 font-mono text-[10px]">↑</kbd>
        <kbd class="px-1 py-0.5 rounded bg-surface-3 text-secondary-700 font-mono text-[10px]">↓</kbd>
        Navigate
        <kbd class="px-1 py-0.5 rounded bg-surface-3 text-secondary-700 font-mono text-[10px]">Enter</kbd>
        Select
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Suggestion {
  hashtag: string;
  description: string;
  tool: string;
}

interface Props {
  suggestions: Suggestion[];
  selectedIndex?: number;
  ariaLabel?: string;
}

withDefaults(defineProps<Props>(), {
  selectedIndex: -1,
  ariaLabel: 'Command suggestions',
});

defineEmits<{
  select: [suggestion: Suggestion];
  hover: [index: number];
}>();

function getToolShortName(tool: string): string {
  const parts = tool.split('.');
  return parts[parts.length - 1];
}
</script>
