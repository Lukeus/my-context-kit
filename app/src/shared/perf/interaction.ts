// Interaction latency helpers (T052O)
// -----------------------------------------------------------------------------
// Normalizes telemetry snapshots for the interaction latency harness and enforces
// SLO expectations prior to writing artifacts. Consumers provide either raw
// latency samples or structured ask/tool/approval runs. Values are normalized to
// milliseconds to remain compatible with shared latency utilities.

import type { LatencyStats } from './latency';

export type TimeUnit = 'milliseconds' | 'seconds';

export interface InteractionRunSnapshot {
  askMs?: number;
  toolMs?: number;
  approvalMs?: number;
  totalMs?: number;
  askSeconds?: number;
  toolSeconds?: number;
  approvalSeconds?: number;
  totalSeconds?: number;
}

export interface InteractionHarnessInput {
  latencies?: number[];
  runs?: InteractionRunSnapshot[];
  unit?: TimeUnit;
  discardPercent?: number;
  version?: string;
  sloSeconds?: number;
}

const MIN_SAMPLE_SIZE = 30;

function normalizeSingleLatency(value: number, unit: TimeUnit): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Latency samples must be non-negative finite numbers.');
  }
  return unit === 'seconds' ? value * 1000 : value;
}

function toMilliseconds(ms?: number, seconds?: number): number | undefined {
  if (typeof ms === 'number' && Number.isFinite(ms) && ms >= 0) {
    return ms;
  }
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return undefined;
}

function ensureSampleSize(count: number): void {
  if (count < MIN_SAMPLE_SIZE) {
    throw new Error(`Interaction latency harness requires at least ${MIN_SAMPLE_SIZE} samples. Received ${count}.`);
  }
}

export function normalizeInteractionLatencies(input: InteractionHarnessInput): number[] {
  const unit = input.unit ?? 'milliseconds';

  if (Array.isArray(input.latencies) && input.latencies.length > 0) {
    const normalized = input.latencies.map(value => normalizeSingleLatency(value, unit));
    ensureSampleSize(normalized.length);
    return normalized;
  }

  if (Array.isArray(input.runs) && input.runs.length > 0) {
    const normalized: number[] = [];
    for (const run of input.runs) {
      const total = toMilliseconds(run.totalMs, run.totalSeconds);
      if (typeof total === 'number') {
        normalized.push(total);
        continue;
      }

      const ask = toMilliseconds(run.askMs, run.askSeconds);
      const tool = toMilliseconds(run.toolMs, run.toolSeconds);
      const approval = toMilliseconds(run.approvalMs, run.approvalSeconds);
      if (typeof ask !== 'number' || typeof tool !== 'number' || typeof approval !== 'number') {
        throw new Error('Run snapshot must include ask/tool/approval durations when total duration is absent.');
      }
      normalized.push(ask + tool + approval);
    }
    ensureSampleSize(normalized.length);
    return normalized;
  }

  throw new Error('Interaction latency input must include either "latencies" or "runs".');
}

export function validateInteractionSlo(stats: LatencyStats, sloSeconds = 180, unit: TimeUnit = 'milliseconds'): void {
  if (!Number.isFinite(stats.median)) {
    throw new Error('Interaction latency median is not available.');
  }

  const divisor = unit === 'seconds' ? 1 : 1000;
  const medianSeconds = stats.median / divisor;
  if (medianSeconds > sloSeconds) {
    throw new Error(`Interaction median ${medianSeconds.toFixed(2)}s exceeds SLO ${sloSeconds}s.`);
  }
}

// TODO(T052O-LiveHooks): Replace manual fixture execution once assistant exposes
// observable hooks for automated interaction runs.
