// Migration Adapter (T018) - DEPRECATED
// -----------------------------------------------------------------------------
// DEPRECATION NOTICE: aiStore has been removed as part of the Python sidecar migration.
// This migration adapter is no longer needed since there is no legacy aiStore to migrate from.
// This file is kept as a stub to prevent build errors in dependent code.
// TODO(Cleanup): Remove this file once all references are removed from the codebase.
// -----------------------------------------------------------------------------

import type { MigrationRecord } from '@shared/assistant/migration';
import type { AssistantSessionExtended, ConversationTurn, AssistantProvider } from '@shared/assistant/types';
import { addCheckpoint, createInitialMigrationRecord } from '@shared/assistant/migration';
import { useAssistantStore } from '@/stores/assistantStore';

// T073/T082: Telemetry emission helper refactored to leverage assistantStore telemetry sink.
// Falls back to console logging if store or emitter unavailable.
function emitMigrationTelemetry(eventType: string, metadata: Record<string, unknown>): void {
  try {
    const store = useAssistantStore?.();
    // Unified telemetry event shape placeholder; will be formalized in T090 schema doc.
    const event = {
      id: `migration-${eventType}-${Date.now()}`,
      type: `migration.${eventType}`,
      timestamp: new Date().toISOString(),
      data: metadata
    };
    if (store && Array.isArray(store.telemetryEvents)) {
      // Append to telemetryEvents for visibility in UI panel.
      // TODO(T090): Replace with factory method makeMigrationEvent once defined.
      store.telemetryEvents.push(event as any); // Cast temporary until formal type added.
    } else {
      console.log('[Migration Telemetry Fallback]', eventType, metadata);
    }
  } catch (err) {
    console.warn('Failed to emit migration telemetry:', err);
  }
}

export interface LegacyAIStoreSession {
  id: string;
  provider: AssistantProvider;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    mode?: 'improvement' | 'clarification' | 'general';
    timestamp?: string;
  }>;
  settings?: {
    temperature?: number;
    maxTokens?: number;
    customPrompt?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface MigrationResult {
  success: boolean;
  record: MigrationRecord;
  session?: AssistantSessionExtended;
  errors?: string[];
}

export interface MigrationOptions {
  preserveHistory?: boolean;
  migrateSettings?: boolean;
  skipValidation?: boolean;
  dryRun?: boolean;
}

const DEFAULT_MIGRATION_OPTIONS: MigrationOptions = {
  preserveHistory: true,
  migrateSettings: true,
  skipValidation: false,
  dryRun: false
};

// Internal module flags
let _SCAN_COMPLETED = false; // Prevent duplicate scans in a single renderer lifecycle (T069)
let AUTO_MIGRATION_PERFORMED = false; // Guard ensureLegacyMigration (T069)

/**
 * Compute a lightweight hash of message content for dedupe pre-work (T071 will expand).
 * FNV-1a 32-bit implementation for speed; not cryptographic.
 */
function hashContent(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // unsigned 32-bit
  }
  return hash.toString(16);
}

/**
 * DEPRECATED: aiStore has been removed.
 * Falls back to 'azure-openai'.
 */
function _inferProvider(_legacyStore: unknown): AssistantProvider {
  return 'azure-openai';
}

/**
 * DEPRECATED: aiStore has been removed. This function now returns empty array.
 * Returns empty array since there is no legacy store to migrate from.
 */
export async function scanLegacySessions(_legacyStore?: unknown): Promise<LegacyAIStoreSession[]> {
  _SCAN_COMPLETED = true;
  return [];
}

/**
 * Ensure migration is performed once. (T069)
 * Returns MigrationResult[] or empty if nothing to migrate. Does NOT modify unified session yet.
 */
export async function ensureLegacyMigration(options: MigrationOptions = {}): Promise<MigrationResult[]> {
  if (AUTO_MIGRATION_PERFORMED) {
    return [];
  }
  
  const startTime = Date.now();
  const sessions = await scanLegacySessions();
  
  if (!sessions.length) {
    AUTO_MIGRATION_PERFORMED = true;
    // T073: Emit skipped telemetry event
    emitMigrationTelemetry('migration_skipped', { reason: 'no_legacy_sessions', durationMs: Date.now() - startTime });
    return [];
  }
  
  try {
    // T073: Emit started telemetry event
    emitMigrationTelemetry('migration_started', { sessionCount: sessions.length });
    
    // Preliminary dedupe (T071) before migration
    const unique = dedupeLegacySessions(sessions);
    const results = await batchMigrateSessions(unique, options);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    // T073: Emit completed telemetry event
    emitMigrationTelemetry('migration_completed', {
      totalSessions: results.length,
      successCount,
      failureCount,
      durationMs: Date.now() - startTime
    });
    
    AUTO_MIGRATION_PERFORMED = true;
    return results;
  } catch (err) {
    // T073: Emit failed telemetry event
    emitMigrationTelemetry('migration_failed', {
      error: err instanceof Error ? err.message : 'Unknown migration error',
      durationMs: Date.now() - startTime
    });
    throw err;
  }
}

