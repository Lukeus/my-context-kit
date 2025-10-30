<script setup lang="ts">
import { ref, computed } from 'vue';
import { useImpactStore } from '../stores/impactStore';
import { useContextStore } from '../stores/contextStore';
import PromptModal from './PromptModal.vue';

const impactStore = useImpactStore();
const contextStore = useContextStore();

const activeTab = ref<'overview' | 'issues' | 'stale' | 'diff'>('overview');
const selectedDiffEntityId = ref<string | null>(null);
const showPromptModal = ref(false);
const generatedPrompt = ref<string>('');
const promptEntityId = ref<string>('');
const showResolvedIssues = ref(false);

const supportedPromptTypes = new Set(['feature', 'userstory', 'spec']);

const impactedCount = computed(() => {
  return impactStore.impactReport?.impactedIds.length || 0;
});

const staleCount = computed(() => {
  return impactStore.impactReport?.staleIds?.length || 0;
});

const staleEntities = computed(() => {
  const staleIds = impactStore.impactReport?.staleIds || [];
  return staleIds.map(id => {
    const entity = contextStore.getEntity(id);
    return {
      id,
      type: entity?._type || 'unknown',
      title: entity?.title || entity?.name || 'Untitled',
      status: entity?.status
    };
  });
});

const canGeneratePrompt = computed(() => {
  const entity = contextStore.activeEntity;
  if (!entity) return false;
  return supportedPromptTypes.has(entity._type);
});

async function analyzeImpact() {
  if (!contextStore.activeEntityId) return;
  await impactStore.analyzeImpact([contextStore.activeEntityId]);
}

async function generatePrompt() {
  if (!contextStore.activeEntityId) return;
  if (!canGeneratePrompt.value) {
    impactStore.error = 'Prompt generation is only available for features, user stories, and specs.';
    return;
  }
  
  const result = await impactStore.generatePrompts([contextStore.activeEntityId]);
  
  if (result && result.ok && result.generated && result.generated.length > 0) {
    const firstGenerated = result.generated[0];
    if (firstGenerated.content) {
      generatedPrompt.value = firstGenerated.content;
      promptEntityId.value = firstGenerated.id;
      showPromptModal.value = true;
    }
  } else if (result && !result.ok) {
    impactStore.error = result.error || 'Failed to generate prompt';
  }
}

function closePromptModal() {
  showPromptModal.value = false;
  generatedPrompt.value = '';
  promptEntityId.value = '';
}

function viewEntityDiff(entityId: string) {
  selectedDiffEntityId.value = entityId;
  activeTab.value = 'diff';
}

function selectEntity(entityId: string) {
  contextStore.setActiveEntity(entityId);
}

function getIssueTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    'needs-review': 'bg-tertiary-100 text-tertiary-800 border-tertiary-300',
    'not-found': 'bg-error-100 text-error-800 border-error-300',
    'warning': 'bg-tertiary-100 text-tertiary-800 border-tertiary-300',
    'error': 'bg-error-100 text-error-800 border-error-300'
  };
  return colors[type] || 'bg-surface-variant text-secondary-700 border-secondary-300';
}

function getSeverityBadgeColor(severity?: string): string {
  const colors: Record<string, string> = {
    'error': 'bg-error-50 text-error-700 border-error-300',
    'warning': 'bg-tertiary-50 text-tertiary-700 border-tertiary-300',
    'info': 'bg-primary-50 text-primary-700 border-primary-300'
  };
  return colors[severity || 'warning'] || 'bg-tertiary-50 text-tertiary-700 border-tertiary-300';
}

function getSeverityIcon(severity?: string): string {
  const icons: Record<string, string> = {
    'error': '⚠️',
    'warning': '⚡',
    'info': 'ℹ️'
  };
  return icons[severity || 'warning'] || '⚡';
}

function getStatusColor(status?: string): string {
  if (!status) return 'bg-gray-400';
  
  const statusColors: Record<string, string> = {
    'proposed': 'bg-blue-400',
    'in-progress': 'bg-yellow-400',
    'doing': 'bg-yellow-400',
    'done': 'bg-green-400',
    'blocked': 'bg-red-400',
    'needs-review': 'bg-orange-400',
    'todo': 'bg-gray-400'
  };
  
  return statusColors[status] || 'bg-gray-400';
}

