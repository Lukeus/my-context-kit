/**
 * Enterprise IPC Handlers
 * 
 * Thin handlers that validate input and delegate to EnterpriseService.
 * All handlers use the ent:* namespace.
 */

import { ipcMain } from 'electron';
import type { EnterpriseService } from '../../services/EnterpriseService';
import { 
  EnterpriseConfigSchema, 
  DeriveSpecRequestSchema,
  ENTERPRISE_IPC_CHANNELS 
} from '../../../types/enterprise';

/**
 * Register all enterprise IPC handlers
 */
export function registerEnterpriseHandlers(enterpriseService: EnterpriseService): void {
  // ============================================================================
  // Configuration
  // ============================================================================

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.GET_CONFIG, async () => {
    try {
      return await enterpriseService.getConfig();
    } catch (error) {
      console.error('Error getting enterprise config:', error);
      throw error;
    }
  });

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.SET_CONFIG, async (_, config: unknown) => {
    try {
      // Validate with Zod
      const validated = EnterpriseConfigSchema.partial().parse(config);
      await enterpriseService.setConfig(validated);
      return { success: true };
    } catch (error) {
      console.error('Error setting enterprise config:', error);
      throw error;
    }
  });

  // ============================================================================
  // Repository Operations
  // ============================================================================

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.LIST_REPOS, async () => {
    try {
      return await enterpriseService.listEnterpriseRepos();
    } catch (error) {
      console.error('Error listing enterprise repos:', error);
      throw error;
    }
  });

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.GET_ENTERPRISE_REPO_STATUS, async () => {
    try {
      return await enterpriseService.getEnterpriseRepoStatus();
    } catch (error) {
      console.error('Error getting enterprise repo status:', error);
      throw error;
    }
  });

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.SYNC_ENTERPRISE_REPO, async () => {
    try {
      await enterpriseService.syncEnterpriseRepo();
      return { success: true };
    } catch (error) {
      console.error('Error syncing enterprise repo:', error);
      throw error;
    }
  });

  // ============================================================================
  // Spec Derivation
  // ============================================================================

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.DERIVE_SPEC, async (_, request: unknown) => {
    try {
      // Validate with Zod
      const validated = DeriveSpecRequestSchema.parse(request);
      return await enterpriseService.deriveSpec(validated);
    } catch (error) {
      console.error('Error deriving spec:', error);
      throw error;
    }
  });

  // ============================================================================
  // Constitution
  // ============================================================================

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.GET_EFFECTIVE_CONSTITUTION, async (_, localRepoPath: string) => {
    try {
      if (!localRepoPath || typeof localRepoPath !== 'string') {
        throw new Error('Invalid localRepoPath parameter');
      }
      return await enterpriseService.getEffectiveConstitution(localRepoPath);
    } catch (error) {
      console.error('Error getting effective constitution:', error);
      throw error;
    }
  });

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.MERGE_CONSTITUTIONS, async (_, localRepoPath: string) => {
    try {
      if (!localRepoPath || typeof localRepoPath !== 'string') {
        throw new Error('Invalid localRepoPath parameter');
      }
      // Alias for GET_EFFECTIVE_CONSTITUTION for backwards compatibility
      return await enterpriseService.getEffectiveConstitution(localRepoPath);
    } catch (error) {
      console.error('Error merging constitutions:', error);
      throw error;
    }
  });

  // ============================================================================
  // Prompts
  // ============================================================================

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.LIST_PROMPTS, async () => {
    try {
      return await enterpriseService.listPrompts();
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw error;
    }
  });

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.GET_PROMPT, async (_, name: string) => {
    try {
      if (!name || typeof name !== 'string') {
        throw new Error('Invalid prompt name parameter');
      }
      return await enterpriseService.getPrompt(name);
    } catch (error) {
      console.error('Error getting prompt:', error);
      throw error;
    }
  });

  ipcMain.handle(ENTERPRISE_IPC_CHANNELS.APPLY_TEMPLATE, async (_, data: { name: string; variables: Record<string, string> }) => {
    try {
      if (!data || !data.name || typeof data.name !== 'string') {
        throw new Error('Invalid template application parameters');
      }
      
      const prompt = await enterpriseService.getPrompt(data.name);
      
      // Apply variables
      let rendered = prompt.content;
      if (data.variables) {
        for (const [key, value] of Object.entries(data.variables)) {
          const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
          rendered = rendered.replace(pattern, value);
        }
      }
      
      return { rendered };
    } catch (error) {
      console.error('Error applying template:', error);
      throw error;
    }
  });

  console.log('Enterprise IPC handlers registered');
}
