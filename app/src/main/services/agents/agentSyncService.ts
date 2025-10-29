/**
 * Agent Sync Service
 * 
 * Manages synchronization of agent profiles with Git repositories
 */

import { GitService, type SerializedGitStatus } from '../GitService';
import { AgentProfileService } from './agentProfileService';
import type { AgentProfile } from '@shared/agents/types';

const AGENTS_FILE_PATH = '.context/agents.json';

export interface SyncStatus {
  hasChanges: boolean;
  isModified: boolean;
  isStaged: boolean;
  hasConflict: boolean;
  ahead: number;
  behind: number;
  canPull: boolean;
  canPush: boolean;
}

export interface SyncResult {
  success: boolean;
  message: string;
  conflicts?: string[];
  pulledAgents?: AgentProfile[];
  pushedAgents?: AgentProfile[];
}

export interface MergeConflict {
  agentId: string;
  localVersion: AgentProfile;
  remoteVersion: AgentProfile;
  resolution?: 'keep-local' | 'keep-remote' | 'merge';
}

/**
 * Agent Synchronization Service
 */
export class AgentSyncService {
  private gitService: GitService;
  private agentService: AgentProfileService;

  constructor(private readonly repoPath: string) {
    this.gitService = new GitService(repoPath);
    this.agentService = new AgentProfileService();
  }

