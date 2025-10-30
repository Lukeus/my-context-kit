<script setup lang="ts">
import { ref } from 'vue';
import type { TokenProbability } from '../types/ai-prompts';

const props = defineProps<{
  logprobs?: TokenProbability[] | null;
}>();

const isExpanded = ref(false);

function getConfidenceColor(prob: number): string {
  if (prob > 0.9) return 'text-green-700 bg-green-50 border-green-200';
  if (prob > 0.7) return 'text-blue-700 bg-blue-50 border-blue-200';
  if (prob > 0.5) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-orange-700 bg-orange-50 border-orange-200';
}

function formatPercentage(prob: number): string {
  return `${(prob * 100).toFixed(0)}%`;
}
</script>

<template>
  <div v-if="logprobs && logprobs.length" class="mt-2">
    <button
      @click="isExpanded = !isExpanded"
      class="text-xs text-secondary-600 hover:text-secondary-900 flex items-center gap-1.5 transition-colors"
    >
      <svg 
        class="w-3 h-3 transition-transform" 
        :class="isExpanded ? 'rotate-90' : ''" 
        fill="currentColor" 
        viewBox="0 0 20 20"
      >
        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
      </svg>
      Token Probabilities ({{ logprobs.length }} tokens)
    </button>
    
    <div 
      v-if="isExpanded" 
      class="mt-2 p-3 bg-surface-2 rounded-m3-md border border-surface-variant max-h-64 overflow-y-auto"
    >
      <div class="flex flex-wrap gap-1">
        <span
          v-for="(lp, i) in logprobs"
          :key="i"
          :class="getConfidenceColor(lp.prob)"
          class="px-2 py-1 rounded-m3-md text-xs font-mono border"
          :title="`Probability: ${(lp.prob * 100).toFixed(2)}%\nLog probability: ${lp.logprob.toFixed(4)}`"
        >
          {{ lp.token }}
          <span class="text-[10px] opacity-75 ml-1">{{ formatPercentage(lp.prob) }}</span>
        </span>
      </div>
      
      <div class="mt-3 pt-3 border-t border-surface-variant">
        <p class="text-xs font-semibold text-secondary-700 mb-2">Confidence Legend:</p>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span class="px-2 py-1 rounded-m3-md bg-green-50 text-green-700 border border-green-200">High (90%+)</span>
          <span class="px-2 py-1 rounded-m3-md bg-blue-50 text-blue-700 border border-blue-200">Good (70-90%)</span>
          <span class="px-2 py-1 rounded-m3-md bg-yellow-50 text-yellow-700 border border-yellow-200">Medium (50-70%)</span>
          <span class="px-2 py-1 rounded-m3-md bg-orange-50 text-orange-700 border border-orange-200">Low (&lt;50%)</span>
        </div>
      </div>
    </div>
  </div>
</template>
