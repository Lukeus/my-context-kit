// Central CSP builder for Electron main process
// Generates Content-Security-Policy header/meta values with environment-driven connect-src origins.
// TODO(CSP-Dynamic): Future enhancement - watch settings changes to regenerate CSP at runtime if user modifies sidecar port.

export interface CspOptions {
  dev: boolean;
  sidecarPorts?: number[]; // primary sidecar port(s)
  legacyPorts?: number[];  // legacy compatibility ports
  extraConnectOrigins?: string[]; // any additional full origins (e.g., https://api.example.com)
}

function unique<T>(values: T[]): T[] { return Array.from(new Set(values)); }

function originVariants(port: number): string[] {
  return [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `ws://localhost:${port}`,
    `ws://127.0.0.1:${port}`
  ];
}

export function buildCsp(options: CspOptions): string {
  const sidecarPorts = options.sidecarPorts && options.sidecarPorts.length ? options.sidecarPorts : [8000];
  const legacyPorts = options.legacyPorts || [5055];
  const baseOrigins = [
    ...sidecarPorts.flatMap(originVariants),
    ...legacyPorts.flatMap(originVariants),
    ...(options.extraConnectOrigins || [])
  ];
  const connectOrigins = unique(baseOrigins);

  const connectSrc = `connect-src 'self' ${connectOrigins.join(' ')}`;
  const scriptSrc = options.dev ? "script-src 'self' 'unsafe-eval' blob:" : "script-src 'self' blob:";
  const base = "default-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:;";

  return `${base} ${scriptSrc}; ${connectSrc};`;
}

export function buildCspFromEnv(): string {
  const dev = process.env.NODE_ENV === 'development' || !!process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const primaryPort = safePort(process.env.CONTEXT_KIT_SIDECAR_PORT) ?? 8000;
  const legacyPort = safePort(process.env.CONTEXT_KIT_LEGACY_PORT) ?? 5055;
  const ollamaPort = safePort(process.env.OLLAMA_PORT) ?? 11434; // Ollama default port
  console.log('[CSP] Ports:', { primaryPort, legacyPort, ollamaPort });
  const extra = (process.env.CONTEXT_KIT_EXTRA_CONNECT || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return buildCsp({ dev, sidecarPorts: [primaryPort, ollamaPort], legacyPorts: [legacyPort], extraConnectOrigins: extra });
}

function safePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : undefined;
}
