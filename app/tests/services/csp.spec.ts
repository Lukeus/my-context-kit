import { describe, it, expect } from 'vitest';
import { buildCsp, buildCspFromEnv } from '../../src/main/security/csp';

function extractDirective(csp: string, name: string): string | undefined {
  return csp.split(';').map(p => p.trim()).find(p => p.startsWith(name + ' '));
}

describe('CSP builder', () => {
  it('builds production CSP with default ports', () => {
    const csp = buildCsp({ dev: false });
    expect(csp).toContain("default-src 'self'");
    const connect = extractDirective(csp, 'connect-src');
    expect(connect).toBeDefined();
    expect(connect).toContain('http://localhost:8000');
    expect(connect).toContain('http://127.0.0.1:8000');
    expect(connect).toContain('http://localhost:5055');
  });

  it('includes unsafe-eval in dev mode', () => {
    const csp = buildCsp({ dev: true });
    expect(csp).toContain("script-src 'self' 'unsafe-eval' blob:");
  });

  it('respects overridden ports and extra origins', () => {
    const csp = buildCsp({ dev: false, sidecarPorts: [9000], legacyPorts: [], extraConnectOrigins: ['https://api.example.com'] });
    const connect = extractDirective(csp, 'connect-src')!;
    expect(connect).toContain('http://localhost:9000');
    expect(connect).toContain('https://api.example.com');
    expect(connect).not.toContain('5055');
  });

  it('builds from environment variables', () => {
    const prev = { ...process.env };
    process.env.CONTEXT_KIT_SIDECAR_PORT = '7000';
    process.env.CONTEXT_KIT_LEGACY_PORT = '6000';
    process.env.CONTEXT_KIT_EXTRA_CONNECT = 'https://extra.one, https://extra.two';
    const csp = buildCspFromEnv();
    const connect = extractDirective(csp, 'connect-src')!;
    expect(connect).toContain('http://localhost:7000');
    expect(connect).toContain('http://localhost:6000');
    expect(connect).toContain('https://extra.one');
    expect(connect).toContain('https://extra.two');
    process.env = prev;
  });
});
