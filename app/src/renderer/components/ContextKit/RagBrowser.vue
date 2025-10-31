<script setup lang="ts">
import { ref } from 'vue';

// Stub component - RAG functionality to be implemented in future
const ragEntries = ref<any[]>([]);
const selectedEntry = ref<any>(null);

function selectEntry(entry: any) {
  selectedEntry.value = entry;
}
</script>

<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b">
      <h2 class="text-2xl font-semibold text-gray-900">RAG Context Browser</h2>
      <p class="text-sm text-gray-600 mt-1">Browse retrieval-augmented generation context</p>
    </div>

    <div class="flex-1 flex items-center justify-center text-gray-500">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-lg font-medium mt-4">RAG Context Browser</p>
        <p class="text-sm mt-2">View and manage .context-kit/rag.jsonl entries</p>
        <p class="text-sm mt-1 text-gray-400">Coming soon in full RAG implementation</p>
      </div>
    </div>
  </div>
</template>
