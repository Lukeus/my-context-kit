import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useContextStore } from './contextStore';

interface RenamedFile {
  from: string;
  to: string;
  type?: string;
}

interface GitStatus {
  modified: string[];
  created: string[];
  deleted: string[];
  renamed: RenamedFile[];
  conflicted: string[];
  staged: string[];
  current: string;
  tracking: string | null;
  ahead: number;
  behind: number;
  not_added?: string[];
}

export const useGitStore = defineStore('git', () => {
  const contextStore = useContextStore();

  // State
  const status = ref<GitStatus | null>(null);
  const currentBranch = ref<string>('');
  const allBranches = ref<string[]>([]);
  const diff = ref<string>('');
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const hasUncommittedChanges = computed(() => {
    if (!status.value) return false;
    return (
      status.value.modified.length > 0 ||
      status.value.created.length > 0 ||
      status.value.deleted.length > 0 ||
      status.value.renamed.length > 0 ||
      (status.value.not_added?.length ?? 0) > 0
    );
  });

  const changedFiles = computed(() => {
    if (!status.value) return [];
    
    // Filter to only show files in contexts directory (relative to repo root)
    const filterContexts = (files: string[]) => {
      return files.filter(f => f.includes('contexts/') || f.includes('.context/'));
    };
    
    const renamedTargets = status.value.renamed
      .map(entry => entry.to || entry.from)
      .filter(Boolean);

    const notAdded = status.value.not_added ?? [];

    const aggregated = [
      ...filterContexts(status.value.modified),
      ...filterContexts(status.value.created),
      ...filterContexts(status.value.deleted),
      ...filterContexts(renamedTargets),
      ...filterContexts(notAdded)
    ];

    return Array.from(new Set(aggregated));
  });

  const changedFilesCount = computed(() => changedFiles.value.length);

  // Actions
  async function loadStatus() {
    isLoading.value = true;
    error.value = null;

    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return false;
      }

      const result = await window.api.git.status(contextStore.repoPath);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to load git status';
        return false;
      }

      status.value = result.status;
      currentBranch.value = result.status.current;
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to load git status';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadBranches() {
    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return false;
      }

      const result = await window.api.git.branch(contextStore.repoPath);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to load branches';
        return false;
      }

      currentBranch.value = result.current;
      allBranches.value = result.branches;
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to load branches';
      return false;
    }
  }

  async function loadDiff(filePath?: string) {
    isLoading.value = true;
    error.value = null;

    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return false;
      }

      const result = await window.api.git.diff(contextStore.repoPath, filePath);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to load diff';
        return false;
      }

      diff.value = result.diff;
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to load diff';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function commit(message: string, files?: string[]) {
    isLoading.value = true;
    error.value = null;

    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return false;
      }

      const result = await window.api.git.commit(contextStore.repoPath, message, files);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to commit';
        return false;
      }

      // Reload status after commit
      await loadStatus();
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to commit';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function createBranch(branchName: string, checkout = false) {
    isLoading.value = true;
    error.value = null;

    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return false;
      }

      const result = await window.api.git.createBranch(contextStore.repoPath, branchName, checkout);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to create branch';
        return false;
      }

      // Reload branches
      await loadBranches();
      await loadStatus();
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to create branch';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function checkout(branchName: string) {
    isLoading.value = true;
    error.value = null;

    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return false;
      }

      const result = await window.api.git.checkout(contextStore.repoPath, branchName);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to checkout branch';
        return false;
      }

      currentBranch.value = branchName;
      await loadStatus();
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to checkout branch';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function push(remote?: string, branch?: string) {
    isLoading.value = true;
    error.value = null;

    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return false;
      }

      const result = await window.api.git.push(contextStore.repoPath, remote, branch);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to push';
        return false;
      }

      await loadStatus();
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to push';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function createPR(title: string, body: string, base?: string) {
    isLoading.value = true;
    error.value = null;

    try {
      if (!contextStore.repoPath) {
        error.value = 'Repository path is not configured';
        return { ok: false, error: error.value };
      }

      const result = await window.api.git.createPR(contextStore.repoPath, title, body, base);
      
      if (!result.ok) {
        error.value = result.error || 'Failed to create PR';
        return { ok: false, error: error.value };
      }

      return { ok: true, url: result.url };
    } catch (err: any) {
      error.value = err.message || 'Failed to create PR';
      return { ok: false, error: error.value };
    } finally {
      isLoading.value = false;
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    // State
    status,
    currentBranch,
    allBranches,
    diff,
    isLoading,
    error,
    // Computed
    hasUncommittedChanges,
    changedFiles,
    changedFilesCount,
    // Actions
    loadStatus,
    loadBranches,
    loadDiff,
    commit,
    createBranch,
    checkout,
    push,
    createPR,
    clearError
  };
});
