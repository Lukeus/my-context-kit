<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import mermaid from 'mermaid';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();
const renderKey = ref(0);
const error = ref<string | null>(null);

const activeEntity = computed(() => contextStore.activeEntity);
const diagramContent = computed(() => activeEntity.value?.content || '');
const diagramTitle = computed(() => activeEntity.value?.title || 'Untitled Diagram');
const diagramSystem = computed(() => activeEntity.value?.system);
const diagramLevel = computed(() => activeEntity.value?.level);
const diagramFeature = computed(() => activeEntity.value?.feature);
const diagramProjection = computed(() => activeEntity.value?.projection);

const projectionStats = computed(() => {
  if (!diagramProjection.value) return null;
  
  const proj = diagramProjection.value;
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

  await renderDiagram();
});

async function renderDiagram() {
  if (!diagramContent.value) return;
  
  error.value = null;
  renderKey.value++;
  
  // Wait for DOM update
  await new Promise(resolve => setTimeout(resolve, 50));
  
  try {
    const containerId = `mermaid-${renderKey.value}`;
    const container = document.getElementById(containerId);
    
    if (!container) {
      return;
    }
    
    // Clean content of invisible characters before rendering
    const cleanContent = diagramContent.value
      .replace(/\u200B/g, '') // Zero-width space
      .replace(/\uFEFF/g, '') // BOM
      .replace(/\u00A0/g, ' ') // Non-breaking space
      .replace(/[\u2000-\u200F\u2028-\u202F]/g, '') // Other invisible unicode
      .trim();
    
    const { svg } = await mermaid.render(`mermaid-svg-${renderKey.value}`, cleanContent);
    container.innerHTML = svg;
  } catch {
    error.value = 'Failed to render diagram';
  }
}

function openRelatedEntity(entityId: string) {
  contextStore.setActiveEntity(entityId);
}

watch(() => activeEntity.value, async () => {
  if (activeEntity.value?._type === 'c4diagram') {
    await renderDiagram();
  }
});
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-surface">
    <div v-if="!activeEntity" class="flex-1 flex items-center justify-center text-secondary-600">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto mb-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p>Select a C4 diagram from the tree to view</p>
      </div>
    </div>
    
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <!-- Diagram header -->
      <div class="p-4 border-b border-surface-variant bg-surface-2">
        <h3 class="text-lg font-semibold text-primary-700 mb-2">{{ diagramTitle }}</h3>
        
        <div class="flex items-center gap-3 text-sm">
          <div v-if="diagramSystem" class="flex items-center gap-1">
            <span class="text-secondary-600">System:</span>
            <span class="font-medium text-secondary-900">{{ diagramSystem }}</span>
          </div>
          <div v-if="diagramLevel" class="flex items-center gap-1">
            <span class="text-secondary-600">Level:</span>
            <span class="font-medium text-primary-700">{{ diagramLevel }}</span>
          </div>
        </div>
        
        <!-- Related entities -->
        <div v-if="diagramFeature" class="mt-3 flex items-center gap-2">
          <span class="text-xs text-secondary-600">Linked to:</span>
          <button
            @click="openRelatedEntity(diagramFeature)"
            class="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-m3-md hover:bg-primary-200 transition-colors"
          >
            {{ diagramFeature }}
          </button>
        </div>
      </div>

      <!-- Error display -->
      <div v-if="error" class="p-4 bg-error-50 border-b border-error-200">
        <p class="text-sm text-error-800">{{ error }}</p>
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
</template>

<style scoped>
/* Mermaid diagram styling */
:deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
