/**
 * Enterprise Store - Pinia store for enterprise features
 * 
 * Manages state for:
 * - Enterprise configuration
 * - Repository discovery and status
 * - Prompt templates
 * - Constitution merging
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { enterprise } from '../services/ipcClient';
import type {
  EnterpriseConfig,
  EnterpriseRepoInfo,
  EnterpriseRepoStatus,
  DeriveSpecRequest,
  DeriveSpecResult,
  MergedConstitution,
  PromptTemplate,
} from '../../types/enterprise';

export const useEnterpriseStore = defineStore('enterprise', () => {
  // State
  const config = ref<EnterpriseConfig>({ defaultProvider: 'azure' });
  const repos = ref<EnterpriseRepoInfo[]>([]);
  const enterpriseRepoStatus = ref<EnterpriseRepoStatus | null>(null);
  const prompts = ref<PromptTemplate[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const syncing = ref(false);

  // Computed
  const isConfigured = computed(() => {
    return !!(config.value.gheOrg && config.value.enterpriseSpecsRepo);
  });

  const isEnterpriseRepoSynced = computed(() => {
    return enterpriseRepoStatus.value?.cloned ?? false;
  });

  const reposWithConstitution = computed(() => {
    return repos.value.filter(r => r.hasConstitution);
  });

  const reposWithSpecs = computed(() => {
    return repos.value.filter(r => r.hasSpecs);
  });

  // Actions

  /**
   * Load enterprise configuration
   */
  async function loadConfig() {
    try {
      loading.value = true;
      error.value = null;
      config.value = await enterprise.getConfig();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load config';
      console.error('Error loading enterprise config:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Save enterprise configuration
   */
  async function saveConfig(newConfig: Partial<EnterpriseConfig>) {
    try {
      loading.value = true;
      error.value = null;
      await enterprise.setConfig(newConfig);
      // Reload to get full config
      await loadConfig();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save config';
      console.error('Error saving enterprise config:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Load enterprise repository status
   */
  async function loadEnterpriseRepoStatus() {
    try {
      loading.value = true;
      error.value = null;
      enterpriseRepoStatus.value = await enterprise.getEnterpriseRepoStatus();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load repo status';
      console.error('Error loading enterprise repo status:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Sync enterprise-specs repository
   */
  async function syncEnterpriseRepo() {
    try {
      syncing.value = true;
      error.value = null;
      await enterprise.syncEnterpriseRepo();
      // Reload status after sync
      await loadEnterpriseRepoStatus();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sync enterprise repo';
      console.error('Error syncing enterprise repo:', err);
      throw err;
    } finally {
      syncing.value = false;
    }
  }

  /**
   * Load list of enterprise repositories
   */
  async function loadRepos() {
    try {
      loading.value = true;
      error.value = null;
      repos.value = await enterprise.listRepos();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load repos';
      console.error('Error loading enterprise repos:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Refresh repository list
   */
  async function refreshRepos() {
    return loadRepos();
  }

  /**
   * Load available prompt templates
   */
  async function loadPrompts() {
    try {
      loading.value = true;
      error.value = null;
      prompts.value = await enterprise.listPrompts();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load prompts';
      console.error('Error loading prompts:', err);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Derive specification from code
   */
  async function deriveSpec(request: DeriveSpecRequest): Promise<DeriveSpecResult> {
    try {
      loading.value = true;
      error.value = null;
      const result = await enterprise.deriveSpec(request);
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to derive spec';
      console.error('Error deriving spec:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get effective constitution for a local repo
   */
  async function getEffectiveConstitution(localRepoPath: string): Promise<MergedConstitution> {
    try {
      loading.value = true;
      error.value = null;
      return await enterprise.getEffectiveConstitution(localRepoPath);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get constitution';
      console.error('Error getting effective constitution:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Clear error message
   */
  function clearError() {
    error.value = null;
  }

  /**
   * Initialize store - load config and status
   */
  async function initialize() {
    await Promise.all([
      loadConfig(),
      loadEnterpriseRepoStatus(),
    ]);
  }

  return {
    // State
    config,
    repos,
    enterpriseRepoStatus,
    prompts,
    loading,
    error,
    syncing,

    // Computed
    isConfigured,
    isEnterpriseRepoSynced,
    reposWithConstitution,
    reposWithSpecs,

    // Actions
    loadConfig,
    saveConfig,
    loadEnterpriseRepoStatus,
    syncEnterpriseRepo,
    loadRepos,
    refreshRepos,
    loadPrompts,
    deriveSpec,
    getEffectiveConstitution,
    clearError,
    initialize,
  };
});
