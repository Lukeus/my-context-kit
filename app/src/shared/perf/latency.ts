// Latency metric utilities (T028L/T028M)
// -----------------------------------------------------------------------------
// Provides percentile calculations for latency harness scripts. Intentionally
// free of Node.js dependencies so it can be shared between renderer code,
// Vitest suites, and CLI harnesses. Persistence is handled by script callers.

export interface LatencyStats {
  count: number;
  mean: number;
  median: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
  discardedOutliers: number;
}

export interface LatencyComputationOptions {
  /** Percentage (0-0.5) of samples to discard from each tail as outliers. */
  discardPercent?: number;
}

export interface LatencyArtifact {
  version: string;
  metric: 'first-token' | 'interaction';
  generatedAt: string;
  samples: number;
  stats: {
    mean: number;
    median: number;
    p50: number;
    p95: number;
    min: number;
    max: number;
  };
  discardedOutliers: number;
}

export function computeLatencyStats(
  samples: number[],
  options: LatencyComputationOptions = {}
): LatencyStats {
  const valid = samples.filter(value => Number.isFinite(value) && value >= 0);
  if (valid.length === 0) {
    throw new Error('Latency sample set must contain at least one non-negative number.');
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const discardPercent = options.discardPercent ?? 0;
  const discardCount = Math.floor(sorted.length * discardPercent);
  const trimmed = sorted.slice(discardCount, sorted.length - discardCount);
  const discardedOutliers = sorted.length - trimmed.length;

  const mean = average(trimmed);
  const median = percentile(trimmed, 0.5);
  const p95 = percentile(trimmed, 0.95);

  return {
    count: trimmed.length,
    mean,
    median,
    p50: median,
    p95,
    min: trimmed[0],
    max: trimmed[trimmed.length - 1],
    discardedOutliers
  };
}

export function createLatencyArtifact(
  metric: LatencyArtifact['metric'],
  stats: LatencyStats,
  version: string
): LatencyArtifact {
  return {
    version,
    metric,
    generatedAt: new Date().toISOString(),
    samples: stats.count,
    stats: {
      mean: round(stats.mean),
      median: round(stats.median),
      p50: round(stats.p50),
      p95: round(stats.p95),
      min: round(stats.min),
      max: round(stats.max)
    },
    discardedOutliers: stats.discardedOutliers
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    throw new Error('Cannot compute percentile of empty set.');
  }

  const index = percentileValue * (values.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return values[lower];
  }

  const weight = index - lower;
  return values[lower] * (1 - weight) + values[upper] * weight;
}

// TODO(T028L-Integration): Replace JSON snapshot input with live harness wiring
// once streaming instrumentation is available.
