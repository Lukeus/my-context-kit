// Capability manifest fetch logic (T011)
// -----------------------------------------------------------------------------
// Provides high-level helpers for retrieving and indexing capability manifests
// from the sidecar. Wraps sidecar client + shared indexing utilities.
// TODO(T011-IPC): Replace direct sidecarClient usage with dedicated IPC channel
//   when backend exposes /assistant/capability-manifest endpoint.
// TODO(T011-Retry): Add retry/backoff with jitter on transient network failures.

import { createSidecarClient } from './client';
import type { CapabilityManifest, CapabilityIndex } from '@shared/assistant/capabilities';
import { indexManifest } from '@shared/assistant/capabilities';

export interface ManifestFetchOptions {
  forceRefresh?: boolean; // bypass cache
}

let cachedManifest: CapabilityManifest | null = null;
let cachedIndex: CapabilityIndex | null = null;
let lastFetchedAt: string | null = null;

export async function fetchManifest(options: ManifestFetchOptions = {}): Promise<{ manifest: CapabilityManifest; index: CapabilityIndex }> {
  if (!options.forceRefresh && cachedManifest) {
    return { manifest: cachedManifest, index: cachedIndex! };
  }

  const client = createSidecarClient();
  const envelope = await client.fetchCapabilityManifest();
  if (!envelope.ok) {
    // Fallback: provide empty manifest so consumers can gate features.
    const manifest: CapabilityManifest = {
      manifestId: 'fallback',
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      capabilities: [],
      source: 'cached'
    };
    cachedManifest = manifest;
    cachedIndex = indexManifest(manifest);
    lastFetchedAt = manifest.generatedAt;
    return { manifest, index: cachedIndex };
  }

  cachedManifest = envelope.data;
  cachedIndex = indexManifest(envelope.data);
  lastFetchedAt = envelope.data.generatedAt;
  return { manifest: cachedManifest, index: cachedIndex };
}

export function getCachedManifest(): CapabilityManifest | null {
  return cachedManifest;
}

export function getCachedIndex(): CapabilityIndex | null {
  return cachedIndex;
}

export function getLastFetchedAt(): string | null {
  return lastFetchedAt;
}

// Lightweight invalidation (manual refresh trigger)
export function invalidateManifestCache(): void {
  cachedManifest = null;
  cachedIndex = null;
  lastFetchedAt = null;
}

// TODO(T011-Notify): Add optional event emitter for cache refresh notifications to update UI components.
