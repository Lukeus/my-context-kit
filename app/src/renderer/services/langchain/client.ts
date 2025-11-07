// Phase 2 T005: LangChain HTTP client wrappers
// Provides typed calls to orchestration service endpoints defined in
// specs/001-langchain-backend-integration/contracts/assistant-langchain.yaml
// TODO: Add retries, exponential backoff, and circuit breaker for health-degraded state.

import type { CapabilityProfile, TaskEnvelope } from '@shared/assistant/types';

export interface CreateSessionRequest {
  userId: string;
  clientVersion: string;
  provider?: string;
  systemPrompt?: string;
  activeTools?: string[];
  capabilitiesOverride?: Record<string, string>;
}

export interface CreateSessionResponse {
  sessionId: string;
  capabilityProfile?: CapabilityProfile;
  telemetryContext?: Record<string, unknown>;
}

export interface PostMessageRequest {
  content: string;
  mode: 'general' | 'improvement' | 'clarification';
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  info?: Record<string, unknown>;
}

export interface LangChainClientOptions {
  baseUrl: string; // e.g. http://localhost:5055
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export class LangChainClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeoutMs: number;

  constructor(opts: LangChainClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.headers = { 'Content-Type': 'application/json', ...(opts.defaultHeaders || {}) };
    this.timeoutMs = opts.timeoutMs ?? 15000; // default 15s
  }

  // Low-level fetch with timeout
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await fetch(`${this.baseUrl}${path}`, { ...init, headers: this.headers, signal: controller.signal });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
      }
      if (resp.status === 204) return undefined as unknown as T;
      return (await resp.json()) as T;
    } catch (err) {
      if ((err as any).name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeoutMs}ms: ${path}`);
      }
      throw err;
    } finally {
      clearTimeout(id);
    }
  }

  async createSession(payload: CreateSessionRequest): Promise<CreateSessionResponse> {
    // POST /assistant/sessions
    return this.request<CreateSessionResponse>('/assistant/sessions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async postMessage(sessionId: string, payload: PostMessageRequest): Promise<TaskEnvelope> {
    // POST /assistant/sessions/{sessionId}/messages
    return this.request<TaskEnvelope>(`/assistant/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getHealth(): Promise<HealthStatus> {
    // GET /assistant/health
    return this.request<HealthStatus>('/assistant/health', { method: 'GET' });
  }

  async getCapabilities(): Promise<CapabilityProfile> {
    // GET /assistant/capabilities
    return this.request<CapabilityProfile>('/assistant/capabilities', { method: 'GET' });
  }

  // Build stream URL for SSE consumption.
  buildStreamUrl(sessionId: string, taskId: string): string {
    return `${this.baseUrl}/assistant/sessions/${encodeURIComponent(sessionId)}/tasks/${encodeURIComponent(taskId)}/stream`;
  }
}

export function createLangChainClient(baseUrl: string): LangChainClient {
  return new LangChainClient({ baseUrl });
}
