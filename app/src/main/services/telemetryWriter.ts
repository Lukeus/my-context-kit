import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ToolInvocationRecord
} from '@shared/assistant/types';
import type {
  CompleteInvocationPayload,
  StartInvocationPayload,
  TelemetryWriter
} from './toolOrchestrator';

interface TelemetryWriterOptions {
  /**
   * Base directory where telemetry logs should be persisted. When omitted the
   * writer will store data inside the Electron userData folder under
   * `logs/assistant-tools`.
   */
  baseDir?: string;
}

function toLogDir(options?: TelemetryWriterOptions): string {
  if (options?.baseDir) {
    return options.baseDir;
  }
  const userData = app.getPath('userData');
  return path.join(userData, 'logs', 'assistant-tools');
}

export class FileTelemetryWriter implements TelemetryWriter {
  private readonly logDir: string;
  private readonly recordsById = new Map<string, ToolInvocationRecord>();
  private readonly sessionIndex = new Map<string, Set<string>>();

  constructor(options?: TelemetryWriterOptions) {
    this.logDir = toLogDir(options);
  }

  async startInvocation(payload: StartInvocationPayload): Promise<ToolInvocationRecord> {
    const record: ToolInvocationRecord = {
      id: randomUUID(),
      sessionId: payload.sessionId,
      toolId: payload.toolId,
      status: 'pending',
      parameters: { ...payload.parameters },
      resultSummary: undefined,
      startedAt: payload.requestedAt,
      provider: payload.provider,
      metadata: undefined
    };

    this.recordsById.set(record.id, record);
    if (!this.sessionIndex.has(record.sessionId)) {
      this.sessionIndex.set(record.sessionId, new Set());
    }
    this.sessionIndex.get(record.sessionId)?.add(record.id);

    await this.flushSessionRecords(record.sessionId);
    return record;
  }

  async completeInvocation(recordId: string, payload: CompleteInvocationPayload): Promise<ToolInvocationRecord> {
    const existing = this.recordsById.get(recordId);
    if (!existing) {
      throw new Error(`Telemetry record ${recordId} not found.`);
    }

    const finished: ToolInvocationRecord = {
      ...existing,
      status: payload.status,
      finishedAt: payload.finishedAt,
      resultSummary: payload.resultSummary ?? existing.resultSummary,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(payload.metadata ?? {})
      }
    };

    this.recordsById.set(recordId, finished);
    await this.flushSessionRecords(finished.sessionId);
    return finished;
  }

  async getRecordsForSession(sessionId: string): Promise<ToolInvocationRecord[]> {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids || ids.size === 0) {
      await this.hydrateSession(sessionId);
    }

    const nextIds = this.sessionIndex.get(sessionId);
    if (!nextIds) {
      return [];
    }

    return Array.from(nextIds)
      .map(id => this.recordsById.get(id))
      .filter((record): record is ToolInvocationRecord => Boolean(record))
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  async recordApproval(sessionId: string, actionId: string, outcome: 'approved' | 'rejected' | 'expired', metadata?: Record<string, unknown>): Promise<ToolInvocationRecord> {
    const record: ToolInvocationRecord = {
      id: randomUUID(),
      sessionId,
      toolId: 'assistant.approval',
      status: outcome === 'approved' ? 'succeeded' : outcome === 'rejected' ? 'failed' : 'aborted',
      parameters: { actionId },
      resultSummary: `Approval ${outcome}`,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      provider: 'azure-openai',
      metadata: metadata ? { ...metadata } : undefined
    } as ToolInvocationRecord;

    this.recordsById.set(record.id, record);
    if (!this.sessionIndex.has(sessionId)) {
      this.sessionIndex.set(sessionId, new Set());
    }
    this.sessionIndex.get(sessionId)?.add(record.id);
    await this.flushSessionRecords(sessionId);
    return record;
  }

  private async hydrateSession(sessionId: string): Promise<void> {
    try {
      const filePath = this.sessionFilePath(sessionId);
      const content = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as ToolInvocationRecord[] | { records: ToolInvocationRecord[] };
      const records = Array.isArray(parsed) ? parsed : parsed?.records ?? [];
      if (!this.sessionIndex.has(sessionId)) {
        this.sessionIndex.set(sessionId, new Set());
      }
      const idSet = this.sessionIndex.get(sessionId)!;
      for (const record of records) {
        this.recordsById.set(record.id, record);
        idSet.add(record.id);
      }
    } catch {
      // No existing file – nothing to hydrate.
    }
  }

  private async flushSessionRecords(sessionId: string): Promise<void> {
    const records = await this.getRecordsFromMemory(sessionId);
    await mkdir(this.logDir, { recursive: true });
    const filePath = this.sessionFilePath(sessionId);
    const payload = JSON.stringify({ records }, null, 2);
    await writeFile(filePath, payload, 'utf-8');
  }

  private sessionFilePath(sessionId: string): string {
    return path.join(this.logDir, `${sessionId}.json`);
  }

  private async getRecordsFromMemory(sessionId: string): Promise<ToolInvocationRecord[]> {
    const ids = this.sessionIndex.get(sessionId);
    if (!ids) {
      return [];
    }
    const records: ToolInvocationRecord[] = [];
    ids.forEach(id => {
      const record = this.recordsById.get(id);
      if (record) {
        records.push(record);
      }
    });
    return records.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }
}

export function createTelemetryWriter(options?: TelemetryWriterOptions): FileTelemetryWriter {
  return new FileTelemetryWriter(options);
}

// TODO: Expose log rotation strategy once telemetry volume expectations are validated.
