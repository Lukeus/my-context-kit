import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * Context Tree Store
 * 
 * Manages persistent expansion state for the context tree UI.
 * Maintains expanded node IDs independently of assistant visibility or view mode.
 * 
 * Usage:
 * - Call toggleNode(id) when user clicks to expand/collapse
 * - Use isNodeExpanded(id) to check current state
 * - State persists across assistant open/close and view mode changes
 * 
 * Future enhancements:
 * - Persist to localStorage for session continuity
 * - Add bulk expand/collapse operations
 * - Support nested expansion state tracking
 */
export const useContextTreeStore = defineStore('contextTree', () => {
  // State: Array of currently expanded node IDs
  const expandedNodeIds = ref<Set<string>>(new Set());
  
  // State: Default expansion behavior
  const autoExpandDepth = ref<number>(1); // Auto-expand first level by default
  const rememberExpansionState = ref<boolean>(true);

  // Computed: Get expansion state as array for serialization
  const expandedNodesArray = computed(() => Array.from(expandedNodeIds.value));
  
  // Computed: Check if any nodes are expanded
  const hasExpandedNodes = computed(() => expandedNodeIds.value.size > 0);

  // Actions
  function expandNode(nodeId: string): void {
    expandedNodeIds.value.add(nodeId);
  }

  function collapseNode(nodeId: string): void {
    expandedNodeIds.value.delete(nodeId);
  }

  function toggleNode(nodeId: string): boolean {
    const wasExpanded = expandedNodeIds.value.has(nodeId);
    if (wasExpanded) {
      collapseNode(nodeId);
    } else {
      expandNode(nodeId);
    }
    return !wasExpanded; // Return new state
  }

  function isNodeExpanded(nodeId: string): boolean {
    return expandedNodeIds.value.has(nodeId);
  }

  function expandMultiple(nodeIds: string[]): void {
    nodeIds.forEach(id => expandedNodeIds.value.add(id));
  }

  function collapseMultiple(nodeIds: string[]): void {
    nodeIds.forEach(id => expandedNodeIds.value.delete(id));
  }

  function expandAll(nodeIds: string[]): void {
    expandedNodeIds.value.clear();
    expandMultiple(nodeIds);
  }

  function collapseAll(): void {
    expandedNodeIds.value.clear();
  }

  function setAutoExpandDepth(depth: number): void {
    autoExpandDepth.value = Math.max(0, depth);
  }

  function setRememberExpansionState(remember: boolean): void {
    rememberExpansionState.value = remember;
    if (!remember) {
      expandedNodeIds.value.clear();
    }
  }

  // Initialize with auto-expand behavior
  function initializeWithNodes(allNodeIds: string[], nodeDepths?: Record<string, number>): void {
    if (!rememberExpansionState.value) return;
    
    if (nodeDepths && autoExpandDepth.value > 0) {
      // Auto-expand nodes up to specified depth
      const nodesToExpand = Object.entries(nodeDepths)
        .filter(([, depth]) => depth <= autoExpandDepth.value)
        .map(([nodeId]) => nodeId);
      expandMultiple(nodesToExpand);
    }
  }

  // Persistence (future enhancement)
  function saveToStorage(): void {
    if (typeof localStorage !== 'undefined' && rememberExpansionState.value) {
      localStorage.setItem('contextTree.expandedNodes', JSON.stringify(expandedNodesArray.value));
      localStorage.setItem('contextTree.autoExpandDepth', String(autoExpandDepth.value));
    }
  }

  function loadFromStorage(): void {
    if (typeof localStorage !== 'undefined' && rememberExpansionState.value) {
      try {
        const stored = localStorage.getItem('contextTree.expandedNodes');
        if (stored) {
          const nodeIds = JSON.parse(stored) as string[];
          expandedNodeIds.value = new Set(nodeIds);
        }
        
        const storedDepth = localStorage.getItem('contextTree.autoExpandDepth');
        if (storedDepth) {
          autoExpandDepth.value = parseInt(storedDepth, 10) || 1;
        }
      } catch (error) {
        console.warn('Failed to load context tree state from storage:', error);
      }
    }
  }

  // Export store interface
  return {
    // State
    expandedNodeIds: expandedNodesArray,
    autoExpandDepth,
    rememberExpansionState,
    
    // Computed
    hasExpandedNodes,
    
    // Actions
    expandNode,
    collapseNode,
    toggleNode,
    isNodeExpanded,
    expandMultiple,
    collapseMultiple,
    expandAll,
    collapseAll,
    setAutoExpandDepth,
    setRememberExpansionState,
    initializeWithNodes,
    saveToStorage,
    loadFromStorage
  };
});