import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { useGitStore } from '../src/renderer/stores/gitStore';
import { useContextStore } from '../src/renderer/stores/contextStore';

type ApiWithMocks = Record<string, Mock>;

const toMockApi = (api: unknown): ApiWithMocks => api as ApiWithMocks;

describe('gitStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    
    const gitApi = toMockApi(window.api.git);
    gitApi.status.mockReset();
    gitApi.diff.mockReset();
    gitApi.commit.mockReset();
    gitApi.branch.mockReset();
    gitApi.createBranch.mockReset();
    gitApi.checkout.mockReset();
    gitApi.push.mockReset();
    gitApi.createPR.mockReset();
    
    const reposApi = toMockApi(window.api.repos);
    reposApi.list.mockResolvedValue({ ok: true, registry: { activeRepoId: null, repos: [] } });
    const settingsApi = toMockApi(window.api.settings);
    settingsApi.get.mockResolvedValue({ ok: true, value: '' });
    settingsApi.set.mockResolvedValue({ ok: true });
    
    // Setup contextStore with repo path
    const contextStore = useContextStore();
    await vi.waitFor(() => expect(contextStore.isInitialized).toBe(true), { timeout: 1000 });
    contextStore.repoPath = 'C:/test/repo';
  });

  describe('loadStatus', () => {
    it('successfully loads git status', async () => {
      const gitApi = toMockApi(window.api.git);
      const mockStatus = {
        ok: true,
        status: {
          current: 'main',
          tracking: 'origin/main',
          modified: ['contexts/features/FEAT-001.yaml'],
          created: ['contexts/specs/SPEC-001.yaml'],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 1,
          behind: 0,
        },
      };
      gitApi.status.mockResolvedValue(mockStatus);

      const store = useGitStore();
      const result = await store.loadStatus();

      expect(result).toBe(true);
      expect(store.status).toEqual(mockStatus.status);
      expect(store.currentBranch).toBe('main');
      expect(gitApi.status).toHaveBeenCalledWith('C:/test/repo');
    });

    it('handles error when loading status fails', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.status.mockResolvedValue({ ok: false, error: 'Git not found' });

      const store = useGitStore();
      const result = await store.loadStatus();

      expect(result).toBe(false);
      expect(store.error).toBe('Git not found');
    });

    it('returns false when repo path is not configured', async () => {
      const contextStore = useContextStore();
      contextStore.repoPath = '';

      const store = useGitStore();
      const result = await store.loadStatus();

      expect(result).toBe(false);
      expect(store.error).toBe('Repository path is not configured');
    });
  });

  describe('computed properties', () => {
    it('hasUncommittedChanges returns true when there are changes', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.status.mockResolvedValue({
        ok: true,
        status: {
          current: 'main',
          tracking: null,
          modified: ['file.yaml'],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 0,
          behind: 0,
        },
      });

      const store = useGitStore();
      await store.loadStatus();

      expect(store.hasUncommittedChanges).toBe(true);
    });

    it('hasUncommittedChanges returns false when there are no changes', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.status.mockResolvedValue({
        ok: true,
        status: {
          current: 'main',
          tracking: null,
          modified: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 0,
          behind: 0,
        },
      });

      const store = useGitStore();
      await store.loadStatus();

      expect(store.hasUncommittedChanges).toBe(false);
    });

    it('changedFiles filters to context files only', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.status.mockResolvedValue({
        ok: true,
        status: {
          current: 'main',
          tracking: null,
          modified: [
            'contexts/features/FEAT-001.yaml',
            'src/app.ts',
            '.context/schemas/feature.json',
          ],
          created: ['README.md'],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 0,
          behind: 0,
        },
      });

      const store = useGitStore();
      await store.loadStatus();

      expect(store.changedFiles).toEqual([
        'contexts/features/FEAT-001.yaml',
        '.context/schemas/feature.json',
      ]);
      expect(store.changedFilesCount).toBe(2);
    });
  });

  describe('loadBranches', () => {
    it('successfully loads branches', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.branch.mockResolvedValue({
        ok: true,
        current: 'main',
        branches: ['main', 'feature/auth', 'develop'],
      });

      const store = useGitStore();
      const result = await store.loadBranches();

      expect(result).toBe(true);
      expect(store.currentBranch).toBe('main');
      expect(store.allBranches).toEqual(['main', 'feature/auth', 'develop']);
    });
  });

  describe('commit', () => {
    it('successfully commits changes', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.commit.mockResolvedValue({ ok: true });
      gitApi.status.mockResolvedValue({
        ok: true,
        status: {
          current: 'main',
          tracking: null,
          modified: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 0,
          behind: 0,
        },
      });

      const store = useGitStore();
      const result = await store.commit('feat: add new feature', ['file.yaml']);

      expect(result).toBe(true);
      expect(gitApi.commit).toHaveBeenCalledWith('C:/test/repo', 'feat: add new feature', ['file.yaml']);
      expect(gitApi.status).toHaveBeenCalled();
    });

    it('handles commit failure', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.commit.mockResolvedValue({ ok: false, error: 'Nothing to commit' });

      const store = useGitStore();
      const result = await store.commit('feat: add feature');

      expect(result).toBe(false);
      expect(store.error).toBe('Nothing to commit');
    });
  });

  describe('createBranch', () => {
    it('successfully creates and checks out a branch', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.createBranch.mockResolvedValue({ ok: true });
      gitApi.branch.mockResolvedValue({
        ok: true,
        current: 'feature/new-branch',
        branches: ['main', 'feature/new-branch'],
      });
      gitApi.status.mockResolvedValue({
        ok: true,
        status: {
          current: 'feature/new-branch',
          tracking: null,
          modified: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 0,
          behind: 0,
        },
      });

      const store = useGitStore();
      const result = await store.createBranch('feature/new-branch', true);

      expect(result).toBe(true);
      expect(gitApi.createBranch).toHaveBeenCalledWith('C:/test/repo', 'feature/new-branch', true);
    });
  });

  describe('checkout', () => {
    it('successfully checks out a branch', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.checkout.mockResolvedValue({ ok: true });
      gitApi.status.mockResolvedValue({
        ok: true,
        status: {
          current: 'develop',
          tracking: null,
          modified: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 0,
          behind: 0,
        },
      });

      const store = useGitStore();
      const result = await store.checkout('develop');

      expect(result).toBe(true);
      expect(store.currentBranch).toBe('develop');
      expect(gitApi.checkout).toHaveBeenCalledWith('C:/test/repo', 'develop');
    });
  });

  describe('push', () => {
    it('successfully pushes changes', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.push.mockResolvedValue({ ok: true });
      gitApi.status.mockResolvedValue({
        ok: true,
        status: {
          current: 'main',
          tracking: 'origin/main',
          modified: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          staged: [],
          not_added: [],
          ahead: 0,
          behind: 0,
        },
      });

      const store = useGitStore();
      const result = await store.push('origin', 'main');

      expect(result).toBe(true);
      expect(gitApi.push).toHaveBeenCalledWith('C:/test/repo', 'origin', 'main');
    });
  });

  describe('createPR', () => {
    it('successfully creates a PR', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.createPR.mockResolvedValue({
        ok: true,
        url: 'https://github.com/org/repo/pull/123',
      });

      const store = useGitStore();
      const result = await store.createPR('Add new feature', 'This PR adds...', 'main');

      expect(result.ok).toBe(true);
      expect(result.url).toBe('https://github.com/org/repo/pull/123');
      expect(gitApi.createPR).toHaveBeenCalledWith('C:/test/repo', 'Add new feature', 'This PR adds...', 'main');
    });

    it('handles PR creation failure', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.createPR.mockResolvedValue({ ok: false, error: 'No GitHub token' });

      const store = useGitStore();
      const result = await store.createPR('Title', 'Body');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('No GitHub token');
    });
  });

  describe('clearError', () => {
    it('clears error state', async () => {
      const gitApi = toMockApi(window.api.git);
      gitApi.status.mockResolvedValue({ ok: false, error: 'Test error' });

      const store = useGitStore();
      await store.loadStatus();

      expect(store.error).toBe('Test error');

      store.clearError();

      expect(store.error).toBeNull();
    });
  });
});
