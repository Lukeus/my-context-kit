<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import mermaid from 'mermaid';
import { useContextStore } from '../stores/contextStore';

interface C4Diagram {
  file: string;
  title: string;
  content: string;
  system?: string;
  level?: string;
  feature?: string;
  projection?: any;
}

const emit = defineEmits<{
  'close': [];
  'open-entity': [string];
}>();

const contextStore = useContextStore();
const diagrams = ref<C4Diagram[]>([]);
const selectedDiagram = ref<C4Diagram | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const renderKey = ref(0);
const searchQuery = ref('');

const filteredDiagrams = computed(() => {
  if (!searchQuery.value) return diagrams.value;
  
  const query = searchQuery.value.toLowerCase();
  return diagrams.value.filter(d => 
    d.title.toLowerCase().includes(query) ||
    d.system?.toLowerCase().includes(query) ||
    d.level?.toLowerCase().includes(query) ||
    d.feature?.toLowerCase().includes(query)
  );
});

const projectionStats = computed(() => {
  if (!selectedDiagram.value?.projection) return null;
  
  const proj = selectedDiagram.value.projection;
  return {
    nodes: proj.nodes?.length || 0,
    relationships: proj.relationships?.length || 0,
    nodesByKind: proj.nodes?.reduce((acc: Record<string, number>, n: any) => {
      acc[n.kind] = (acc[n.kind] || 0) + 1;
      return acc;
    }, {}) || {}
  };
});

onMounted(async () => {
  // Initialize Mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis'
    }
  });

  await loadDiagrams();
});

async function loadDiagrams() {
  loading.value = true;
  error.value = null;
  
  try {
    if (!contextStore.repoPath) {
      error.value = 'No repository configured';
      loading.value = false;
      return;
    }
    
    const result = await window.api.c4.loadDiagrams(contextStore.repoPath);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load diagrams');
    }
    
    diagrams.value = result.diagrams;
    
    if (diagrams.value.length > 0) {
      selectedDiagram.value = diagrams.value[0];
      await renderDiagram();
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load C4 diagrams';
    console.error('Error loading C4 diagrams:', err);
  } finally {
    loading.value = false;
  }
}

async function selectDiagram(diagram: C4Diagram) {
  selectedDiagram.value = diagram;
  await renderDiagram();
}

async function renderDiagram() {
  if (!selectedDiagram.value) return;
  
  renderKey.value++;
  
  // Wait for DOM update
  await new Promise(resolve => setTimeout(resolve, 50));
  
  try {
    const containerId = `mermaid-${renderKey.value}`;
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error('Mermaid container not found');
      return;
    }
    
    // Clean content of invisible characters before rendering
    const cleanContent = selectedDiagram.value.content
      .replace(/\u200B/g, '') // Zero-width space
      .replace(/\uFEFF/g, '') // BOM
      .replace(/\u00A0/g, ' ') // Non-breaking space
      .replace(/[\u2000-\u200F\u2028-\u202F]/g, '') // Other invisible unicode
      .trim();
    
    const { svg } = await mermaid.render(`mermaid-svg-${renderKey.value}`, cleanContent);
    container.innerHTML = svg;
  } catch (err) {
    console.error('Error rendering Mermaid diagram:', err);
    error.value = 'Failed to render diagram';
  }
}

function openRelatedEntity(entityId: string) {
  emit('open-entity', entityId);
}

watch(() => selectedDiagram.value, async () => {
  if (selectedDiagram.value) {
    await renderDiagram();
  }
});
</script>

