// T061: Telemetry Aggregation
// Aggregates tool execution telemetry for analytics and reporting.

import type { ToolInvocationRecord } from '@shared/assistant/types';

export interface ToolDurationStats {
  toolId: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}

export interface SessionAggregates {
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  abortedInvocations: number;
  overallSuccessRate: number;
  totalDuration: number;
  avgDuration: number;
  toolStats: ToolDurationStats[];
  slowestTool: string | null;
  fastestTool: string | null;
}

/**
 * Aggregate telemetry records into statistics.
 * T061: Tool duration aggregation for performance monitoring.
 */
export function aggregateTelemetry(records: ToolInvocationRecord[]): SessionAggregates {
  if (records.length === 0) {
    return {
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      abortedInvocations: 0,
      overallSuccessRate: 0,
      totalDuration: 0,
      avgDuration: 0,
      toolStats: [],
      slowestTool: null,
      fastestTool: null
    };
  }

  // Overall stats
  const totalInvocations = records.length;
  const successfulInvocations = records.filter(r => r.status === 'succeeded').length;
  const failedInvocations = records.filter(r => r.status === 'failed').length;
  const abortedInvocations = records.filter(r => r.status === 'aborted').length;
  const overallSuccessRate = (successfulInvocations / totalInvocations) * 100;

  // Calculate durations
  const completedRecords = records.filter(r => r.finishedAt);
  const durations = completedRecords.map(r => calculateDuration(r));
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgDuration = completedRecords.length > 0 ? totalDuration / completedRecords.length : 0;

  // Group by tool
  const toolGroups = new Map<string, ToolInvocationRecord[]>();
  for (const record of records) {
    const existing = toolGroups.get(record.toolId) || [];
    existing.push(record);
    toolGroups.set(record.toolId, existing);
  }

  // Calculate per-tool stats
  const toolStats: ToolDurationStats[] = [];
  for (const [toolId, toolRecords] of toolGroups.entries()) {
    const completed = toolRecords.filter(r => r.finishedAt);
    const toolDurations = completed.map(r => calculateDuration(r));
    const successCount = toolRecords.filter(r => r.status === 'succeeded').length;
    const failureCount = toolRecords.filter(r => r.status === 'failed').length;

    toolStats.push({
      toolId,
      count: toolRecords.length,
      totalDuration: toolDurations.reduce((sum, d) => sum + d, 0),
      avgDuration: completed.length > 0 ? toolDurations.reduce((sum, d) => sum + d, 0) / completed.length : 0,
      minDuration: completed.length > 0 ? Math.min(...toolDurations) : 0,
      maxDuration: completed.length > 0 ? Math.max(...toolDurations) : 0,
      successCount,
      failureCount,
      successRate: toolRecords.length > 0 ? (successCount / toolRecords.length) * 100 : 0
    });
  }

  // Find slowest and fastest tools
  const sortedByAvg = [...toolStats].sort((a, b) => b.avgDuration - a.avgDuration);
  const slowestTool = sortedByAvg[0]?.toolId || null;
  const fastestTool = sortedByAvg[sortedByAvg.length - 1]?.toolId || null;

  return {
    totalInvocations,
    successfulInvocations,
    failedInvocations,
    abortedInvocations,
    overallSuccessRate: Math.round(overallSuccessRate * 10) / 10,
    totalDuration: Math.round(totalDuration),
    avgDuration: Math.round(avgDuration),
    toolStats,
    slowestTool,
    fastestTool
  };
}

/**
 * Calculate duration in milliseconds for a telemetry record.
 */
function calculateDuration(record: ToolInvocationRecord): number {
  if (!record.finishedAt) return 0;
  const start = new Date(record.startedAt).getTime();
  const end = new Date(record.finishedAt).getTime();
  return end - start;
}

/**
 * Get tools that exceed a duration threshold (performance outliers).
 */
export function getSlowTools(
  records: ToolInvocationRecord[],
  thresholdMs: number
): Array<{ toolId: string; duration: number; startedAt: string }> {
  return records
    .filter(r => r.finishedAt)
    .map(r => ({
      toolId: r.toolId,
      duration: calculateDuration(r),
      startedAt: r.startedAt
    }))
    .filter(item => item.duration > thresholdMs)
    .sort((a, b) => b.duration - a.duration);
}

/**
 * Export telemetry data as CSV for analysis.
 */
export function exportTelemetryCSV(records: ToolInvocationRecord[]): string {
  const header = 'Tool ID,Status,Started At,Finished At,Duration (ms),Error Message\n';
  
  const rows = records.map(r => {
    const duration = r.finishedAt ? calculateDuration(r) : '';
    const error = r.metadata?.error || '';
    return `${r.toolId},${r.status},${r.startedAt},${r.finishedAt || ''},${duration},"${error}"`;
  });

  return header + rows.join('\n');
}

/**
 * Format duration in human-readable format.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
