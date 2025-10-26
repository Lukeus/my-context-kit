import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { useContextStore } from '../src/renderer/stores/contextStore';

type RepoRegistryEntry = {
  id: string;
  label: string;
  path: string;
  createdAt: string;
  lastUsed: string;
  autoDetected?: boolean;
};

type RepoRegistryPayload = {
  activeRepoId: string | null;
  repos: RepoRegistryEntry[];
};

type ApiWithMocks = Record<string, Mock>;

const toMockApi = (api: unknown): ApiWithMocks => api as ApiWithMocks;

const makeRegistryEntry = (id: string, repoPath: string, label?: string): RepoRegistryEntry => ({
  id,
  label: label ?? id,
  path: repoPath,
  createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  lastUsed: new Date('2024-01-02T00:00:00.000Z').toISOString(),
});

describe('contextStore repository workflows', () => {
  beforeEach(() => {
    setActivePinia(createPinia());

    const reposApi = toMockApi(window.api.repos);
    reposApi.list.mockReset();
    reposApi.add.mockReset();
    reposApi.remove.mockReset();
    reposApi.update.mockReset();
    reposApi.setActive.mockReset();

    const settingsApi = toMockApi(window.api.settings);
    settingsApi.get.mockReset();
    settingsApi.set.mockReset();

    const appApi = toMockApi(window.api.app);
    appApi.getDefaultRepoPath.mockReset();

    const contextApi = toMockApi(window.api.context);
    contextApi.buildGraph.mockReset();
  });

  it('initializes using the active repository from registry', async () => {
    const reposApi = toMockApi(window.api.repos);
    const settingsApi = toMockApi(window.api.settings);
    const reposWatch = vi.fn().mockResolvedValue({ ok: true });
    const reposOnFileChanged = vi.fn().mockReturnValue(() => { /* noop */ });
    reposApi.watch = reposWatch;
    reposApi.onFileChanged = reposOnFileChanged;

    const registry: RepoRegistryPayload = {
      activeRepoId: 'alpha',
      repos: [
        makeRegistryEntry('alpha', 'C:/contexts/alpha', 'Alpha Repo'),
        makeRegistryEntry('beta', 'D:/contexts/beta', 'Beta Repo'),
      ],
    };

    reposApi.list.mockResolvedValue({ ok: true, registry });
    settingsApi.get.mockResolvedValue({ ok: true, value: '' });
    settingsApi.set.mockResolvedValue({ ok: true });

    const store = useContextStore();
    // Wait for auto-initialization to complete
    await vi.waitFor(() => {
      expect(store.isInitialized).toBe(true);
    }, { timeout: 1000 });

    expect(store.repoPath).toBe('C:/contexts/alpha');
    expect(store.availableRepos).toHaveLength(2);
    expect(settingsApi.set).toHaveBeenCalledWith('repoPath', 'C:/contexts/alpha');
  });

  it('switches repositories and refreshes the graph', async () => {
    const reposApi = toMockApi(window.api.repos);
    const settingsApi = toMockApi(window.api.settings);
    const contextApi = toMockApi(window.api.context);
    const reposWatch = vi.fn().mockResolvedValue({ ok: true });
    const reposOnFileChanged = vi.fn().mockReturnValue(() => { /* noop */ });
    reposApi.watch = reposWatch;
    reposApi.onFileChanged = reposOnFileChanged;

    const registry: RepoRegistryPayload = {
      activeRepoId: 'alpha',
      repos: [
        makeRegistryEntry('alpha', 'C:/contexts/alpha', 'Alpha Repo'),
        makeRegistryEntry('beta', 'D:/contexts/beta', 'Beta Repo'),
      ],
    };

    reposApi.list.mockResolvedValue({ ok: true, registry });
    settingsApi.get.mockResolvedValue({ ok: true, value: '' });
    settingsApi.set.mockResolvedValue({ ok: true });
    contextApi.buildGraph.mockResolvedValue({ nodes: [], edges: [] });

    const store = useContextStore();
    // Wait for auto-initialization
    await vi.waitFor(() => expect(store.isInitialized).toBe(true), { timeout: 1000 });

    // Setup for switching repos
    reposApi.list.mockResolvedValue({ ok: true, registry: { ...registry, activeRepoId: 'beta' } });
    reposApi.setActive.mockResolvedValue({ ok: true, registry: { ...registry, activeRepoId: 'beta' } });

    contextApi.buildGraph.mockClear();
    settingsApi.set.mockClear();

    await store.selectActiveRepo('beta');

    expect(reposApi.setActive).toHaveBeenCalledWith('beta');
    expect(settingsApi.set).toHaveBeenCalledWith('repoPath', 'D:/contexts/beta');
    expect(store.repoPath).toBe('D:/contexts/beta');
    expect(contextApi.buildGraph).toHaveBeenCalledWith('D:/contexts/beta');
  });

  it('adds a repository and activates it immediately', async () => {
    const reposApi = toMockApi(window.api.repos);
    const settingsApi = toMockApi(window.api.settings);
    const contextApi = toMockApi(window.api.context);
    const reposWatch = vi.fn().mockResolvedValue({ ok: true });
    const reposOnFileChanged = vi.fn().mockReturnValue(() => { /* noop */ });
    reposApi.watch = reposWatch;
    reposApi.onFileChanged = reposOnFileChanged;

    const initialRegistry: RepoRegistryPayload = {
      activeRepoId: null,
      repos: [],
    };

    const nextRegistry: RepoRegistryPayload = {
      activeRepoId: 'gamma',
      repos: [makeRegistryEntry('gamma', 'E:/contexts/gamma', 'Gamma Repo')],
    };

    reposApi.list.mockResolvedValue({ ok: true, registry: initialRegistry });
    settingsApi.get.mockResolvedValue({ ok: true, value: '' });
    settingsApi.set.mockResolvedValue({ ok: true });
    contextApi.buildGraph.mockResolvedValue({ nodes: [], edges: [] });
    reposApi.add.mockResolvedValue({ ok: true, registry: nextRegistry });

    const store = useContextStore();
    // Wait for auto-initialization
    await vi.waitFor(() => expect(store.isInitialized).toBe(true), { timeout: 1000 });

    const result = await store.addRepository({ label: '  Gamma Repo  ', path: '  E:/contexts/gamma  ' });

    expect(result.ok).toBe(true);
    expect(reposApi.add).toHaveBeenCalledWith({ label: 'Gamma Repo', path: 'E:/contexts/gamma', setActive: true });
    expect(store.repoPath).toBe('E:/contexts/gamma');
    expect(contextApi.buildGraph).toHaveBeenCalledWith('E:/contexts/gamma');
  });
});
