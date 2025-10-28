#!/usr/bin/env node

/**
 * Spec Kit Fetch Pipeline
 *
 * Deterministically hydrates Spec Kit releases into `.context/speckit-cache/<tag>`.
 * Enforces single-run locking via `.context/state/speckit-fetch.lock` and emits a
 * structured summary JSON compatible with the renderer.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '../..');
const FIVE_MINUTES_MS = 5 * 60 * 1000;

function createPathContext(repoRoot) {
  const resolvedRoot = path.resolve(repoRoot ?? DEFAULT_REPO_ROOT);
  const stateDir = path.join(resolvedRoot, '.context', 'state');
  const cacheRoot = path.join(resolvedRoot, '.context', 'speckit-cache');
  const lockFile = path.join(stateDir, 'speckit-fetch.lock');
  const summaryFile = path.join(stateDir, 'speckit-fetch.json');
  const repoCacheDir = path.join(resolvedRoot, '.context', '.cache', 'spec-kit-repo');

  return {
    repoRoot: resolvedRoot,
    stateDir,
    cacheRoot,
    lockFile,
    summaryFile,
    repoCacheDir,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = createPathContext(args.repoPath);
  const now = new Date();

  await ensureDirectories(paths);

  const warnings = [];
  const lockState = await checkLock(paths);

  if (lockState.locked) {
    output({
      ok: false,
      inProgress: true,
      startedAt: lockState.lock?.acquiredAt ?? null,
      error: 'Spec Kit fetch already in progress'
    });
    process.exit(202);
  }

  if (lockState.staleMessage) {
    warnings.push(lockState.staleMessage);
  }

  await writeLock(paths, { ownerPid: process.pid, acquiredAt: now.toISOString() });

  try {
    const summary = await runFetch({
      releaseTag: args.releaseTag,
      forceRefresh: args.forceRefresh,
      now,
      paths,
    });

    if (warnings.length > 0) {
      summary.warnings = warnings;
    }

    await writeSummary(paths, summary);
    output({ ok: true, ...summary });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await writeSummary(paths, {
      source: {
        repository: 'github/spec-kit',
        releaseTag: args.releaseTag ?? null,
        commit: null
      },
      timing: {
        startedAt: now.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0
      },
      artifacts: {
        docs: [],
        templates: [],
        memory: []
      },
      status: {
        ok: false,
        error: err.message,
        stale: true
      }
    });
    output({ ok: false, error: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    await removeLock(paths);
  }
}

function parseArgs(argv) {
  const args = { repoPath: DEFAULT_REPO_ROOT, releaseTag: null, forceRefresh: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repoPath') {
      args.repoPath = path.resolve(argv[++i]);
    } else if (arg === '--releaseTag') {
      args.releaseTag = argv[++i];
    } else if (arg === '--forceRefresh') {
      args.forceRefresh = true;
    }
  }
  if (!args.repoPath) {
    throw new Error('`--repoPath` is required');
  }
  return args;
}

async function ensureDirectories(paths) {
  await fsp.mkdir(paths.stateDir, { recursive: true });
  await fsp.mkdir(paths.cacheRoot, { recursive: true });
  await fsp.mkdir(path.dirname(paths.repoCacheDir), { recursive: true });
}

async function checkLock(paths) {
  try {
    const content = await fsp.readFile(paths.lockFile, 'utf-8');
    const data = JSON.parse(content);

    if (!data?.acquiredAt) {
      return { locked: false };
    }

    const acquiredTimestamp = Date.parse(data.acquiredAt);
    if (Number.isNaN(acquiredTimestamp)) {
      return { locked: false };
    }

    const ageMs = Date.now() - acquiredTimestamp;
    if (ageMs >= FIVE_MINUTES_MS) {
      await removeLock(paths);
      const staleMessage = `Removed stale Spec Kit fetch lock acquired at ${data.acquiredAt}`;
      console.warn(staleMessage);
      return { locked: false, staleMessage };
    }

    return { locked: true, lock: data };
  } catch {
    return { locked: false };
  }
}

async function writeLock(paths, lock) {
  await fsp.writeFile(paths.lockFile, JSON.stringify(lock, null, 2), 'utf-8');
}

async function removeLock(paths) {
  try {
    await fsp.unlink(paths.lockFile);
  } catch {
    // ignore
  }
}

async function runFetch({ releaseTag, forceRefresh, now, paths }) {
  const gitDir = paths.repoCacheDir;
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'speckit-fetch-'));
  try {
    const tag = releaseTag ?? (await resolveLatestReleaseTag());
    const commit = await cloneOrUpdate({ gitDir, tmpDir, tag, forceRefresh });
    const cachePath = path.join(paths.cacheRoot, tag);

    await clearCacheIfNeeded({ cachePath, forceRefresh });
    await copyArtifacts({ sourceDir: tmpDir, tag, cachePath });

    const artifacts = await catalogArtifacts(cachePath);

    const finishedAt = new Date();
    const summary = {
      cachePath,
      commit,
      releaseTag: tag,
      durationMs: finishedAt.getTime() - now.getTime(),
      fetchedAt: finishedAt.toISOString(),
      artifacts,
      source: {
        repository: 'github/spec-kit',
        releaseTag: tag,
        commit
      },
      timing: {
        startedAt: now.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - now.getTime()
      },
      status: {
        ok: true,
        error: null,
        stale: false
      }
    };

    return summary;
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
}

async function resolveLatestReleaseTag() {
  // fallback to `git ls-remote --tags` to determine latest semver tag
  const remote = 'https://github.com/github/spec-kit.git';
  const tags = await exec('git', ['ls-remote', '--tags', remote]);
  const matches = tags.split('\n')
    .map(line => line.trim())
    .filter(line => line.endsWith('^{}'))
    .map(line => line.split('\t')[1].replace('refs/tags/', '').replace('^{}', ''));

  if (matches.length === 0) {
    throw new Error('Unable to determine latest Spec Kit release tag');
  }

  const sorted = matches.sort(compareSemver);
  return sorted[sorted.length - 1];
}

function compareSemver(a, b) {
  const clean = value => value.replace(/^v/, '').split('.').map(num => parseInt(num, 10));
  const [aMaj, aMin, aPatch] = clean(a);
  const [bMaj, bMin, bPatch] = clean(b);
  if (aMaj !== bMaj) return aMaj - bMaj;
  if (aMin !== bMin) return aMin - bMin;
  return (aPatch ?? 0) - (bPatch ?? 0);
}

async function cloneOrUpdate({ gitDir, tmpDir, tag, forceRefresh }) {
  const remote = 'https://github.com/github/spec-kit.git';
  const exists = fs.existsSync(gitDir);

  if (!exists || forceRefresh) {
    await fsp.rm(gitDir, { recursive: true, force: true });
    await fsp.mkdir(path.dirname(gitDir), { recursive: true });
    await exec('git', ['clone', '--depth', '1', '--branch', tag, remote, gitDir]);
  } else {
    await exec('git', ['-C', gitDir, 'fetch', '--tags', remote]);
    await exec('git', ['-C', gitDir, 'checkout', '--force', tag]);
  }

  await exec('git', ['-C', gitDir, 'reset', '--hard']);
  await exec('git', ['-C', gitDir, 'clean', '-fd']);

  // copy to tmp dir to work without mutating local cache mid-run
  await copyDirectory(gitDir, tmpDir);

  const commit = (await exec('git', ['-C', tmpDir, 'rev-parse', 'HEAD'])).trim();
  return commit;
}

async function clearCacheIfNeeded({ cachePath, forceRefresh }) {
  if (forceRefresh) {
    await fsp.rm(cachePath, { recursive: true, force: true });
  }
  await fsp.mkdir(cachePath, { recursive: true });
}

async function copyArtifacts({ sourceDir, tag, cachePath }) {
  const subdirs = ['docs', 'templates', 'memory'];
  for (const dir of subdirs) {
    const from = path.join(sourceDir, dir);
    const to = path.join(cachePath, dir);
    await fsp.rm(to, { recursive: true, force: true });
    if (fs.existsSync(from)) {
      await fsp.mkdir(to, { recursive: true });
      await copyDirectory(from, to);
    }
  }
  await fsp.writeFile(path.join(cachePath, 'METADATA.json'), JSON.stringify({ releaseTag: tag }, null, 2));
}

async function catalogArtifacts(cachePath) {
  const inventory = { docs: [], templates: [], memory: [] };
  for (const key of Object.keys(inventory)) {
    const dir = path.join(cachePath, key);
    if (!fs.existsSync(dir)) continue;
    const files = await walkFiles(dir, f => f.endsWith('.md'));
    inventory[key] = files.map(file => path.relative(cachePath, file).replace(/\\/g, '/'));
  }
  return inventory;
}

async function walkFiles(dir, predicate) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath, predicate);
    }
    return predicate(entry.name) ? [fullPath] : [];
  }));
  return files.flat();
}

async function exec(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed: ${stderr.trim() || stdout.trim()}`));
      }
    });
  });
}

async function copyDirectory(from, to) {
  await fsp.mkdir(to, { recursive: true });
  const entries = await fsp.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(src, dest);
    } else if (entry.isFile()) {
      await fsp.copyFile(src, dest);
    }
  }
}

async function writeSummary(paths, summary) {
  await fsp.mkdir(path.dirname(paths.summaryFile), { recursive: true });
  const payload = { ...summary };
  if (Array.isArray(payload.warnings) && payload.warnings.length === 0) {
    delete payload.warnings;
  }
  await fsp.writeFile(paths.summaryFile, JSON.stringify(payload, null, 2), 'utf-8');
}

function output(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

await main();
