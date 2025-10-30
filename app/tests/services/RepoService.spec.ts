import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepoService } from '~main/services/repo.service';
import * as fsPromises from 'node:fs/promises';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Use vi.hoisted to ensure mockWatchFn is available during vi.mock hoisting
const { mockWatchFn, createMockWatcher } = vi.hoisted(() => {
  const createMockWatcher = () => ({
    on: vi.fn(),
    close: vi.fn(),
  });
  
  const mockWatchFn = vi.fn(createMockWatcher);
  
  return { mockWatchFn, createMockWatcher };
});

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(tmpdir(), 'context-kit-tests')),
    getAppPath: vi.fn(() => path.join(tmpdir(), 'context-kit-app')),
  },
}));

vi.mock('node:fs', () => {
  const mocks = {
    existsSync: vi.fn(),
  };
  return {
    ...mocks,
    default: mocks,
  };
});

vi.mock('node:fs/promises', () => {
  const mocks = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
  };
  return {
    ...mocks,
    default: mocks,
  };
});

vi.mock('chokidar', () => ({
  default: {
    watch: mockWatchFn,
  },
  watch: mockWatchFn,
}));

describe('RepoService', () => {
  let service: RepoService;

  beforeEach(() => {
    service = new RepoService();
    vi.clearAllMocks();
    // Setup default mock watcher behavior
    mockWatchFn.mockImplementation(createMockWatcher);
  });

  describe('loadRepoRegistry', () => {
    it('should load valid registry from file', async () => {
      const mockRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Test Repo',
            path: '/test/path',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(mockRegistry)
      );

      const result = await service.loadRepoRegistry();

      expect(result).toEqual(mockRegistry);
      expect(fsPromises.readFile).toHaveBeenCalled();
    });

    it('should return empty registry when file does not exist', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const result = await service.loadRepoRegistry();

      expect(result).toEqual({ activeRepoId: null, repos: [] });
    });

    it('should handle corrupt registry by quarantining', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue('{ invalid json');
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.rename).mockResolvedValue(undefined);

      const result = await service.loadRepoRegistry();

      expect(result).toEqual({ activeRepoId: null, repos: [] });
      expect(fsPromises.rename).toHaveBeenCalled();
    });

    it('should sanitize and fix invalid repo entries', async () => {
      const mockRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Valid Repo',
            path: '/valid/path',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
          {
            // Missing required fields
            id: '',
            label: 'Invalid Repo',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(mockRegistry)
      );

      const result = await service.loadRepoRegistry();

      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].id).toBe('repo-1');
    });
  });

  describe('saveRepoRegistry', () => {
    it('should save registry to file', async () => {
      const mockRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Test Repo',
            path: '/test/path',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      await service.saveRepoRegistry(mockRegistry);

      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify(mockRegistry, null, 2),
        'utf-8'
      );
    });

    it('should throw error on write failure', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(
        service.saveRepoRegistry({ activeRepoId: null, repos: [] })
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('upsertRepoEntry', () => {
    beforeEach(() => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify({ activeRepoId: null, repos: [] })
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    });

    it('should add new repo entry', async () => {
      const result = await service.upsertRepoEntry('/new/repo', {
        label: 'New Repo',
        setActive: true,
      });

      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].label).toBe('New Repo');
      expect(result.repos[0].path).toContain('new');
      expect(result.activeRepoId).toBe(result.repos[0].id);
    });

    it('should update existing repo entry', async () => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Old Label',
            path: '/test/path',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );

      const result = await service.upsertRepoEntry('/test/path', {
        label: 'New Label',
        setActive: true,
      });

      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].label).toBe('New Label');
      expect(result.repos[0].id).toBe('repo-1');
    });

    it('should set autoDetected flag when provided', async () => {
      const result = await service.upsertRepoEntry('/new/repo', {
        label: 'Auto Repo',
        autoDetected: true,
      });

      expect(result.repos[0].autoDetected).toBe(true);
    });

    it('should not set active by default if setActive is false', async () => {
      const result = await service.upsertRepoEntry('/new/repo', {
        label: 'New Repo',
        setActive: false,
      });

      expect(result.activeRepoId).toBeNull();
    });
  });

  describe('removeRepoEntry', () => {
    beforeEach(() => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Repo 1',
            path: '/repo1',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'repo-2',
            label: 'Repo 2',
            path: '/repo2',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    });

    it('should remove repo entry by id', async () => {
      const result = await service.removeRepoEntry('repo-2');

      expect(result.repos).toHaveLength(1);
      expect(result.repos[0].id).toBe('repo-1');
    });

    it('should update active repo when removing active repo', async () => {
      const result = await service.removeRepoEntry('repo-1');

      expect(result.repos).toHaveLength(1);
      expect(result.activeRepoId).toBe('repo-2');
    });

    it('should set activeRepoId to null when removing last repo', async () => {
      await service.removeRepoEntry('repo-2');
      const result = await service.removeRepoEntry('repo-1');

      expect(result.repos).toHaveLength(0);
      expect(result.activeRepoId).toBeNull();
    });
  });

  describe('updateRepoEntry', () => {
    beforeEach(() => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Repo 1',
            path: '/repo1',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    });

    it('should update repo label', async () => {
      const result = await service.updateRepoEntry('repo-1', {
        label: 'Updated Label',
      });

      expect(result.repos[0].label).toBe('Updated Label');
    });

    it('should update repo path', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await service.updateRepoEntry('repo-1', {
        path: '/new/path',
      });

      expect(result.repos[0].path).toContain('new');
    });

    it('should throw error if repo not found', async () => {
      await expect(
        service.updateRepoEntry('non-existent', { label: 'Test' })
      ).rejects.toThrow('Repository not found');
    });

    it('should throw error if new path does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        service.updateRepoEntry('repo-1', { path: '/invalid/path' })
      ).rejects.toThrow('Repository path does not exist');
    });

    it('should throw error if path collides with another repo', async () => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Repo 1',
            path: '/repo1',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'repo-2',
            label: 'Repo 2',
            path: '/repo2',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(
        service.updateRepoEntry('repo-1', { path: '/repo2' })
      ).rejects.toThrow('Another repository already uses this path');
    });
  });

  describe('setActiveRepo', () => {
    beforeEach(() => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Repo 1',
            path: '/repo1',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'repo-2',
            label: 'Repo 2',
            path: '/repo2',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    });

    it('should set active repo by id', async () => {
      const result = await service.setActiveRepo('repo-2');

      expect(result.activeRepoId).toBe('repo-2');
    });

    it('should update lastUsed timestamp', async () => {
      const beforeTime = new Date().toISOString();
      const result = await service.setActiveRepo('repo-2');
      const afterTime = new Date().toISOString();

      const activeRepo = result.repos.find((r) => r.id === 'repo-2');
      expect(activeRepo?.lastUsed).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(activeRepo!.lastUsed >= beforeTime).toBe(true);
      expect(activeRepo!.lastUsed <= afterTime).toBe(true);
    });

    it('should throw error if repo not found', async () => {
      await expect(service.setActiveRepo('non-existent')).rejects.toThrow(
        'Repository not found'
      );
    });
  });

  describe('ensureActiveRepoPath', () => {
    it('should return active repo path if it exists', async () => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Repo 1',
            path: '/repo1',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await service.ensureActiveRepoPath();

      expect(result).toContain('repo1');
    });

    it('should fallback to first existing repo if active does not exist', async () => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Repo 1',
            path: '/repo1',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'repo-2',
            label: 'Repo 2',
            path: '/repo2',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // repo-1 doesn't exist
        .mockReturnValueOnce(true); // repo-2 exists

      const result = await service.ensureActiveRepoPath();

      expect(result).toContain('repo2');
    });

    it('should return null if no repos exist', async () => {
      const existingRegistry = {
        activeRepoId: null,
        repos: [],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );

      const result = await service.ensureActiveRepoPath();

      expect(result).toBeNull();
    });
  });

  describe('getDefaultRepoPath', () => {
    beforeEach(() => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify({ activeRepoId: null, repos: [] })
      );
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    });

    it('should return env override if set', async () => {
      process.env.CONTEXT_REPO_PATH = '/env/repo';
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await service.getDefaultRepoPath();

      expect(result).toBe('/env/repo');
      delete process.env.CONTEXT_REPO_PATH;
    });

    it('should return active repo path if available', async () => {
      const existingRegistry = {
        activeRepoId: 'repo-1',
        repos: [
          {
            id: 'repo-1',
            label: 'Repo 1',
            path: '/active/repo',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastUsed: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(fsPromises.readFile).mockResolvedValue(
        JSON.stringify(existingRegistry)
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const result = await service.getDefaultRepoPath();

      expect(result).toContain('active');
    });

    it('should search candidate paths and return first match', async () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const result = await service.getDefaultRepoPath();

      expect(result).toContain('context-repo');
    });

    it('should return empty string if no candidates found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await service.getDefaultRepoPath();

      expect(result).toBe('');
    });
  });

  describe('watchRepo', () => {
    it('should set up file watcher', async () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      mockWatchFn.mockReturnValueOnce(mockWatcher);

      const onFileChange = vi.fn();
      await service.watchRepo('/test/repo', onFileChange);

      expect(mockWatchFn).toHaveBeenCalled();
      expect(mockWatcher.on).toHaveBeenCalledWith('all', expect.any(Function));
    });

    it('should not create duplicate watchers', async () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn(),
      };
      mockWatchFn.mockReturnValue(mockWatcher);

      const onFileChange = vi.fn();
      await service.watchRepo('/test/repo', onFileChange);
      await service.watchRepo('/test/repo', onFileChange);

      expect(mockWatchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('unwatchRepo', () => {
    it('should close and remove watcher', async () => {
      const mockWatcher = {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockWatchFn.mockReturnValue(mockWatcher);

      const onFileChange = vi.fn();
      await service.watchRepo('/test/repo', onFileChange);
      await service.unwatchRepo('/test/repo');

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should handle unwatching non-existent repo gracefully', async () => {
      await expect(service.unwatchRepo('/non/existent')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should close all watchers', async () => {
      const mockWatcher1 = {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockWatcher2 = {
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      mockWatchFn
        .mockReturnValueOnce(mockWatcher1)
        .mockReturnValueOnce(mockWatcher2);

      const onFileChange = vi.fn();
      await service.watchRepo('/test/repo1', onFileChange);
      await service.watchRepo('/test/repo2', onFileChange);
      await service.cleanup();

      expect(mockWatcher1.close).toHaveBeenCalled();
      expect(mockWatcher2.close).toHaveBeenCalled();
    });
  });
});
