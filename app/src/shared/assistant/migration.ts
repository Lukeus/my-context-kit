// Migration record interfaces (T008)
// -----------------------------------------------------------------------------
// Track progress of legacy aiStore session migration into unified assistant.
// Supports telemetry correlation and user-visible progress reporting.
// Unified interface for both feature-level migration tracking and session-level
// migration from legacy aiStore to unified assistantStore.
// TODO(T008-UI): Create renderer component to surface migration status.

export interface MigrationCheckpoint {
  phase: string;     // migration phase name (e.g., 'started', 'validation', 'completed')
  status: 'in-progress' | 'completed' | 'failed';
  timestamp: string; // ISO timestamp
  details?: Record<string, unknown>; // optional metadata
}

export interface MigrationRecord {
  id: string;                 // session or migration identifier
  source: string;             // migration source (e.g., 'legacy-ai-store')
  startedAt: string;          // ISO timestamp when tracking began
  updatedAt: string;          // last updated timestamp
  checkpoints: MigrationCheckpoint[]; // ordered chronologically
  metadata?: Record<string, unknown>; // optional metadata
}

export function addCheckpoint(record: MigrationRecord, checkpoint: MigrationCheckpoint): MigrationRecord {
  return {
    ...record,
    updatedAt: checkpoint.timestamp,
    checkpoints: [...record.checkpoints, checkpoint]
  };
}

export function isPhaseCompleted(record: MigrationRecord, phase: string): boolean {
  return record.checkpoints.some(cp => cp.phase === phase && cp.status === 'completed');
}

export function createInitialMigrationRecord(id: string, source: string): MigrationRecord {
  const now = new Date().toISOString();
  return {
    id,
    source,
    startedAt: now,
    updatedAt: now,
    checkpoints: []
  };
}

// Common migration phases for session-level migration:
// - 'started': Migration initiated
// - 'validation': Legacy session structure validated
// - 'conversation-transform': Message history transformed
// - 'settings-migrate': Settings and configuration migrated
// - 'completed': Migration successfully completed
// - 'error': Migration encountered errors
