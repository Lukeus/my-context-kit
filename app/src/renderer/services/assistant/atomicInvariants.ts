/**
 * atomicInvariants.ts
 * Central list of atomic state invariants (FR-031) for test consumption.
 */
export const ATOMIC_INVARIANTS = {
  toolStatusMonotonic: 'Tool status transitions must follow pending->running->(completed|failed|timeout)',
  approvalDecisionAtomic: 'Approval decision and timestamp written together',
  streamingVisibility: 'Streaming partial visible only while isStreaming=true; finalization removes flag atomically',
  transcriptTelemetryPair: 'Transcript append accompanied by telemetry emission for related event',
};
