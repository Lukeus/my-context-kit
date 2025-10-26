<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useImpactStore } from '../stores/impactStore';
import { useContextStore } from '../stores/contextStore';

const impactStore = useImpactStore();
const contextStore = useContextStore();

const showResolvedIssues = ref(false);

// Auto-analyze when active entity changes
watch(() => contextStore.activeEntityId, async (newId) => {
  if (newId) {
    await impactStore.analyzeImpact([newId]);
  }
}, { immediate: true });

const activeEntity = computed(() => contextStore.activeEntity);

// Filter to only show issues with actual git changes or high severity
const relevantIssues = computed(() => {
  if (!impactStore.impactReport) return [];
  
  return impactStore.impactReport.issues.filter(issue => {
    // Always show errors (including 'not-found' type) and insights
    if (issue.severity === 'error' || issue.type === 'not-found' || issue.type === 'insight') return true;
    
    // Show issues with actual git diff changes
    if (issue.hasGitDiff && issue.changes && issue.changes.length > 0) return true;
    
    // Hide issues without evidence of real changes (false positives)
    return false;
  });
});

const unresolvedRelevantIssues = computed(() => {
  return relevantIssues.value.filter(issue => {
    const issueKey = `${issue.id}-${issue.ruleId || issue.type}-${issue.message}`;
    return !impactStore.resolvedIssues.has(issueKey);
  });
});

const displayedIssues = computed(() => {
  return showResolvedIssues.value ? relevantIssues.value : unresolvedRelevantIssues.value;
});

function isIssueResolved(issue: any): boolean {
  const issueKey = `${issue.id}-${issue.ruleId || issue.type}-${issue.message}`;
  return impactStore.resolvedIssues.has(issueKey);
}

function resolveIssue(issue: any) {
  impactStore.markIssueAsResolved(issue.id, issue.ruleId || issue.type, issue.message);
}

function selectEntity(entityId: string) {
  contextStore.setActiveEntity(entityId);
}

function getSeverityColor(severity?: string): string {
  const colors: Record<string, string> = {
    'error': 'text-error-700',
    'warning': 'text-tertiary-700',
    'info': 'text-primary-700'
  };
  return colors[severity || 'warning'] || colors.warning;
}

function getSeverityBadge(severity?: string): string {
  const badges: Record<string, string> = {
    'error': 'bg-error-100 text-error-800 border-error-200',
    'warning': 'bg-tertiary-100 text-tertiary-800 border-tertiary-200',
    'info': 'bg-primary-100 text-primary-800 border-primary-200'
  };
  return badges[severity || 'warning'] || badges.warning;
}

function getSeverityLabel(severity?: string): string {
  const labels: Record<string, string> = {
    'error': 'Error',
    'warning': 'Warning',
    'info': 'Info'
  };
  return labels[severity || 'warning'] || 'Warning';
}