function resolveIssue(issue: any) {
  impactStore.markIssueAsResolved(issue.id, issue.ruleId, issue.message);
}

function resolveAllIssues() {
  impactStore.markAllIssuesResolved();
}

function isIssueResolved(issue: any): boolean {
  const issueKey = `${issue.id}-${issue.ruleId || issue.type}-${issue.message}`;
  return impactStore.resolvedIssues.has(issueKey);
}
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Header -->
    <div class="p-4 border-b border-surface-variant bg-surface-2">
      <h2 class="text-lg font-semibold mb-3 text-primary-700">Impact Analysis</h2>
      
      <!-- Action buttons -->
      <div class="space-y-2">
        <button
          @click="analyzeImpact"
          :disabled="!contextStore.activeEntityId || impactStore.isAnalyzing"
          class="w-full px-4 py-2.5 text-sm bg-primary text-white rounded-m3-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
        >
          {{ impactStore.isAnalyzing ? 'Analyzing...' : 'Analyze Impact' }}
        </button>
        
        <button
          @click="generatePrompt"
          :disabled="!contextStore.activeEntityId || !canGeneratePrompt"
          :title="!canGeneratePrompt ? 'Prompts are available for features, user stories, and specs.' : undefined"
          class="w-full px-4 py-2.5 text-sm bg-secondary text-white rounded-m3-md hover:bg-secondary-700 active:bg-secondary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
        >
          Generate Prompt
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="impactStore.error" class="p-4 bg-error-50 border-b border-error-200">
      <div class="text-sm text-error-700">
        {{ impactStore.error }}
      </div>
      <button
        @click="impactStore.clearError"
        class="mt-2 text-xs text-error-800 hover:underline"
      >
        Dismiss
      </button>
    </div>

    <!-- No report state -->
    <div v-if="!impactStore.impactReport" class="flex-1 p-4 flex items-center justify-center">
      <div class="text-center text-sm text-secondary-600">
        <svg class="w-12 h-12 mx-auto mb-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Select an entity and click<br>"Analyze Impact" to begin</p>
      </div>
    </div>

    <!-- Report content -->
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <!-- Tabs -->
      <div class="flex border-b border-surface-variant px-4 bg-surface-1">
        <button
          @click="activeTab = 'overview'"
          class="px-3 py-3 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
          :class="activeTab === 'overview' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
        >
          Overview
        </button>
        <button
          @click="activeTab = 'issues'"
          class="px-3 py-3 text-sm font-medium border-b-2 transition-all hover:bg-surface-3 flex items-center gap-2"
          :class="activeTab === 'issues' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
        >
          <span>Issues</span>
          <span 
            v-if="impactStore.unresolvedCount > 0"
            class="px-2 py-0.5 text-xs font-bold rounded-m3-md-full"
            :class="activeTab === 'issues' ? 'bg-primary text-white' : 'bg-tertiary-500 text-white'"
          >
            {{ impactStore.unresolvedCount }}
          </span>
          <span v-else class="text-xs text-gray-400">({{ impactStore.issuesCount }})</span>
        </button>
        <button
          @click="activeTab = 'stale'"
          class="px-3 py-3 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
          :class="activeTab === 'stale' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
        >
          Stale ({{ staleCount }})
        </button>
      </div>

      <!-- Tab content -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Overview tab -->
        <div v-if="activeTab === 'overview'" class="space-y-4">
          <!-- Summary stats -->
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 bg-blue-50 rounded-m3-md-lg">
              <div class="text-2xl font-bold text-blue-900">{{ impactedCount }}</div>
              <div class="text-xs text-blue-700">Entities Impacted</div>
            </div>
            <div class="p-3 bg-orange-50 rounded-m3-md-lg">
              <div class="text-2xl font-bold text-orange-900">{{ staleCount }}</div>
              <div class="text-xs text-orange-700">Stale Items</div>
            </div>
            <div class="p-3 bg-red-50 rounded-m3-md-lg">
              <div class="text-2xl font-bold text-red-900">{{ impactStore.issuesCount }}</div>
              <div class="text-xs text-red-700">Issues Found</div>
            </div>
            <div class="p-3 bg-purple-50 rounded-m3-md-lg">
              <div class="text-2xl font-bold text-purple-900">{{ impactStore.needsReviewCount }}</div>
              <div class="text-xs text-purple-700">Needs Review</div>
            </div>
          </div>

          <!-- Changed entities -->
          <div>
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Changed Entities</h3>
            <div class="space-y-2">
              <div
                v-for="id in impactStore.impactReport.changedIds"
                :key="id"
                class="p-2 bg-blue-50 border border-blue-200 rounded-m3-md text-sm"
              >
                <div class="font-medium text-blue-900">{{ id }}</div>
              </div>
            </div>
          </div>

          <!-- Quick issue summary -->
          <div v-if="impactStore.issuesCount > 0">
            <h3 class="text-sm font-semibold text-gray-700 mb-2">Top Issues</h3>
            <div class="space-y-2">
              <div
                v-for="issue in impactStore.impactReport.issues.slice(0, 3)"
                :key="issue.id"
                class="p-2 bg-orange-50 border border-orange-200 rounded-m3-md text-xs"
              >
                <div class="font-medium text-orange-900">{{ issue.id }}</div>
                <div class="text-orange-700 mt-1">{{ issue.message }}</div>
              </div>
            </div>
            <button
              v-if="impactStore.issuesCount > 3"
              @click="activeTab = 'issues'"
              class="mt-2 text-xs text-blue-600 hover:underline"
            >
              View all {{ impactStore.issuesCount }} issues →
            </button>
          </div>
        </div>

        <!-- Issues tab -->
        <div v-if="activeTab === 'issues'" class="space-y-3">
          <div v-if="impactStore.issuesCount === 0" class="text-sm text-gray-500 text-center py-8">
            No issues found
          </div>
          
          <!-- Actions bar -->
          <div v-if="impactStore.issuesCount > 0" class="flex items-center justify-between pb-2 border-b border-gray-200">
            <div class="flex items-center gap-2">
              <button
                @click="showResolvedIssues = !showResolvedIssues"
                class="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                <span v-if="showResolvedIssues">✓ Hide Resolved</span>
                <span v-else>Show Resolved ({{ impactStore.issuesCount - impactStore.unresolvedCount }})</span>
              </button>
            </div>
            <button
              v-if="impactStore.unresolvedCount > 0"
              @click="resolveAllIssues"
              class="text-xs px-3 py-1 bg-primary-100 text-primary-700 hover:bg-primary-200 rounded-m3-md font-medium shadow-elevation-1 transition-all"
            >
              ✓ Resolve All
            </button>
          </div>
          <div
            v-for="(issue, index) in impactStore.impactReport.issues"
            :key="`${issue.id}-${issue.ruleId || issue.type}-${index}`"
            v-show="showResolvedIssues || !isIssueResolved(issue)"
            class="p-5 border-2 rounded-m3-md transition-all duration-200"
            :class="[
              isIssueResolved(issue) 
                ? 'bg-surface-2 border-surface-variant opacity-60' 
                : 'bg-surface border-surface-variant shadow-elevation-2 ' + getSeverityBadgeColor(issue.severity).replace('text-', 'border-').replace('bg-', 'border-'),
              !isIssueResolved(issue) ? 'hover:shadow-elevation-3 hover:scale-[1.01]' : ''
            ]"
          >
            <div class="flex items-start justify-between mb-4">
              <button
                @click="selectEntity(issue.id)"
                class="group font-bold hover:underline text-left flex items-center gap-3 text-lg"
                :class="isIssueResolved(issue) ? 'text-gray-500' : getSeverityBadgeColor(issue.severity).split(' ')[1]"
              >
                <div class="w-10 h-10 rounded-m3-md-full flex items-center justify-center text-xl transition-transform group-hover:scale-110"
                  :class="isIssueResolved(issue) ? 'bg-gray-200' : getSeverityBadgeColor(issue.severity)"
                >
                  {{ isIssueResolved(issue) ? '✓' : getSeverityIcon(issue.severity) }}
                </div>
                <span>{{ issue.id }}</span>
              </button>
              <div class="flex gap-2 items-center">
                <span
                  class="px-3 py-1.5 text-xs font-bold rounded-m3-md-full uppercase tracking-wider shadow-elevation-1"
                  :class="isIssueResolved(issue) ? 'bg-gray-200 text-gray-600' : getSeverityBadgeColor(issue.severity)"
                >
                  {{ issue.severity || 'warning' }}
                </span>
                <span
                  class="px-3 py-1.5 text-xs font-bold rounded-m3-md-full border-2 shadow-elevation-1"
                  :class="getIssueTypeBadgeColor(issue.type)"
                >
                  {{ issue.type }}
                </span>
              </div>
            </div>
            <!-- Source entity header (always show if available) -->
            <div v-if="issue.sourceEntity && !isIssueResolved(issue)" class="mb-3 p-4 bg-primary-50 border-l-4 border-primary rounded-m3-md shadow-elevation-1">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-8 h-8 bg-primary-500 rounded-m3-md flex items-center justify-center text-white font-bold text-sm">
                  {{ issue.sourceEntity.type.charAt(0).toUpperCase() }}
                </div>
                <div class="flex-1">
                  <div class="text-[10px] font-semibold text-primary-600 uppercase tracking-wider">Changed Entity</div>
                  <button
                    @click="selectEntity(issue.sourceEntity.id)"
                    class="text-sm font-bold text-primary-900 hover:text-primary-700 hover:underline flex items-center gap-2"
                  >
                    <span class="font-mono">{{ issue.sourceEntity.id }}</span>
                    <span v-if="issue.sourceEntity.title !== issue.sourceEntity.id" class="font-normal text-primary-700">{{ issue.sourceEntity.title }}</span>
                  </button>
                </div>
                <span class="px-2 py-1 bg-primary-200 text-primary-800 rounded-m3-md text-[10px] font-bold uppercase">{{ issue.sourceEntity.type }}</span>
              </div>
              
              <!-- Change details if available -->
              <div v-if="issue.changes && issue.changes.length > 0" class="space-y-2">
                <div class="h-px bg-primary-200 my-2"></div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-bold text-purple-900 uppercase tracking-wide">Source of Change:</span>
                <button
                  @click="selectEntity(issue.sourceEntity.id)"
                  class="text-xs font-semibold text-purple-700 hover:underline flex items-center gap-1"
                >
                  <span>{{ issue.sourceEntity.type }}</span>
                  <span class="font-mono">{{ issue.sourceEntity.id }}</span>
                  <span v-if="issue.sourceEntity.title !== issue.sourceEntity.id" class="text-purple-600">"{{ issue.sourceEntity.title }}"</span>
                </button>
              </div>
              
                <div 
                  v-for="change in issue.changes" 
                  :key="change.field"
                  class="bg-surface rounded-m3-md overflow-hidden border border-primary-200 shadow-elevation-1"
                >
                  <div class="bg-primary-100 px-3 py-1.5 border-b border-primary-200">
                    <span class="font-bold text-primary-900 text-xs uppercase tracking-wide">{{ change.field }}</span>
                  </div>
                  <div class="p-3">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <div class="text-[10px] font-semibold text-secondary-600 mb-1.5 uppercase tracking-wide">Before</div>
                        <div class="text-xs font-mono text-error-800 bg-error-50 px-3 py-2 rounded-m3-md border border-error-200 break-words min-h-[2rem] flex items-center">
                          {{ change.oldValue }}
                        </div>
                      </div>
                      <div>
                        <div class="text-[10px] font-semibold text-secondary-600 mb-1.5 uppercase tracking-wide">After</div>
                        <div class="text-xs font-mono text-primary-800 bg-primary-50 px-3 py-2 rounded-m3-md border border-primary-200 break-words min-h-[2rem] flex items-center">
                          {{ change.newValue }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- No git diff available -->
              <div v-else-if="!issue.hasGitDiff" class="mt-2">
                <div class="text-xs text-tertiary-800 bg-tertiary-50 px-3 py-2 rounded-m3-md border border-tertiary-300 flex items-start gap-2">
                  <span>⚠️</span>
                  <div>
                    <div class="font-semibold mb-1">No git changes detected</div>
                    <div class="text-tertiary-700">The entity may have been manually marked as changed or git diff is unavailable. Review the entity's current state in the editor.</div>
                  </div>
                </div>
              </div>
              <!-- Rule matched but no specific field changes -->
              <div v-else class="mt-2">
                <div class="text-xs text-primary-700 bg-primary-100 px-3 py-2 rounded-m3-md border border-primary-200">
                  <span class="font-semibold">🔍</span> Entity changed but specific fields not identified. Review the entity for updates.
                </div>
              </div>
            </div>
            
            <div class="text-sm font-medium mb-2" :class="isIssueResolved(issue) ? 'text-gray-500 line-through' : getSeverityBadgeColor(issue.severity).split(' ')[1]">
              {{ issue.message }}
            </div>
            
            <div v-if="issue.reason" class="text-xs mb-2 opacity-75" :class="isIssueResolved(issue) ? 'text-gray-400' : getSeverityBadgeColor(issue.severity).split(' ')[1]">
              {{ issue.reason }}
            </div>
            <div v-if="issue.suggestedAction && !isIssueResolved(issue)" class="mt-4 p-4 bg-secondary-50 border-l-4 border-secondary rounded-m3-md shadow-elevation-1">
              <div class="font-bold text-secondary-900 mb-2 flex items-center gap-2 text-sm">
                <div class="w-6 h-6 bg-secondary-500 rounded-m3-md flex items-center justify-center text-white">💡</div>
                <span class="uppercase tracking-wide">Suggested Action</span>
              </div>
              <div class="text-secondary-900 text-sm leading-relaxed">{{ issue.suggestedAction }}</div>
            </div>
            
            <!-- Resolution button -->
            <div v-if="!isIssueResolved(issue)" class="mt-4 pt-4 border-t-2 border-surface-variant">
              <button
                @click="resolveIssue(issue)"
                class="w-full px-4 py-3 text-sm font-bold text-white bg-primary hover:bg-primary-600 rounded-m3-md transition-all shadow-elevation-2 hover:shadow-elevation-3 flex items-center justify-center gap-2 group"
              >
                <span class="text-lg group-hover:scale-125 transition-transform">✓</span>
                <span>Mark as Resolved</span>
              </button>
            </div>
            <div v-else class="mt-4 pt-4 border-t-2 border-surface-variant text-center">
              <div class="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-800 rounded-m3-md text-sm font-bold">
                <span>✓</span>
                <span>Resolved</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Stale tab -->
        <div v-if="activeTab === 'stale'" class="space-y-2">
          <div v-if="staleCount === 0" class="text-sm text-gray-500 text-center py-8">
            No stale items found
          </div>
          <button
            v-for="entity in staleEntities"
            :key="entity.id"
            @click="selectEntity(entity.id)"
            class="w-full p-3 bg-orange-50 border border-orange-200 rounded-m3-md-lg hover:bg-orange-100 transition-colors text-left"
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                class="w-2 h-2 rounded-m3-md-full flex-shrink-0"
                :class="getStatusColor(entity.status)"
              ></span>
              <span class="font-medium text-orange-900">{{ entity.id }}</span>
              <span class="px-2 py-0.5 text-xs bg-orange-200 text-orange-800 rounded-m3-md">
                {{ entity.type }}
              </span>
            </div>
            <div class="text-xs text-orange-700 ml-4">{{ entity.title }}</div>
          </button>
        </div>

        <!-- Diff tab -->
        <div v-if="activeTab === 'diff'" class="space-y-4">
          <div class="text-sm text-gray-500 text-center py-8">
            <svg class="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <p>Diff view coming soon</p>
            <p class="text-xs mt-2">Will show before/after comparison<br>for changed entity fields</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Prompt Modal -->
    <PromptModal
      :show="showPromptModal"
      :prompt="generatedPrompt"
      :entity-id="promptEntityId"
      @close="closePromptModal"
    />
  </div>
</template>
