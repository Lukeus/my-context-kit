// Phase 2 T006: Server-Sent Events (SSE) streaming helpers
// Consumes text/event-stream from LangChain task stream endpoint and normalizes
// incremental outputs into TaskEnvelope-compatible updates.
// TODO: Add reconnect with backoff and health-state integration.

import type { TaskEnvelope } from '@shared/assistant/types';

export type StreamEventType = 'chunk' | 'error' | 'end';

export interface NormalizedStreamChunk {
  taskId: string;
  sessionId: string;
  status: 'streaming' | 'succeeded' | 'failed';
  outputFragment?: Record<string, unknown>;
  error?: string;
  done?: boolean;
}

export interface TaskStreamCallbacks {
  onChunk: (chunk: NormalizedStreamChunk) => void;
  onError: (err: string) => void;
  onEnd: (taskId: string) => void;
}

// Minimal SSE parser using EventSource (browser API available in Electron renderer context)
export function startTaskStream(sessionId: string, taskId: string, url: string, callbacks: TaskStreamCallbacks): () => void {
  const es = new EventSource(url);

  es.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      // Assume backend sends shape { type: 'chunk'|'end'|'error', data: {...} }
      const type: StreamEventType = payload.type || 'chunk';
      if (type === 'chunk') {
        callbacks.onChunk({
          taskId,
          sessionId,
          status: 'streaming',
          outputFragment: payload.data || { token: payload.token }
        });
      } else if (type === 'end') {
        callbacks.onChunk({ taskId, sessionId, status: 'succeeded', done: true });
        callbacks.onEnd(taskId);
        es.close();
      } else if (type === 'error') {
        const msg = payload.error || 'Unknown stream error';
        callbacks.onChunk({ taskId, sessionId, status: 'failed', error: msg, done: true });
        callbacks.onError(msg);
        es.close();
      } else {
        // Treat unknown types as chunk pass-through
        callbacks.onChunk({ taskId, sessionId, status: 'streaming', outputFragment: payload });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onError(msg);
    }
  };

  es.onerror = () => {
    callbacks.onError('SSE connection error');
    es.close();
  };

  return () => {
    es.close();
  };
}

// Merge stream fragments into a TaskEnvelope instance (immutable update pattern)
export function applyStreamChunk(existing: TaskEnvelope, chunk: NormalizedStreamChunk): TaskEnvelope {
  const outputs = [...existing.outputs];
  if (chunk.outputFragment) outputs.push(chunk.outputFragment);
  return {
    ...existing,
    status: chunk.status,
    outputs,
    timestamps: {
      ...existing.timestamps,
      firstResponse: existing.timestamps?.firstResponse || (chunk.status === 'streaming' ? new Date().toISOString() : undefined),
      completed: chunk.done ? new Date().toISOString() : existing.timestamps?.completed
    }
  };
}
