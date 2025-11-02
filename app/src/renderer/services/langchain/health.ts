// LangChain Health Polling Utility (Phase 4 T015)
// Provides reactive polling of /assistant/health endpoint with simple exponential backoff
// and status mapping suitable for assistantStore integration.
// TODO(T016): Integrate with assistantStore to propagate health state and block risky actions.

import { resolveLangChainConfig } from './config';

export type LangChainHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface RawHealthResponse {
  status?: string; // backend raw status
  latencyMs?: number;
  components?: Array<{ name: string; status: string; latencyMs?: number }>;
  timestamp?: string;
  message?: string;
}

export interface NormalisedHealth {
  status: LangChainHealthStatus;
  latencyMs: number | null;
  components: Array<{ name: string; status: LangChainHealthStatus; latencyMs: number | null }>;
  timestamp: string;
  message: string | null;
}

export interface HealthListener {
  (health: NormalisedHealth): void;
}

export interface HealthPollerOptions {
  intervalMs?: number; // base poll interval
  maxIntervalMs?: number; // cap exponential backoff
  initialDelayMs?: number; // start delay
  fetchFn?: typeof fetch; // override for tests
}

export class LangChainHealthPoller {
  private timer: any = null;
  private listeners: Set<HealthListener> = new Set();
  private running = false;
  private currentInterval: number;
  private readonly baseInterval: number;
  private readonly maxInterval: number;
  private readonly initialDelay: number;
  private readonly fetchFn: typeof fetch;
  private lastHealth: NormalisedHealth = this.emptyHealth();

  constructor(options: HealthPollerOptions = {}) {
    this.baseInterval = options.intervalMs ?? 8000;
    this.maxInterval = options.maxIntervalMs ?? 60000; // 60s cap
    this.initialDelay = options.initialDelayMs ?? 0;
    this.currentInterval = this.baseInterval;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.initialDelay > 0) {
      this.timer = setTimeout(() => this.scheduleNext(), this.initialDelay);
    } else {
      this.scheduleNext();
    }
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  on(listener: HealthListener): () => void {
    this.listeners.add(listener);
    // emit current snapshot immediately
    listener(this.lastHealth);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): NormalisedHealth {
    return this.lastHealth;
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.pollOnce().then(() => {
        this.scheduleNext();
      });
    }, this.currentInterval);
  }

  private async pollOnce(): Promise<void> {
    const { baseUrl } = resolveLangChainConfig();
    const url = `${baseUrl.replace(/\/$/, '')}/assistant/health`;
    let raw: RawHealthResponse | null = null;
    let ok = false;
    let latency: number | null = null;
    const start = performance.now();
    try {
      const res = await this.fetchFn(url, { method: 'GET' });
      latency = performance.now() - start;
      if (res.ok) {
        raw = await res.json();
        ok = true;
      }
    } catch {
      // network failure treated as unhealthy
    }

    const normalised = this.normalise(raw, ok, latency);
    this.lastHealth = normalised;
    this.emit(normalised);

    // Backoff logic: if unhealthy increase interval up to max; if healthy reset.
    if (normalised.status === 'unhealthy') {
      this.currentInterval = Math.min(this.currentInterval * 2, this.maxInterval);
    } else if (normalised.status === 'healthy') {
      this.currentInterval = this.baseInterval;
    }
  }

  private emit(health: NormalisedHealth): void {
    for (const listener of [...this.listeners]) {
      try { listener(health); } catch {/* swallow listener errors */}
    }
  }

  private normalise(raw: RawHealthResponse | null, ok: boolean, latency: number | null): NormalisedHealth {
    const baseStatus = ok ? this.mapStatus(raw?.status) : 'unhealthy';
    const components = Array.isArray(raw?.components) ? raw!.components.map(c => ({
      name: c.name,
      status: this.mapStatus(c.status),
      latencyMs: typeof c.latencyMs === 'number' ? c.latencyMs : null
    })) : [];
    return {
      status: baseStatus,
      latencyMs: latency,
      components,
      timestamp: new Date().toISOString(),
      message: typeof raw?.message === 'string' ? raw!.message : null
    };
  }

  private mapStatus(input: string | undefined): LangChainHealthStatus {
    switch ((input || '').toLowerCase()) {
      case 'ok':
      case 'healthy':
        return 'healthy';
      case 'partial':
      case 'degraded':
        return 'degraded';
      case 'down':
      case 'error':
      case 'unhealthy':
        return 'unhealthy';
      default:
        return 'unknown';
    }
  }

  private emptyHealth(): NormalisedHealth {
    return {
      status: 'unknown',
      latencyMs: null,
      components: [],
      timestamp: new Date().toISOString(),
      message: null
    };
  }
}

export function createHealthPoller(options?: HealthPollerOptions): LangChainHealthPoller {
  return new LangChainHealthPoller(options);
}
