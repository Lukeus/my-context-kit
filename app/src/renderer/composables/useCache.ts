/**
 * Cache Composable
 * 
 * Provides in-memory caching with TTL support for performance optimization.
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class ContextCache {
  private cache: Map<string, CacheEntry<any>>;
  private cleanupInterval: number | null = null;

  constructor(cleanupIntervalMs: number = 60000) {
    this.cache = new Map();
    
    // Start periodic cleanup of expired entries
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = 300000): void { // Default 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate keys matching a pattern
   */
  invalidate(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Global cache instance
let globalCache: ContextCache | null = null;

/**
 * Composable for using the cache
 */
export function useCache() {
  if (!globalCache) {
    globalCache = new ContextCache();
  }

  /**
   * Get or compute value with caching
   */
  async function getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl: number = 300000
  ): Promise<T> {
    // Check cache first
    const cached = globalCache!.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute and cache
    const result = await compute();
    globalCache!.set(key, result, ttl);
    return result;
  }

  /**
   * Memoize a function with cache
   */
  function memoize<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    keyFn: (...args: TArgs) => string,
    ttl: number = 300000
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const key = keyFn(...args);
      return getOrCompute(key, () => fn(...args), ttl);
    };
  }

  return {
    cache: globalCache!,
    getOrCompute,
    memoize,
  };
}
