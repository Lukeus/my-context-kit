// T083: Performance test script for tool durations
// -----------------------------------------------------------------------------
// Measures average, min, max durations of recent tool executions for a session.
// Usage (from repo root): pnpm ts-node app/scripts/perf/tool-durations.ts <sessionId>
// NOTE: This script assumes a running Electron main process exposing telemetry
// via window.api.assistant.listTelemetry (future: main-process API / sidecar pull).
// For now, we simulate by importing a JSON snapshot or mock.
// TODO(T083-Integration): Replace mock loader with IPC call once exposed.

import { aggregateTelemetry, getSlowTools, exportTelemetryCSV } from '@/services/assistant/telemetryAggregator';
import type { ToolInvocationRecord } from '@shared/assistant/types';
import { formatDuration } from '@/services/assistant/timeHelpers';

interface MockDataEnvelope { records: ToolInvocationRecord[] }

function loadMockTelemetry(sessionId: string): ToolInvocationRecord[] {
  // Placeholder: In future, fetch from main process or sidecar
  console.warn('[tool-durations] Using mock telemetry loader. Replace with IPC fetch.');
  try {
    // Attempt dynamic import of optional snapshot file
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const snapshot: MockDataEnvelope = require(`./snapshots/${sessionId}.json`);
    return snapshot.records;
  } catch {
    return [];
  }
}

function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error('Usage: pnpm ts-node app/scripts/perf/tool-durations.ts <sessionId>');
    process.exit(1);
  }

  const records = loadMockTelemetry(sessionId);
  if (records.length === 0) {
    console.log('No telemetry records found for session.');
    process.exit(0);
  }

  const aggregates = aggregateTelemetry(records);
  console.log('\nTool Execution Performance Summary');
  console.log('----------------------------------');
  console.log(`Total Invocations: ${aggregates.totalInvocations}`);
  console.log(`Overall Success Rate: ${aggregates.overallSuccessRate}%`);
  console.log(`Total Duration: ${formatDuration(aggregates.totalDuration)}`);
  console.log(`Average Duration: ${formatDuration(aggregates.avgDuration)}`);
  console.log(`Slowest Tool (avg): ${aggregates.slowestTool}`);
  console.log(`Fastest Tool (avg): ${aggregates.fastestTool}`);

  console.log('\nPer-Tool Stats');
  for (const stat of aggregates.toolStats) {
    console.log(`- ${stat.toolId}: count=${stat.count} avg=${formatDuration(stat.avgDuration)} min=${formatDuration(stat.minDuration)} max=${formatDuration(stat.maxDuration)} successRate=${stat.successRate.toFixed(1)}%`);
  }

  const thresholdMs = 2000; // 2s threshold for slow tools
  const slow = getSlowTools(records, thresholdMs);
  if (slow.length > 0) {
    console.log(`\nTools exceeding ${thresholdMs}ms:`);
    for (const entry of slow) {
      console.log(`  * ${entry.toolId} duration=${formatDuration(entry.duration)} started=${entry.startedAt}`);
    }
  } else {
    console.log(`\nNo tools exceeded ${thresholdMs}ms.`);
  }

  // Optional CSV export
  const csv = exportTelemetryCSV(records);
  console.log('\nCSV Output (first 3 lines):');
  console.log(csv.split('\n').slice(0, 4).join('\n'));
}

// Execute if run directly
if (require.main === module) {
  main();
}
