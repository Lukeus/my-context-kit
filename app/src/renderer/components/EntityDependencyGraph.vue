<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import cytoscape, { type Core, type NodeSingular, type EdgeSingular } from 'cytoscape';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

const graphContainer = ref<HTMLElement | null>(null);
const cy = ref<Core | null>(null);
const layoutType = ref<'cose' | 'circle' | 'breadthfirst'>('breadthfirst');

// Entity type colors - Material 3 theme
const nodeColors = {
  governance: '#1E40AF',    // blue-800
  feature: '#2563EB',       // blue-600
  userstory: '#059669',     // green-600
  spec: '#7C3AED',          // purple-600
  task: '#EA580C',          // orange-600
  service: '#DC2626',       // red-600
  package: '#CA8A04'        // yellow-600
};

// Edge relationship colors
const edgeColors = {
  'has-story': '#059669',
  'has-spec': '#7C3AED',
  'has-task': '#EA580C',
  'requires': '#DC2626',
  'produces': '#CA8A04',
  'impacts': '#F97316',
  'uses': '#06B6D4',
  'implements': '#7C3AED',
  'modifies': '#EA580C',
  'depends-on': '#DC2626',
  'relates-to': '#6B7280',
  'governs': '#1E40AF'
};

const activeEntityId = computed(() => contextStore.activeEntityId);
const activeEntity = computed(() => contextStore.activeEntity);

const relatedEntities = computed(() => {
  if (!cy.value || !activeEntityId.value) return { incoming: 0, outgoing: 0, total: 0 };
  
  const node = cy.value.getElementById(activeEntityId.value);
  if (!node.length) return { incoming: 0, outgoing: 0, total: 0 };
  
  const incoming = node.connectedEdges().filter(e => e.target().id() === activeEntityId.value).length;
  const outgoing = node.connectedEdges().filter(e => e.source().id() === activeEntityId.value).length;
  
  return {
    incoming,
    outgoing,
    total: incoming + outgoing
  };
});

function getRelatedNodes(entityId: string) {
  if (!contextStore.graph) return { nodeIds: new Set<string>(), edges: [] };
  
  const nodeIds = new Set<string>();
  const edges = [];
  
  // Find the constitution entity
  const constitutionNode = contextStore.graph.nodes.find(node => node.kind === 'governance');
  
  // If viewing the constitution, show ALL entities
  if (constitutionNode && entityId === constitutionNode.id) {
    // Add all nodes
    contextStore.graph.nodes.forEach(node => {
      nodeIds.add(node.id);
    });
    
    // Add all edges
    contextStore.graph.edges.forEach(edge => {
      edges.push(edge);
    });
    
    // Add implicit governance edges for entities without direct constitution connection
    contextStore.graph.nodes.forEach(node => {
      if (node.id !== constitutionNode.id) {
        const hasDirectConstitutionEdge = edges.some(
          e => (e.from === constitutionNode.id && e.to === node.id) || 
               (e.from === node.id && e.to === constitutionNode.id)
        );
        
        if (!hasDirectConstitutionEdge) {
          edges.push({
            from: constitutionNode.id,
            to: node.id,
            rel: 'governs'
          });
        }
      }
    });
    
    return { nodeIds, edges };
  }
  
  // For non-constitution entities, show only related nodes
  nodeIds.add(entityId); // Include the central entity
  
  // Always include constitution
  if (constitutionNode) {
    nodeIds.add(constitutionNode.id);
  }
  
  // Find all edges connected to this entity
  for (const edge of contextStore.graph.edges) {
    if (edge.from === entityId || edge.to === entityId) {
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
      edges.push(edge);
    }
  }
  
  // If constitution exists and current entity is not the constitution, add implicit governance edge
  if (constitutionNode && entityId !== constitutionNode.id) {
    // Check if there's already a direct edge to constitution
    const hasDirectConstitutionEdge = edges.some(
      e => (e.from === constitutionNode.id && e.to === entityId) || 
           (e.from === entityId && e.to === constitutionNode.id)
    );
    
    // If no direct edge exists, add an implicit "governed-by" relationship
    if (!hasDirectConstitutionEdge) {
      edges.push({
        from: constitutionNode.id,
        to: entityId,
        rel: 'governs'
      });
    }
  }
  
  return { nodeIds, edges };
}

