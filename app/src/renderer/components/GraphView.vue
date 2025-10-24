<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import cytoscape, { type Core, type NodeSingular, type EdgeSingular } from 'cytoscape';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

const graphContainer = ref<HTMLElement | null>(null);
const cy = ref<Core | null>(null);
const selectedNodes = ref<string[]>([]);
const searchQuery = ref('');
const layoutType = ref<'cose' | 'circle' | 'grid' | 'breadthfirst'>('cose');
const showLabels = ref(true);
const highlightedPath = ref<string[]>([]);
const selectedEntityId = ref<string | null>(null);
const showDetailPanel = ref(false);

// Entity type colors
const nodeColors = {
  feature: '#3B82F6',      // blue
  userstory: '#10B981',    // green
  spec: '#8B5CF6',         // purple
  task: '#F59E0B',         // orange
  service: '#EF4444',      // red
  package: '#EAB308'       // yellow
};

// Edge relationship colors
const edgeColors = {
  'has-story': '#10B981',
  'has-spec': '#8B5CF6',
  'has-task': '#F59E0B',
  'requires': '#EF4444',
  'produces': '#EAB308',
  'impacts': '#F97316',
  'uses': '#06B6D4',
  'implements': '#8B5CF6',
  'modifies': '#F59E0B',
  'depends-on': '#DC2626',
  'relates-to': '#9CA3AF'
};

const stats = computed(() => {
  if (!cy.value) return { nodes: 0, edges: 0 };
  return {
    nodes: cy.value.nodes().length,
    edges: cy.value.edges().length
  };
});

const selectedEntity = computed(() => {
  if (!selectedEntityId.value) return null;
  return contextStore.getEntity(selectedEntityId.value);
});

const selectedEntityConnections = computed(() => {
  if (!cy.value || !selectedEntityId.value) return { incoming: 0, outgoing: 0 };
  
  const node = cy.value.getElementById(selectedEntityId.value);
  if (!node.length) return { incoming: 0, outgoing: 0 };
  
  return {
    incoming: node.connectedEdges().filter(e => e.target().id() === selectedEntityId.value).length,
    outgoing: node.connectedEdges().filter(e => e.source().id() === selectedEntityId.value).length
  };
});

function initializeGraph() {
  if (!graphContainer.value || !contextStore.graph) return;

  const graphData = contextStore.graph;

  // Convert graph data to Cytoscape format
  const elements = [
    ...graphData.nodes.map(node => ({
      data: {
        id: node.id,
        label: node.id,
        type: node.kind,
        title: node.data.title || node.data.name || node.id,
        ...node.data
      }
    })),
    ...graphData.edges.map((edge, index) => ({
      data: {
        id: `edge-${index}`,
        source: edge.from,
        target: edge.to,
        relationship: edge.rel,
        label: edge.rel
      }
    }))
  ];

  cy.value = cytoscape({
    container: graphContainer.value,
    elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-color': (ele: NodeSingular) => nodeColors[ele.data('type') as keyof typeof nodeColors] || '#6B7280',
          'label': showLabels.value ? 'data(label)' : '',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'color': '#1F2937',
          'text-outline-width': 2,
          'text-outline-color': '#FFFFFF',
          'width': 40,
          'height': 40,
          'border-width': 2,
          'border-color': '#FFFFFF'
        }
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#1D4ED8',
          'background-color': (ele: NodeSingular) => {
            const color = nodeColors[ele.data('type') as keyof typeof nodeColors] || '#6B7280';
            return color;
          },
          'overlay-opacity': 0.2,
          'overlay-color': '#1D4ED8',
          'overlay-padding': 8
        }
      },
      {
        selector: 'node.highlighted',
        style: {
          'border-width': 4,
          'border-color': '#DC2626',
          'background-color': (ele: NodeSingular) => {
            const color = nodeColors[ele.data('type') as keyof typeof nodeColors] || '#6B7280';
            return color;
          }
        }
      },
      {
        selector: 'node.dimmed',
        style: {
          'opacity': 0.3
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': (ele: EdgeSingular) => edgeColors[ele.data('relationship') as keyof typeof edgeColors] || '#9CA3AF',
          'target-arrow-color': (ele: EdgeSingular) => edgeColors[ele.data('relationship') as keyof typeof edgeColors] || '#9CA3AF',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'label': '',
          'font-size': '8px',
          'text-rotation': 'autorotate',
          'text-margin-y': -8
        }
      },
      {
        selector: 'edge.highlighted',
        style: {
          'width': 4,
          'line-color': '#DC2626',
          'target-arrow-color': '#DC2626',
          'z-index': 999
        }
      },
      {
        selector: 'edge.dimmed',
        style: {
          'opacity': 0.2
        }
      }
    ],
    layout: {
      name: layoutType.value,
      animate: true,
      animationDuration: 500,
      padding: 50
    },
    minZoom: 0.1,
    maxZoom: 3
  });

  // Node click handler
  cy.value.on('tap', 'node', (evt) => {
    const node = evt.target;
    const nodeId = node.data('id');
    
    // Handle path highlighting mode
    if (selectedNodes.value.length < 2) {
      if (selectedNodes.value.includes(nodeId)) {
        selectedNodes.value = selectedNodes.value.filter(id => id !== nodeId);
      } else {
        selectedNodes.value.push(nodeId);
      }
      
      if (selectedNodes.value.length === 2) {
        highlightPath();
      }
    } else {
      // Reset selection
      selectedNodes.value = [nodeId];
      clearHighlights();
    }
  });

  // Double click to show details
  cy.value.on('dbltap', 'node', (evt) => {
    const node = evt.target;
    const nodeId = node.data('id');
    selectedEntityId.value = nodeId;
    showDetailPanel.value = true;
  });

  // Edge tap to show relationship
  cy.value.on('tap', 'edge', (evt) => {
    const edge = evt.target;
    console.log('Edge:', edge.data('relationship'), 'from', edge.data('source'), 'to', edge.data('target'));
  });
}

