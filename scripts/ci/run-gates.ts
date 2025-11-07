import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { runSidecarGuard, SidecarGuardResult } from './assert-sidecar-only';

interface GateDetail {
  ok: boolean;
  reason?: string;
  durationMs: number;
  data?: Record<string, unknown>;
}

type GateKey = 'sidecarOnly' | 'checksumMatch' | 'classificationEnforced' | 'interactionSlo';

interface GateArtifact {
  version: string;
  generatedAt: string;
  commit: string;
  gates: Record<GateKey, boolean>;
  details: Record<GateKey, GateDetail>;
  checksum?: string;
}

const ARTIFACT_VERSION = '1.0.0';
const DEFAULT_OUTPUT = join('context-repo', 'generated', 'gate-status.json');
const INTERACTION_ARTIFACT = ['generated', 'perf', 'interaction.json'];
const DEFAULT_INTERACTION_SLO_SECONDS = 180;

function nowIso(): string {
  return new Date().toISOString();
}

function ensureDirFor(filePath: string): void {
  const dir = dirname(filePath);
  if (!dir) return;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getGitSha(repoRoot: string): string {
  const fromEnv = process.env.GITHUB_SHA || process.env.GIT_SHA;
  if (fromEnv) {
    return fromEnv;
  }
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  if (result.status === 0 && typeof result.stdout === 'string') {
    return result.stdout.trim();
  }
  return 'UNKNOWN_SHA';
}

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function computeEmbeddingsGate(contextRepoPath: string): { detail: GateDetail; checksum?: string } {
  const started = performance.now();
  const metadataPath = join(contextRepoPath, 'generated', 'embeddings', 'metadata.json');
  const metadata = loadJson<{ checksum?: string; vectorFile?: string; totalEntries?: number }>(metadataPath);
  if (!metadata || !metadata.checksum) {
    return {
      detail: {
        ok: false,
        reason: metadata ? 'Embeddings metadata missing checksum field.' : 'Embeddings metadata not found. Run build-embeddings pipeline first.',
        durationMs: Math.round(performance.now() - started)
      }
    };
  }

  const vectorRelative = metadata.vectorFile ?? join('generated', 'embeddings', 'corpus.jsonl');
  const vectorPath = resolve(contextRepoPath, vectorRelative);
  if (!existsSync(vectorPath)) {
    return {
      detail: {
        ok: false,
        reason: `Embeddings corpus missing at ${relative(contextRepoPath, vectorPath)}.`,
        durationMs: Math.round(performance.now() - started)
      },
      checksum: metadata.checksum
    };
  }

  let recomputed: string;
  try {
    const contents = readFileSync(vectorPath, 'utf8')
      .split('\n')
      .filter(Boolean);
    const hash = createHash('sha256');
    for (const line of contents) {
      try {
        const entry = JSON.parse(line) as { id?: string; text?: string };
        hash.update(String(entry.id ?? ''));
        hash.update('\n');
        hash.update(String(entry.text ?? ''));
        hash.update('\n');
      } catch {
        return {
          detail: {
            ok: false,
            reason: 'Failed to parse embeddings corpus entry (JSON malformed).',
            durationMs: Math.round(performance.now() - started)
          },
          checksum: metadata.checksum
        };
      }
    }
    recomputed = hash.digest('hex');
  } catch (error) {
    return {
      detail: {
        ok: false,
        reason: error instanceof Error ? error.message : 'Failed to recompute embeddings checksum.',
        durationMs: Math.round(performance.now() - started)
      },
      checksum: metadata.checksum
    };
  }

  const ok = recomputed === metadata.checksum;
  return {
    detail: {
      ok,
      reason: ok ? undefined : `Checksum mismatch: computed ${recomputed} expected ${metadata.checksum}.`,
      durationMs: Math.round(performance.now() - started),
      data: {
        totalEntries: metadata.totalEntries ?? null,
        corpusFile: relative(contextRepoPath, vectorPath).replace(/\\/g, '/'),
        recomputed
      }
    },
    checksum: metadata.checksum
  };
}

function computeSidecarGate(repoRoot: string): { detail: GateDetail } {
  const started = performance.now();
  let result: SidecarGuardResult;
  try {
    result = runSidecarGuard(repoRoot);
  } catch (error) {
    return {
      detail: {
        ok: false,
        reason: error instanceof Error ? error.message : 'Sidecar guard execution failed.',
        durationMs: Math.round(performance.now() - started)
      }
    };
  }

  const ok = result.disallowedCount === 0;
  return {
    detail: {
      ok,
      reason: ok ? undefined : 'Disallowed provider imports detected outside sidecar service.',
      durationMs: Math.round(performance.now() - started),
      data: {
        violations: result.matches,
        scannedFileCount: result.scannedFileCount,
        pattern: result.pattern
      }
    }
  };
}

function computeClassificationGate(repoRoot: string): { detail: GateDetail } {
  const started = performance.now();
  const classificationModule = join(repoRoot, 'app', 'src', 'renderer', 'services', 'assistant', 'toolClassification.ts');
  if (!existsSync(classificationModule)) {
    return {
      detail: {
        ok: false,
        reason: 'toolClassification module not found (T028G pending).',
        durationMs: Math.round(performance.now() - started)
      }
    };
  }

  try {
    const content = readFileSync(classificationModule, 'utf8');
    const hasEnum = content.includes('enum SafetyClass');
    const hasPolicy = content.includes('applyClassificationPolicy');
    const ok = hasEnum && hasPolicy;
    return {
      detail: {
        ok,
        reason: ok ? undefined : 'Classification module missing expected exports.',
        durationMs: Math.round(performance.now() - started),
        data: {
          hasEnum,
          hasPolicy
        }
      }
    };
  } catch (error) {
    return {
      detail: {
        ok: false,
        reason: error instanceof Error ? error.message : 'Failed to inspect classification module.',
        durationMs: Math.round(performance.now() - started)
      }
    };
  }
}

function computeInteractionSloGate(repoRoot: string): { detail: GateDetail } {
  const started = performance.now();
  const artifactPath = resolve(repoRoot, ...INTERACTION_ARTIFACT);
  const artifactRel = relative(repoRoot, artifactPath).replace(/\\/g, '/');
  if (!existsSync(artifactPath)) {
    return {
      detail: {
        ok: false,
        reason: `Interaction latency artifact missing at ${artifactRel}. Run the harness before invoking CI gates.`,
        durationMs: Math.round(performance.now() - started)
      }
    };
  }

  try {
    const raw = readFileSync(artifactPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      stats?: { median?: number; p95?: number };
      metric?: string;
      version?: string;
      discardedOutliers?: number;
      samples?: number;
    };
    const sloSeconds = Number(process.env.INTERACTION_SLO_SECONDS ?? DEFAULT_INTERACTION_SLO_SECONDS);
    const median = parsed?.stats?.median;

    if (typeof median !== 'number' || Number.isNaN(median)) {
      return {
        detail: {
          ok: false,
          reason: 'Interaction artifact missing median statistic.',
          durationMs: Math.round(performance.now() - started)
        }
      };
    }

    if (median < 0) {
      return {
        detail: {
          ok: false,
          reason: 'Interaction median must be non-negative.',
          durationMs: Math.round(performance.now() - started)
        }
      };
    }

    const sloMs = sloSeconds * 1000;
    const ok = median <= sloMs;
    return {
      detail: {
        ok,
        reason: ok ? undefined : `Interaction median ${Math.round(median)}ms exceeds SLO ${sloMs}ms (${sloSeconds}s).`,
        durationMs: Math.round(performance.now() - started),
        data: {
          medianMs: median,
          sloMs,
          metric: parsed.metric ?? 'interaction',
          samples: parsed.samples ?? null,
          discardedOutliers: parsed.discardedOutliers ?? null,
          artifact: artifactRel
        }
      }
    };
  } catch (error) {
    return {
      detail: {
        ok: false,
        reason: error instanceof Error ? error.message : 'Failed to read interaction latency artifact.',
        durationMs: Math.round(performance.now() - started)
      }
    };
  }
}

function writeArtifactFile(artifact: GateArtifact, outputPath: string): void {
  ensureDirFor(outputPath);
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');
}

export function writeArtifact(outPath = DEFAULT_OUTPUT, repoRoot = process.cwd()) {
  const resolvedRoot = resolve(repoRoot);
  const contextRepoPath = join(resolvedRoot, 'context-repo');

  const checksumResult = computeEmbeddingsGate(contextRepoPath);
  const sidecarResult = computeSidecarGate(resolvedRoot);
  const classificationResult = computeClassificationGate(resolvedRoot);
  const interactionResult = computeInteractionSloGate(resolvedRoot);

  const artifact: GateArtifact = {
    version: ARTIFACT_VERSION,
    generatedAt: nowIso(),
    commit: getGitSha(resolvedRoot),
    gates: {
      sidecarOnly: sidecarResult.detail.ok,
      checksumMatch: checksumResult.detail.ok,
      classificationEnforced: classificationResult.detail.ok,
      interactionSlo: interactionResult.detail.ok
    },
    details: {
      sidecarOnly: sidecarResult.detail,
      checksumMatch: checksumResult.detail,
      classificationEnforced: classificationResult.detail,
      interactionSlo: interactionResult.detail
    },
    checksum: checksumResult.checksum
  };

  const primaryPath = resolve(resolvedRoot, outPath);
  writeArtifactFile(artifact, primaryPath);

  // Maintain backward compatibility with assistant reader expecting artifact in .context directory.
  const legacyPath = join(contextRepoPath, '.context', 'gate-status.json');
  writeArtifactFile(artifact, legacyPath);

  const summary = {
    ...artifact.gates,
    output: relative(resolvedRoot, primaryPath)
  };
  console.log('[run-gates] Artifact written:', JSON.stringify(summary));

  if (!artifact.gates.sidecarOnly || !artifact.gates.checksumMatch || !artifact.gates.classificationEnforced || !artifact.gates.interactionSlo) {
    console.error('[run-gates] One or more gates failed. See details in gate-status artifact.');
    process.exitCode = 1;
  }

  return artifact;
}

if (require.main === module) {
  try {
    writeArtifact();
  } catch (e) {
    console.error('[run-gates] FAILED', e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

// TODO(T028C-Future): Enforce classification gate by loading tool classification manifest once implemented.