function initializeGraph() {
  if (!graphContainer.value || !contextStore.graph || !activeEntityId.value) return;

  const graphData = contextStore.graph;
  const { nodeIds, edges } = getRelatedNodes(activeEntityId.value);
  
  // Filter nodes to only those related to the active entity
  const relatedNodes = graphData.nodes.filter(node => nodeIds.has(node.id));
  
  // Convert to Cytoscape format
  const elements = [
    ...relatedNodes.map(node => ({
      data: {
        id: node.id,
        label: node.id,
        type: node.kind,
        title: node.data.title || node.data.name || node.id,
        ...node.data
      }
    })),
    ...edges.map((edge, index) => ({
      data: {
        id: `edge-${index}`,
        source: edge.from,
        target: edge.to,
        relationship: edge.rel,
        label: edge.rel
      }
    }))
  ];

  // Destroy existing graph if present
  if (cy.value) {
    cy.value.destroy();
  }

  cy.value = cytoscape({
    container: graphContainer.value,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': (ele: NodeSingular) => {
            const type = ele.data('type') as keyof typeof nodeColors;
            return nodeColors[type] || '#6B7280';
          },
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '11px',
          'font-weight': '600',
          'color': '#1F2937',
          'text-outline-width': 3,
          'text-outline-color': '#FFFFFF',
          'width': 50,
          'height': 50,
          'border-width': 3,
          'border-color': '#FFFFFF'
        }
      },
      {
        selector: `node[id="${activeEntityId.value}"]`,
        style: {
          'border-width': 5,
          'border-color': '#1D4ED8',
          'width': 60,
          'height': 60,
          'font-size': '12px',
          'font-weight': 'bold',
          'overlay-opacity': 0.2,
          'overlay-color': '#1D4ED8',
          'overlay-padding': 10
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#7C3AED'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': (ele: EdgeSingular) => {
            const rel = ele.data('relationship') as keyof typeof edgeColors;
            return edgeColors[rel] || '#9CA3AF';
          },
          'target-arrow-color': (ele: EdgeSingular) => {
            const rel = ele.data('relationship') as keyof typeof edgeColors;
            return edgeColors[rel] || '#9CA3AF';
          },
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': 'data(relationship)',
          'font-size': '9px',
          'text-rotation': 'autorotate',
          'text-margin-y': -10,
          'color': '#4B5563',
          'text-outline-width': 2,
          'text-outline-color': '#FFFFFF'
        }
      }
    ],
    layout: {
      name: layoutType.value,
      animate: true,
      animationDuration: 500,
      padding: 60,
      directed: true,
      roots: `#${activeEntityId.value}`,
      spacingFactor: 1.5
    },
    minZoom: 0.3,
    maxZoom: 3
  });

  // Click handler to select entities
  cy.value.on('tap', 'node', (evt) => {
    const node = evt.target;
    const nodeId = node.data('id');
    contextStore.setActiveEntity(nodeId);
  });

  // Fit the graph to view
  setTimeout(() => {
    if (cy.value) {
      cy.value.fit(undefined, 50);
    }
  }, 100);
}

function changeLayout(newLayout: 'cose' | 'circle' | 'breadthfirst') {
  layoutType.value = newLayout;
  if (cy.value) {
    cy.value.layout({
      name: newLayout,
      animate: true,
      animationDuration: 500,
      padding: 60,
      directed: true,
      roots: `#${activeEntityId.value}`,
      spacingFactor: 1.5
    }).run();
  }
}

