// LangChain Capability Profile Cache (Phase 5 T019)
// Provides caching layer for capability profiles with timestamp-based refresh logic.
// Integrates with assistantStore to expose capability availability to UI components.

import type { CapabilityProfile, CapabilityEntry } from '@shared/assistant/types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes default TTL

export interface CachedCapabilityProfile extends CapabilityProfile {
  cachedAt: string; // ISO timestamp when cached
}

export interface CapabilityCache {
  profile: CachedCapabilityProfile | null;
  fetch: () => Promise<CapabilityProfile>;
  refresh: () => Promise<CapabilityProfile>;
  isFresh: () => boolean;
  clear: () => void;
}

/**
 * Create a capability profile cache with automatic staleness detection.
 * Uses IPC bridge to fetch capabilities from main process.
 * @param options Configuration for cache behavior
 * @returns CapabilityCache instance
 */
export function createCapabilityCache(options?: {
  ttlMs?: number;
}): CapabilityCache {
  const ttl = options?.ttlMs ?? CACHE_TTL_MS;
  
  let cached: CachedCapabilityProfile | null = null;

  function isFresh(): boolean {
    if (!cached) return false;
    const age = Date.now() - new Date(cached.cachedAt).getTime();
    return age < ttl;
  }

  async function fetchProfile(): Promise<CapabilityProfile> {
    try {
      // Use IPC bridge instead of HTTP fetch
      const bridge = window.api?.assistant;
      if (!bridge) {
        console.warn('[capabilities] Assistant bridge not available, using fallback profile');
        return {
          profileId: 'no-bridge',
          lastUpdated: new Date().toISOString(),
          capabilities: {}
        };
      }

      const profile = await bridge.fetchCapabilityManifest();
      return profile;
    } catch (err) {
      console.warn('[capabilities] Failed to fetch capability profile via IPC, using fallback:', err);
      return {
        profileId: 'fallback',
        lastUpdated: new Date().toISOString(),
        capabilities: {}
      };
    }
  }

  async function refresh(): Promise<CapabilityProfile> {
    const profile = await fetchProfile();
    cached = {
      ...profile,
      cachedAt: new Date().toISOString()
    };
    return profile;
  }

  async function fetchCached(): Promise<CapabilityProfile> {
    if (isFresh()) {
      return cached!;
    }
    return refresh();
  }

  function clear(): void {
    cached = null;
  }

  return {
    get profile() {
      return cached;
    },
    fetch: fetchCached,
    refresh,
    isFresh,
    clear
  };
}

/**
 * Check if a specific capability is enabled in the profile.
 * @param profile Capability profile to check
 * @param capabilityId Capability identifier
 * @returns true if enabled, false otherwise
 */
export function isCapabilityEnabled(
  profile: CapabilityProfile | null,
  capabilityId: string
): boolean {
  if (!profile) return false;
  const entry = profile.capabilities[capabilityId];
  return entry?.status === 'enabled';
}

/**
 * Get capability entry with default fallback.
 * @param profile Capability profile
 * @param capabilityId Capability identifier
 * @returns CapabilityEntry or disabled fallback
 */
export function getCapability(
  profile: CapabilityProfile | null,
  capabilityId: string
): CapabilityEntry {
  const entry = profile?.capabilities[capabilityId];
  return entry || { status: 'disabled' };
}

/**
 * Get all enabled capability IDs.
 * @param profile Capability profile
 * @returns Array of enabled capability IDs
 */
export function getEnabledCapabilities(profile: CapabilityProfile | null): string[] {
  if (!profile) return [];
  return Object.entries(profile.capabilities)
    .filter(([, entry]) => entry.status === 'enabled')
    .map(([id]) => id);
}
