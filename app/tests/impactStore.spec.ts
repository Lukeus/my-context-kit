import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { useImpactStore } from '../src/renderer/stores/impactStore';
import { useContextStore } from '../src/renderer/stores/contextStore';

type ApiWithMocks = Record<string, Mock>;

const toMockApi = (api: unknown): ApiWithMocks => api as ApiWithMocks;

describe('impactStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    
    const contextApi = toMockApi(window.api.context);
    contextApi.impact.mockReset();
    contextApi.generate.mockReset();
    
    const reposApi = toMockApi(window.api.repos);
    reposApi.list.mockResolvedValue({ ok: true, registry: { activeRepoId: null, repos: [] } });
    const settingsApi = toMockApi(window.api.settings);
    settingsApi.get.mockResolvedValue({ ok: true, value: '' });
    settingsApi.set.mockResolvedValue({ ok: true });
    
    // Setup contextStore with repo path
    const contextStore = useContextStore();
    await vi.waitFor(() => expect(contextStore.isInitialized).toBe(true), { timeout: 1000 });
    contextStore.repoPath = 'C:/test/repo';
  });

  describe('analyzeImpact', () => {
    it('successfully analyzes impact of changed entities', async () => {
      const contextApi = toMockApi(window.api.context);
      const mockReport = {
        changedIds: ['FEAT-001'],
        impactedIds: ['US-101', 'SPEC-101', 'T-1001'],
        staleIds: ['T-1001'],
        issues: [
          {
            id: 'T-1001',
            type: 'needs-review',
            message: 'Related feature FEAT-001 changed',
            severity: 'warning' as const,
          },
        ],
        stats: {
          totalChanged: 1,
          totalImpacted: 3,
          totalStale: 1,
          totalIssues: 1,
          issuesByType: { 'needs-review': 1 },
        },
        impactedEntities: [
          { id: 'US-101', type: 'userstory', title: 'User Story 101', status: 'proposed' },
          { id: 'SPEC-101', type: 'spec', title: 'Spec 101', status: 'draft' },
          { id: 'T-1001', type: 'task', title: 'Task 1001', status: 'needs-review' },
        ],
      };
      contextApi.impact.mockResolvedValue(mockReport);

      const store = useImpactStore();
      const result = await store.analyzeImpact(['FEAT-001']);

      expect(result).toBe(true);
      expect(store.impactReport).toEqual(mockReport);
      expect(store.changedEntityIds).toEqual(['FEAT-001']);
      expect(contextApi.impact).toHaveBeenCalledWith('C:/test/repo', ['FEAT-001']);
    });

    it('handles error when impact analysis fails', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({ error: 'Failed to analyze' });

      const store = useImpactStore();
      const result = await store.analyzeImpact(['FEAT-001']);

      expect(result).toBe(false);
      expect(store.error).toBe('Failed to analyze');
    });

    it('does nothing when no entities provided', async () => {
      const contextApi = toMockApi(window.api.context);

      const store = useImpactStore();
      await store.analyzeImpact([]);

      expect(contextApi.impact).not.toHaveBeenCalled();
    });

    it('clears resolved issues when running new analysis', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({
        changedIds: ['FEAT-001'],
        impactedIds: [],
        issues: [],
        stats: { totalChanged: 1, totalImpacted: 0, totalIssues: 0, issuesByType: {} },
        impactedEntities: [],
      });

      const store = useImpactStore();
      store.markIssueAsResolved('T-1001', 'needs-review', 'Test message');
      expect(store.resolvedIssues.size).toBe(1);

      await store.analyzeImpact(['FEAT-001']);
      expect(store.resolvedIssues.size).toBe(0);
    });
  });

  describe('computed properties', () => {
    it('hasImpact returns true when there are impacted entities', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({
        changedIds: ['FEAT-001'],
        impactedIds: ['US-101'],
        issues: [],
        stats: { totalChanged: 1, totalImpacted: 1, totalIssues: 0, issuesByType: {} },
        impactedEntities: [{ id: 'US-101', type: 'userstory' }],
      });

      const store = useImpactStore();
      await store.analyzeImpact(['FEAT-001']);

      expect(store.hasImpact).toBe(true);
    });

    it('hasImpact returns false when there are no impacted entities', () => {
      const store = useImpactStore();
      expect(store.hasImpact).toBeFalsy();
    });

    it('issuesCount returns correct count', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({
        changedIds: ['FEAT-001'],
        impactedIds: [],
        issues: [
          { id: 'T-1001', type: 'needs-review', message: 'Issue 1' },
          { id: 'T-1002', type: 'needs-review', message: 'Issue 2' },
        ],
        stats: { totalChanged: 1, totalImpacted: 0, totalIssues: 2, issuesByType: { 'needs-review': 2 } },
        impactedEntities: [],
      });

      const store = useImpactStore();
      await store.analyzeImpact(['FEAT-001']);

      expect(store.issuesCount).toBe(2);
    });

    it('needsReviewCount returns correct count', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({
        changedIds: ['FEAT-001'],
        impactedIds: [],
        issues: [
          { id: 'T-1001', type: 'needs-review', message: 'Issue 1' },
          { id: 'T-1002', type: 'validation-error', message: 'Issue 2' },
          { id: 'T-1003', type: 'needs-review', message: 'Issue 3' },
        ],
        stats: { totalChanged: 1, totalImpacted: 0, totalIssues: 3, issuesByType: { 'needs-review': 2, 'validation-error': 1 } },
        impactedEntities: [],
      });

      const store = useImpactStore();
      await store.analyzeImpact(['FEAT-001']);

      expect(store.needsReviewCount).toBe(2);
    });

    it('unresolvedIssues filters out resolved issues', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({
        changedIds: ['FEAT-001'],
        impactedIds: [],
        issues: [
          { id: 'T-1001', type: 'needs-review', ruleId: 'rule1', message: 'Issue 1' },
          { id: 'T-1002', type: 'needs-review', ruleId: 'rule2', message: 'Issue 2' },
        ],
        stats: { totalChanged: 1, totalImpacted: 0, totalIssues: 2, issuesByType: { 'needs-review': 2 } },
        impactedEntities: [],
      });

      const store = useImpactStore();
      await store.analyzeImpact(['FEAT-001']);

      store.markIssueAsResolved('T-1001', 'rule1', 'Issue 1');

      expect(store.unresolvedIssues).toHaveLength(1);
      expect(store.unresolvedIssues[0].id).toBe('T-1002');
      expect(store.unresolvedCount).toBe(1);
    });
  });

  describe('generatePrompts', () => {
    it('successfully generates prompts', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.generate.mockResolvedValue({
        ok: true,
        generated: ['FEAT-001.md'],
      });

      const store = useImpactStore();
      const result = await store.generatePrompts(['FEAT-001']);

      expect(result.ok).toBe(true);
      expect(contextApi.generate).toHaveBeenCalledWith('C:/test/repo', ['FEAT-001']);
    });

    it('handles generation failure', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.generate.mockResolvedValue({
        ok: false,
        error: 'Template not found',
      });

      const store = useImpactStore();
      const result = await store.generatePrompts(['FEAT-001']);

      expect(result.ok).toBe(false);
      expect(store.error).toBe('Template not found');
    });
  });

  describe('changed entity management', () => {
    it('addChangedEntity adds entity to list', () => {
      const store = useImpactStore();
      
      store.addChangedEntity('FEAT-001');
      expect(store.changedEntityIds).toContain('FEAT-001');

      store.addChangedEntity('US-101');
      expect(store.changedEntityIds).toEqual(['FEAT-001', 'US-101']);
    });

    it('addChangedEntity does not add duplicates', () => {
      const store = useImpactStore();
      
      store.addChangedEntity('FEAT-001');
      store.addChangedEntity('FEAT-001');

      expect(store.changedEntityIds).toEqual(['FEAT-001']);
    });

    it('removeChangedEntity removes entity from list', () => {
      const store = useImpactStore();
      
      store.addChangedEntity('FEAT-001');
      store.addChangedEntity('US-101');
      store.removeChangedEntity('FEAT-001');

      expect(store.changedEntityIds).toEqual(['US-101']);
    });

    it('clearChangedEntities clears all data', () => {
      const store = useImpactStore();
      
      store.changedEntityIds.push('FEAT-001');
      store.impactReport = {
        changedIds: [],
        impactedIds: [],
        issues: [],
        stats: { totalChanged: 0, totalImpacted: 0, totalIssues: 0, issuesByType: {} },
        impactedEntities: [],
      };

      store.clearChangedEntities();

      expect(store.changedEntityIds).toEqual([]);
      expect(store.impactReport).toBeNull();
    });
  });

  describe('issue resolution tracking', () => {
    it('markIssueAsResolved adds issue to resolved set', () => {
      const store = useImpactStore();
      
      store.markIssueAsResolved('T-1001', 'rule1', 'Test message');

      expect(store.resolvedIssues.has('T-1001-rule1-Test message')).toBe(true);
    });

    it('markAllIssuesResolved marks all issues as resolved', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({
        changedIds: ['FEAT-001'],
        impactedIds: [],
        issues: [
          { id: 'T-1001', type: 'needs-review', ruleId: 'rule1', message: 'Issue 1' },
          { id: 'T-1002', type: 'needs-review', message: 'Issue 2' },
        ],
        stats: { totalChanged: 1, totalImpacted: 0, totalIssues: 2, issuesByType: { 'needs-review': 2 } },
        impactedEntities: [],
      });

      const store = useImpactStore();
      await store.analyzeImpact(['FEAT-001']);

      store.markAllIssuesResolved();

      expect(store.resolvedIssues.size).toBe(2);
      expect(store.unresolvedCount).toBe(0);
    });

    it('clearResolvedIssues clears resolved issues set', () => {
      const store = useImpactStore();
      
      store.markIssueAsResolved('T-1001', 'rule1', 'Test message');
      expect(store.resolvedIssues.size).toBe(1);

      store.clearResolvedIssues();
      expect(store.resolvedIssues.size).toBe(0);
    });
  });

  describe('clearError', () => {
    it('clears error state', async () => {
      const contextApi = toMockApi(window.api.context);
      contextApi.impact.mockResolvedValue({ error: 'Test error' });

      const store = useImpactStore();
      await store.analyzeImpact(['FEAT-001']);

      expect(store.error).toBe('Test error');

      store.clearError();

      expect(store.error).toBeNull();
    });
  });
});
