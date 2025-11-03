// T082: Time calculation helpers
// Consolidates timestamp and duration logic used across assistant services.

/**
 * Get current timestamp in milliseconds since epoch.
 */
export function now(): number {
  return Date.now();
}

/**
 * Get current timestamp as ISO 8601 string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Calculate elapsed time in milliseconds from a start time.
 */
export function elapsed(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Format a duration in milliseconds as a human-readable string.
 * Examples: "42ms", "1.2s", "3.5m"
 */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  } else if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  } else {
    return `${(durationMs / 60000).toFixed(1)}m`;
  }
}

/**
 * Format an ISO 8601 timestamp as a human-readable string.
 */
export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  } catch {
    return isoString;
  }
}

/**
 * Check if a timestamp is older than the specified age in milliseconds.
 */
export function isStale(timestamp: string | null | undefined, maxAgeMs: number): boolean {
  if (!timestamp) return true;
  
  const parsedTime = Date.parse(timestamp);
  if (isNaN(parsedTime)) return true;
  
  return Date.now() - parsedTime > maxAgeMs;
}
