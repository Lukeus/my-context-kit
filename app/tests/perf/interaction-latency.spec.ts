import { describe, expect, it } from 'vitest';
import { computeLatencyStats, createLatencyArtifact } from '@shared/perf/latency';
import { normalizeInteractionLatencies, validateInteractionSlo } from '@shared/perf/interaction';

// Interaction latency harness coverage (T028M)
// Ensures shared utilities expose required statistics for multi-step flows.
describe('interaction latency metrics', () => {
  it('computes trimmed statistics while preserving percentile values', () => {
    const samples = [95, 120, 130, 180, 190, 210, 6000];
    const stats = computeLatencyStats(samples, { discardPercent: 0.15 });

    expect(stats.count).toBe(5);
    expect(stats.discardedOutliers).toBe(2);
    expect(stats.median).toBeGreaterThanOrEqual(120);
    expect(stats.p50).toBeCloseTo(stats.median, 6);
    expect(stats.p95).toBeGreaterThanOrEqual(stats.p50);
  });

  it('creates an interaction latency artifact with required fields', () => {
    const stats = computeLatencyStats([150, 200, 220, 240, 260, 300], { discardPercent: 0 });
    const artifact = createLatencyArtifact('interaction', stats, '0.2.0');

    expect(artifact.metric).toBe('interaction');
    expect(artifact.version).toBe('0.2.0');
    expect(artifact.samples).toBe(stats.count);
    expect(artifact.discardedOutliers).toBe(stats.discardedOutliers);
    expect(artifact.stats.median).toBeCloseTo(stats.median, 2);
    expect(artifact.stats.p50).toBeCloseTo(stats.p50, 2);
    expect(artifact.stats.p95).toBeCloseTo(stats.p95, 2);
    expect(Date.parse(artifact.generatedAt)).toBeGreaterThan(0);
  });
});

describe('interaction latency harness helpers', () => {
  it('normalizes run snapshots into millisecond samples', () => {
    const runs = Array.from({ length: 30 }, (_, index) => ({
      askSeconds: 50 + (index % 3),
      toolSeconds: 35,
      approvalSeconds: 20
    }));
    const samples = normalizeInteractionLatencies({ runs });

    expect(samples).toHaveLength(30);
    expect(samples[0]).toBe(105000);
  });

  it('normalizes direct latency samples provided in seconds', () => {
    const values = Array(30).fill(120);
    const samples = normalizeInteractionLatencies({ latencies: values, unit: 'seconds' });

    expect(samples[0]).toBe(120000);
  });

  it('enforces the minimum sample size requirement', () => {
    expect(() => normalizeInteractionLatencies({ latencies: [100, 120] })).toThrow(/at least 30/);
  });

  it('throws when the median exceeds the SLO threshold', () => {
    const stats = computeLatencyStats(Array(30).fill(200000), { discardPercent: 0 });
    expect(() => validateInteractionSlo(stats, 180)).toThrow(/exceeds SLO/);
  });

  it('passes when the median is under the SLO threshold', () => {
    const stats = computeLatencyStats(Array(30).fill(150000), { discardPercent: 0 });
    expect(() => validateInteractionSlo(stats, 180)).not.toThrow();
  });
});