function highlightPath() {
  if (!cy.value || selectedNodes.value.length !== 2) return;

  const [sourceId, targetId] = selectedNodes.value;
  const source = cy.value.getElementById(sourceId);
  const target = cy.value.getElementById(targetId);

  if (!source.length || !target.length) return;

  // Use Dijkstra's algorithm to find shortest path
  const dijkstra = cy.value.elements().dijkstra({
    root: source,
    directed: true
  });

  const path = dijkstra.pathTo(target);
  
  if (path.length === 0) {
    alert(`No path found between ${sourceId} and ${targetId}`);
    return;
  }

  // Dim all elements
  cy.value.elements().addClass('dimmed');

  // Highlight path
  path.nodes().removeClass('dimmed').addClass('highlighted');
  path.edges().removeClass('dimmed').addClass('highlighted');

  highlightedPath.value = path.nodes().map(n => n.data('id'));
}

function clearHighlights() {
  if (!cy.value) return;
  
  cy.value.elements().removeClass('highlighted dimmed');
  highlightedPath.value = [];
}

function clearSelection() {
  selectedNodes.value = [];
  clearHighlights();
}

function runLayout() {
  if (!cy.value) return;
  
  cy.value.layout({
    name: layoutType.value,
    animate: true,
    animationDuration: 500,
    padding: 50
  }).run();
}

function fitToScreen() {
  if (!cy.value) return;
  cy.value.fit(undefined, 50);
}

function zoomIn() {
  if (!cy.value) return;
  cy.value.zoom(cy.value.zoom() * 1.2);
  cy.value.center();
}

function zoomOut() {
  if (!cy.value) return;
  cy.value.zoom(cy.value.zoom() * 0.8);
  cy.value.center();
}

function resetZoom() {
  if (!cy.value) return;
  cy.value.zoom(1);
  cy.value.center();
}

function searchNodes() {
  if (!cy.value) return;
  
  clearHighlights();
  
  if (!searchQuery.value) {
    return;
  }

  const query = searchQuery.value.toLowerCase();
  const matchingNodes = cy.value.nodes().filter(node => {
    const id = node.data('id').toLowerCase();
    const title = (node.data('title') || '').toLowerCase();
    return id.includes(query) || title.includes(query);
  });

  if (matchingNodes.length === 0) {
    return;
  }

  // Dim all, highlight matches
  cy.value.elements().addClass('dimmed');
  matchingNodes.removeClass('dimmed').addClass('highlighted');

  // Fit to highlighted nodes
  cy.value.fit(matchingNodes, 100);
}

function toggleLabels() {
  showLabels.value = !showLabels.value;
  if (!cy.value) return;
  
  cy.value.style().selector('node').style({
    'label': showLabels.value ? 'data(label)' : ''
  }).update();
}

function openInEditor() {
  if (selectedEntityId.value) {
    contextStore.setActiveEntity(selectedEntityId.value);
    showDetailPanel.value = false;
  }
}

