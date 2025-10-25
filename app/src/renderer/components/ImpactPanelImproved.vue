<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useImpactStore } from '../stores/impactStore';
import { useContextStore } from '../stores/contextStore';

const emit = defineEmits<{
  'close': [];
}>();

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

function isIssueResolved(issue: any): boolean {
  const issueKey = `${issue.id}-${issue.ruleId || issue.type}-${issue.message}`;
  return impactStore.resolvedIssues.has(issueKey);
}

function resolveIssue(issue: any) {
  impactStore.markIssueAsResolved(issue.id, issue.ruleId, issue.message);
}

function selectEntity(entityId: string) {
  contextStore.setActiveEntity(entityId);
  // Close modal so user can see the editor
  emit('close');
}

function getSeverityColor(severity?: string): string {
  const colors: Record<string, string> = {
    'error': 'bg-error-50 border-error-300 text-error-900',
    'warning': 'bg-tertiary-50 border-tertiary-300 text-tertiary-900',
    'info': 'bg-primary-50 border-primary-300 text-primary-900'
  };
  return colors[severity || 'warning'] || colors.warning;
}

function getAccentClass(severity?: string): string {
  const accents: Record<string, string> = {
    'error': 'border-l-4 border-error-400',
    'warning': 'border-l-4 border-tertiary-400',
    'info': 'border-l-4 border-primary-400'
  };
  return accents[severity || 'warning'] || accents.warning;
}

function getSeverityIcon(severity?: string): string {
  const icons: Record<string, string> = {
    'error': '⚠️',
    'warning': '⚡',
    'info': 'ℹ️'
  };
  return icons[severity || 'warning'] || '⚡';
}

async function refreshAnalysis() {
  if (contextStore.activeEntityId) {
    await impactStore.analyzeImpact([contextStore.activeEntityId]);
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Toolbar -->
    <div class="px-4 py-2 border-b border-surface-variant bg-surface-2 flex items-center justify-between gap-2">
      <div class="text-xs text-secondary-600">
        <template v-if="activeEntity">
          <span class="px-2 py-0.5 rounded-m3-full bg-primary-100 text-primary-800 font-medium mr-2">{{ activeEntity._type }}</span>
          <span class="font-mono">{{ activeEntity.id }}</span>
        </template>
        <template v-else>
          Select an entity to analyze impact
        </template>
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
    <div v-if="impactStore.error" class="mx-4 mt-4 p-3 bg-error-50 border border-error-200 rounded-m3-md">
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

    <!-- Results -->
    <div v-else-if="!impactStore.isAnalyzing && impactStore.impactReport" class="flex-1 overflow-y-auto">
      <!-- No issues found -->
      <div v-if="unresolvedRelevantIssues.length === 0" class="p-6 text-center">
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

      <!-- Issues list -->
      <div v-else class="p-4 space-y-3">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-semibold text-secondary-700 uppercase tracking-wide">
            {{ unresolvedRelevantIssues.length }} Item{{ unresolvedRelevantIssues.length === 1 ? '' : 's' }} Need{{ unresolvedRelevantIssues.length === 1 ? 's' : '' }} Review
          </h3>
          <button
            v-if="relevantIssues.length > unresolvedRelevantIssues.length"
            @click="showResolvedIssues = !showResolvedIssues"
            class="text-xs text-secondary-600 hover:text-secondary-900"
          >
            {{ showResolvedIssues ? 'Hide' : 'Show' }} resolved
          </button>
        </div>

        <div
          v-for="(issue, index) in relevantIssues"
          :key="`${issue.id}-${issue.ruleId || issue.type}-${index}`"
          v-show="showResolvedIssues || !isIssueResolved(issue)"
          class="border-2 rounded-m3-lg overflow-hidden transition-all"
          :class="[
            isIssueResolved(issue) 
              ? 'bg-surface-2 border-surface-variant opacity-60' 
              : getSeverityColor(issue.severity) + ' shadow-elevation-1 ' + getAccentClass(issue.severity)
          ]"
        >
          <!-- Entity header -->
          <div class="p-3 bg-surface/50">
            <div
              v-if="issue.type === 'not-found'"
              class="flex items-center gap-2 w-full"
            >
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-lg bg-white/50">
                {{ getSeverityIcon(issue.severity) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-sm truncate">{{ issue.id }}</div>
                <div class="text-xs opacity-75 truncate">{{ issue.message }}</div>
              </div>
            </div>
            <button
              v-else
              @click="selectEntity(issue.id)"
              class="flex items-center gap-2 w-full text-left hover:underline group"
            >
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                :class="isIssueResolved(issue) ? 'bg-surface-3' : 'bg-white/50'"
              >
                {{ isIssueResolved(issue) ? '✓' : getSeverityIcon(issue.severity) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-bold text-sm truncate">{{ issue.id }}</div>
                <div class="text-xs opacity-75 truncate">{{ issue.message }}</div>
              </div>
              <svg class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Change details -->
          <div v-if="issue.changes && issue.changes.length > 0 && !isIssueResolved(issue)" class="px-3 pb-3 space-y-2">
            <div class="text-xs font-semibold text-secondary-700 uppercase tracking-wide">Changes Detected:</div>
            <div
              v-for="change in issue.changes"
              :key="change.field"
              class="bg-surface rounded-m3-sm p-2 border border-surface-variant"
            >
              <div class="font-semibold text-xs mb-1">{{ change.field }}</div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span class="text-secondary-600">Before:</span>
                  <div class="font-mono text-error-700 truncate">{{ change.oldValue }}</div>
                </div>
                <div>
                  <span class="text-secondary-600">After:</span>
                  <div class="font-mono text-primary-700 truncate">{{ change.newValue }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Suggested action -->
          <div v-if="issue.suggestedAction && !isIssueResolved(issue)" class="px-3 pb-3">
            <div class="bg-secondary-50 border border-secondary-200 rounded-m3-md p-2">
              <div class="flex items-start gap-2">
                <span class="text-lg">💡</span>
                <div class="flex-1">
                  <div class="text-xs font-semibold text-secondary-900 mb-1">Suggested Action</div>
                  <div class="text-xs text-secondary-800">{{ issue.suggestedAction }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="border-t p-3 flex items-center justify-between gap-2"
            :class="isIssueResolved(issue) ? 'border-surface-variant bg-surface-2' : 'border-current/10 bg-white/30'"
          >
            <button
              v-if="issue.type !== 'not-found'"
              @click="selectEntity(issue.id)"
              class="text-xs font-medium hover:underline"
              :class="isIssueResolved(issue) ? 'text-secondary-600' : ''"
            >
              Open in editor →
            </button>
            <div v-else class="text-xs text-secondary-600">
              This entity ID was referenced but the file doesn't exist
            </div>
            <button
              v-if="!isIssueResolved(issue)"
              @click="resolveIssue(issue)"
              class="px-3 py-1.5 text-xs font-semibold rounded-m3-full bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-elevation-1"
            >
              ✓ Mark Resolved
            </button>
            <span v-else class="text-xs text-secondary-600 font-medium">
              ✓ Resolved
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
