// Sidecar Fallback Detection (T020)
// -----------------------------------------------------------------------------
// Provides health checking and fallback detection for LangChain sidecar service.
// Integrates with capability manifest to determine available operations when
// sidecar is degraded or unavailable.
// TODO(T020-Retry): Implement exponential backoff for health checks.
// TODO(T020-UI): Wire health status into FallbackBanner.vue component.

import type { HealthStatusResponse } from '@/../preload/assistantBridge';

export type SidecarHealthStatus = 'available' | 'degraded' | 'unavailable' | 'unknown';

export interface SidecarHealthCheck {
  status: SidecarHealthStatus;
  timestamp: string;
  latencyMs?: number;
  capabilities?: string[];
  error?: string;
  fallbackMode: boolean;
}

export interface FallbackCapabilities {
  canReadContext: boolean;
  canValidate: boolean;
  canBuildGraph: boolean;
  canRunImpact: boolean;
  canGenerate: boolean;
  canUseAI: boolean;
}

export interface HealthCheckOptions {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Check sidecar health status via IPC bridge.
 */
export async function checkSidecarHealth(
  options: HealthCheckOptions = {}
): Promise<SidecarHealthCheck> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();

  try {
    // Call IPC bridge with timeout
    const healthPromise = window.api.assistant.getHealthStatus();
    const timeoutPromise = new Promise<HealthStatusResponse>((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
    );

    const response = await Promise.race([
      healthPromise,
      timeoutPromise
    ]);

    const latencyMs = Date.now() - startTime;
    const status = mapHealthStatus(response.status);

    return {
      status,
      timestamp: response.timestamp,
      latencyMs,
      error: response.message && status !== 'available' ? response.message : undefined,
      fallbackMode: status === 'degraded' || status === 'unavailable'
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      status: 'unavailable',
      timestamp: new Date().toISOString(),
      latencyMs,
      error: err instanceof Error ? err.message : 'Health check failed',
      fallbackMode: true
    };
  }
}

/**
 * Map health response status to sidecar status.
 */
function mapHealthStatus(status: string): SidecarHealthStatus {
  switch (status) {
    case 'healthy':
      return 'available';
    case 'degraded':
      return 'degraded';
    case 'unhealthy':
      return 'unavailable';
    default:
      return 'unknown';
  }
}

/**
 * Determine fallback capabilities when sidecar is unavailable.
 */
export function getFallbackCapabilities(health: SidecarHealthCheck): FallbackCapabilities {
  if (health.status === 'available') {
    // Full capabilities available
    return {
      canReadContext: true,
      canValidate: true,
      canBuildGraph: true,
      canRunImpact: true,
      canGenerate: true,
      canUseAI: true
    };
  }

  if (health.status === 'degraded') {
    // Limited AI capabilities, local operations still available
    return {
      canReadContext: true,
      canValidate: true,
      canBuildGraph: true,
      canRunImpact: true,
      canGenerate: true,
      canUseAI: false // AI-powered features disabled
    };
  }

  // Sidecar unavailable - only local read operations
  return {
    canReadContext: true,  // Local file system access
    canValidate: false,    // Requires sidecar
    canBuildGraph: false,  // Requires sidecar
    canRunImpact: false,   // Requires sidecar
    canGenerate: false,    // Requires sidecar
    canUseAI: false        // Requires sidecar
  };
}

/**
 * Check if specific capability is available given health status.
 */
export function isCapabilityAvailable(
  health: SidecarHealthCheck,
  capability: keyof FallbackCapabilities
): boolean {
  const capabilities = getFallbackCapabilities(health);
  return capabilities[capability];
}

/**
 * Get user-friendly status message for health state.
 */
export function getHealthStatusMessage(health: SidecarHealthCheck): string {
  switch (health.status) {
    case 'available':
      return 'All features available';
    case 'degraded':
      return 'Limited features available - AI operations may be slow';
    case 'unavailable':
      return 'Service unavailable - only local read operations available';
    case 'unknown':
      return 'Health status unknown';
    default:
      return 'Unexpected status';
  }
}

/**
 * Determine if fallback mode banner should be shown.
 */
export function shouldShowFallbackBanner(health: SidecarHealthCheck): boolean {
  return health.fallbackMode && (health.status === 'degraded' || health.status === 'unavailable');
}

/**
 * Create health check poller with exponential backoff.
 */
export interface HealthPoller {
  start(): void;
  stop(): void;
  forceCheck(): Promise<SidecarHealthCheck>;
  getLatest(): SidecarHealthCheck | null;
  on(listener: (health: SidecarHealthCheck) => void): () => void;
}

export function createHealthPoller(options: {
  intervalMs?: number;
  backoffMultiplier?: number;
  maxIntervalMs?: number;
}): HealthPoller {
  const baseIntervalMs = options.intervalMs ?? 10000; // 10s default
  const backoffMultiplier = options.backoffMultiplier ?? 1.5;
  const maxIntervalMs = options.maxIntervalMs ?? 60000; // 60s max

  let currentIntervalMs = baseIntervalMs;
  let timeoutId: NodeJS.Timeout | null = null;
  let latestHealth: SidecarHealthCheck | null = null;
  const listeners: Set<(health: SidecarHealthCheck) => void> = new Set();
  let isRunning = false;

  async function poll() {
    try {
      const health = await checkSidecarHealth();
      latestHealth = health;

      // Reset interval on successful check
      if (health.status === 'available') {
        currentIntervalMs = baseIntervalMs;
      } else {
        // Increase interval on failure (exponential backoff)
        currentIntervalMs = Math.min(
          currentIntervalMs * backoffMultiplier,
          maxIntervalMs
        );
      }

      // Notify listeners
      for (const listener of [...listeners]) {
        try {
          listener(health);
        } catch (err) {
          console.error('Health poller listener error:', err);
        }
      }
    } catch (err) {
      console.error('Health poll failed:', err);
      currentIntervalMs = Math.min(
        currentIntervalMs * backoffMultiplier,
        maxIntervalMs
      );
    }

    if (isRunning) {
      timeoutId = setTimeout(() => void poll(), currentIntervalMs);
    }
  }

  return {
    start() {
      if (isRunning) return;
      isRunning = true;
      currentIntervalMs = baseIntervalMs;
      // Intentionally fire-and-forget polling - errors handled internally
      void poll();
    },

    stop() {
      isRunning = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },

    async forceCheck() {
      const health = await checkSidecarHealth();
      latestHealth = health;
      for (const listener of [...listeners]) {
        try {
          listener(health);
        } catch (err) {
          console.error('Health poller listener error:', err);
        }
      }
      return health;
    },

    getLatest() {
      return latestHealth;
    },

    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// Example usage:
// const poller = createHealthPoller({ intervalMs: 10000 });
// poller.on(health => {
//   if (shouldShowFallbackBanner(health)) {
//     showBanner(getHealthStatusMessage(health));
//   }
// });
// poller.start();
