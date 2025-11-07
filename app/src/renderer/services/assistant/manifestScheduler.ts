// Manifest Refresh Scheduler (T024)
// -----------------------------------------------------------------------------
// Provides automatic background refresh of capability manifest at configurable intervals.
// Integrates with assistantStore to keep capability profile up-to-date.
// TODO(T024-UI): Add manual refresh button in UnifiedAssistant.vue.
// TODO(T024-Config): Make refresh interval user-configurable in settings.

export interface ManifestSchedulerOptions {
  intervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onRefresh?: (success: boolean, error?: string) => void;
  onError?: (error: string) => void;
}

const DEFAULT_INTERVAL_MS = 300000; // 5 minutes
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;

export interface ManifestScheduler {
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
  isRunning(): boolean;
  getLastRefresh(): Date | null;
  getNextRefresh(): Date | null;
}

/**
 * Create manifest refresh scheduler.
 */
export function createManifestScheduler(
  options: ManifestSchedulerOptions = {}
): ManifestScheduler {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let timeoutId: NodeJS.Timeout | null = null;
  let lastRefresh: Date | null = null;
  let nextRefresh: Date | null = null;
  let running = false;
  let retryCount = 0;

  async function doRefresh(): Promise<void> {
    try {
      // Call IPC bridge to fetch manifest
      const manifest = await window.api.assistant.fetchCapabilityManifest();
      
      lastRefresh = new Date();
      retryCount = 0; // Reset retry count on success
      
      options.onRefresh?.(true);
      
      console.debug('[ManifestScheduler] Manifest refreshed successfully', {
        timestamp: lastRefresh.toISOString(),
        profileId: manifest.profileId,
        capabilityCount: Object.keys(manifest.capabilities || {}).length
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      retryCount++;
      
      if (retryCount <= maxRetries) {
        console.warn(`[ManifestScheduler] Refresh failed (attempt ${retryCount}/${maxRetries}):`, errorMessage);
        
        // Schedule retry with delay
        setTimeout(() => {
          if (running) {
            void doRefresh();
          }
        }, retryDelayMs);
      } else {
        console.error('[ManifestScheduler] Max retries exceeded:', errorMessage);
        options.onError?.(errorMessage);
        retryCount = 0; // Reset for next scheduled refresh
      }
      
      options.onRefresh?.(false, errorMessage);
    }
  }

  function scheduleNext() {
    if (!running) return;
    
    nextRefresh = new Date(Date.now() + intervalMs);
    timeoutId = setTimeout(() => {
      void doRefresh();
      scheduleNext();
    }, intervalMs);
  }

  return {
    start() {
      if (running) return;
      
      running = true;
      console.debug('[ManifestScheduler] Starting scheduler', {
        intervalMs,
        maxRetries,
        retryDelayMs
      });
      
      // Immediate refresh on start
      void doRefresh();
      scheduleNext();
    },

    stop() {
      if (!running) return;
      
      running = false;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      nextRefresh = null;
      console.debug('[ManifestScheduler] Stopped scheduler');
    },

    async refresh() {
      await doRefresh();
    },

    isRunning() {
      return running;
    },

    getLastRefresh() {
      return lastRefresh;
    },

    getNextRefresh() {
      return nextRefresh;
    }
  };
}

/**
 * Format time until next refresh for display.
 */
export function formatNextRefresh(scheduler: ManifestScheduler): string {
  const next = scheduler.getNextRefresh();
  if (!next) return 'Not scheduled';
  
  const now = Date.now();
  const diff = next.getTime() - now;
  
  if (diff < 0) return 'Refreshing...';
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Format last refresh time for display.
 */
export function formatLastRefresh(scheduler: ManifestScheduler): string {
  const last = scheduler.getLastRefresh();
  if (!last) return 'Never';
  
  const now = Date.now();
  const diff = now - last.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Example usage:
// const scheduler = createManifestScheduler({
//   intervalMs: 300000, // 5 minutes
//   onRefresh: (success, error) => {
//     if (success) {
//       console.log('Manifest refreshed');
//     } else {
//       console.error('Manifest refresh failed:', error);
//     }
//   }
// });
// scheduler.start();
