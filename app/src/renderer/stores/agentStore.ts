/**
 * Agent Store
 * 
 * Manages agent profiles, selection, and filtering in the renderer process
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useContextStore } from './contextStore';
import type { 
  AgentProfile, 
  AgentSearchCriteria, 
  AgentCapabilityTag,
  AgentComplexity 
} from '@shared/agents/types';

/**
 * Agent store for managing AI agent profiles
 */
export const useAgentStore = defineStore('agent', () => {
  // Dependencies
  const contextStore = useContextStore();

  // State
  const availableAgents = ref<AgentProfile[]>([]);
  const selectedAgentId = ref<string | null>('context-assistant'); // Default to Context Assistant
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const lastLoaded = ref<string | null>(null);

  // Computed
  const selectedAgent = computed<AgentProfile | null>(() => 
    availableAgents.value.find(a => a.id === selectedAgentId.value) ?? null
  );

  const builtInAgents = computed(() => 
    availableAgents.value.filter(a => a.metadata.isBuiltIn === true)
  );

  const customAgents = computed(() => 
    availableAgents.value.filter(a => a.metadata.isBuiltIn !== true)
  );

  const hasAgents = computed(() => availableAgents.value.length > 0);

  const hasCustomAgents = computed(() => customAgents.value.length > 0);

  /**
   * Get agents by capability tag
   */
  function getAgentsByTag(tag: AgentCapabilityTag): AgentProfile[] {
    return availableAgents.value.filter(agent =>
      agent.metadata.tags.includes(tag)
    );
  }

  /**
   * Get agents by complexity level
   */
  function getAgentsByComplexity(complexity: AgentComplexity): AgentProfile[] {
    return availableAgents.value.filter(agent =>
      agent.metadata.complexity === complexity
    );
  }

  /**
   * Filter agents based on search criteria
   */
  function filterAgents(criteria: AgentSearchCriteria): AgentProfile[] {
    let filtered = [...availableAgents.value];

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      filtered = filtered.filter(agent =>
        criteria.tags!.some(tag => agent.metadata.tags.includes(tag))
      );
    }

    // Filter by complexity
    if (criteria.complexity) {
      filtered = filtered.filter(agent =>
        agent.metadata.complexity === criteria.complexity
      );
    }

    // Filter by provider compatibility
    if (criteria.provider) {
      filtered = filtered.filter(agent =>
        !agent.providers || agent.providers.includes(criteria.provider!)
      );
    }

    // Filter by search query
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.metadata.name.toLowerCase().includes(query) ||
        agent.metadata.description.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query)
      );
    }

    // Filter built-in only
    if (criteria.builtInOnly === true) {
      filtered = filtered.filter(agent => agent.metadata.isBuiltIn === true);
    }

    return filtered;
  }

  /**
   * Load agents from repository
   */
  async function loadAgents(forceReload = false): Promise<void> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set. Configure a context repository first.';
      return;
    }

    // Skip if already loaded recently (unless forced)
    if (!forceReload && lastLoaded.value && availableAgents.value.length > 0) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.agent.listAgents(repoPath);

      if (!result.ok) {
        throw new Error(result.error || 'Failed to load agents');
      }

      availableAgents.value = result.agents || [];
      lastLoaded.value = new Date().toISOString();

      // Ensure selected agent is still valid
      if (selectedAgentId.value) {
        const exists = availableAgents.value.some(a => a.id === selectedAgentId.value);
        if (!exists) {
          // Fall back to default agent
          selectedAgentId.value = 'context-assistant';
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load agents';
      error.value = message;
      console.error('Failed to load agents:', err);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get agent by ID
   */
  async function getAgent(agentId: string): Promise<AgentProfile | null> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return null;
    }

    // Check if agent is already in memory
    const cached = availableAgents.value.find(a => a.id === agentId);
    if (cached) {
      return cached;
    }

    // Fetch from backend
    try {
      const result = await window.api.agent.getAgent(repoPath, agentId);
      if (!result.ok || !result.agent) {
        error.value = result.error || 'Agent not found';
        return null;
      }

      return result.agent;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get agent';
      error.value = message;
      return null;
    }
  }

  /**
   * Select agent by ID
   */
  async function selectAgent(agentId: string): Promise<void> {
    // Validate agent exists
    const agent = await getAgent(agentId);
    if (!agent) {
      error.value = `Agent '${agentId}' not found`;
      return;
    }

    selectedAgentId.value = agentId;
    error.value = null;
  }

  /**
   * Create new custom agent
   */
  async function createAgent(agent: AgentProfile): Promise<boolean> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.agent.createAgent(repoPath, agent);

      if (!result.ok) {
        throw new Error(result.error || 'Failed to create agent');
      }

      // Reload agents to include new one
      await loadAgents(true);

      // Select the newly created agent
      selectedAgentId.value = agent.id;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create agent';
      error.value = message;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Update existing agent
   */
  async function updateAgent(agent: AgentProfile): Promise<boolean> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.agent.updateAgent(repoPath, agent);

      if (!result.ok) {
        throw new Error(result.error || 'Failed to update agent');
      }

      // Reload agents to reflect changes
      await loadAgents(true);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update agent';
      error.value = message;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Delete custom agent
   */
  async function deleteAgent(agentId: string): Promise<boolean> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.agent.deleteAgent(repoPath, agentId);

      if (!result.ok) {
        throw new Error(result.error || 'Failed to delete agent');
      }

      // If deleted agent was selected, fall back to default
      if (selectedAgentId.value === agentId) {
        selectedAgentId.value = 'context-assistant';
      }

      // Reload agents
      await loadAgents(true);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete agent';
      error.value = message;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Validate agent profile
   */
  async function validateAgent(agent: AgentProfile): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const result = await window.api.agent.validateAgent(agent);

      if (!result.ok) {
        return {
          valid: false,
          errors: result.error ? [result.error] : ['Validation failed']
        };
      }

      return {
        valid: true,
        errors: []
      };
    } catch (err) {
      return {
        valid: false,
        errors: [err instanceof Error ? err.message : 'Validation failed']
      };
    }
  }

  /**
   * Export agent to JSON string
   */
  async function exportAgent(agent: AgentProfile): Promise<string | null> {
    try {
      const result = await window.api.agent.exportAgent(agent);

      if (!result.ok || !result.json) {
        error.value = result.error || 'Export failed';
        return null;
      }

      return result.json;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Export failed';
      return null;
    }
  }

  /**
   * Import agent from JSON string
   */
  async function importAgent(json: string): Promise<AgentProfile | null> {
    try {
      const result = await window.api.agent.importAgent(json);

      if (!result.ok || !result.agent) {
        error.value = result.error || 'Import failed';
        return null;
      }

      return result.agent;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Import failed';
      return null;
    }
  }

  /**
   * Clear error message
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Reset store state
   */
  function reset(): void {
    availableAgents.value = [];
    selectedAgentId.value = 'context-assistant';
    isLoading.value = false;
    error.value = null;
    lastLoaded.value = null;
  }

  // ===== Git Sync Operations =====

  /**
   * Get agent sync status
   */
  async function getSyncStatus(): Promise<any> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return null;
    }

    try {
      const result = await window.api.agent.getSyncStatus(repoPath);
      if (!result.ok) {
        error.value = result.error || 'Failed to get sync status';
        return null;
      }
      return result.status;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get sync status';
      error.value = message;
      return null;
    }
  }

  /**
   * Pull agents from remote
   */
  async function pullAgents(options?: { remote?: string; branch?: string }): Promise<boolean> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.agent.pullAgents(repoPath, options);
      
      if (!result.success) {
        error.value = result.message;
        return false;
      }

      // Reload agents to reflect pulled changes
      await loadAgents(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pull agents';
      error.value = message;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Push agents to remote
   */
  async function pushAgents(message: string, options?: { remote?: string; branch?: string }): Promise<boolean> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return false;
    }

    if (!message || !message.trim()) {
      error.value = 'Commit message is required';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.agent.pushAgents(repoPath, {
        message,
        ...options
      });
      
      if (!result.success) {
        error.value = result.message;
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to push agents';
      error.value = message;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Sync agents (pull then push)
   */
  async function syncAgents(commitMessage?: string, options?: { remote?: string; branch?: string }): Promise<boolean> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      error.value = 'No repository path set';
      return false;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.api.agent.syncAgents(repoPath, {
        commitMessage,
        ...options
      });
      
      if (!result.success) {
        error.value = result.message;
        return false;
      }

      // Reload agents to reflect synced changes
      await loadAgents(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync agents';
      error.value = message;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Check if repository has remote configured
   */
  async function hasRemote(): Promise<boolean> {
    const repoPath = contextStore.repoPath;
    if (!repoPath) {
      return false;
    }

    try {
      const result = await window.api.agent.hasRemote(repoPath);
      return result.ok && result.hasRemote === true;
    } catch {
      return false;
    }
  }

  return {
    // State
    availableAgents,
    selectedAgentId,
    isLoading,
    error,
    lastLoaded,

    // Computed
    selectedAgent,
    builtInAgents,
    customAgents,
    hasAgents,
    hasCustomAgents,

    // Actions
    loadAgents,
    getAgent,
    selectAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    validateAgent,
    exportAgent,
    importAgent,
    filterAgents,
    getAgentsByTag,
    getAgentsByComplexity,
    clearError,
    reset,

    // Sync Actions
    getSyncStatus,
    pullAgents,
    pushAgents,
    syncAgents,
    hasRemote
  };
});
