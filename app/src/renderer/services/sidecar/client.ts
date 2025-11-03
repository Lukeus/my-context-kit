// Sidecar client scaffold (T010)
// ----------------------------------------------------------------------------
// Provides a thin facade around the context-isolated IPC bridge (window.api.langchain
// / window.api.assistant) to standardise envelopes, error handling, and telemetry hooks.
// NOTE: This is distinct from the raw langchain HTTP client in services/langchain/* which
// may be phased out as FastAPI sidecar becomes canonical.
// TODO(T010-Enhance): Add retries & backoff; integrate telemetry factories.

import type { AssistantProvider, AssistantPipelineName, CapabilityProfile } from '@shared/assistant/types';
import type { CapabilityManifest } from '@shared/assistant/capabilities';
import type { TelemetryEnvelope } from '@shared/assistant/telemetry';

export interface SidecarSuccessEnvelope<T> { ok: true; data: T; meta?: Record<string, unknown>; }
export interface SidecarErrorEnvelope { ok: false; error: string; code?: string; retryable?: boolean; meta?: Record<string, unknown>; }
export type SidecarEnvelope<T> = SidecarSuccessEnvelope<T> | SidecarErrorEnvelope;

// Pipeline result placeholder (refine once backend returns structured schema)
export interface PipelineRunResult { output?: string; summary?: string; durationMs?: number; }

// Context read model
export interface ContextFileRead {
  path: string;
  repoRelativePath: string;
  content: string;
  encoding: string;
  size: number;
  lastModified: string;
  truncated: boolean;
}

export interface RunPipelineOptions {
  sessionId?: string; // optional if bridge handles implicit session
  repoPath: string;
  pipeline: AssistantPipelineName;
  args?: Record<string, unknown>;
  provider?: AssistantProvider;
}

export interface ReadContextFileOptions {
  repoPath: string;
  path: string;
  encoding?: string;
  provider?: AssistantProvider;
}

