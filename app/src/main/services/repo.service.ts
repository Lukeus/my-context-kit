import { app } from 'electron';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import chokidar, { type FSWatcher } from 'chokidar';

const REPO_REGISTRY_FILE = 'repo-registry.json';
const REGISTRY_BACKUP_PREFIX = 'repo-registry.invalid';

export type RepoEntry = {
  id: string;
  label: string;
  path: string;
  createdAt: string;
  lastUsed: string;
  autoDetected?: boolean;
};

export type RepoRegistry = {
  activeRepoId: string | null;
  repos: RepoEntry[];
};

/**
 * Service responsible for managing repository registry operations
 */
export class RepoService {
  private repoWatchers = new Map<string, FSWatcher>();
  private registryCache: RepoRegistry | null = null;

  /**
   * Get the path to the repository registry file
   */
  private getRegistryPath(): string {
    return path.join(app.getPath('userData'), REPO_REGISTRY_FILE);
  }

  /**
   * Type guard for plain objects
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Sanitize and validate a repository entry
   */
  private sanitizeRepoEntry(value: unknown): RepoEntry | null {
    if (!this.isPlainObject(value)) {
      return null;
    }

    const idValue = value.id;
    const labelValue = value.label;
    const pathValue = value.path;
    const createdAtValue = value.createdAt;
    const lastUsedValue = value.lastUsed;
    const autoDetectedValue = value.autoDetected;

    if (typeof idValue !== 'string' || idValue.trim().length === 0) {
      return null;
    }

    if (typeof pathValue !== 'string' || pathValue.trim().length === 0) {
      return null;
    }

    const normalizeDate = (input: unknown): string => {
      if (typeof input === 'string' && !Number.isNaN(Date.parse(input))) {
        return input;
      }
      return new Date().toISOString();
    };

    const normalizedPath = pathValue;
    const normalizedLabel =
      typeof labelValue === 'string' && labelValue.trim().length > 0
        ? labelValue
        : path.basename(normalizedPath) || normalizedPath;
    const normalizedCreated = normalizeDate(createdAtValue);
    const normalizedLastUsed = normalizeDate(lastUsedValue);
    const normalizedAutoDetected =
      typeof autoDetectedValue === 'boolean' ? autoDetectedValue : undefined;

    return {
      id: idValue,
      label: normalizedLabel,
      path: normalizedPath,
      createdAt: normalizedCreated,
      lastUsed: normalizedLastUsed,
      autoDetected: normalizedAutoDetected,
    };
  }

  /**
   * Sanitize and validate a repository registry
   */
  private sanitizeRepoRegistry(value: unknown): RepoRegistry | null {
    if (!this.isPlainObject(value)) {
      return null;
    }

    const rawRepos = value.repos;
    if (!Array.isArray(rawRepos)) {
      return null;
    }

    const sanitizedRepos = rawRepos
      .map((repo) => this.sanitizeRepoEntry(repo))
      .filter((repo): repo is RepoEntry => repo !== null);

    if (sanitizedRepos.length === 0 && rawRepos.length > 0) {
      return null;
    }

    let activeRepoId: string | null = null;
    if (
      typeof value.activeRepoId === 'string' &&
      sanitizedRepos.some((repo) => repo.id === value.activeRepoId)
    ) {
      activeRepoId = value.activeRepoId;
    } else if (sanitizedRepos.length > 0) {
      activeRepoId = sanitizedRepos[0].id;
    }

    return {
      activeRepoId,
      repos: sanitizedRepos,
    };
  }

  private cloneRegistry(registry: RepoRegistry): RepoRegistry {
    return {
      activeRepoId: registry.activeRepoId,
      repos: registry.repos.map((repo) => ({ ...repo })),
    };
  }

  private snapshotRegistry(registry: RepoRegistry): RepoRegistry {
    this.registryCache = this.cloneRegistry(registry);
    return this.cloneRegistry(registry);
  }

