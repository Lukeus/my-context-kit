// Phase 2 T007: Configuration utilities for LangChain service integration
// Centralizes runtime resolution of base URL, timeouts, telemetry defaults, and capability cache TTL.
// TODO(Resilience): Add dynamic update when user modifies settings mid-session.

export interface LangChainRuntimeConfig {
  baseUrl: string;
  timeoutMs: number;
  telemetryDefaults: {
    appVersion: string;
    platform: string;
  };
  capabilityCacheTtlMs: number;
}

// Default matches Context Kit Service spawn (see ContextKitServiceClient) – previously 5055, aligned to 8000 on 2025-11-02.
const DEFAULT_BASE_URL = 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CAPABILITY_CACHE_TTL_MS = 60_000; // 1 minute

function getEnv(name: string): string | undefined {
  // Access order:
  // 1. Preload-injected window.ENV (renderer only)
  // 2. process.env (main & renderer)
  // 3. import.meta.env (Vite renderer build-time injections)
  // 4. globalThis.ENV (future compatibility for shared injection)
  // Guard against ReferenceError when running in Electron main (no window object)
  // TODO(Config-Injection): Consider moving this file to shared/ and injecting an explicit env bag instead of implicit globals.
  try {
    const w: any = typeof window !== 'undefined' ? (window as any) : undefined;
    const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    const procEnv = typeof process !== 'undefined' ? (process as any).env : undefined;
    const viteEnv = typeof import.meta !== 'undefined' && (import.meta as any)?.env ? (import.meta as any).env : undefined; // eslint-disable-line
    return (w?.ENV && w.ENV[name])
      || (procEnv && procEnv[name])
      || (viteEnv && viteEnv[name])
      || (g?.ENV && g.ENV[name]);
  } catch {
    try {
      return typeof process !== 'undefined' ? (process as any).env?.[name] : undefined;
    } catch {
      return undefined;
    }
  }
}

export function resolveLangChainConfig(): LangChainRuntimeConfig {
  const baseUrl = sanitizeBaseUrl(
    getEnv('LANGCHAIN_BASE_URL') || getEnv('VITE_LANGCHAIN_BASE_URL') || DEFAULT_BASE_URL
  );
  const timeoutRaw = getEnv('LANGCHAIN_TIMEOUT_MS');
  const timeoutMs = timeoutRaw ? safeNumber(timeoutRaw, DEFAULT_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  const ttlRaw = getEnv('LANGCHAIN_CAPABILITY_CACHE_TTL_MS');
  const capabilityCacheTtlMs = ttlRaw ? safeNumber(ttlRaw, DEFAULT_CAPABILITY_CACHE_TTL_MS) : DEFAULT_CAPABILITY_CACHE_TTL_MS;

  return {
    baseUrl,
    timeoutMs,
    telemetryDefaults: {
      appVersion: getEnv('APP_VERSION') || 'dev',
      // navigator is not defined in Electron main; guard accordingly
      platform: (typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows'))
        ? 'windows'
        : (typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac'))
          ? 'mac'
          : 'linux'
    },
    capabilityCacheTtlMs
  };
}

export function getBaseUrl(): string {
  return resolveLangChainConfig().baseUrl;
}

export function getTimeout(): number {
  return resolveLangChainConfig().timeoutMs;
}

export function buildTelemetryContext(extra?: Record<string, unknown>): Record<string, unknown> {
  const cfg = resolveLangChainConfig();
  return {
    ...cfg.telemetryDefaults,
    ts: new Date().toISOString(),
    ...(extra || {})
  };
}

function sanitizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function safeNumber(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
