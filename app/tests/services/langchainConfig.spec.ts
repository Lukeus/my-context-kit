import { describe, it, expect, beforeEach, afterAll } from 'vitest';

// Import via relative path to renderer service (bundler alias not applied in test runtime without Vite context)
import { resolveLangChainConfig } from '../../src/renderer/services/langchain/config';

describe('resolveLangChainConfig (node/main safety)', () => {
  const originalEnv = { ...process.env };
  const originalWindow = (globalThis as any).window;
  const originalNavigator = (globalThis as any).navigator;

  beforeEach(() => {
    // Reset env and globals each test
    process.env = { ...originalEnv };
    (globalThis as any).window = undefined; // simulate Electron main (no window)
    (globalThis as any).navigator = undefined; // navigator absent in main
  });

  it('falls back to defaults when no env vars present and no window/navigator', () => {
    const cfg = resolveLangChainConfig();
    expect(cfg.baseUrl).toBe('http://localhost:5055');
    expect(cfg.timeoutMs).toBe(15000);
    expect(cfg.telemetryDefaults.platform).toBe('linux'); // default branch when navigator undefined
  });

  it('uses env overrides when provided', () => {
    process.env.LANGCHAIN_BASE_URL = 'http://127.0.0.1:6000/'; // trailing slash to test sanitize
    process.env.LANGCHAIN_TIMEOUT_MS = '25000';
    process.env.LANGCHAIN_CAPABILITY_CACHE_TTL_MS = '120000';
    process.env.APP_VERSION = '1.2.3';
    const cfg = resolveLangChainConfig();
    expect(cfg.baseUrl).toBe('http://127.0.0.1:6000'); // sanitized
    expect(cfg.timeoutMs).toBe(25000);
    expect(cfg.capabilityCacheTtlMs).toBe(120000);
    expect(cfg.telemetryDefaults.appVersion).toBe('1.2.3');
  });

  it('prefers window.ENV when available (renderer scenario)', () => {
    (globalThis as any).window = { ENV: { LANGCHAIN_BASE_URL: 'http://renderer:7777' } };
    const cfg = resolveLangChainConfig();
    expect(cfg.baseUrl).toBe('http://renderer:7777');
  });

  it('falls back to globalThis.ENV when window/process missing', () => {
    (globalThis as any).window = undefined;
    const originalProcess = (globalThis as any).process;
    (globalThis as any).process = undefined;
    (globalThis as any).ENV = { LANGCHAIN_BASE_URL: 'http://global-env:8088' };
    const cfg = resolveLangChainConfig();
    expect(cfg.baseUrl).toBe('http://global-env:8088');
    (globalThis as any).process = originalProcess;
    delete (globalThis as any).ENV;
  });

  afterAll(() => {
    // Restore originals
    process.env = originalEnv;
    (globalThis as any).window = originalWindow;
    (globalThis as any).navigator = originalNavigator;
  });
});
