import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { simpleGit, type SimpleGit } from 'simple-git';
import { execa } from 'execa';
import { GitError, ValidationError } from '../errors/AppError';

export interface SerializedGitStatus {
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
  conflicted: string[];
  staged: string[];
  current: string;
  tracking: string | null;
  ahead: number;
  behind: number;
  not_added: string[];
}

export interface BranchInfo {
  current: string;
  branches: string[];
}

/**
 * Service for managing Git operations
 */
export class GitService {
  private git: SimpleGit;
  private readonly repoAbsolutePath: string;
  private readonly repoRootName: string;

  constructor(private readonly repoPath: string) {
    if (!repoPath || !repoPath.trim()) {
      throw new ValidationError('Repository path is required');
    }
    const resolvedPath = path.resolve(repoPath);
    this.repoAbsolutePath = resolvedPath;
    this.repoRootName = path.basename(resolvedPath);
    this.git = simpleGit(resolvedPath);
  }

  private toGitPath(filePath: string): string {
    const trimmed = filePath.trim();
    if (!trimmed) {
      return '';
    }

    if (path.isAbsolute(trimmed)) {
      const relative = path.relative(this.repoAbsolutePath, trimmed);
      return relative.split(path.sep).join('/');
    }

    let normalized = trimmed.replace(/\\/g, '/');

    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }

    if (this.repoRootName) {
      const repoPrefix = `${this.repoRootName}/`;
      if (normalized.startsWith(repoPrefix)) {
        normalized = normalized.slice(repoPrefix.length);
      }
    }