async function refreshAnalysis() {
  if (contextStore.activeEntityId) {
    await impactStore.analyzeImpact([contextStore.activeEntityId]);
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-surface overflow-hidden">
    <!-- Toolbar -->
    <div class="px-4 py-3 border-b border-surface-variant bg-surface-2 flex items-center justify-between gap-2 flex-shrink-0">
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold text-primary-700">Impact Analysis</h3>
        <div class="text-xs text-secondary-600">
          <template v-if="activeEntity">
            <span class="px-2 py-0.5 rounded-m3-full bg-primary-100 text-primary-800 font-medium mr-2">{{ activeEntity._type }}</span>
            <span class="font-mono">{{ activeEntity.id }}</span>
          </template>
          <template v-else>
            Select an entity to analyze impact
          </template>
        </div>
      </div>
      <button
        @click="refreshAnalysis"
        :disabled="!contextStore.activeEntityId || impactStore.isAnalyzing"
        class="p-1.5 rounded-m3-full hover:bg-surface-3 transition-colors disabled:opacity-50"
        title="Refresh analysis"
      >
        <svg class="w-4 h-4" :class="impactStore.isAnalyzing ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v6h6M20 20v-6h-6M5 11a9 9 0 0114-6.708M19 13a9 9 0 01-14 6.708" />
        </svg>
      </button>
    </div>

    <!-- Error state -->
    <div v-if="impactStore.error" class="mx-4 mt-4 p-3 bg-error-50 border border-error-200 rounded-m3-md flex-shrink-0">
      <div class="flex items-start gap-2">
        <span class="text-error-600">⚠️</span>
        <div class="flex-1">
          <p class="text-sm text-error-700 font-medium">{{ impactStore.error }}</p>
          <button
            @click="impactStore.clearError"
            class="mt-2 text-xs text-error-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="impactStore.isAnalyzing" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600 mb-3"></div>
        <p class="text-sm text-secondary-600">Analyzing dependencies...</p>
      </div>
    </div>

    <!-- No entity selected -->
    <div v-else-if="!activeEntity" class="flex-1 flex items-center justify-center p-4">
      <div class="text-center text-sm text-secondary-600">
        <svg class="w-12 h-12 mx-auto mb-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <p>Select an entity from the tree</p>
        <p class="text-xs mt-1 text-secondary-500">to see its impact on related items</p>
      </div>
    </div>

    <!-- Results - Material Table -->
    <div v-else-if="!impactStore.isAnalyzing && impactStore.impactReport" class="flex-1 flex flex-col overflow-hidden">
      <!-- No issues found -->
      <div v-if="unresolvedRelevantIssues.length === 0" class="flex-1 flex items-center justify-center p-6">
        <div class="text-center">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-3">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 class="text-base font-semibold text-secondary-900 mb-1">No Issues Found</h3>
          <p class="text-sm text-secondary-600">
            <span v-if="relevantIssues.length > 0">All issues resolved ✓</span>
            <span v-else>This change looks good!</span>
          </p>
          <button
            v-if="showResolvedIssues === false && relevantIssues.length > 0"
            @click="showResolvedIssues = true"
            class="mt-4 text-xs text-primary-600 hover:underline"
          >
            Show {{ relevantIssues.length }} resolved issue{{ relevantIssues.length === 1 ? '' : 's' }}
          </button>
        </div>
      </div>

      <!-- Material Table -->
      <div v-else class="flex-1 flex flex-col overflow-hidden">
        <!-- Table header with controls -->
        <div class="px-4 py-3 border-b border-surface-variant bg-surface-1 flex items-center justify-between flex-shrink-0">
          <div class="text-sm font-medium text-secondary-900">
            {{ unresolvedRelevantIssues.length }} Item{{ unresolvedRelevantIssues.length === 1 ? '' : 's' }} Need{{ unresolvedRelevantIssues.length === 1 ? 's' : '' }} Review
          </div>
          <button
            v-if="relevantIssues.length > unresolvedRelevantIssues.length"
            @click="showResolvedIssues = !showResolvedIssues"
            class="text-xs font-medium text-primary-600 hover:underline"
          >
            {{ showResolvedIssues ? 'Hide' : 'Show' }} resolved ({{ relevantIssues.length - unresolvedRelevantIssues.length }})
          </button>
        </div>

        <!-- Scrollable table container -->
        <div class="flex-1 overflow-auto">
          <table class="w-full border-collapse">
            <thead class="sticky top-0 bg-surface-2 border-b border-surface-variant z-10">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wide">Status</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wide">Severity</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wide">Entity</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wide">Issue</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wide">Changes</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-secondary-700 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(issue, index) in displayedIssues"
                :key="`${issue.id}-${issue.ruleId || issue.type}-${index}`"
                class="border-b border-surface-variant hover:bg-surface-1 transition-colors"
                :class="isIssueResolved(issue) ? 'opacity-60 bg-surface-2' : ''"
              >
                <!-- Status -->
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center w-8 h-8 rounded-full"
                    :class="isIssueResolved(issue) ? 'bg-green-100 text-green-700' : 'bg-tertiary-100 text-tertiary-700'"
                  >
                    <span class="text-sm font-medium">{{ isIssueResolved(issue) ? '✓' : '!' }}</span>
                  </div>
                </td>

                <!-- Severity -->
                <td class="px-4 py-3">
                  <span class="inline-flex items-center px-2 py-1 rounded-m3-full text-xs font-medium border"
                    :class="getSeverityBadge(issue.severity)"
                  >
                    {{ getSeverityLabel(issue.severity) }}
                  </span>
                </td>

                <!-- Entity -->
                <td class="px-4 py-3">
                  <button
                    v-if="issue.type !== 'not-found'"
                    @click="selectEntity(issue.id)"
                    class="font-mono text-sm text-primary-700 hover:underline font-medium"
                  >
                    {{ issue.id }}
                  </button>
                  <span v-else class="font-mono text-sm text-error-700 font-medium">
                    {{ issue.id }}
                  </span>
                  <div v-if="issue.type === 'not-found'" class="text-xs text-error-600 mt-0.5">
                    File not found
                  </div>
                </td>

                <!-- Issue -->
                <td class="px-4 py-3">
                  <div class="text-sm text-secondary-900">{{ issue.message }}</div>
                  <div v-if="issue.suggestedAction" class="text-xs text-secondary-600 mt-1 flex items-start gap-1">
                    <span>💡</span>
                    <span>{{ issue.suggestedAction }}</span>
                  </div>
                </td>

                <!-- Changes -->
                <td class="px-4 py-3">
                  <div v-if="issue.changes && issue.changes.length > 0" class="space-y-1">
                    <div
                      v-for="change in issue.changes.slice(0, 2)"
                      :key="change.field"
                      class="text-xs"
                    >
                      <span class="font-semibold text-secondary-700">{{ change.field }}:</span>
                      <div class="flex items-center gap-1 mt-0.5">
                        <span class="font-mono text-error-600 truncate max-w-[100px]" :title="change.oldValue">{{ change.oldValue }}</span>
                        <span class="text-secondary-500">→</span>
                        <span class="font-mono text-primary-600 truncate max-w-[100px]" :title="change.newValue">{{ change.newValue }}</span>
                      </div>
                    </div>
                    <div v-if="issue.changes.length > 2" class="text-xs text-secondary-500">
                      +{{ issue.changes.length - 2 }} more
                    </div>
                  </div>
                  <span v-else class="text-xs text-secondary-500">—</span>
                </td>

                <!-- Actions -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <button
                      v-if="issue.type !== 'not-found' && !isIssueResolved(issue)"
                      @click="selectEntity(issue.id)"
                      class="text-xs font-medium text-primary-600 hover:underline"
                    >
                      Open
                    </button>
                    <button
                      v-if="!isIssueResolved(issue)"
                      @click="resolveIssue(issue)"
                      class="px-2 py-1 text-xs font-medium rounded-m3-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      Resolve
                    </button>
                    <span v-else class="text-xs text-green-600 font-medium">
                      Resolved
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure table has proper overflow behavior */
table {
  min-width: 100%;
}

/* Sticky header styling */
thead {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
</style>
