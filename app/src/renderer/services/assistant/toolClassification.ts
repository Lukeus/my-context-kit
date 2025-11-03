/**
 * toolClassification.ts
 * Implements ToolSafetyClass mapping per FR-032.
 * TODO: integrate with capability manifest & telemetry emission.
 */
export type ToolSafetyClass = 'readOnly' | 'mutating' | 'destructive';

export interface ToolClassificationEntry { toolId: string; safety: ToolSafetyClass; requiresReason: boolean; }

// Placeholder map; populate from manifest later.
const CLASSIFICATION: ToolClassificationEntry[] = [
  { toolId: 'context.read', safety: 'readOnly', requiresReason: false },
  { toolId: 'context.validate', safety: 'readOnly', requiresReason: false },
  { toolId: 'graph.build', safety: 'readOnly', requiresReason: false },
  { toolId: 'impact.analyze', safety: 'readOnly', requiresReason: false },
  { toolId: 'file.write', safety: 'mutating', requiresReason: false },
  { toolId: 'session.applyEdit', safety: 'mutating', requiresReason: false },
  { toolId: 'repo.destructiveCleanup', safety: 'destructive', requiresReason: true }
];

export function getToolSafety(toolId: string): ToolSafetyClass | undefined {
  return CLASSIFICATION.find(c => c.toolId === toolId)?.safety;
}

export function validateInvocation(toolId: string, approvalProvided: boolean, reason?: string): void {
  const entry = CLASSIFICATION.find(c => c.toolId === toolId);
  if (!entry) return; // Unknown tool; treat as safe until manifest integration.
  if (entry.safety === 'readOnly') return;
  if (!approvalProvided) throw new Error(`Approval required for tool ${toolId}`);
  if (entry.safety === 'destructive' && entry.requiresReason && (!reason || !reason.trim())) {
    throw new Error(`Reason required for destructive tool ${toolId}`);
  }
}
