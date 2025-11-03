// Capability manifest interfaces (T007)
// -----------------------------------------------------------------------------
// Layered typing for capability manifests emitted by sidecar / main process.
// Mirrors data model references in spec (capabilityProfile).
// TODO(T020-Validation): Add JSON schema alignment & runtime validators.

export type CapabilityPhase = 'alpha' | 'beta' | 'ga' | 'deprecated';

export interface CapabilityMeta {
  id: string;                 // machine id (e.g. pipeline.run)
  title: string;              // human readable name
  description: string;        // short description
  phase: CapabilityPhase;     // rollout phase
  category?: string;          // grouping category
  tags?: string[];            // arbitrary tags
}

export interface CapabilityToggleState {
  status: 'enabled' | 'disabled' | 'preview';
  since?: string;             // ISO timestamp when state applied
  rationale?: string;         // reason for status change
  fallbackToolId?: string;    // optional fallback tool id when disabled
}

export interface CapabilityRecord extends CapabilityMeta, CapabilityToggleState {
  // Merge of meta + state for convenience.
  rolloutNotes?: string;      // additional rollout commentary
}

export interface CapabilityManifest {
  manifestId: string;
  generatedAt: string;        // ISO timestamp
  version: string;            // schema version
  capabilities: CapabilityRecord[];
  source: 'sidecar' | 'static' | 'cached';
}

export interface CapabilityIndex {
  byId: Record<string, CapabilityRecord>;
  enabled: Set<string>;
  preview: Set<string>;
  disabled: Set<string>;
}

export function indexManifest(manifest: CapabilityManifest): CapabilityIndex {
  const byId: Record<string, CapabilityRecord> = {};
  const enabled = new Set<string>();
  const preview = new Set<string>();
  const disabled = new Set<string>();

  for (const entry of manifest.capabilities) {
    byId[entry.id] = entry;
    if (entry.status === 'enabled') enabled.add(entry.id);
    else if (entry.status === 'preview') preview.add(entry.id);
    else disabled.add(entry.id);
  }

  return { byId, enabled, preview, disabled };
}

export function isCapabilityEnabled(index: CapabilityIndex, id: string): boolean {
  return index.enabled.has(id);
}

export function isCapabilityPreview(index: CapabilityIndex, id: string): boolean {
  return index.preview.has(id);
}

export function isCapabilityDisabled(index: CapabilityIndex, id: string): boolean {
  return index.disabled.has(id);
}

// TODO(T007-Enhancement): Add diffing helper to compare old/new manifests for telemetry.
