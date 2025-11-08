/**
 * IPC Client - Type-safe wrapper around window.api
 * 
 * Provides clean interface for renderer to call main process operations.
 * Components should use this instead of accessing window.api directly.
 */

import type {
  EnterpriseConfig,
  EnterpriseRepoInfo,
  EnterpriseRepoStatus,
  DeriveSpecRequest,
  DeriveSpecResult,
  MergedConstitution,
  PromptTemplate,
} from '../../types/enterprise';

/**
 * Type-safe IPC client for enterprise operations
 */
export const ipcClient = {
  enterprise: {
    /**
     * Get enterprise configuration
     */
    async getConfig(): Promise<EnterpriseConfig> {
      return window.api.enterprise.getConfig();
    },
    
    /**
     * Set enterprise configuration
     */
    async setConfig(config: Partial<EnterpriseConfig>): Promise<void> {
      await window.api.enterprise.setConfig(config);
    },
    
    /**
     * List all repositories in the enterprise organization
     */
    async listRepos(): Promise<EnterpriseRepoInfo[]> {
      return window.api.enterprise.listRepos();
    },
    
    /**
     * Get status of enterprise-specs repository
     */
    async getEnterpriseRepoStatus(): Promise<EnterpriseRepoStatus> {
      return window.api.enterprise.getEnterpriseRepoStatus();
    },
    
    /**
     * Sync (clone or pull) enterprise-specs repository
     */
    async syncEnterpriseRepo(): Promise<void> {
      await window.api.enterprise.syncEnterpriseRepo();
    },
    
    /**
     * Derive specification from code using AI
     */
    async deriveSpec(request: DeriveSpecRequest): Promise<DeriveSpecResult> {
      return window.api.enterprise.deriveSpec(request);
    },
    
    /**
     * Get effective constitution (merged global + local)
     */
    async getEffectiveConstitution(localRepoPath: string): Promise<MergedConstitution> {
      return window.api.enterprise.getEffectiveConstitution(localRepoPath);
    },
    
    /**
     * List available prompt templates
     */
    async listPrompts(): Promise<PromptTemplate[]> {
      return window.api.enterprise.listPrompts();
    },
    
    /**
     * Get a specific prompt template
     */
    async getPrompt(name: string): Promise<PromptTemplate> {
      return window.api.enterprise.getPrompt(name);
    },
    
    /**
     * Apply template with variables and get rendered result
     */
    async applyTemplate(name: string, variables: Record<string, string>): Promise<string> {
      const result = await window.api.enterprise.applyTemplate({ name, variables });
      return result.rendered;
    },
  },
  
  // Future: Add wrappers for other APIs (context, git, ai, etc.)
  // For now, components can use window.api directly for non-enterprise operations
};

/**
 * Type-safe wrapper exports for convenience
 */
export const { enterprise } = ipcClient;