<template>
  <div class="flex h-full bg-surface">
    <!-- Left sidebar: Diagram list -->
    <div class="w-80 border-r border-surface-variant bg-surface-1 flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-surface-variant bg-surface-2">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-primary-700">C4 Diagrams</h2>
          <button
            @click="loadDiagrams"
            class="p-2 hover:bg-surface-3 rounded-m3-md transition-colors"
            title="Refresh"
          >
            <svg class="w-5 h-5 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        
        <!-- Search -->
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search diagrams..."
          class="w-full px-3 py-2 border border-surface-variant rounded-m3-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
      </div>

      <!-- Diagram list -->
      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="loading" class="p-4 text-center text-secondary-600">
          Loading diagrams...
        </div>
        
        <div v-else-if="error" class="p-4">
          <div class="bg-error-50 border border-error-200 rounded-m3-md p-3">
            <p class="text-sm text-error-800">{{ error }}</p>
          </div>
        </div>
        
        <div v-else-if="filteredDiagrams.length === 0" class="p-4 text-center text-secondary-600">
          <p v-if="searchQuery">No diagrams match your search.</p>
          <p v-else>No C4 diagrams found.</p>
          <p class="text-xs mt-2">Add diagrams to <code class="px-1 py-0.5 bg-surface-3 rounded-m3-md">context-repo/c4/</code></p>
        </div>
        
        <div v-else class="space-y-2">
          <button
            v-for="diagram in filteredDiagrams"
            :key="diagram.file"
            @click="selectDiagram(diagram)"
            class="w-full text-left p-3 rounded-m3-md border transition-all"
            :class="selectedDiagram?.file === diagram.file
              ? 'bg-primary-50 border-primary-300 shadow-elevation-1'
              : 'bg-surface border-surface-variant hover:bg-surface-2 hover:border-surface-variant'"
          >
            <div class="font-medium text-sm text-secondary-900">{{ diagram.title }}</div>
            <div class="flex items-center gap-2 mt-1 text-xs text-secondary-600">
              <span v-if="diagram.system" class="px-2 py-0.5 bg-surface-3 rounded-m3-md">{{ diagram.system }}</span>
              <span v-if="diagram.level" class="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-m3-md">{{ diagram.level }}</span>
            </div>
            <div v-if="diagram.feature" class="mt-1 text-xs text-primary-600">
              → {{ diagram.feature }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Main content: Diagram viewer -->
    <div class="flex-1 flex flex-col bg-surface">
      <div v-if="!selectedDiagram" class="flex-1 flex items-center justify-center text-secondary-600">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto mb-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>Select a diagram to view</p>
        </div>
      </div>
      
      <div v-else class="flex-1 flex flex-col overflow-hidden">
        <!-- Diagram header -->
        <div class="p-4 border-b border-surface-variant bg-surface-2">
          <h3 class="text-lg font-semibold text-primary-700 mb-2">{{ selectedDiagram.title }}</h3>
          
          <div class="flex items-center gap-3 text-sm">
            <div v-if="selectedDiagram.system" class="flex items-center gap-1">
              <span class="text-secondary-600">System:</span>
              <span class="font-medium text-secondary-900">{{ selectedDiagram.system }}</span>
            </div>
            <div v-if="selectedDiagram.level" class="flex items-center gap-1">
              <span class="text-secondary-600">Level:</span>
              <span class="font-medium text-primary-700">{{ selectedDiagram.level }}</span>
            </div>
          </div>
          
          <!-- Related entities -->
          <div v-if="selectedDiagram.feature" class="mt-3 flex items-center gap-2">
            <span class="text-xs text-secondary-600">Linked to:</span>
            <button
              @click="openRelatedEntity(selectedDiagram.feature)"
              class="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-m3-md hover:bg-primary-200 transition-colors"
            >
              {{ selectedDiagram.feature }}
            </button>
          </div>
        </div>

        <!-- Diagram content -->
        <div class="flex-1 overflow-auto p-6 bg-surface">
          <div 
            :id="`mermaid-${renderKey}`" 
            class="flex items-center justify-center min-h-full"
          />
        </div>

        <!-- Stats panel -->
        <div v-if="projectionStats" class="p-4 border-t border-surface-variant bg-surface-2">
          <div class="flex items-center gap-6 text-sm">
            <div>
              <span class="text-secondary-600">Nodes:</span>
              <span class="ml-1 font-medium text-secondary-900">{{ projectionStats.nodes }}</span>
            </div>
            <div>
              <span class="text-secondary-600">Relationships:</span>
              <span class="ml-1 font-medium text-secondary-900">{{ projectionStats.relationships }}</span>
            </div>
            <div v-for="(count, kind) in projectionStats.nodesByKind" :key="kind" class="flex items-center gap-1">
              <span class="px-2 py-0.5 bg-surface-3 rounded-m3-md text-xs text-secondary-700">{{ kind }}</span>
              <span class="text-secondary-700">{{ count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mermaid diagram styling */
#mermaid-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