/**
 * Migrate a legacy aiStore session to unified assistantStore format.
 */
export async function migrateLegacySession(
  legacy: LegacyAIStoreSession,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const opts = { ...DEFAULT_MIGRATION_OPTIONS, ...options };
  const errors: string[] = [];
  let record = createInitialMigrationRecord(legacy.id, 'legacy-ai-store');

  try {
    // Checkpoint: Start migration
    record = addCheckpoint(record, {
      phase: 'started',
      status: 'in-progress',
      timestamp: new Date().toISOString(),
      details: { legacyId: legacy.id, provider: legacy.provider }
    });

    // Validate legacy session structure
    if (!opts.skipValidation) {
      const validationErrors = validateLegacySession(legacy);
      if (validationErrors.length > 0) {
        errors.push(...validationErrors);
        record = addCheckpoint(record, {
          phase: 'validation',
          status: 'failed',
          timestamp: new Date().toISOString(),
          details: { errors: validationErrors }
        });
        return { success: false, record, errors };
      }
    }

    // Checkpoint: Validation complete
    record = addCheckpoint(record, {
      phase: 'validation',
      status: 'completed',
      timestamp: new Date().toISOString()
    });

    // Transform conversation history
    let conversation: ConversationTurn[] = [];
    if (opts.preserveHistory && legacy.messages) {
      conversation = transformConversationHistory(legacy.messages);
      record = addCheckpoint(record, {
        phase: 'conversation-transform',
        status: 'completed',
        timestamp: new Date().toISOString(),
        details: { messageCount: conversation.length }
      });
    }

    // Construct unified session
    if (opts.dryRun) {
      record = addCheckpoint(record, {
        phase: 'completed',
        status: 'completed',
        timestamp: new Date().toISOString(),
        details: { dryRun: true }
      });
      return { success: true, record };
    }

    const session: AssistantSessionExtended = {
      id: legacy.id,
      provider: legacy.provider,
      systemPrompt: legacy.settings?.customPrompt || 'You are a helpful AI assistant.',
      activeTools: [],
      messages: conversation,
      pendingApprovals: [],
      telemetryId: `migrated-${legacy.id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tasks: [],
      telemetryContext: {
        migrationSource: 'legacy-ai-store',
        migrationTimestamp: new Date().toISOString()
      }
    };

    // Checkpoint: Migration complete
    record = addCheckpoint(record, {
      phase: 'completed',
      status: 'completed',
      timestamp: new Date().toISOString(),
      details: {
        sessionId: session.id,
        messageCount: conversation.length,
        provider: session.provider
      }
    });

    return { success: true, record, session };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown migration error';
    errors.push(errorMessage);
    
    record = addCheckpoint(record, {
      phase: 'error',
      status: 'failed',
      timestamp: new Date().toISOString(),
      details: { error: errorMessage }
    });

    return { success: false, record, errors };
  }
}

/**
 * Validate legacy session structure before migration.
 */
function validateLegacySession(session: LegacyAIStoreSession): string[] {
  const errors: string[] = [];

  if (!session.id || typeof session.id !== 'string') {
    errors.push('Legacy session missing valid ID');
  }

  if (!session.provider || !['azure-openai', 'ollama'].includes(session.provider)) {
    errors.push('Legacy session has invalid or missing provider');
  }

  if (!Array.isArray(session.messages)) {
    errors.push('Legacy session messages must be an array');
  }

  return errors;
}

/**
 * Transform legacy message format to unified ConversationTurn format.
 */
function transformConversationHistory(
  messages: LegacyAIStoreSession['messages']
): ConversationTurn[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp || new Date().toISOString(),
    metadata: msg.mode ? { mode: msg.mode } : undefined
  }));
}

/**
 * Batch migrate multiple legacy sessions.
 */
export async function batchMigrateSessions(
  sessions: LegacyAIStoreSession[],
  options: MigrationOptions = {}
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const session of sessions) {
    try {
      const result = await migrateLegacySession(session, options);
      results.push(result);
    } catch (err) {
      results.push({
        success: false,
        record: createInitialMigrationRecord(session.id, 'legacy-ai-store'),
        errors: [err instanceof Error ? err.message : 'Batch migration failed']
      });
    }
  }

  return results;
}

/**
 * Check if migration is needed for a legacy session.
 */
export function needsMigration(session: unknown): session is LegacyAIStoreSession {
  if (!session || typeof session !== 'object') return false;
  const s = session as Record<string, unknown>;
  
  // Check for legacy aiStore signature
  return (
    typeof s.id === 'string' &&
    typeof s.provider === 'string' &&
    Array.isArray(s.messages) &&
    !('activeTools' in s) && // unified sessions have activeTools
    !('tasks' in s) // unified sessions have tasks
  );
}

/**
 * Get migration progress summary from record.
 */
export function getMigrationProgress(record: MigrationRecord): {
  phase: string;
  status: string;
  progress: number;
  completedSteps: number;
  totalSteps: number;
} {
  const checkpoints = record.checkpoints;
  const latest = checkpoints[checkpoints.length - 1];
  
  const phases = ['started', 'validation', 'conversation-transform', 'completed'];
  const completedPhases = checkpoints.filter(c => c.status === 'completed').length;
  const progress = Math.round((completedPhases / phases.length) * 100);

  return {
    phase: latest?.phase || 'unknown',
    status: latest?.status || 'unknown',
    progress,
    completedSteps: completedPhases,
    totalSteps: phases.length
  };
}

/**
 * Persist migration record to storage.
 * TODO(T018-Persistence): Implement using localStorage or IndexedDB.
 */
export async function saveMigrationRecord(record: MigrationRecord): Promise<void> {
  // Placeholder for persistence implementation
  console.debug('Migration record save (not implemented):', record.id);
}

/**
 * Load migration record from storage.
 * TODO(T018-Persistence): Implement using localStorage or IndexedDB.
 */
export async function loadMigrationRecord(id: string): Promise<MigrationRecord | null> {
  // Placeholder for persistence implementation
  console.debug('Migration record load (not implemented):', id);
  return null;
}

/**
 * Dedupe sessions by identical message sequence hash & provider (T071).
 * For now legacy will at most produce a single session; algorithm designed for future multi-session expansion.
 * Combines sessions if their concatenated content hashes match.
 */
export function dedupeLegacySessions(sessions: LegacyAIStoreSession[]): LegacyAIStoreSession[] {
  if (sessions.length <= 1) return sessions;
  const map = new Map<string, LegacyAIStoreSession>();
  for (const s of sessions) {
    const sequenceHash = hashContent(s.messages.map(m => m.role + ':' + m.content).join('\n')); // stable content signature
    const key = `${s.provider}:${sequenceHash}`;
    if (!map.has(key)) {
      map.set(key, s);
    } else {
      // Merge metadata (keep earliest timestamp, aggregate original counts)
      const existing = map.get(key)!;
      existing.metadata = {
        ...existing.metadata,
        mergedFrom: [...(existing.metadata?.mergedFrom as string[] || []), s.id],
        duplicateCount: ((existing.metadata?.duplicateCount as number) || 0) + 1
      };
    }
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Import & Rollback Logic (T074)
// ---------------------------------------------------------------------------
export interface ImportedSessionRecord {
  legacyId: string;
  newSessionId: string;
  timestamp: string;
  messageCount: number;
}

const importedSessions: ImportedSessionRecord[] = [];

export async function importLegacySessions(results: MigrationResult[], applyFn: (s: AssistantSessionExtended) => void, rollbackFn?: (id: string) => void): Promise<{ imported: number; failed: number; errors: string[]; rollbackPerformed: boolean; }> {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];
  const appliedIds: string[] = [];
  const startTime = Date.now();

  // T073: Emit import started telemetry
  emitMigrationTelemetry('migration_import_started', { resultCount: results.length });

  for (const r of results) {
    if (!r.success || !r.session) {
      failed++;
      errors.push(`Migration failed for legacy ${r.record.id}`);
      continue;
    }
    try {
      applyFn(r.session);
      importedSessions.push({
        legacyId: r.record.id,
        newSessionId: r.session.id,
        timestamp: new Date().toISOString(),
        messageCount: r.session.messages.length
      });
      appliedIds.push(r.session.id);
      imported++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : 'Unknown import error';
      errors.push(`Import error for ${r.record.id}: ${msg}`);
      
      // T073: Emit import failed telemetry with rollback indication
      emitMigrationTelemetry('migration_import_failed', {
        imported,
        failed,
        rollbackNeeded: Boolean(rollbackFn),
        durationMs: Date.now() - startTime
      });
      
      // Fail fast and attempt rollback of previously applied sessions
      if (rollbackFn) {
        for (const id of appliedIds) {
          try { rollbackFn(id); } catch (rollbackErr) {
            console.warn('Rollback failed for session', id, rollbackErr);
          }
        }
        return { imported, failed, errors, rollbackPerformed: appliedIds.length > 0 };
      }
      return { imported, failed, errors, rollbackPerformed: false };
    }
  }
  
  // T073: Emit import completed telemetry
  emitMigrationTelemetry('migration_import_completed', {
    imported,
    failed,
    durationMs: Date.now() - startTime
  });
  
  return { imported, failed, errors, rollbackPerformed: false };
}

/**
 * Simple accessor for imported session ledger
 */
export function listImportedSessions(): ImportedSessionRecord[] {
  return [...importedSessions];
}

// Example usage:
// const legacySession = aiStore.getCurrentSession();
// if (needsMigration(legacySession)) {
//   const result = await migrateLegacySession(legacySession);
//   if (result.success && result.session) {
//     assistantStore.applySession(result.session);
//   }
// }
