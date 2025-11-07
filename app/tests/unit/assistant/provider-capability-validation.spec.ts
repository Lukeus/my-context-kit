import { beforeEach, describe, expect, it } from 'vitest';
import { validateCapabilityManifest, indexManifest, type CapabilityManifest } from '@shared/assistant/capabilities';
import { updateClassificationFromManifest, resetClassification, getToolSafety, getToolClassification, validateInvocation } from '@/services/assistant/toolClassification';

describe('provider capability manifest validation', () => {
  beforeEach(() => {
    resetClassification();
  });

  it('rejects manifests missing mandatory identifiers (FR-038)', () => {
    const manifest: Partial<CapabilityManifest> = {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      capabilities: [],
      source: 'sidecar'
    };

    const result = validateCapabilityManifest(manifest);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.errors.map(e => e.path);
      expect(paths).toContain('manifestId');
    }
  });

  it('applies safety classes from manifest payload (FR-032, FR-028)', () => {
    const manifest: CapabilityManifest = {
      manifestId: 'test-manifest',
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      source: 'sidecar',
      capabilities: [
        {
          id: 'pipeline.run',
          title: 'Pipeline Runner',
          description: 'Execute context repository pipelines',
          phase: 'ga',
          status: 'enabled',
          requiresApproval: true,
          safetyClass: 'mutating'
        },
        {
          id: 'repo.destructiveCleanup',
          title: 'Repository Cleanup',
          description: 'Performs destructive cleanup operations',
          phase: 'beta',
          status: 'enabled',
          requiresApproval: true,
          safetyClass: 'destructive'
        }
      ]
    };

    const validation = validateCapabilityManifest(manifest);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const index = indexManifest(validation.manifest);
    updateClassificationFromManifest(index);

    expect(getToolSafety('pipeline.run')).toBe('mutating');
    expect(getToolSafety('repo.destructiveCleanup')).toBe('destructive');

    const destructive = getToolClassification('repo.destructiveCleanup');
    expect(destructive?.requiresReason).toBe(true);
    expect(() => validateInvocation('repo.destructiveCleanup', true, 'validReason', {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).not.toThrow();
  });

  it('enforces reason requirements for destructive tools (FR-032)', () => {
    resetClassification();
    expect(() => validateInvocation('repo.destructiveCleanup', true, 'short', {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).toThrow(/reason/i);

    expect(() => validateInvocation('repo.destructiveCleanup', true, 'sufficient reason text', {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).not.toThrow();
  });
});