function closeDetailPanel() {
  showDetailPanel.value = false;
  selectedEntityId.value = null;
}

watch(() => contextStore.graph, () => {
  if (graphContainer.value) {
    initializeGraph();
  }
}, { deep: true });

watch(layoutType, () => {
  runLayout();
});

onMounted(() => {
  if (contextStore.graph) {
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
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">Dependency Graph</h2>
        <p class="text-xs text-gray-600">{{ stats.nodes }} nodes, {{ stats.edges }} edges</p>
      </div>
      <button
        @click="fitToScreen"
        class="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
      >
        Fit to Screen
      </button>
    </div>

    <!-- Toolbar -->
    <div class="px-4 py-2 border-b border-gray-200 flex items-center gap-3 flex-wrap">
      <!-- Search -->
      <div class="flex-1 min-w-[200px]">
        <input
          v-model="searchQuery"
          @input="searchNodes"
          type="text"
          placeholder="Search nodes..."
          class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- Layout selector -->
      <select
        v-model="layoutType"
        class="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="cose">Force-Directed</option>
        <option value="circle">Circle</option>
        <option value="grid">Grid</option>
        <option value="breadthfirst">Hierarchical</option>
      </select>

      <!-- Controls -->
      <div class="flex gap-1">
        <button
          @click="zoomIn"
          class="p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="Zoom In"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>
        <button
          @click="zoomOut"
          class="p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="Zoom Out"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
          </svg>
        </button>
        <button
          @click="resetZoom"
          class="p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="Reset Zoom"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          @click="toggleLabels"
          class="p-1.5 hover:bg-gray-100 rounded transition-colors"
          :class="{ 'bg-blue-100 text-blue-600': showLabels }"
          title="Toggle Labels"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>
        <button
          v-if="selectedNodes.length > 0 || highlightedPath.length > 0"
          @click="clearSelection"
          class="px-2 py-1.5 text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 rounded transition-colors"
        >
          Clear ({{ selectedNodes.length }})
        </button>
      </div>
    </div>

    <!-- Legend -->
    <div class="px-4 py-2 border-b border-gray-200 flex items-center gap-4 text-xs flex-wrap">
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: nodeColors.feature }"></span>
        <span>Feature</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: nodeColors.userstory }"></span>
        <span>Story</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: nodeColors.spec }"></span>
        <span>Spec</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: nodeColors.task }"></span>
        <span>Task</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: nodeColors.service }"></span>
        <span>Service</span>
      </div>
      <div class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: nodeColors.package }"></span>
        <span>Package</span>
      </div>
      <div class="ml-4 text-gray-600">
        Click nodes to select • Double-click to view details • Select 2 nodes to find path
      </div>
    </div>

    <!-- Graph Container with Detail Panel -->
    <div class="flex-1 flex overflow-hidden">
      <div ref="graphContainer" class="flex-1 bg-gray-50" :class="{ 'w-2/3': showDetailPanel }"></div>
      
      <!-- Detail Panel -->
      <Transition name="slide">
        <div v-if="showDetailPanel && selectedEntity" class="w-1/3 border-l border-gray-200 bg-white overflow-y-auto">
          <div class="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <h3 class="font-semibold text-gray-900">Entity Details</h3>
            <button
              @click="closeDetailPanel"
              class="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="p-4 space-y-4">
            <!-- Entity Header -->
            <div class="flex items-start gap-3">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                :style="{ backgroundColor: nodeColors[selectedEntity._type as keyof typeof nodeColors] || '#6B7280' }"
              >
                <span class="text-white font-bold text-lg">{{ selectedEntity.id.substring(0, 2) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-lg font-bold text-gray-900 break-words">{{ selectedEntity.id }}</h4>
                <p class="text-sm text-gray-600 mt-1">{{ selectedEntity.title || selectedEntity.name || 'Untitled' }}</p>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="px-2 py-1 text-xs font-medium rounded capitalize"
                    :style="{
                      backgroundColor: nodeColors[selectedEntity._type as keyof typeof nodeColors] + '20',
                      color: nodeColors[selectedEntity._type as keyof typeof nodeColors]
                    }"
                  >
                    {{ selectedEntity._type }}
                  </span>
                  <span
                    v-if="selectedEntity.status"
                    class="px-2 py-1 text-xs font-medium rounded"
                    :class="{
                      'bg-green-100 text-green-800': selectedEntity.status === 'done',
                      'bg-yellow-100 text-yellow-800': selectedEntity.status === 'in-progress' || selectedEntity.status === 'doing',
                      'bg-blue-100 text-blue-800': selectedEntity.status === 'proposed' || selectedEntity.status === 'todo',
                      'bg-red-100 text-red-800': selectedEntity.status === 'blocked',
                      'bg-orange-100 text-orange-800': selectedEntity.status === 'needs-review'
                    }"
                  >
                    {{ selectedEntity.status }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Connections -->
            <div class="bg-gray-50 rounded-lg p-3">
              <h5 class="text-xs font-semibold text-gray-700 mb-2">Connections</h5>
              <div class="flex gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-blue-600">{{ selectedEntityConnections.incoming }}</div>
                  <div class="text-xs text-gray-600">Incoming</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-green-600">{{ selectedEntityConnections.outgoing }}</div>
                  <div class="text-xs text-gray-600">Outgoing</div>
                </div>
              </div>
            </div>

            <!-- Properties -->
            <div>
              <h5 class="text-xs font-semibold text-gray-700 mb-2">Properties</h5>
              <div class="space-y-2 text-sm">
                <div v-if="selectedEntity.domain" class="flex justify-between">
                  <span class="text-gray-600">Domain:</span>
                  <span class="text-gray-900 font-medium">{{ selectedEntity.domain }}</span>
                </div>
                <div v-if="selectedEntity.owner || selectedEntity.owners" class="flex justify-between">
                  <span class="text-gray-600">Owner:</span>
                  <span class="text-gray-900 font-medium">{{ selectedEntity.owner || selectedEntity.owners?.join(', ') }}</span>
                </div>
                <div v-if="selectedEntity.version" class="flex justify-between">
                  <span class="text-gray-600">Version:</span>
                  <span class="text-gray-900 font-medium font-mono">{{ selectedEntity.version }}</span>
                </div>
              </div>
            </div>

            <!-- Description/Objective -->
            <div v-if="selectedEntity.objective || selectedEntity.iWant || selectedEntity.content">
              <h5 class="text-xs font-semibold text-gray-700 mb-2">Description</h5>
              <p class="text-sm text-gray-700 whitespace-pre-wrap">
                {{ selectedEntity.objective || selectedEntity.iWant || selectedEntity.content }}
              </p>
            </div>

            <!-- Related Entities -->
            <div v-if="selectedEntity.userStories || selectedEntity.specs || selectedEntity.tasks || selectedEntity.requires || selectedEntity.produces">
              <h5 class="text-xs font-semibold text-gray-700 mb-2">Related Entities</h5>
              <div class="space-y-2">
                <div v-if="selectedEntity.userStories" class="text-sm">
                  <span class="text-gray-600">Stories:</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span
                      v-for="id in selectedEntity.userStories"
                      :key="id"
                      class="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-mono"
                    >
                      {{ id }}
                    </span>
                  </div>
                </div>
                <div v-if="selectedEntity.specs" class="text-sm">
                  <span class="text-gray-600">Specs:</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span
                      v-for="id in selectedEntity.specs"
                      :key="id"
                      class="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-mono"
                    >
                      {{ id }}
                    </span>
                  </div>
                </div>
                <div v-if="selectedEntity.tasks" class="text-sm">
                  <span class="text-gray-600">Tasks:</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span
                      v-for="id in selectedEntity.tasks"
                      :key="id"
                      class="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-mono"
                    >
                      {{ id }}
                    </span>
                  </div>
                </div>
                <div v-if="selectedEntity.requires" class="text-sm">
                  <span class="text-gray-600">Requires:</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span
                      v-for="id in selectedEntity.requires"
                      :key="id"
                      class="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-mono"
                    >
                      {{ id }}
                    </span>
                  </div>
                </div>
                <div v-if="selectedEntity.produces" class="text-sm">
                  <span class="text-gray-600">Produces:</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <span
                      v-for="id in selectedEntity.produces"
                      :key="id"
                      class="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-mono"
                    >
                      {{ id }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="pt-4 border-t border-gray-200 space-y-2">
              <button
                @click="openInEditor"
                class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Open in Editor
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Path Info -->
    <div v-if="highlightedPath.length > 0" class="px-4 py-2 bg-blue-50 border-t border-blue-200">
      <div class="text-sm font-medium text-blue-900 mb-1">Path Found:</div>
      <div class="text-xs text-blue-700">
        {{ highlightedPath.join(' → ') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Cytoscape container needs explicit height */

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
