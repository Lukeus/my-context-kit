import { ipcMain } from 'electron';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { successWith, error } from '../types';

// Phase 2 T008: Path Resolution IPC handler
// Mirrors PowerShell common.ps1 logic per path-resolution.yaml contract.
// TODO(FailureModes): Enhance error codes for ambiguous feature branch detection.

const execAsync = promisify(exec);

interface PathResolutionRequest {
  includeFeatureBranch?: boolean;
  includeSpecPaths?: boolean;
}

interface PathResolutionResponse {
  repoRoot: string;
  currentBranch: string | null;
  specDir: string | null;
  specPaths: {
    spec?: string | null;
    plan?: string | null;
    tasks?: string | null;
  } | null;
  contextDir: string;
  error?: string | null;
}

/**
 * Core path resolution logic - can be called directly from main process or via IPC.
 */
export async function resolveRepositoryPaths(payload: PathResolutionRequest = {}): Promise<PathResolutionResponse> {
  const includeFeatureBranch = payload.includeFeatureBranch !== false; // default true
  const includeSpecPaths = payload.includeSpecPaths !== false; // default true

  const repoRoot = await resolveRepoRoot();
  const contextDir = path.join(repoRoot, 'context-repo');
  let currentBranch: string | null = null;

  if (includeFeatureBranch) {
    currentBranch = resolveFeatureBranchEnv() || (await resolveGitBranch(repoRoot));
  }

  let specDir: string | null = null;
  let specPaths: PathResolutionResponse['specPaths'] = null;

  if (currentBranch) {
    const candidate = path.join(repoRoot, 'specs', currentBranch);
    if (existsSync(candidate)) {
      specDir = candidate;
      if (includeSpecPaths) {
        specPaths = {
          spec: fileIfExists(path.join(candidate, 'spec.md')),
          plan: fileIfExists(path.join(candidate, 'plan.md')),
          tasks: fileIfExists(path.join(candidate, 'tasks.md')),
        };
      }
    }
  }

  return {
    repoRoot,
    currentBranch,
    specDir,
    specPaths,
    contextDir,
    error: null
  };
}

export function registerPathResolutionHandlers(): void {
  ipcMain.handle('path:resolve', async (_event, payload: PathResolutionRequest = {}): Promise<any> => {
    try {
      const response = await resolveRepositoryPaths(payload);
      return successWith(response);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return error(message);
    }
  });
}

async function resolveRepoRoot(): Promise<string> {
  // Attempt git rev-parse, fallback to process.cwd()
  try {
    const { stdout } = await execAsync('git rev-parse --show-toplevel');
    const root = stdout.trim();
    if (root) return root;
  } catch {
    // swallow
  }
  // Fallback: walk up until package.json present (heuristic)
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function resolveFeatureBranchEnv(): string | null {
  const envVar = process.env.SPECIFY_FEATURE || process.env.FEATURE_BRANCH;
  return envVar && envVar.trim().length > 0 ? envVar.trim() : null;
}

async function resolveGitBranch(repoRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git branch --show-current', { cwd: repoRoot });
    const branch = stdout.trim();
    return branch.length > 0 ? branch : null;
  } catch {
    return null;
  }
}

function fileIfExists(p: string): string | null {
  return existsSync(p) ? p : null;
}
