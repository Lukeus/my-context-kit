import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface Entity {
  id: string;
  _type: string;
  title?: string;
  name?: string;
  status?: string;
  [key: string]: any;
}

interface Graph {
  nodes: Array<{
    id: string;
    kind: string;
    data: Entity;
  }>;
  edges: Array<{
    from: string;
    to: string;
    rel: string;
  }>;
  stats?: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByRel: Record<string, number>;
  };
}

export const useContextStore = defineStore('context', () => {
  // State
  const repoPath = ref('C:\\Users\\lukeu\\source\\repos\\my-context-kit\\context-repo');
  const entities = ref<Record<string, Entity>>({});
  const graph = ref<Graph | null>(null);
  const activeEntityId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const activeEntity = computed(() => {
    if (!activeEntityId.value) return null;
    return entities.value[activeEntityId.value] || null;
  });

  const entitiesByType = computed(() => {
    const grouped: Record<string, Entity[]> = {
      feature: [],
      userstory: [],
      spec: [],
      task: [],
      service: [],
      package: []
    };

    Object.values(entities.value).forEach(entity => {
      const type = entity._type;
      if (grouped[type]) {
        grouped[type].push(entity);
      }
    });

    // Sort each group by ID
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    });

    return grouped;
  });

  const entityCount = computed(() => {
    return Object.keys(entities.value).length;
  });

  // Actions
  async function setRepoPath(path: string) {
    repoPath.value = path;
  }

  async function loadGraph() {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.context.buildGraph(repoPath.value);
      
      if (result.error) {
        error.value = result.error;
        return false;
      }

      graph.value = result;

      // Extract entities from graph nodes
      const newEntities: Record<string, Entity> = {};
      if (result.nodes) {
        result.nodes.forEach((node: any) => {
          // Map 'kind' from graph to '_type' for entity
          newEntities[node.id] = {
            ...node.data,
            _type: node.kind
          };
        });
      }
      entities.value = newEntities;

      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to load graph';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function validateRepo() {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.context.validate(repoPath.value);
      
      if (!result.ok) {
        error.value = result.error || 'Validation failed';
        return result;
      }

      return result;
    } catch (err: any) {
      error.value = err.message || 'Failed to validate repository';
      return { ok: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  }

  function setActiveEntity(entityId: string | null) {
    activeEntityId.value = entityId;
  }

  function getEntity(entityId: string): Entity | null {
    return entities.value[entityId] || null;
  }

  function clearError() {
    error.value = null;
  }

  return {
    // State
    repoPath,
    entities,
    graph,
    activeEntityId,
    isLoading,
    error,
    // Computed
    activeEntity,
    entitiesByType,
    entityCount,
    // Actions
    setRepoPath,
    loadGraph,
    validateRepo,
    setActiveEntity,
    getEntity,
    clearError
  };
});
