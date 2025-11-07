// First-token latency harness (T028L/T028L-Store)
// -----------------------------------------------------------------------------
// Consumes latency samples (ms) produced by upcoming streaming instrumentation
// and persists summary statistics to generated/perf/first-token.json.
// Usage: pnpm ts-node app/scripts/perf/first-token-latency.ts <samples.json>
//
// Expected input schema:
// {
//   "latencies": [120, 140, 200, ...],
//   "version": "0.1.0",           // optional semantic version tag
//   "discardPercent": 0.05          // optional trim percentage per tail
// }
//
// TODO(T028L-Hook): Wire this harness to real session telemetry once
// streaming instrumentation lands. For now it operates on JSON snapshots.

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { computeLatencyStats, createLatencyArtifact } from '@shared/perf/latency';

interface HarnessInput {
  latencies: number[];
  version?: string;
  discardPercent?: number;
}

async function ensureDirectory(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

async function loadInput(path: string): Promise<HarnessInput> {
  const data = await fs.readFile(path, 'utf8');
  const parsed = JSON.parse(data) as HarnessInput;
  if (!Array.isArray(parsed.latencies)) {
    throw new Error('Input file must include a "latencies" array.');
  }
  return parsed;
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: pnpm ts-node app/scripts/perf/first-token-latency.ts <samples.json>');
    process.exitCode = 1;
    return;
  }

  const resolvedInput = resolve(process.cwd(), inputPath);
  const input = await loadInput(resolvedInput);
  const discardPercent = input.discardPercent ?? 0.05;
  const stats = computeLatencyStats(input.latencies, { discardPercent });
  const version = input.version ?? '0.1.0';
  const artifact = createLatencyArtifact('first-token', stats, version);

  const outputDir = join(process.cwd(), 'generated', 'perf');
  const outputPath = join(outputDir, 'first-token.json');
  await ensureDirectory(outputDir);
  await fs.writeFile(outputPath, JSON.stringify(artifact, null, 2), 'utf8');

  console.log(`First-token latency metrics written to ${outputPath}`);
  console.log(JSON.stringify(artifact, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error('[first-token-latency] Failed to generate metrics:', error);
    process.exit(1);
  });
}
