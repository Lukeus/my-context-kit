// Capability manifest interfaces (T007)
// -----------------------------------------------------------------------------
// Layered typing for capability manifests emitted by sidecar / main process.
// Mirrors data model references in spec (capabilityProfile).

import { z } from 'zod';

export const TOOL_SAFETY_CLASSES = ['readOnly', 'mutating', 'destructive'] as const;
export type ToolSafetyClass = typeof TOOL_SAFETY_CLASSES[number];

const ISO_8601_REGEX = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d+)?Z$/;

function assertIsoTimestamp(value: string): boolean {
  return ISO_8601_REGEX.test(value);
}
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
  requiresApproval?: boolean; // FR-032 optional override per capability
  safetyClass?: ToolSafetyClass; // FR-032 optional safety override from manifest
}

export interface CapabilityManifest {
  manifestId: string;
  generatedAt: string;        // ISO timestamp
  version: string;            // schema version
  capabilities: CapabilityRecord[];
  source: 'sidecar' | 'static' | 'cached';
}

export interface CapabilityManifestValidationError {
  path: string;
  message: string;
}

const capabilityRecordSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  phase: z.enum(['alpha', 'beta', 'ga', 'deprecated']),
  category: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  status: z.enum(['enabled', 'disabled', 'preview']),
  since: z.string().refine(assertIsoTimestamp, 'since must be ISO-8601').optional(),
  rationale: z.string().optional(),
  fallbackToolId: z.string().optional(),
  rolloutNotes: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  safetyClass: z.enum(TOOL_SAFETY_CLASSES).optional()
}).passthrough();

const capabilityManifestSchema = z.object({
  manifestId: z.string().min(1),
  generatedAt: z.string().refine(assertIsoTimestamp, 'generatedAt must be ISO-8601'),
  version: z.string().min(1),
  capabilities: z.array(capabilityRecordSchema),
  source: z.enum(['sidecar', 'static', 'cached'])
}).passthrough();

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

export function validateCapabilityManifest(candidate: unknown): { ok: true; manifest: CapabilityManifest } | { ok: false; errors: CapabilityManifestValidationError[] } {
  const outcome = capabilityManifestSchema.safeParse(candidate);
  if (!outcome.success) {
    const errors = outcome.error.issues.map(issue => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message
    }));
    return { ok: false, errors };
  }
  return { ok: true, manifest: outcome.data };
}

export function createEmptyManifest(source: CapabilityManifest['source'], reason: string): CapabilityManifest {
  const generatedAt = new Date().toISOString();
  return {
    manifestId: `fallback-${reason}`,
    generatedAt,
    version: '1.0.0',
    capabilities: [],
    source
  };
}

// TODO(T007-Enhancement): Add diffing helper to compare old/new manifests for telemetry.
