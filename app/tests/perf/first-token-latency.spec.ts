import { describe, expect, it } from 'vitest';
import { computeLatencyStats, createLatencyArtifact } from '@shared/perf/latency';

describe('Latency metrics utilities', () => {
  it('computes trimmed statistics with percentile outputs', () => {
    const samples = [120, 140, 160, 200, 250, 5000];
    const stats = computeLatencyStats(samples, { discardPercent: 0.2 });

    expect(stats.count).toBe(4);
    expect(stats.discardedOutliers).toBe(2);
    expect(stats.min).toBe(140);
    expect(stats.max).toBe(250);
    expect(stats.p50).toBeGreaterThanOrEqual(140);
    expect(stats.p95).toBeGreaterThanOrEqual(stats.p50);
  });

  it('builds latency artifact with rounded statistics', () => {
    const stats = computeLatencyStats([100, 150, 175, 200, 220], { discardPercent: 0 });
    const artifact = createLatencyArtifact('first-token', stats, '1.2.3');

    expect(artifact.version).toBe('1.2.3');
    expect(artifact.metric).toBe('first-token');
    expect(artifact.samples).toBe(stats.count);
    expect(artifact.stats.p50).toBeCloseTo(stats.p50, 2);
    expect(artifact.stats.p95).toBeCloseTo(stats.p95, 2);
    expect(artifact.discardedOutliers).toBe(stats.discardedOutliers);
    expect(Date.parse(artifact.generatedAt)).toBeGreaterThan(0);
  });
});
