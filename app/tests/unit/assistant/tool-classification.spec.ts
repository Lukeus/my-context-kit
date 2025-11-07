import { beforeEach, describe, expect, it } from 'vitest';
import { indexManifest, type CapabilityManifest } from '@shared/assistant/capabilities';
import {
  resetClassification,
  updateClassificationFromManifest,
  validateInvocation
} from '@/services/assistant/toolClassification';

describe('Tool classification gating (FR-032)', () => {
  beforeEach(() => {
    resetClassification();
    const manifest: CapabilityManifest = {
      manifestId: 'test-manifest',
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      source: 'static',
      capabilities: [
        {
          id: 'context.read',
          title: 'Read Context',
          description: 'Read-only context probe',
          phase: 'ga',
          status: 'enabled',
          requiresApproval: false,
          safetyClass: 'readOnly'
        },
        {
          id: 'pipeline.run',
          title: 'Pipeline Runner',
          description: 'Executes context pipelines',
          phase: 'ga',
          status: 'enabled',
          requiresApproval: true,
          safetyClass: 'mutating'
        },
        {
          id: 'repo.destructiveCleanup',
          title: 'Destructive Cleanup',
          description: 'Perform destructive cleanup tasks',
          phase: 'beta',
          status: 'enabled',
          requiresApproval: true,
          safetyClass: 'destructive'
        }
      ]
    };

    updateClassificationFromManifest(indexManifest(manifest));
  });

  it('allows read-only tools without approval', () => {
    expect(() => validateInvocation('context.read', false, undefined, {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).not.toThrow();
  });

  it('requires approval for mutating tools when gating enforced', () => {
    expect(() => validateInvocation('pipeline.run', false, undefined, {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).toThrow(/approval required/i);

    expect(() => validateInvocation('pipeline.run', true, undefined, {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).not.toThrow();
  });

  it('enforces reason length for destructive tools', () => {
    expect(() => validateInvocation('repo.destructiveCleanup', true, 'short', {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).toThrow(/reason/i);

    expect(() => validateInvocation('repo.destructiveCleanup', true, 'sufficient justification', {
      gating: { classificationEnforced: true },
      reasonMinLength: 8
    })).not.toThrow();
  });

  it('bypasses approval requirements when gating disabled (Limited Read-Only Mode)', () => {
    expect(() => validateInvocation('pipeline.run', false, undefined, {
      gating: { classificationEnforced: false },
      reasonMinLength: 8
    })).not.toThrow();

    expect(() => validateInvocation('repo.destructiveCleanup', false, undefined, {
      gating: { classificationEnforced: false },
      reasonMinLength: 8
    })).not.toThrow();
  });
});
