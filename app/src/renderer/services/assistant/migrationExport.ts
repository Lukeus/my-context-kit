// Migration Export Utility (T076)
// -----------------------------------------------------------------------------
// Provides JSON and CSV export capabilities for migration audit records.
// Exports include: migration ledger, session counts, message preservation stats.

import type { ImportedSessionRecord } from './migrationAdapter';

export interface MigrationAuditReport {
  exportedAt: string;
  totalSessionsImported: number;
  totalMessagesPreserved: number;
  sessions: ImportedSessionRecord[];
  summary: {
    oldestImport: string | null;
    newestImport: string | null;
    duplicatesRemoved: number;
  };
}

/**
 * Generate migration audit report from imported session ledger.
 */
export function generateMigrationAuditReport(ledger: ImportedSessionRecord[]): MigrationAuditReport {
  const totalMessages = ledger.reduce((sum, r) => sum + r.messageCount, 0);
  const timestamps = ledger.map(r => r.timestamp).sort();

  return {
    exportedAt: new Date().toISOString(),
    totalSessionsImported: ledger.length,
    totalMessagesPreserved: totalMessages,
    sessions: ledger.map(r => ({ ...r })), // defensive copy
    summary: {
      oldestImport: timestamps.length > 0 ? timestamps[0] : null,
      newestImport: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
      duplicatesRemoved: 0 // TODO: Track in dedupe phase
    }
  };
}

/**
 * Export migration audit report as JSON blob.
 */
export function exportMigrationAuditJSON(report: MigrationAuditReport): Blob {
  const json = JSON.stringify(report, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Export migration audit report as CSV blob.
 * CSV format: legacyId, newSessionId, timestamp, messageCount
 */
export function exportMigrationAuditCSV(report: MigrationAuditReport): Blob {
  const headers = 'legacyId,newSessionId,timestamp,messageCount\n';
  const rows = report.sessions
    .map(s => `"${s.legacyId}","${s.newSessionId}","${s.timestamp}",${s.messageCount}`)
    .join('\n');
  const csv = headers + rows;
  return new Blob([csv], { type: 'text/csv' });
}

/**
 * Trigger browser download of blob with given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export migration audit report as JSON file download.
 */
export function exportMigrationAuditAsJSON(ledger: ImportedSessionRecord[], filename = 'migration-audit.json'): void {
  const report = generateMigrationAuditReport(ledger);
  const blob = exportMigrationAuditJSON(report);
  downloadBlob(blob, filename);
}

/**
 * Export migration audit report as CSV file download.
 */
export function exportMigrationAuditAsCSV(ledger: ImportedSessionRecord[], filename = 'migration-audit.csv'): void {
  const report = generateMigrationAuditReport(ledger);
  const blob = exportMigrationAuditCSV(report);
  downloadBlob(blob, filename);
}