  /**
   * Quarantine a corrupt registry file
   */
  private async quarantineCorruptRegistry(registryPath: string): Promise<void> {
    try {
      if (!existsSync(registryPath)) {
        return;
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${REGISTRY_BACKUP_PREFIX}-${timestamp}.json`;
      const backupPath = path.join(path.dirname(registryPath), backupName);
      await rename(registryPath, backupPath);
      console.warn(
        `Repository registry was invalid and has been quarantined as ${backupName}`
      );
    } catch (error) {
      console.warn('Failed to quarantine invalid repository registry.', error);
    }
  }

  /**
   * Canonicalize a repository path for comparison
   */
  private canonicalizeRepoPath(input: string): string {
    const normalizedPath = path.normalize(path.resolve(input));
    return process.platform === 'win32'
      ? normalizedPath.toLowerCase()
      : normalizedPath;
  }

  /**
   * Load the repository registry from disk
   */
  async loadRepoRegistry(options?: { bypassCache?: boolean }): Promise<RepoRegistry> {
    if (!options?.bypassCache && this.registryCache) {
      return this.cloneRegistry(this.registryCache);
    }

    const registryPath = this.getRegistryPath();
    try {
      const content = await readFile(registryPath, 'utf-8');
      const parsed = JSON.parse(content);
      const sanitized = this.sanitizeRepoRegistry(parsed);
      if (sanitized) {
        return this.snapshotRegistry(sanitized);
      }
      await this.quarantineCorruptRegistry(registryPath);
    } catch (error: any) {
      if (error?.name === 'SyntaxError') {
        await this.quarantineCorruptRegistry(registryPath);
      } else if (error?.code && error.code !== 'ENOENT') {
        console.warn(
          'Failed to load repository registry; falling back to defaults.',
          error
        );
      }
    }
    return this.snapshotRegistry({ activeRepoId: null, repos: [] });
  }

  /**
   * Save the repository registry to disk
   */
  async saveRepoRegistry(registry: RepoRegistry): Promise<void> {
    this.registryCache = this.cloneRegistry(registry);
    await writeFile(
      this.getRegistryPath(),
      JSON.stringify(registry, null, 2),
      'utf-8'
    );
  }

  /**
   * Add or update a repository entry
   */
  async upsertRepoEntry(
    repoPath: string,
    options: { label?: string; setActive?: boolean; autoDetected?: boolean } = {}
  ): Promise<RepoRegistry> {
    const normalizedPath = path.normalize(path.resolve(repoPath));
    const canonicalPath = this.canonicalizeRepoPath(normalizedPath);
    const registry = await this.loadRepoRegistry();
    const existing = registry.repos.find(
      (entry) => this.canonicalizeRepoPath(entry.path) === canonicalPath
    );
    const nowIso = new Date().toISOString();

    if (existing) {
      if (options.label && existing.label !== options.label) {
        existing.label = options.label;
      }
      if (options.autoDetected !== undefined) {
        existing.autoDetected = options.autoDetected;
      }
      if (options.setActive) {
        registry.activeRepoId = existing.id;
        existing.lastUsed = nowIso;
      }
    } else {
      const entry: RepoEntry = {
        id: randomUUID(),
        label: options.label || path.basename(normalizedPath) || normalizedPath,
        path: normalizedPath,
        createdAt: nowIso,
        lastUsed: nowIso,
        autoDetected: options.autoDetected,
      };
      registry.repos.push(entry);
      if (options.setActive ?? true) {
        registry.activeRepoId = entry.id;
      }
    }

    await this.saveRepoRegistry(registry);
    return this.cloneRegistry(registry);
  }

  /**
   * Remove a repository entry by ID
   */
  async removeRepoEntry(id: string): Promise<RepoRegistry> {
    const registry = await this.loadRepoRegistry();
    registry.repos = registry.repos.filter((entry) => entry.id !== id);
    if (registry.activeRepoId === id) {
      registry.activeRepoId = registry.repos[0]?.id ?? null;
      if (registry.activeRepoId) {
        const nextActive = registry.repos.find(
          (entry) => entry.id === registry.activeRepoId
        );
        if (nextActive) {
          nextActive.lastUsed = new Date().toISOString();
        }
      }
    }
    await this.saveRepoRegistry(registry);
    return this.cloneRegistry(registry);
  }

  /**
   * Update a repository entry by ID
   */
  async updateRepoEntry(
    id: string,
    updates: { label?: string; path?: string; autoDetected?: boolean }
  ): Promise<RepoRegistry> {
    const registry = await this.loadRepoRegistry();
    const repo = registry.repos.find((entry) => entry.id === id);
    if (!repo) {
      throw new Error('Repository not found');
    }

    if (updates.label) {
      repo.label = updates.label;
    }

    if (updates.path) {
      if (!existsSync(updates.path)) {
        throw new Error('Repository path does not exist');
      }
      const canonicalNew = this.canonicalizeRepoPath(updates.path);
      const collision = registry.repos.find(
        (entry) =>
          entry.id !== id &&
          this.canonicalizeRepoPath(entry.path) === canonicalNew
      );
      if (collision) {
        throw new Error('Another repository already uses this path');
      }
      repo.path = path.normalize(path.resolve(updates.path));
    }

    if (updates.autoDetected !== undefined) {
      repo.autoDetected = updates.autoDetected;
    }

    await this.saveRepoRegistry(registry);
    return this.cloneRegistry(registry);
  }

  /**
   * Set the active repository by ID
   */
  async setActiveRepo(id: string): Promise<RepoRegistry> {
    const registry = await this.loadRepoRegistry();
    const repo = registry.repos.find((entry) => entry.id === id);
    if (!repo) {
      throw new Error('Repository not found');
    }

    registry.activeRepoId = id;
    repo.lastUsed = new Date().toISOString();
    await this.saveRepoRegistry(registry);

    return this.cloneRegistry(registry);
  }

  /**
   * Ensure the active repository path exists, falling back to the first existing repo
   */
  async ensureActiveRepoPath(): Promise<string | null> {
    const registry = await this.loadRepoRegistry();
    const activeRepo = registry.repos.find(
      (entry) => entry.id === registry.activeRepoId
    );
    if (activeRepo && existsSync(activeRepo.path)) {
      return activeRepo.path;
    }

    const firstExisting = registry.repos
      .filter((entry) => entry.id !== registry.activeRepoId)
      .find((entry) => existsSync(entry.path));
    if (firstExisting) {
      registry.activeRepoId = firstExisting.id;
      firstExisting.lastUsed = new Date().toISOString();
      await this.saveRepoRegistry(registry);
      return firstExisting.path;
    }

    return null;
  }

  /**
   * Get the default repository path, checking environment, registry, and fallback candidates
   */
  async getDefaultRepoPath(): Promise<string> {
    const envOverride = process.env.CONTEXT_REPO_PATH;
    if (envOverride && existsSync(envOverride)) {
      await this.upsertRepoEntry(envOverride, {
        setActive: true,
        label: path.basename(envOverride),
      });
      return envOverride;
    }

    const activePath = await this.ensureActiveRepoPath();
    if (activePath) {
      return activePath;
    }

    const appPath = app.getAppPath();
    const candidates = [
      path.resolve(appPath, '..', 'context-repo'),
      path.resolve(appPath, '..', '..', 'context-repo'),
      path.resolve(process.cwd(), 'context-repo'),
    ];

    const matchingPath = candidates.find((candidate) => existsSync(candidate));
    if (matchingPath) {
      await this.upsertRepoEntry(matchingPath, {
        setActive: true,
        autoDetected: true,
        label: path.basename(matchingPath),
      });
      return matchingPath;
    }

    return '';
  }

  /**
   * Start watching a repository directory for file changes
   */
  async watchRepo(
    dir: string,
    onFileChange: (event: string, file: string) => void
  ): Promise<void> {
    const abs = path.resolve(dir);
    if (this.repoWatchers.has(abs)) {
      return;
    }
    const watcher = chokidar.watch(
      [path.join(abs, 'contexts'), path.join(abs, '.context', 'schemas')],
      {
        ignored: (p: string) => path.basename(p).startsWith('.'),
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      }
    );

    watcher.on('all', (evt, changedPath) => {
      // Only forward YAML or template/schema changes
      if (!changedPath.match(/\.(ya?ml|hbs|json)$/i)) return;
      onFileChange(evt, changedPath);
    });

    this.repoWatchers.set(abs, watcher);
  }

  /**
   * Stop watching a repository directory
   */
  async unwatchRepo(dir: string): Promise<void> {
    const abs = path.resolve(dir);
    const watcher = this.repoWatchers.get(abs);
    if (watcher) {
      await watcher.close();
      this.repoWatchers.delete(abs);
    }
  }

  /**
   * Clean up all watchers
   */
  async cleanup(): Promise<void> {
    for (const watcher of this.repoWatchers.values()) {
      await watcher.close();
    }
    this.repoWatchers.clear();
  }
}
