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

interface RepoRegistryEntry {
  id: string;
  label: string;
  path: string;
  createdAt: string;
  lastUsed: string;
  autoDetected?: boolean;
}

interface RepoRegistryPayload {
  activeRepoId: string | null;
  repos: RepoRegistryEntry[];
}

interface RepoRegistryResult {
  ok: boolean;
  registry?: RepoRegistryPayload;
  error?: string;
}

// Constants
const FILE_WATCH_DEBOUNCE_MS = 250; // Debounce to prevent excessive graph rebuilds on rapid file changes

export const useContextStore = defineStore('context', () => {
  // State
  const repoPath = ref('');
  const availableRepos = ref<RepoRegistryEntry[]>([]);
  const activeRepoId = ref<string | null>(null);
  const entities = ref<Record<string, Entity>>({});
  const graph = ref<Graph | null>(null);
  const activeEntityId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isInitialized = ref(false);

  let watchedRepoPath: string | null = null;
  let disposeFileWatcher: (() => void) | null = null;
  let fileChangeDebounce: ReturnType<typeof setTimeout> | null = null;

  async function stopRepoWatch() {
    if (disposeFileWatcher) {
      disposeFileWatcher();
      disposeFileWatcher = null;
    }
    if (watchedRepoPath) {
      try {
        await window.api.repos.unwatch(watchedRepoPath);
      } catch (err) {
        // Log cleanup errors but don't throw - this is a non-critical cleanup operation
        console.debug('[contextStore] Failed to unwatch repo during cleanup:', watchedRepoPath, err);
      }
      watchedRepoPath = null;
    }
    if (fileChangeDebounce) {
      clearTimeout(fileChangeDebounce);
      fileChangeDebounce = null;
    }
  }

  async function startRepoWatch(dir: string) {
    const normalized = dir.trim();
    if (!normalized) {
      await stopRepoWatch();
      return;
    }

    if (watchedRepoPath === normalized) {
      return;
    }

    await stopRepoWatch();

    try {
      await window.api.repos.watch(normalized);
    } catch (err) {
      // Swallow watch errors to prevent UI crashes, but log for debugging
      console.warn('[contextStore] Failed to start repo watch:', normalized, err);
      return;
    }

    watchedRepoPath = normalized;
    disposeFileWatcher = window.api.repos.onFileChanged(async (payload: any) => {
      if (!repoPath.value || payload?.dir !== watchedRepoPath) {
        return;
      }

      if (fileChangeDebounce) {
        clearTimeout(fileChangeDebounce);
      }

      fileChangeDebounce = setTimeout(async () => {
        await loadGraph();
        fileChangeDebounce = null;
      }, FILE_WATCH_DEBOUNCE_MS);
    });
  }

  // Load saved repo path on initialization
  async function initializeStore() {
    if (isInitialized.value) return;
    
    try {
      await refreshRepoRegistry();

      if (activeRepoId.value) {
        const activeRepo = availableRepos.value.find(repo => repo.id === activeRepoId.value);
        if (activeRepo) {
          repoPath.value = activeRepo.path;
          await window.api.settings.set('repoPath', activeRepo.path);
        } else {
          await applyDefaultRepoPath();
        }
      } else {
        const settingsPath = await window.api.settings.get('repoPath');
        if (settingsPath.ok && settingsPath.value) {
          repoPath.value = settingsPath.value;
          await ensureRepoInRegistry(settingsPath.value, { setActive: true });
        } else {
          await applyDefaultRepoPath();
        }
      }

      await startRepoWatch(repoPath.value);
    } catch (err) {
      console.error('[contextStore] Failed to initialize store, applying default repo path:', err);
      await applyDefaultRepoPath();
    }
    
    isInitialized.value = true;
  }

  async function applyDefaultRepoPath() {
    try {
      const defaultResult = await window.api.app.getDefaultRepoPath();
      if (defaultResult.ok && defaultResult.path) {
        const normalized = defaultResult.path.trim();
        repoPath.value = normalized;
        await window.api.settings.set('repoPath', normalized);
        await refreshRepoRegistry();
        await startRepoWatch(normalized);
      } else {
        repoPath.value = '';
        await stopRepoWatch();
      }
    } catch (err) {
      console.error('[contextStore] Failed to apply default repo path:', err);
      repoPath.value = '';
      await stopRepoWatch();
    }
  }

  // Initialize on first access
  initializeStore();

  // Computed
  const activeEntity = computed(() => {
    if (!activeEntityId.value) return null;
    return entities.value[activeEntityId.value] || null;
  });

  const entitiesByType = computed(() => {
    const grouped: Record<string, Entity[]> = {
      governance: [],
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

  const repoOptions = computed(() => {
    return availableRepos.value
      .slice()
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
  });

  // Actions
  async function setRepoPath(path: string) {
    const normalizedPath = path.trim();
    repoPath.value = normalizedPath;
    
    // Persist to settings
    try {
      await window.api.settings.set('repoPath', normalizedPath);
      await ensureRepoInRegistry(normalizedPath, { setActive: true });
      await refreshRepoRegistry();
    } catch (err) {
      console.warn('[contextStore] Failed to persist repo path or update registry:', err);
    } finally {
      await startRepoWatch(normalizedPath);
    }
  }

  async function loadGraph() {
    isLoading.value = true;
    error.value = null;

    try {
      if (!repoPath.value) {
        error.value = 'Repository path is not configured';
        return false;
      }

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
      if (!repoPath.value) {
        error.value = 'Repository path is not configured';
        return { ok: false, error: error.value };
      }

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

  // Update recents list in settings (best-effort, non-blocking)
  if (entityId) {
    (async () => {
      try {
        const res = await window.api.settings.get('recentEntities');
        const list: string[] = Array.isArray(res?.value) ? res.value : [];
        const next = [entityId, ...list.filter((id) => id !== entityId)].slice(0, 10);
        await window.api.settings.set('recentEntities', next);
      } catch {
        // ignore settings errors silently
      }
    })();
  }
}

  function getEntity(entityId: string): Entity | null {
    return entities.value[entityId] || null;
  }

  function clearError() {
    error.value = null;
  }

  async function refreshRepoRegistry() {
    try {
      const result = await window.api.repos.list() as RepoRegistryResult;
      if (result.ok && result.registry) {
        availableRepos.value = result.registry.repos;
        activeRepoId.value = result.registry.activeRepoId;
      }
    } catch {
      // Ignore registry errors silently
    }
  }

  async function ensureRepoInRegistry(pathToEnsure: string, options: { setActive?: boolean; label?: string } = {}) {
    try {
      const normalizedPath = pathToEnsure.trim();
      if (!normalizedPath) {
        return;
      }
      const label = options.label || normalizedPath.split(/[/\\]/).pop() || normalizedPath;
      await window.api.repos.add({
        label,
        path: normalizedPath,
        setActive: options.setActive ?? false,
      }) as RepoRegistryResult;
    } catch {
      // Duplicate path errors should not interrupt user flow
    }
  }

  async function selectActiveRepo(id: string) {
    const repo = availableRepos.value.find(entry => entry.id === id);
    if (!repo) {
      return;
    }

    try {
      await window.api.repos.setActive(id) as RepoRegistryResult;
      await window.api.settings.set('repoPath', repo.path);
      repoPath.value = repo.path;
      activeRepoId.value = id;
      await refreshRepoRegistry();
      await startRepoWatch(repo.path);
      await loadGraph();
    } catch {
      // Ignore errors
    }
  }

  async function addRepository(entry: { label: string; path: string }) {
    const trimmedLabel = entry.label.trim();
    const trimmedPath = entry.path.trim();
    if (!trimmedLabel || !trimmedPath) {
      return { ok: false, error: 'Label and path are required' };
    }

    try {
      const result = await window.api.repos.add({
        label: trimmedLabel,
        path: trimmedPath,
        setActive: true,
      }) as RepoRegistryResult;

      if (result.ok && result.registry) {
        const registry = result.registry;
        availableRepos.value = registry.repos;
        activeRepoId.value = registry.activeRepoId;
        const activeRepo = registry.repos.find(repo => repo.id === registry.activeRepoId);
        if (activeRepo) {
          repoPath.value = activeRepo.path;
          await window.api.settings.set('repoPath', activeRepo.path);
          await startRepoWatch(activeRepo.path);
          await loadGraph();
        }
      }

      return result;
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to add repository' };
    }
  }

  async function removeRepository(id: string) {
    try {
      const result = await window.api.repos.remove(id) as RepoRegistryResult;
      if (result.ok && result.registry) {
        const registry = result.registry;
        availableRepos.value = registry.repos;
        activeRepoId.value = registry.activeRepoId;
        const activeRepo = registry.repos.find(repo => repo.id === registry.activeRepoId);
        if (activeRepo) {
          repoPath.value = activeRepo.path;
          await window.api.settings.set('repoPath', activeRepo.path);
          await startRepoWatch(activeRepo.path);
        } else {
          repoPath.value = '';
          await window.api.settings.set('repoPath', '');
          await stopRepoWatch();
        }
        if (repoPath.value) {
          await loadGraph();
        } else {
          graph.value = null;
          entities.value = {};
        }
      }

      return result;
    } catch (err: any) {
      return { ok: false, error: err.message || 'Failed to remove repository' };
    }
  }

  function getActiveRepoMeta(): RepoRegistryEntry | null {
    if (!activeRepoId.value) {
      return null;
    }
    return availableRepos.value.find(repo => repo.id === activeRepoId.value) || null;
  }

  function isRepoRegistered(repoDir: string): boolean {
    const normalized = repoDir.trim();
    return availableRepos.value.some(repo => repo.path === normalized);
  }

  /**
   * Cleanup function to be called when the store is no longer needed
   * Stops file watching and clears any pending timeouts to prevent memory leaks
   */
  function cleanup() {
    stopRepoWatch();
    // Any other cleanup can be added here
  }

  return {
    // State
    repoPath,
    availableRepos,
    activeRepoId,
    entities,
    graph,
    activeEntityId,
    isLoading,
    error,
    isInitialized,
    // Computed
    activeEntity,
    entitiesByType,
    entityCount,
    repoOptions,
    // Actions
    initializeStore,
    setRepoPath,
    loadGraph,
    validateRepo,
    setActiveEntity,
    getEntity,
    clearError,
    refreshRepoRegistry,
    ensureRepoInRegistry,
    selectActiveRepo,
    addRepository,
    removeRepository,
    getActiveRepoMeta,
    isRepoRegistered,
    cleanup
  };
});
