// Approval Decision Logger (T025)
// -----------------------------------------------------------------------------
// Logs approval decisions for audit trail and user accountability.
// Integrates with telemetry system for compliance tracking.
// TODO(T025-Persistence): Add IPC handler for persistent approval logs.
// TODO(T025-Export): Implement approval log export for compliance reports.

import type { AssistantProvider } from '@shared/assistant/types';

export type ApprovalDecision = 'approved' | 'rejected' | 'expired';

export interface ApprovalLogEntry {
  id: string;
  sessionId: string;
  provider: AssistantProvider;
  toolId: string;
  approvalId: string;
  decision: ApprovalDecision;
  timestamp: string;
  userId?: string;
  notes?: string;
  metadata?: {
    diffPreview?: string;
    riskyOperations?: string[];
    estimatedImpact?: string;
    [key: string]: unknown;
  };
}

export interface ApprovalLogFilter {
  sessionId?: string;
  toolId?: string;
  decision?: ApprovalDecision;
  startDate?: Date;
  endDate?: Date;
}

/**
 * In-memory approval log store.
 * TODO(T025-Persistence): Replace with IPC-backed persistent storage.
 */
class ApprovalLogger {
  private logs: ApprovalLogEntry[] = [];
  private listeners: Set<(entry: ApprovalLogEntry) => void> = new Set();

  /**
   * Log an approval decision.
   */
  log(entry: Omit<ApprovalLogEntry, 'id' | 'timestamp'>): ApprovalLogEntry {
    const logEntry: ApprovalLogEntry = {
      ...entry,
      id: `approval-${crypto.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*10000)}`}`,
      timestamp: new Date().toISOString()
    };

    this.logs.push(logEntry);
    this.notifyListeners(logEntry);

    console.debug('[ApprovalLogger]', logEntry.decision, logEntry.toolId, {
      approvalId: logEntry.approvalId,
      sessionId: logEntry.sessionId,
      notes: logEntry.notes
    });

    return logEntry;
  }

  /**
   * Get all approval logs.
   */
  getAll(): ApprovalLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get filtered approval logs.
   */
  filter(filter: ApprovalLogFilter): ApprovalLogEntry[] {
    return this.logs.filter(entry => {
      if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
      if (filter.toolId && entry.toolId !== filter.toolId) return false;
      if (filter.decision && entry.decision !== filter.decision) return false;
      
      if (filter.startDate) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate < filter.startDate) return false;
      }
      
      if (filter.endDate) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate > filter.endDate) return false;
      }
      
      return true;
    });
  }

  /**
   * Get approval log by approval ID.
   */
  getByApprovalId(approvalId: string): ApprovalLogEntry | null {
    return this.logs.find(entry => entry.approvalId === approvalId) || null;
  }

  /**
   * Get approval statistics.
   */
  getStats(): {
    total: number;
    approved: number;
    rejected: number;
    expired: number;
    approvalRate: number;
  } {
    const total = this.logs.length;
    const approved = this.logs.filter(e => e.decision === 'approved').length;
    const rejected = this.logs.filter(e => e.decision === 'rejected').length;
    const expired = this.logs.filter(e => e.decision === 'expired').length;
    const approvalRate = total > 0 ? (approved / total) * 100 : 0;

    return { total, approved, rejected, expired, approvalRate };
  }

  /**
   * Subscribe to approval log events.
   */
  subscribe(listener: (entry: ApprovalLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all logs (for testing or privacy).
   */
  clear(): void {
    this.logs = [];
  }

  private notifyListeners(entry: ApprovalLogEntry): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(entry);
      } catch (err) {
        console.error('[ApprovalLogger] Listener error:', err);
      }
    }
  }
}

// Singleton instance
const approvalLogger = new ApprovalLogger();

/**
 * Log an approval decision.
 */
export function logApproval(
  sessionId: string,
  provider: AssistantProvider,
  toolId: string,
  approvalId: string,
  decision: ApprovalDecision,
  notes?: string,
  metadata?: ApprovalLogEntry['metadata']
): ApprovalLogEntry {
  return approvalLogger.log({
    sessionId,
    provider,
    toolId,
    approvalId,
    decision,
    notes,
    metadata
  });
}

/**
 * Get all approval logs.
 */
export function getApprovalLogs(): ApprovalLogEntry[] {
  return approvalLogger.getAll();
}

/**
 * Get filtered approval logs.
 */
export function filterApprovalLogs(filter: ApprovalLogFilter): ApprovalLogEntry[] {
  return approvalLogger.filter(filter);
}

/**
 * Get approval log by approval ID.
 */
export function getApprovalLog(approvalId: string): ApprovalLogEntry | null {
  return approvalLogger.getByApprovalId(approvalId);
}

/**
 * Get approval statistics.
 */
export function getApprovalStats(): ReturnType<typeof approvalLogger.getStats> {
  return approvalLogger.getStats();
}

/**
 * Subscribe to approval log events.
 */
export function subscribeToApprovalLogs(
  listener: (entry: ApprovalLogEntry) => void
): () => void {
  return approvalLogger.subscribe(listener);
}

/**
 * Clear all approval logs.
 */
export function clearApprovalLogs(): void {
  approvalLogger.clear();
}

/**
 * Export approval logs as JSON.
 */
export function exportApprovalLogs(filter?: ApprovalLogFilter): string {
  const logs = filter ? approvalLogger.filter(filter) : approvalLogger.getAll();
  return JSON.stringify(logs, null, 2);
}

/**
 * Export approval logs as CSV.
 */
export function exportApprovalLogsCSV(filter?: ApprovalLogFilter): string {
  const logs = filter ? approvalLogger.filter(filter) : approvalLogger.getAll();
  
  const headers = ['ID', 'Timestamp', 'Session ID', 'Tool ID', 'Decision', 'Notes'];
  const rows = logs.map(log => [
    log.id,
    log.timestamp,
    log.sessionId,
    log.toolId,
    log.decision,
    log.notes || ''
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

// Example usage:
// logApproval(sessionId, 'azure-openai', 'context.write', 'approval-123', 'approved', 'Looks good');
// const stats = getApprovalStats();
// const unsubscribe = subscribeToApprovalLogs(entry => console.log('New approval:', entry));