export interface SidecarClientHooks {
  onBeforeInvoke?: (kind: string, payload: Record<string, unknown>) => void;
  onAfterInvoke?: (kind: string, envelope: SidecarEnvelope<any>) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export class SidecarClient {
  private hooks: SidecarClientHooks;

  constructor(hooks: SidecarClientHooks = {}) {
    this.hooks = hooks;
  }

  private wrapError(error: unknown, code?: string): SidecarErrorEnvelope {
    const message = error instanceof Error ? error.message : 'Unknown sidecar error';
    return { ok: false, error: message, code, retryable: false };
  }

  private invoke<T>(kind: string, fn: () => Promise<T>, payload: Record<string, unknown>): Promise<SidecarEnvelope<T>> {
    try {
      this.hooks.onBeforeInvoke?.(kind, payload);
    } catch {/* swallow hook errors */}
    const started = performance.now();
    return fn()
      .then(data => {
        const envelope: SidecarSuccessEnvelope<T> = { ok: true, data, meta: { durationMs: performance.now() - started } };
        try { this.hooks.onAfterInvoke?.(kind, envelope); } catch {/* ignore */}
        return envelope;
      })
      .catch(err => {
        const envelope = this.wrapError(err);
        envelope.meta = { durationMs: performance.now() - started };
        try { this.hooks.onAfterInvoke?.(kind, envelope); } catch {/* ignore */}
        return envelope;
      });
  }

  // Pipelines ----------------------------------------------------------------
  runPipeline(opts: RunPipelineOptions): Promise<SidecarEnvelope<PipelineRunResult>> {
    if (!opts.repoPath) {
      return Promise.resolve({ ok: false, error: 'repoPath is required', code: 'VALIDATION' });
    }
    if (!opts.pipeline) {
      return Promise.resolve({ ok: false, error: 'pipeline name is required', code: 'VALIDATION' });
    }
    // Assume window.api.langchain.runPipeline exists (future IPC). Placeholder.
    const payload = { ...opts };
    return this.invoke('pipeline.run', async () => {
      // IPC signature: runPipeline(sessionId, payload)
      const sessionId = opts.sessionId || ''; // empty indicates internal session resolution (assistantStore wrapper)
      const res = await window.api.assistant.runPipeline(sessionId, { repoPath: opts.repoPath, pipeline: opts.pipeline, args: opts.args });
      // ToolExecutionResponse includes result + error + session/ conversation updates.
      const duration = typeof (res.result as any)?.durationMs === 'number' ? (res.result as any).durationMs : undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
      const summaryVal = (res.result as any)?.summary; // eslint-disable-line @typescript-eslint/no-explicit-any
      return { output: String((res.result as any)?.output ?? ''), summary: typeof summaryVal === 'string' ? summaryVal : undefined, durationMs: duration };
    }, payload);
  }

  // Context file read --------------------------------------------------------
  readContextFile(opts: ReadContextFileOptions): Promise<SidecarEnvelope<ContextFileRead>> {
    if (!opts.repoPath) {
      return Promise.resolve({ ok: false, error: 'repoPath is required', code: 'VALIDATION' });
    }
    if (!opts.path) {
      return Promise.resolve({ ok: false, error: 'path is required', code: 'VALIDATION' });
    }
    const payload = { ...opts };
    return this.invoke('context.read', async () => {
      // Use executeTool IPC when dedicated readContextFile not exposed; parameters encoded.
      const sessionId = opts.provider ? '' : ''; // session id resolution deferred
      const toolRes = await window.api.assistant.executeTool(sessionId, {
        toolId: 'context.read',
        repoPath: opts.repoPath,
        parameters: { path: opts.path, encoding: opts.encoding }
      });
      if (toolRes.error) throw new Error(toolRes.error);
      const result = toolRes.result as any; // TODO(T010-TypeRefine): Introduce tool result typing
      return {
        path: result?.path || opts.path,
        repoRelativePath: result?.repoRelativePath || opts.path,
        content: result?.content || '',
        encoding: result?.encoding || 'utf-8',
        size: typeof result?.size === 'number' ? result.size : (result?.content?.length || 0),
        lastModified: result?.lastModified || new Date().toISOString(),
        truncated: Boolean(result?.truncated)
      };
    }, payload);
  }

  // Capability manifest ------------------------------------------------------
  fetchCapabilityManifest(): Promise<SidecarEnvelope<CapabilityManifest>> {
    return this.invoke('capability.manifest', async () => {
      // Reuse executeTool when direct capability endpoint not yet available.
      // Fallback to assistantStore capabilityProfile retrieval pattern via listTelemetry hack if necessary.
      const sessionId = '';
      // Attempt tool execution (will likely fail until tool registered)
      try {
        const toolRes = await window.api.assistant.executeTool(sessionId, {
          toolId: 'capability.profile',
          repoPath: '',
          parameters: {}
        });
        if (!toolRes.error && toolRes.result) {
          const rawProfile = toolRes.result as Record<string, unknown>;
          if (typeof rawProfile !== 'object' || !rawProfile) throw new Error('Invalid capability profile payload');
          const profile: CapabilityProfile = {
            profileId: String(rawProfile['profileId'] ?? 'unknown'),
            lastUpdated: String(rawProfile['lastUpdated'] ?? new Date().toISOString()),
            capabilities: typeof rawProfile['capabilities'] === 'object' && rawProfile['capabilities'] !== null
              ? (rawProfile['capabilities'] as Record<string, any>) // eslint-disable-line @typescript-eslint/no-explicit-any
              : {}
          };
          return {
            manifestId: profile.profileId,
            generatedAt: profile.lastUpdated,
            version: '1.0.0',
            capabilities: Object.entries(profile.capabilities).map(([id, entry]) => ({
              id,
              title: id,
              description: 'Capability',
              phase: 'ga',
              tags: [],
              status: entry.status,
              since: profile.lastUpdated
            })),
            source: 'sidecar'
          };
        }
      } catch {/* ignore */}
      // Fallback empty manifest
      return {
        manifestId: 'unavailable',
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        capabilities: [],
        source: 'cached'
      };
    }, {});
  }

  // Telemetry fetch ----------------------------------------------------------
  fetchTelemetry(sessionId: string): Promise<SidecarEnvelope<TelemetryEnvelope>> {
    if (!sessionId) return Promise.resolve({ ok: false, error: 'sessionId required', code: 'VALIDATION' });
    return this.invoke('telemetry.list', async () => {
      const records = await window.api.assistant.listTelemetry(sessionId);
      return {
        events: records.map(r => ({
          id: r.id,
          kind: 'tool.completed', // TODO(T011): refine kind mapping from record.status/toolId
          sessionId: r.sessionId,
          timestamp: r.finishedAt || r.startedAt,
          provider: r.provider,
          latencyMs: r.finishedAt ? (new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) : undefined,
          meta: { toolId: r.toolId, status: r.status }
        })),
        generatedAt: new Date().toISOString(),
        sessionId,
        version: '1.0.0'
      };
    }, { sessionId });
  }
}

export function createSidecarClient(hooks?: SidecarClientHooks): SidecarClient {
  return new SidecarClient(hooks);
}

// TODO(T010-Export): Provide a singleton accessor integrated with assistantStore lifecycle.
