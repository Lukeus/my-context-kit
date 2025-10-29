/**
 * Agent Bridge for Preload Context
 * 
 * Exposes agent management API to renderer process via context isolation
 */

import { ipcRenderer } from 'electron';
import type { AgentProfile, AgentSearchCriteria, AgentOperationResult } from '@shared/agents/types';

/**
 * Agent management API for renderer process
 */
export const agentBridge = {
  /**
   * List all available agents (built-in + custom)
   */
  listAgents: (repoPath: string, criteria?: AgentSearchCriteria): Promise<AgentOperationResult> => {
    return ipcRenderer.invoke('agent:list', repoPath, criteria);
  },

  /**
   * Get specific agent by ID
   */
  getAgent: (repoPath: string, agentId: string): Promise<AgentOperationResult> => {
    return ipcRenderer.invoke('agent:get', repoPath, agentId);
  },

  /**
   * Create new custom agent
   */
  createAgent: (repoPath: string, agent: AgentProfile): Promise<AgentOperationResult> => {
    return ipcRenderer.invoke('agent:create', repoPath, agent);
  },

  /**
   * Update existing agent
   */
  updateAgent: (repoPath: string, agent: AgentProfile): Promise<AgentOperationResult> => {
    return ipcRenderer.invoke('agent:update', repoPath, agent);
  },

  /**
   * Delete custom agent
   */
  deleteAgent: (repoPath: string, agentId: string): Promise<AgentOperationResult> => {
    return ipcRenderer.invoke('agent:delete', repoPath, agentId);
  },

  /**
   * Validate agent profile
   */
  validateAgent: (agent: AgentProfile): Promise<AgentOperationResult> => {
    return ipcRenderer.invoke('agent:validate', agent);
  },

  /**
   * Export agent to JSON string
   */
  exportAgent: (agent: AgentProfile): Promise<{ ok: boolean; json?: string; error?: string }> => {
    return ipcRenderer.invoke('agent:export', agent);
  },

  /**
   * Import agent from JSON string
   */
  importAgent: (json: string): Promise<AgentOperationResult> => {
    return ipcRenderer.invoke('agent:import', json);
  },

  // ===== Agent Sync Operations =====

  /**
   * Get sync status for agents file
   */
  getSyncStatus: (repoPath: string): Promise<{ ok: boolean; status?: any; error?: string }> => {
    return ipcRenderer.invoke('agent:syncStatus', repoPath);
  },

  /**
   * Pull agents from remote repository
   */
  pullAgents: (repoPath: string, options?: { remote?: string; branch?: string }): Promise<any> => {
    return ipcRenderer.invoke('agent:pull', repoPath, options);
  },

  /**
   * Push agents to remote repository
   */
  pushAgents: (repoPath: string, options: { message: string; remote?: string; branch?: string }): Promise<any> => {
    return ipcRenderer.invoke('agent:push', repoPath, options);
  },

  /**
   * Sync agents (pull then push)
   */
  syncAgents: (repoPath: string, options?: { commitMessage?: string; remote?: string; branch?: string }): Promise<any> => {
    return ipcRenderer.invoke('agent:sync', repoPath, options);
  },

  /**
   * Commit agent changes
   */
  commitAgents: (repoPath: string, message: string): Promise<any> => {
    return ipcRenderer.invoke('agent:commit', repoPath, message);
  },

  /**
   * Check if repository has a remote configured
   */
  hasRemote: (repoPath: string): Promise<{ ok: boolean; hasRemote?: boolean; error?: string }> => {
    return ipcRenderer.invoke('agent:hasRemote', repoPath);
  }
};

export type AgentBridge = typeof agentBridge;
