import type { Dispatcher } from 'undici';
import { logger } from './logger';

const proxyDispatcherCache = new Map<string, Promise<Dispatcher | null>>();

export interface ProxyFetchOptions {
  /**
   * Optional provider that returns the AbortSignal to attach to each request.
   * When omitted, the caller can still pass a signal in the RequestInit object.
   */
  signalProvider?: () => AbortSignal | null | undefined;
}

/**
 * Create a fetch implementation that respects system proxy settings while
 * allowing per-request abort signals. This helper centralises proxy handling
 * so services do not duplicate environment parsing logic.
 */
export function createProxyAwareFetch(targetUrl: string | undefined, options?: ProxyFetchOptions): typeof fetch {
  const fetchImpl: typeof fetch | undefined = (globalThis as { fetch?: typeof fetch }).fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error('Fetch API is not available in this runtime');
  }

  if (!targetUrl) {
    return attachSignalWrapper(fetchImpl, options?.signalProvider);
  }

  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl || shouldBypassProxy(targetUrl)) {
    return attachSignalWrapper(fetchImpl, options?.signalProvider);
  }

  const dispatcherPromise = getProxyDispatcher(proxyUrl);

  return attachSignalWrapper(async (input: RequestInfo | URL, init?: RequestInit) => {
    const dispatcher = await dispatcherPromise;
    if (!dispatcher) {
      return fetchImpl(input, init);
    }

    const finalInit: RequestInit & { dispatcher?: Dispatcher } = { ...(init ?? {}) };
    if (!finalInit.dispatcher) {
      finalInit.dispatcher = dispatcher;
    }

    return fetchImpl(input, finalInit);
  }, options?.signalProvider);
}

export function resolveProxyUrl(): string | null {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    null
  );
}

export function shouldBypassProxy(targetUrl: string): boolean {
  const rawNoProxy = [process.env.NO_PROXY, process.env.no_proxy, process.env.AI_PROXY_BYPASS]
    .filter(Boolean)
    .join(',');

  if (!rawNoProxy) {
    return false;
  }

  let host: string | null = null;
  try {
    host = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return false;
  }

  return rawNoProxy
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((pattern) => hostMatchesPattern(host!, pattern));
}

function attachSignalWrapper(fetchFn: typeof fetch, signalProvider?: () => AbortSignal | null | undefined): typeof fetch {
  if (!signalProvider) {
    return fetchFn;
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const signal = signalProvider();
    if (!signal) {
      return fetchFn(input, init);
    }

    const finalInit: RequestInit = { ...(init ?? {}) };
    if (!finalInit.signal) {
      finalInit.signal = signal;
    }

    return fetchFn(input, finalInit);
  };
}

function hostMatchesPattern(host: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }

  const [patternHost, patternPort] = pattern.split(':');
  const [hostNameOnly, hostPort] = host.split(':');

  if (patternPort && hostPort && patternPort === hostPort && patternHost === hostNameOnly) {
    return true;
  }

  const normalizedPattern = patternHost.startsWith('.') ? patternHost.slice(1) : patternHost;

  return hostNameOnly === normalizedPattern || hostNameOnly.endsWith(`.${normalizedPattern}`);
}

function getProxyDispatcher(proxyUrl: string): Promise<Dispatcher | null> {
  if (!proxyDispatcherCache.has(proxyUrl)) {
    const dispatcherPromise: Promise<Dispatcher | null> = import('undici')
      .then((mod) => {
        const ProxyAgentCtor = (mod as { ProxyAgent?: new (url: string) => Dispatcher }).ProxyAgent;
        if (typeof ProxyAgentCtor !== 'function') {
          logger.warn(
            { service: 'proxyFetch', method: 'getProxyDispatcher' },
            'ProxyAgent not available in undici; using direct fetch.'
          );
          return null;
        }
        return new ProxyAgentCtor(proxyUrl);
      })
      .catch((err) => {
        logger.warn(
          { service: 'proxyFetch', method: 'getProxyDispatcher', proxyUrl },
          `Failed to create proxy agent: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
      });

    proxyDispatcherCache.set(proxyUrl, dispatcherPromise);
  }

  return proxyDispatcherCache.get(proxyUrl)!;
}