    return normalized;
  }

  private normalizeGitList(list?: string[]): string[] {
    if (!list) {
      return [];
    }
    return list
      .map(item => this.toGitPath(item))
      .filter((item): item is string => item.length > 0);
  }

  /**
   * Gets the current repository status
   */
  async getStatus(): Promise<SerializedGitStatus> {
    try {
      const status = await this.git.status();

      return {
        modified: this.normalizeGitList(status.modified),
        created: this.normalizeGitList(status.created),
        deleted: this.normalizeGitList(status.deleted),
        renamed: (status.renamed || []).map(entry => ({
          from: this.toGitPath(entry.from),
          to: this.toGitPath(entry.to)
        })),
        conflicted: this.normalizeGitList(status.conflicted),
        staged: this.normalizeGitList(status.staged),
        current: status.current || '',
        tracking: status.tracking || null,
        ahead: status.ahead || 0,
        behind: status.behind || 0,
        not_added: this.normalizeGitList(status.not_added)
      };
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to get git status',
        'status'
      );
    }
  }

  /**
   * Gets diff for a file or all changes
   */
  async getDiff(filePath?: string): Promise<string> {
    try {
      if (filePath) {
        const targetPath = this.toGitPath(filePath);

        if (!targetPath) {
          throw new ValidationError('File path is required');
        }

        // Check file status
        const status = await this.git.status();
        const created = this.normalizeGitList(status.created);
        const notAdded = this.normalizeGitList(status.not_added);
        const staged = this.normalizeGitList(status.staged);

        const isNewFile = created.includes(targetPath) ||
          notAdded.includes(targetPath);
        const isStaged = staged.includes(targetPath);

        if (isNewFile && !isStaged) {
          // For new untracked files, show the entire file content as "added"
          try {
            const content = await readFile(path.resolve(this.repoAbsolutePath, targetPath), 'utf-8');
            const lines = content.split('\n');
            const diff = lines.map(line => `+${line}`).join('\n');
            return `New file: ${targetPath}\n\n${diff}`;
          } catch {
            return 'New file (unable to read content)';
          }
        }

        // For staged files, use --cached flag
        if (isStaged) {
          const diff = await this.git.diff(['--cached', '--', targetPath]);
          return diff || 'No changes in staged file';
        }

        // For modified tracked files, use normal diff
        const diff = await this.git.diff(['--', targetPath]);
        return diff || 'No changes';
      } else {
        // Diff all changes
        const diff = await this.git.diff();
        return diff;
      }
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to get git diff',
        'diff',
        { filePath }
      );
    }
  }

  /**
   * Commits changes with optional file selection
   */
  async commit(message: string, files?: string[]): Promise<string> {
    if (!message || !message.trim()) {
      throw new ValidationError('Commit message is required');
    }

    try {
      // Add files (or all if not specified)
      if (files && files.length > 0) {
        const normalizedFiles = files
          .map(file => this.toGitPath(file))
          .filter((file): file is string => file.length > 0);

        if (normalizedFiles.length === 0) {
          throw new ValidationError('No valid files to commit');
        }

        await this.git.add(normalizedFiles);
      } else {
        await this.git.add('.');
      }

      // Commit
      const result = await this.git.commit(message);
      return result.commit;
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to commit changes',
        'commit',
        { message, files }
      );
    }
  }

  /**
   * Lists all branches
   */
  async getBranches(): Promise<BranchInfo> {
    try {
      const branch = await this.git.branchLocal();
      return {
        current: branch.current,
        branches: branch.all
      };
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to list branches',
        'branch'
      );
    }
  }

  /**
   * Creates a new branch
   */
  async createBranch(branchName: string, checkout = false): Promise<string> {
    if (!branchName || !branchName.trim()) {
      throw new ValidationError('Branch name is required');
    }

    try {
      if (checkout) {
        await this.git.checkoutLocalBranch(branchName);
      } else {
        await this.git.branch([branchName]);
      }

      return branchName;
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to create branch',
        'create-branch',
        { branchName, checkout }
      );
    }
  }

  /**
   * Checks out a branch
   */
  async checkout(branchName: string): Promise<string> {
    if (!branchName || !branchName.trim()) {
      throw new ValidationError('Branch name is required');
    }

    try {
      await this.git.checkout(branchName);
      return branchName;
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to checkout branch',
        'checkout',
        { branchName }
      );
    }
  }

  /**
   * Reverts a file to HEAD
   */
  async revertFile(filePath: string): Promise<void> {
    if (!filePath || !filePath.trim()) {
      throw new ValidationError('File path is required');
    }

    try {
      // Check if file is staged
      const status = await this.git.status();
      const staged = new Set(this.normalizeGitList(status.staged));
      const targetPath = this.toGitPath(filePath);

      if (!targetPath) {
        throw new ValidationError('File path is required');
      }

      if (staged.has(targetPath)) {
        // Unstage the file first
        await this.git.reset(['HEAD', '--', targetPath]);
      }

      // Revert the file to HEAD version
      await this.git.checkout(['HEAD', '--', targetPath]);
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to revert file',
        'revert',
        { filePath }
      );
    }
  }

  /**
   * Pushes changes to remote
   */
  async push(remote = 'origin', branch?: string): Promise<void> {
    try {
      await this.git.push(remote, branch);
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to push changes',
        'push',
        { remote, branch }
      );
    }
  }

  /**
   * Creates a pull request using GitHub CLI
   */
  async createPR(title: string, body: string, base?: string): Promise<string> {
    if (!title || !title.trim()) {
      throw new ValidationError('PR title is required');
    }

    try {
      const args = ['pr', 'create', '--title', title, '--body', body];
      if (base) {
        args.push('--base', base);
      }

      const result = await execa('gh', args, {
        cwd: this.repoPath
      });

      return result.stdout;
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to create pull request',
        'create-pr',
        { title, base, hint: 'Ensure GitHub CLI (gh) is installed and authenticated' }
      );
    }
  }

  /**
   * Initializes a new git repository
   */
  async init(): Promise<void> {
    try {
      await this.git.init();
    } catch (error: unknown) {
      throw new GitError(
        error instanceof Error ? error.message : 'Failed to initialize git repository',
        'init'
      );
    }
  }
}