function fitGraph() {
  if (cy.value) {
    cy.value.fit(undefined, 50);
  }
}

function centerOnActive() {
  if (cy.value && activeEntityId.value) {
    const node = cy.value.getElementById(activeEntityId.value);
    if (node.length) {
      cy.value.animate({
        center: { eles: node },
        zoom: 1.5
      }, {
        duration: 500
      });
    }
  }
}

// Watch for entity changes
watch(activeEntityId, () => {
  if (activeEntityId.value) {
    initializeGraph();
  }
});

// Watch for graph changes
watch(() => contextStore.graph, () => {
  if (activeEntityId.value) {
    initializeGraph();
  }
});

onMounted(() => {
  if (activeEntityId.value) {
    initializeGraph();
  }
});

onBeforeUnmount(() => {
  if (cy.value) {
    cy.value.destroy();
  }
});
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Header -->
    <div class="border-b border-surface-variant bg-surface-1 px-4 py-3">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-secondary-900">Dependency Graph</h3>
          <p v-if="activeEntity" class="text-xs text-secondary-600 mt-0.5">
            Showing {{ relatedEntities.total }} related entities for <span class="font-mono font-semibold">{{ activeEntityId }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 bg-surface-2 border border-surface-variant rounded-m3-lg p-1">
            <button
              @click="changeLayout('breadthfirst')"
              :class="layoutType === 'breadthfirst' ? 'bg-primary-600 text-white' : 'text-secondary-700 hover:bg-surface-3'"
              class="px-2.5 py-1 text-xs font-medium rounded-m3-md transition-colors"
              title="Hierarchical Layout"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </button>
            <button
              @click="changeLayout('cose')"
              :class="layoutType === 'cose' ? 'bg-primary-600 text-white' : 'text-secondary-700 hover:bg-surface-3'"
              class="px-2.5 py-1 text-xs font-medium rounded-m3-md transition-colors"
              title="Force-Directed Layout"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              @click="changeLayout('circle')"
              :class="layoutType === 'circle' ? 'bg-primary-600 text-white' : 'text-secondary-700 hover:bg-surface-3'"
              class="px-2.5 py-1 text-xs font-medium rounded-m3-md transition-colors"
              title="Circular Layout"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <button
            @click="centerOnActive"
            class="px-3 py-1.5 text-xs font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 transition-colors"
            title="Center on active entity"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
            </svg>
          </button>
          <button
            @click="fitGraph"
            class="px-3 py-1.5 text-xs font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 transition-colors"
            title="Fit to view"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Graph Container -->
    <div class="flex-1 relative">
      <div v-if="!activeEntityId" class="absolute inset-0 flex items-center justify-center bg-surface-1">
        <div class="text-center">
          <svg class="w-16 h-16 text-secondary-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <p class="text-sm text-secondary-600">Select an entity to view its dependency graph</p>
        </div>
      </div>
      <div v-else-if="relatedEntities.total === 0" class="absolute inset-0 flex items-center justify-center bg-surface-1">
        <div class="text-center">
          <svg class="w-16 h-16 text-secondary-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p class="text-sm font-semibold text-secondary-900 mb-1">No Dependencies Found</p>
          <p class="text-xs text-secondary-600">This entity has no related entities</p>
        </div>
      </div>
      <div ref="graphContainer" class="w-full h-full"></div>
    </div>

    <!-- Stats Footer -->
    <div v-if="activeEntityId && relatedEntities.total > 0" class="border-t border-surface-variant bg-surface-1 px-4 py-2.5">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <div class="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            <span class="text-secondary-700">{{ relatedEntities.incoming }} incoming</span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
            <span class="text-secondary-700">{{ relatedEntities.outgoing }} outgoing</span>
          </div>
        </div>
        <span class="text-secondary-600 font-medium">{{ relatedEntities.total }} total relationships</span>
      </div>
    </div>
  </div>
</template>
