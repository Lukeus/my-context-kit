import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { FileTelemetryWriter } from '../../src/main/services/telemetryWriter';
import type {
  CompleteInvocationPayload,
  StartInvocationPayload
} from '../../src/main/services/toolOrchestrator';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(tmpdir(), 'assistant-tools-tests'))
  }
}));

describe('FileTelemetryWriter', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(path.join(tmpdir(), 'assistant-telemetry-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('persists telemetry records for a session', async () => {
    const writer = new FileTelemetryWriter({ baseDir });

    const startPayload: StartInvocationPayload = {
      sessionId: 'session-123',
      provider: 'azure-openai',
      toolId: 'pipeline.run',
      parameters: { pipeline: 'validate' },
      requestedAt: '2025-10-28T18:00:00.000Z'
    };

    const pendingRecord = await writer.startInvocation(startPayload);
    expect(pendingRecord.status).toBe('pending');

    const completion: CompleteInvocationPayload = {
      status: 'succeeded',
      finishedAt: '2025-10-28T18:00:05.000Z',
      resultSummary: 'Pipeline validate completed successfully.',
      metadata: { pipeline: 'validate' }
    };

    const finishedRecord = await writer.completeInvocation(pendingRecord.id, completion);
    expect(finishedRecord.status).toBe('succeeded');
    expect(finishedRecord.resultSummary).toContain('validate');

    const records = await writer.getRecordsForSession('session-123');
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('succeeded');

    const logFile = path.join(baseDir, 'session-123.json');
    const persisted = JSON.parse(await readFile(logFile, 'utf-8')) as { records: unknown[] };
    expect(Array.isArray(persisted.records)).toBe(true);
    expect((persisted.records?.[0] as { status: string }).status).toBe('succeeded');
  });

  it('hydrates telemetry records from disk on demand', async () => {
    const writer = new FileTelemetryWriter({ baseDir });
    const startPayload: StartInvocationPayload = {
      sessionId: 'session-hydrate',
      provider: 'ollama',
      toolId: 'pipeline.run',
      parameters: { pipeline: 'build-graph' },
      requestedAt: '2025-10-28T19:05:00.000Z'
    };

    const pending = await writer.startInvocation(startPayload);
    await writer.completeInvocation(pending.id, {
      status: 'failed',
      finishedAt: '2025-10-28T19:05:04.000Z',
      resultSummary: 'Pipeline build-graph failed.',
      metadata: { pipeline: 'build-graph', error: 'Test failure' }
    });

    const rehydrated = new FileTelemetryWriter({ baseDir });
    const records = await rehydrated.getRecordsForSession('session-hydrate');
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('failed');
    expect(records[0].metadata).toMatchObject({ pipeline: 'build-graph' });
  });
});