  /**
   * Get sync status for agents file
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const status: SerializedGitStatus = await this.gitService.getStatus();
      
      const isModified = status.modified.includes(AGENTS_FILE_PATH) || 
                        status.not_added.includes(AGENTS_FILE_PATH);
      const isStaged = status.staged.includes(AGENTS_FILE_PATH);
      const hasConflict = status.conflicted.includes(AGENTS_FILE_PATH);
      const hasChanges = isModified || isStaged || hasConflict;
      
      const canPull = status.behind > 0;
      const canPush = status.ahead > 0 || hasChanges;

      return {
        hasChanges,
        isModified,
        isStaged,
        hasConflict,
        ahead: status.ahead,
        behind: status.behind,
        canPull,
        canPush
      };
    } catch (error) {
      throw new Error(`Failed to get sync status: ${(error as Error).message}`);
    }
  }

  /**
   * Pull agent changes from remote
   */
  async pullAgents(options?: { remote?: string; branch?: string }): Promise<SyncResult> {
    try {
      // Check sync status first
      const status = await this.getSyncStatus();
      
      if (status.hasChanges) {
        return {
          success: false,
          message: 'Cannot pull: local changes detected. Commit or stash your changes first.'
        };
      }

      if (!status.canPull) {
        return {
          success: true,
          message: 'Already up to date',
          pulledAgents: []
        };
      }

      // Load agents before pull
      const beforePull = await this.agentService.loadAgentsFile(this.repoPath);
      const beforeIds = new Set(beforePull.agents.map(a => a.id));

      // Perform pull
      await this.gitService.pull(options?.remote, options?.branch);

      // Load agents after pull
      const afterPull = await this.agentService.loadAgentsFile(this.repoPath);
      
      // Determine what changed
      const pulledAgents = afterPull.agents.filter(
        agent => !beforeIds.has(agent.id)
      );

      return {
        success: true,
        message: `Successfully pulled ${pulledAgents.length} new agent(s)`,
        pulledAgents
      };
    } catch (error) {
      return {
        success: false,
        message: `Pull failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Push agent changes to remote
   */
  async pushAgents(options: {
    message: string;
    remote?: string;
    branch?: string;
  }): Promise<SyncResult> {
    try {
      const status = await this.getSyncStatus();

      if (!status.canPush) {
        return {
          success: true,
          message: 'No changes to push',
          pushedAgents: []
        };
      }

      // Load current agents
      const document = await this.agentService.loadAgentsFile(this.repoPath);
      const customAgents = document.agents.filter(a => !a.metadata.isBuiltIn);

      // Stage the agents file
      await this.gitService.commit(options.message, [AGENTS_FILE_PATH]);

      // Push to remote
      await this.gitService.push(options.remote, options.branch);

      return {
        success: true,
        message: `Successfully pushed ${customAgents.length} agent(s)`,
        pushedAgents: customAgents
      };
    } catch (error) {
      return {
        success: false,
        message: `Push failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Sync agents: pull then push if needed
   */
  async syncAgents(options: {
    commitMessage?: string;
    remote?: string;
    branch?: string;
  }): Promise<SyncResult> {
    try {
      // First, try to pull
      const pullResult = await this.pullAgents({
        remote: options.remote,
        branch: options.branch
      });

      if (!pullResult.success) {
        return pullResult;
      }

      // Check if we need to push
      const status = await this.getSyncStatus();
      if (!status.canPush) {
        return {
          success: true,
          message: 'Agents synced successfully',
          pulledAgents: pullResult.pulledAgents
        };
      }

      // Push any local changes
      const pushResult = await this.pushAgents({
        message: options.commitMessage || 'Update agent profiles',
        remote: options.remote,
        branch: options.branch
      });

      if (!pushResult.success) {
        return pushResult;
      }

      return {
        success: true,
        message: 'Agents synced successfully',
        pulledAgents: pullResult.pulledAgents,
        pushedAgents: pushResult.pushedAgents
      };
    } catch (error) {
      return {
        success: false,
        message: `Sync failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Detect merge conflicts in agents file
   */
  async detectConflicts(): Promise<MergeConflict[]> {
    try {
      const status = await this.gitService.getStatus();
      
      if (!status.conflicted.includes(AGENTS_FILE_PATH)) {
        return [];
      }

      // TODO: Implement conflict detection by parsing git conflict markers
      // This would require reading the file and parsing <<<<<<< ======= >>>>>>> markers
      // For now, return empty array and let user resolve manually

      return [];
    } catch (error) {
      throw new Error(`Failed to detect conflicts: ${(error as Error).message}`);
    }
  }

  /**
   * Resolve conflicts by choosing a resolution strategy
   */
  async resolveConflicts(conflicts: MergeConflict[]): Promise<SyncResult> {
    try {
      const document = await this.agentService.loadAgentsFile(this.repoPath);
      const resolvedAgents: AgentProfile[] = [];

      for (const conflict of conflicts) {
        switch (conflict.resolution) {
          case 'keep-local': {
            // Keep local version
            const localIndex = document.agents.findIndex(a => a.id === conflict.agentId);
            if (localIndex >= 0) {
              document.agents[localIndex] = conflict.localVersion;
            } else {
              document.agents.push(conflict.localVersion);
            }
            resolvedAgents.push(conflict.localVersion);
            break;
          }

          case 'keep-remote': {
            // Keep remote version
            const remoteIndex = document.agents.findIndex(a => a.id === conflict.agentId);
            if (remoteIndex >= 0) {
              document.agents[remoteIndex] = conflict.remoteVersion;
            } else {
              document.agents.push(conflict.remoteVersion);
            }
            resolvedAgents.push(conflict.remoteVersion);
            break;
          }

          case 'merge': {
            // Merge both versions (prefer local metadata, remote content)
            const merged: AgentProfile = {
              ...conflict.remoteVersion,
              metadata: {
                ...conflict.localVersion.metadata,
                updatedAt: new Date().toISOString()
              }
            };
            const mergeIndex = document.agents.findIndex(a => a.id === conflict.agentId);
            if (mergeIndex >= 0) {
              document.agents[mergeIndex] = merged;
            } else {
              document.agents.push(merged);
            }
            resolvedAgents.push(merged);
            break;
          }
        }
      }

      // Save resolved document
      await this.agentService.saveAgentsFile(this.repoPath, document);

      // Stage and commit
      await this.gitService.commit('Resolve agent profile conflicts', [AGENTS_FILE_PATH]);

      return {
        success: true,
        message: `Resolved ${conflicts.length} conflict(s)`,
        pulledAgents: resolvedAgents
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to resolve conflicts: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check if repository has a remote configured
   */
  async hasRemote(): Promise<boolean> {
    try {
      const status = await this.gitService.getStatus();
      return status.tracking !== null;
    } catch {
      return false;
    }
  }

  /**
   * Create a commit for agent changes without pushing
   */
  async commitAgents(message: string): Promise<SyncResult> {
    try {
      const status = await this.getSyncStatus();

      if (!status.hasChanges) {
        return {
          success: true,
          message: 'No changes to commit',
          pushedAgents: []
        };
      }

      // Commit the agents file
      await this.gitService.commit(message, [AGENTS_FILE_PATH]);

      // Load current agents for the result
      const document = await this.agentService.loadAgentsFile(this.repoPath);
      const customAgents = document.agents.filter(a => !a.metadata.isBuiltIn);

      return {
        success: true,
        message: 'Changes committed successfully',
        pushedAgents: customAgents
      };
    } catch (error) {
      return {
        success: false,
        message: `Commit failed: ${(error as Error).message}`
      };
    }
  }
}
