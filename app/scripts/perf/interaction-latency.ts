// Interaction latency harness (T028M)
// -----------------------------------------------------------------------------
// Mirrors first-token harness but targets multi-step ask/tool/approval flows.
// Persists metrics to generated/perf/interaction.json for SC-002 tracking.
// Usage: pnpm ts-node app/scripts/perf/interaction-latency.ts <samples.json>
//
// TODO(T052O): Replace JSON snapshot workflow with automated harness once the
// unified assistant exposes programmatic run hooks.

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { computeLatencyStats, createLatencyArtifact } from '@shared/perf/latency';
import {
  normalizeInteractionLatencies,
  validateInteractionSlo,
  type InteractionHarnessInput
} from '@shared/perf/interaction';

async function ensureDirectory(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

async function loadInput(path: string): Promise<InteractionHarnessInput> {
  const data = await fs.readFile(path, 'utf8');
  const parsed = JSON.parse(data) as InteractionHarnessInput;
  if (!Array.isArray(parsed.latencies) && !Array.isArray(parsed.runs)) {
    throw new Error('Input file must include either a "latencies" array or a "runs" collection.');
  }
  return parsed;
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: pnpm ts-node app/scripts/perf/interaction-latency.ts <samples.json>');
    process.exitCode = 1;
    return;
  }

  const resolvedInput = resolve(process.cwd(), inputPath);
  const input = await loadInput(resolvedInput);
  const latencies = normalizeInteractionLatencies(input);
  const discardPercent = input.discardPercent ?? 0.05;
  const stats = computeLatencyStats(latencies, { discardPercent });
  validateInteractionSlo(stats, input.sloSeconds ?? 180);
  const version = input.version ?? '0.1.0';
  const artifact = createLatencyArtifact('interaction', stats, version);

  const outputDir = join(process.cwd(), 'generated', 'perf');
  const outputPath = join(outputDir, 'interaction.json');
  await ensureDirectory(outputDir);
  await fs.writeFile(outputPath, JSON.stringify(artifact, null, 2), 'utf8');

  const medianSeconds = Number((stats.median / 1000).toFixed(2));
  console.log(`Interaction latency metrics written to ${outputPath}`);
  console.log(`Median latency: ${medianSeconds}s (SLO <= ${(input.sloSeconds ?? 180)}s)`);
  console.log(JSON.stringify(artifact, null, 2));
}

const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch(error => {
    console.error('[interaction-latency] Failed to generate metrics:', error);
    process.exit(1);
  });
}
