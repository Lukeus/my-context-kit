/**
 * IPC Handlers for Agent Management
 * 
 * Exposes agent profile operations to the renderer process
 */

import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { agentProfileService } from '../../services/agents/agentProfileService';
import { AgentSyncService, type SyncStatus, type SyncResult } from '../../services/agents/agentSyncService';
import type { AgentProfile, AgentSearchCriteria, AgentOperationResult } from '@shared/agents/types';

/**
 * Register all agent-related IPC handlers
 */
export function registerAgentHandlers(): void {
  /**
   * List all available agents (built-in + custom)
   */
  ipcMain.handle(
    'agent:list',
    async (_event: IpcMainInvokeEvent, repoPath: string, criteria?: AgentSearchCriteria): Promise<AgentOperationResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            ok: false,
            error: 'Repository path is required'
          };
        }

        const agents = await agentProfileService.listAgents(repoPath, criteria);
        return {
          ok: true,
          agents
        };
      } catch (error) {
        return {
          ok: false,
          error: `Failed to list agents: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Get specific agent by ID
   */
  ipcMain.handle(
    'agent:get',
    async (_event: IpcMainInvokeEvent, repoPath: string, agentId: string): Promise<AgentOperationResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            ok: false,
            error: 'Repository path is required'
          };
        }

        if (!agentId || typeof agentId !== 'string') {
          return {
            ok: false,
            error: 'Agent ID is required'
          };
        }

        const agent = await agentProfileService.getAgent(repoPath, agentId);
        
        if (!agent) {
          return {
            ok: false,
            error: `Agent '${agentId}' not found`
          };
        }

        return {
          ok: true,
          agent
        };
      } catch (error) {
        return {
          ok: false,
          error: `Failed to get agent: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Create new custom agent
   */
  ipcMain.handle(
    'agent:create',
    async (_event: IpcMainInvokeEvent, repoPath: string, agent: AgentProfile): Promise<AgentOperationResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            ok: false,
            error: 'Repository path is required'
          };
        }

        if (!agent || typeof agent !== 'object') {
          return {
            ok: false,
            error: 'Agent profile is required'
          };
        }

        return await agentProfileService.createAgent(repoPath, agent);
      } catch (error) {
        return {
          ok: false,
          error: `Failed to create agent: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Update existing agent
   */
  ipcMain.handle(
    'agent:update',
    async (_event: IpcMainInvokeEvent, repoPath: string, agent: AgentProfile): Promise<AgentOperationResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            ok: false,
            error: 'Repository path is required'
          };
        }

        if (!agent || typeof agent !== 'object') {
          return {
            ok: false,
            error: 'Agent profile is required'
          };
        }

        return await agentProfileService.updateAgent(repoPath, agent);
      } catch (error) {
        return {
          ok: false,
          error: `Failed to update agent: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Delete custom agent
   */
  ipcMain.handle(
    'agent:delete',
    async (_event: IpcMainInvokeEvent, repoPath: string, agentId: string): Promise<AgentOperationResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            ok: false,
            error: 'Repository path is required'
          };
        }

        if (!agentId || typeof agentId !== 'string') {
          return {
            ok: false,
            error: 'Agent ID is required'
          };
        }

        return await agentProfileService.deleteAgent(repoPath, agentId);
      } catch (error) {
        return {
          ok: false,
          error: `Failed to delete agent: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Validate agent profile
   */
  ipcMain.handle(
    'agent:validate',
    async (_event: IpcMainInvokeEvent, agent: AgentProfile): Promise<AgentOperationResult> => {
      try {
        if (!agent || typeof agent !== 'object') {
          return {
            ok: false,
            error: 'Agent profile is required'
          };
        }

        const validation = agentProfileService.validateAgent(agent);
        
        if (!validation.valid) {
          return {
            ok: false,
            error: validation.errors.join(', ')
          };
        }

        return {
          ok: true,
          agent
        };
      } catch (error) {
        return {
          ok: false,
          error: `Failed to validate agent: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Export agent to JSON string
   */
  ipcMain.handle(
    'agent:export',
    async (_event: IpcMainInvokeEvent, agent: AgentProfile): Promise<{ ok: boolean; json?: string; error?: string }> => {
      try {
        if (!agent || typeof agent !== 'object') {
          return {
            ok: false,
            error: 'Agent profile is required'
          };
        }

        const json = agentProfileService.exportAgent(agent);
        return {
          ok: true,
          json
        };
      } catch (error) {
        return {
          ok: false,
          error: `Failed to export agent: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Import agent from JSON string
   */
  ipcMain.handle(
    'agent:import',
    async (_event: IpcMainInvokeEvent, json: string): Promise<AgentOperationResult> => {
      try {
        if (!json || typeof json !== 'string') {
          return {
            ok: false,
            error: 'JSON string is required'
          };
        }

        return agentProfileService.importAgent(json);
      } catch (error) {
        return {
          ok: false,
          error: `Failed to import agent: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Get agent sync status
   */
  ipcMain.handle(
    'agent:syncStatus',
    async (_event: IpcMainInvokeEvent, repoPath: string): Promise<{ ok: boolean; status?: SyncStatus; error?: string }> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            ok: false,
            error: 'Repository path is required'
          };
        }

        const syncService = new AgentSyncService(repoPath);
        const status = await syncService.getSyncStatus();
        return {
          ok: true,
          status
        };
      } catch (error) {
        return {
          ok: false,
          error: `Failed to get sync status: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Pull agents from remote
   */
  ipcMain.handle(
    'agent:pull',
    async (_event: IpcMainInvokeEvent, repoPath: string, options?: { remote?: string; branch?: string }): Promise<SyncResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            success: false,
            message: 'Repository path is required'
          };
        }

        const syncService = new AgentSyncService(repoPath);
        return await syncService.pullAgents(options);
      } catch (error) {
        return {
          success: false,
          message: `Pull failed: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Push agents to remote
   */
  ipcMain.handle(
    'agent:push',
    async (_event: IpcMainInvokeEvent, repoPath: string, options: { message: string; remote?: string; branch?: string }): Promise<SyncResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            success: false,
            message: 'Repository path is required'
          };
        }

        if (!options?.message) {
          return {
            success: false,
            message: 'Commit message is required'
          };
        }

        const syncService = new AgentSyncService(repoPath);
        return await syncService.pushAgents(options);
      } catch (error) {
        return {
          success: false,
          message: `Push failed: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Sync agents (pull then push)
   */
  ipcMain.handle(
    'agent:sync',
    async (_event: IpcMainInvokeEvent, repoPath: string, options?: { commitMessage?: string; remote?: string; branch?: string }): Promise<SyncResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            success: false,
            message: 'Repository path is required'
          };
        }

        const syncService = new AgentSyncService(repoPath);
        return await syncService.syncAgents(options || {});
      } catch (error) {
        return {
          success: false,
          message: `Sync failed: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Commit agent changes
   */
  ipcMain.handle(
    'agent:commit',
    async (_event: IpcMainInvokeEvent, repoPath: string, message: string): Promise<SyncResult> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            success: false,
            message: 'Repository path is required'
          };
        }

        if (!message || typeof message !== 'string') {
          return {
            success: false,
            message: 'Commit message is required'
          };
        }

        const syncService = new AgentSyncService(repoPath);
        return await syncService.commitAgents(message);
      } catch (error) {
        return {
          success: false,
          message: `Commit failed: ${(error as Error).message}`
        };
      }
    }
  );

  /**
   * Check if repository has remote
   */
  ipcMain.handle(
    'agent:hasRemote',
    async (_event: IpcMainInvokeEvent, repoPath: string): Promise<{ ok: boolean; hasRemote?: boolean; error?: string }> => {
      try {
        if (!repoPath || typeof repoPath !== 'string') {
          return {
            ok: false,
            error: 'Repository path is required'
          };
        }

        const syncService = new AgentSyncService(repoPath);
        const hasRemote = await syncService.hasRemote();
        return {
          ok: true,
          hasRemote
        };
      } catch (error) {
        return {
          ok: false,
          error: `Failed to check remote: ${(error as Error).message}`
        };
      }
    }
  );
}
