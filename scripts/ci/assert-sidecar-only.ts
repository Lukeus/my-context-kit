import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';

export interface SidecarGuardMatch {
  path: string;
  matches: string[];
}

export interface SidecarGuardResult {
  disallowedCount: number;
  scannedFileCount: number;
  durationMs: number;
  matches: SidecarGuardMatch[];
  pattern: string;
}

const DISALLOWED_PATTERN = /@azure\/openai|langchain|openai\s*from/gi;
const DEFAULT_RELATIVE_ROOT = join('app', 'src');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'generated']);
const ALLOWED_FILES = new Set([
  // Scripts in the sidecar service are allowed to reference providers directly.
  join('context-kit-service', 'src')
]);

function isAllowedPath(fullPath: string): boolean {
  for (const allowed of ALLOWED_FILES) {
    if (fullPath.includes(allowed)) {
      return true;
    }
  }
  return false;
}

function shouldRecurse(direntName: string): boolean {
  return !SKIP_DIRS.has(direntName);
}

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!shouldRecurse(entry.name)) {
        continue;
      }
      results.push(...collectFiles(join(dir, entry.name)));
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      if (!ext) continue;
      if (['ts', 'tsx', 'js', 'jsx', 'vue', 'mjs', 'cjs'].includes(ext)) {
        results.push(join(dir, entry.name));
      }
    }
  }
  return results;
}

export function runSidecarGuard(rootDir = process.cwd(), relativeScanRoot = DEFAULT_RELATIVE_ROOT): SidecarGuardResult {
  const started = performance.now();
  const scanRoot = join(rootDir, relativeScanRoot);
  let files: string[] = [];
  try {
    if (statSync(scanRoot).isDirectory()) {
      files = collectFiles(scanRoot);
    }
  } catch {
    // Missing directory treated as zero violations; upstream caller will handle gating failure if needed.
    files = [];
  }
  const matches: SidecarGuardMatch[] = [];
  let violationCount = 0;

  for (const file of files) {
    if (isAllowedPath(file)) {
      continue;
    }
    const content = readFileSync(file, 'utf8');
    const localMatches = Array.from(content.matchAll(DISALLOWED_PATTERN)).map(([text]) => text);
    if (localMatches.length > 0) {
      violationCount += localMatches.length;
      matches.push({
        path: relative(rootDir, file).replace(/\\/g, '/'),
        matches: localMatches
      });
    }
  }

  const durationMs = Math.round(performance.now() - started);

  return {
    disallowedCount: violationCount,
    scannedFileCount: files.length,
    durationMs,
    matches,
    pattern: DISALLOWED_PATTERN.source
  };
}

if (require.main === module) {
  try {
    const result = runSidecarGuard();
    console.log(JSON.stringify(result, null, 2));
    if (result.disallowedCount > 0) {
      console.error('[assert-sidecar-only] Disallowed provider imports detected.');
      process.exit(1);
    }
  } catch (error) {
    console.error('[assert-sidecar-only] Failed to scan repository:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// TODO(T028I-FollowUp): Allow opt-in override list for vetted test fixtures once destructive tool coverage lands.
