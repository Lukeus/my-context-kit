<script setup lang="ts">
import { computed } from 'vue';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

const emit = defineEmits<{
  'show-graph': [];
  'show-git': [];
  'validate': [];
  'toggle-left-panel': [];
  'toggle-assistant': [];
  'go-workspace': [];
}>();

const props = defineProps<{
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  isRepoConfigured: boolean;
}>();

function goWorkspace() {
  emit('go-workspace');
}
</script>

<template>
  <div class="border-b border-surface-variant bg-surface-1 shadow-elevation-1">
    <div class="px-6 py-3 flex items-center gap-2 flex-wrap">
      <button
        @click="goWorkspace"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all"
        title="Open Workspace Hub"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Home
      </button>
      <button
        @click="emit('show-graph')"
        :disabled="!isRepoConfigured"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Open dependency graph viewer"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        Graph
      </button>
      <button
        @click="emit('show-git')"
        :disabled="!isRepoConfigured"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Open Git integration"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        Git
      </button>
      <button
        @click="emit('validate')"
        :disabled="!isRepoConfigured"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Run schema validation"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6M5 7h14" />
        </svg>
        Validate
      </button>
      <button
        @click="emit('toggle-assistant')"
        class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border transition-all"
        :class="rightPanelOpen ? 'bg-primary-600 text-white border-primary-400 shadow-elevation-2' : 'border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1'"
        :title="rightPanelOpen ? 'Hide AI Assistant (Ctrl+Shift+A)' : 'Show AI Assistant (Ctrl+Shift+A)'"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        AI Assistant
      </button>
    </div>
  </div>
</template>