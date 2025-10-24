import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useContextStore } from './contextStore';

interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
  valueType: string;
}

interface SourceEntity {
  id: string;
  type: string;
  title: string;
}

interface ImpactIssue {
  id: string;
  type: string;
  message: string;
  reason?: string;
  suggestedAction?: string;
  severity?: 'error' | 'warning' | 'info';
  ruleId?: string;
  changes?: FieldChange[];
  sourceEntity?: SourceEntity;
  hasGitDiff?: boolean;
}

interface ImpactedEntity {
  id: string;
  type: string;
  title?: string;
  status?: string;
}

interface ImpactReport {
  changedIds: string[];
  impactedIds: string[];
  staleIds?: string[];
  issues: ImpactIssue[];
  stats: {
    totalChanged: number;
    totalImpacted: number;
    totalStale?: number;
    totalIssues: number;
    issuesByType: Record<string, number>;
  };
  impactedEntities: ImpactedEntity[];
}

export const useImpactStore = defineStore('impact', () => {
  // State
  const changedEntityIds = ref<string[]>([]);
  const impactReport = ref<ImpactReport | null>(null);
  const isAnalyzing = ref(false);
  const error = ref<string | null>(null);
  const resolvedIssues = ref<Set<string>>(new Set());

  // Computed
  const hasImpact = computed(() => {
    return impactReport.value && impactReport.value.impactedIds.length > 0;
  });

  const issuesCount = computed(() => {
    return impactReport.value?.issues.length || 0;
  });

  const needsReviewCount = computed(() => {
    return impactReport.value?.issues.filter(i => i.type === 'needs-review').length || 0;
  });

  const impactedEntities = computed(() => {
    return impactReport.value?.impactedEntities || [];
  });

  const unresolvedIssues = computed(() => {
    return impactReport.value?.issues.filter(issue => {
      const issueKey = `${issue.id}-${issue.ruleId || issue.type}-${issue.message}`;
      return !resolvedIssues.value.has(issueKey);
    }) || [];
  });

  const unresolvedCount = computed(() => {
    return unresolvedIssues.value.length;
  });

  // Actions
  async function analyzeImpact(entityIds: string[]) {
    if (entityIds.length === 0) {
      return;
    }

    const contextStore = useContextStore();
    isAnalyzing.value = true;
    error.value = null;
    // Clear resolved issues when running new analysis
    resolvedIssues.value.clear();

    try {
      const result = await window.api.context.impact(
        contextStore.repoPath,
        entityIds
      );

      if (result.error) {
        error.value = result.error;
        return false;
      }

      impactReport.value = result;
      changedEntityIds.value = entityIds;
      return true;
    } catch (err: any) {
      error.value = err.message || 'Failed to analyze impact';
      return false;
    } finally {
      isAnalyzing.value = false;
    }
  }

  async function generatePrompts(entityIds: string[]) {
    const contextStore = useContextStore();
    
    try {
      const result = await window.api.context.generate(
        contextStore.repoPath,
        entityIds
      );

      if (result.error) {
        error.value = result.error;
        return result;
      }

      if (!result.ok) {
        const firstError = result.errors?.[0]?.error || 'Failed to generate prompts';
        error.value = firstError;
      }

      return result;
    } catch (err: any) {
      error.value = err.message || 'Failed to generate prompts';
      return { ok: false, error: error.value };
    }
  }

  function addChangedEntity(entityId: string) {
    if (!changedEntityIds.value.includes(entityId)) {
      changedEntityIds.value.push(entityId);
    }
  }

  function removeChangedEntity(entityId: string) {
    const index = changedEntityIds.value.indexOf(entityId);
    if (index > -1) {
      changedEntityIds.value.splice(index, 1);
    }
  }

  function clearChangedEntities() {
    changedEntityIds.value = [];
    impactReport.value = null;
  }

  function clearError() {
    error.value = null;
  }

  function markIssueAsResolved(issueId: string, ruleId: string | undefined, message: string) {
    const issueKey = `${issueId}-${ruleId || 'unknown'}-${message}`;
    resolvedIssues.value.add(issueKey);
  }

  function markAllIssuesResolved() {
    if (!impactReport.value) return;
    impactReport.value.issues.forEach(issue => {
      const issueKey = `${issue.id}-${issue.ruleId || issue.type}-${issue.message}`;
      resolvedIssues.value.add(issueKey);
    });
  }

  function clearResolvedIssues() {
    resolvedIssues.value.clear();
  }

  return {
    // State
    changedEntityIds,
    impactReport,
    isAnalyzing,
    error,
    resolvedIssues,
    // Computed
    hasImpact,
    issuesCount,
    needsReviewCount,
    impactedEntities,
    unresolvedIssues,
    unresolvedCount,
    // Actions
    analyzeImpact,
    generatePrompts,
    addChangedEntity,
    removeChangedEntity,
    clearChangedEntities,
    clearError,
    markIssueAsResolved,
    markAllIssuesResolved,
    clearResolvedIssues
  };
});
