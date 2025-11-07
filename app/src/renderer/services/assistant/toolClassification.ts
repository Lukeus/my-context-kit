/**
 * toolClassification.ts
 * Implements ToolSafetyClass mapping per FR-032.
 * Syncs with capability manifest when available, otherwise falls back to
 * conservative defaults. Used by assistantStore + UI for approval gating.
 * TODO: integrate with telemetry emission once approval workflow finalized.
 */

import type { CapabilityIndex, CapabilityRecord, ToolSafetyClass as CapabilityToolSafetyClass } from '@shared/assistant/capabilities';
import type { GatingStatus } from '@shared/assistant/types';

export type ToolSafetyClass = CapabilityToolSafetyClass;

export type ClassificationSource = 'fallback' | 'manifest';

export interface ToolClassificationEntry {
  toolId: string;
  safety: ToolSafetyClass;
  requiresApproval: boolean;
  requiresReason: boolean;
  source: ClassificationSource;
}

export interface ValidateInvocationOptions {
  gating?: Pick<GatingStatus, 'classificationEnforced'> | null;
  reasonMinLength?: number;
  confirmations?: number;
}

const FALLBACK_CLASSIFICATION: ToolClassificationEntry[] = [
  { toolId: 'context.read', safety: 'readOnly', requiresApproval: false, requiresReason: false, source: 'fallback' },
  { toolId: 'context.search', safety: 'readOnly', requiresApproval: false, requiresReason: false, source: 'fallback' },
  { toolId: 'pipeline.run', safety: 'mutating', requiresApproval: true, requiresReason: false, source: 'fallback' },
  { toolId: 'session.applyEdit', safety: 'mutating', requiresApproval: true, requiresReason: false, source: 'fallback' },
  { toolId: 'repo.destructiveCleanup', safety: 'destructive', requiresApproval: true, requiresReason: true, source: 'fallback' }
];

const classificationMap = new Map<string, ToolClassificationEntry>();

function applyEntries(entries: ToolClassificationEntry[]): void {
  classificationMap.clear();
  for (const entry of entries) {
    classificationMap.set(entry.toolId, { ...entry });
  }
}

applyEntries(FALLBACK_CLASSIFICATION);

function toClassificationEntry(record: CapabilityRecord): ToolClassificationEntry {
  const safety: ToolSafetyClass = record.safetyClass ?? 'readOnly';
  const requiresApproval = record.requiresApproval ?? (safety !== 'readOnly');
  const requiresReason = safety === 'destructive';
  return {
    toolId: record.id,
    safety,
    requiresApproval,
    requiresReason,
    source: 'manifest'
  };
}

export function resetClassification(): void {
  applyEntries(FALLBACK_CLASSIFICATION);
}

export function updateClassificationFromManifest(index?: CapabilityIndex | null): void {
  if (!index) {
    resetClassification();
    return;
  }

  const entries: ToolClassificationEntry[] = [];
  for (const record of Object.values(index.byId)) {
    entries.push(toClassificationEntry(record));
  }

  if (entries.length === 0) {
    resetClassification();
    return;
  }

  // Merge manifest-derived entries with fallback for unknown tools
  const merged = new Map<string, ToolClassificationEntry>();
  for (const entry of FALLBACK_CLASSIFICATION) {
    merged.set(entry.toolId, { ...entry });
  }
  for (const entry of entries) {
    merged.set(entry.toolId, { ...entry });
  }
  classificationMap.clear();
  for (const [toolId, entry] of merged.entries()) {
    classificationMap.set(toolId, entry);
  }
}

export function getToolClassification(toolId: string): ToolClassificationEntry | undefined {
  return classificationMap.get(toolId);
}

export function getToolSafety(toolId: string): ToolSafetyClass | undefined {
  return classificationMap.get(toolId)?.safety;
}

export function validateInvocation(toolId: string, approvalProvided: boolean, reason?: string, options?: ValidateInvocationOptions): void {
  const entry = classificationMap.get(toolId);
  if (!entry) return; // Unknown tool; permissive until manifest provides mapping

  const gatingEnforced = options?.gating?.classificationEnforced !== false;
  if (!entry.requiresApproval) {
    return;
  }

  if (!gatingEnforced) {
    // Classification enforcement disabled by gating artifact; skip approval check.
    // TODO(T028G-ReadOnlyMode): Once Limited Read-Only Mode auto-blocks UI buttons we can remove this guard.
    return;
  }

  if (!approvalProvided) {
    throw new Error(`Approval required for tool ${toolId} (${entry.safety}).`);
  }

  if ((entry.requiresReason || entry.safety === 'destructive')) {
    const minLength = options?.reasonMinLength ?? 8;
    const compact = (reason ?? '').replace(/\s+/g, '');
    if (compact.length < minLength) {
      throw new Error(`Destructive tool ${toolId} requires reason with at least ${minLength} non-whitespace characters.`);
    }
    // TODO(T028G-DoubleConfirm): Enforce double confirmation when approval workflow exposes confirmation metadata.
    const confirmations = options?.confirmations ?? 1;
    if (entry.safety === 'destructive' && confirmations < 1) {
      throw new Error(`Confirmation required for destructive tool ${toolId}.`);
    }
  }
}
