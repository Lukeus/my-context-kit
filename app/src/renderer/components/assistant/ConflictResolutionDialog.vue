<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AgentProfile } from '@shared/agents/types';

interface ConflictItem {
  agentId: string;
  localAgent: AgentProfile;
  remoteAgent: AgentProfile;
  resolution: 'keep-local' | 'keep-remote' | 'merge' | null;
}

interface Props {
  conflicts: ConflictItem[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  resolve: [conflicts: ConflictItem[]];
}>();

const selectedConflictIndex = ref(0);
const localConflicts = ref<ConflictItem[]>(props.conflicts.map(c => ({ ...c })));

const selectedConflict = computed(() => localConflicts.value[selectedConflictIndex.value]);

const hasUnresolvedConflicts = computed(() => 
  localConflicts.value.some(c => !c.resolution)
);

const conflictStats = computed(() => ({
  total: localConflicts.value.length,
  resolved: localConflicts.value.filter(c => c.resolution).length
}));

function selectConflict(index: number) {
  selectedConflictIndex.value = index;
}

function setResolution(resolution: 'keep-local' | 'keep-remote' | 'merge') {
  if (selectedConflict.value) {
    selectedConflict.value.resolution = resolution;
  }
}

function goToNext() {
  if (selectedConflictIndex.value < localConflicts.value.length - 1) {
    selectedConflictIndex.value++;
  }
}

function goToPrevious() {
  if (selectedConflictIndex.value > 0) {
    selectedConflictIndex.value--;
  }
}

function handleResolve() {
  emit('resolve', localConflicts.value);
}

function handleCancel() {
  emit('close');
}

function getConflictIcon(conflict: ConflictItem) {
  if (!conflict.resolution) return '⚠';
  if (conflict.resolution === 'keep-local') return '←';
  if (conflict.resolution === 'keep-remote') return '→';
  return '⟷';
}

function getDifferenceCount(local: AgentProfile, remote: AgentProfile): number {
  let count = 0;
  if (local.systemPrompt !== remote.systemPrompt) count++;
  if (JSON.stringify(local.tools) !== JSON.stringify(remote.tools)) count++;
  if (JSON.stringify(local.config) !== JSON.stringify(remote.config)) count++;
  if (local.metadata.description !== remote.metadata.description) count++;
  return count;
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-6xl max-h-[90vh] bg-white rounded-m3-xl shadow-elevation-3 flex flex-col">
      <!-- Header -->
      <header class="flex items-center justify-between px-6 py-4 border-b border-surface-variant">
        <div>
          <h2 class="text-lg font-semibold text-secondary-900">Resolve Merge Conflicts</h2>
          <p class="text-sm text-secondary-600">
            {{ conflictStats.resolved }} of {{ conflictStats.total }} conflicts resolved
          </p>
        </div>
        <button
          class="text-secondary-600 hover:text-secondary-900 transition-colors p-1"
          @click="handleCancel"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <!-- Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Conflict List Sidebar -->
        <aside class="w-64 border-r border-surface-variant bg-surface-1 overflow-y-auto">
          <div class="p-3 space-y-1">
            <div
              v-for="(conflict, index) in localConflicts"
              :key="conflict.agentId"
              class="flex items-center gap-2 px-3 py-2 rounded-m3-md cursor-pointer transition-colors"
              :class="index === selectedConflictIndex
                ? 'bg-primary-100 border border-primary-300'
                : 'hover:bg-surface-2'"
              @click="selectConflict(index)"
            >
              <span class="text-lg">{{ getConflictIcon(conflict) }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-secondary-900 truncate">
                  {{ conflict.localAgent.metadata.name }}
                </div>
                <div class="text-xs text-secondary-600">
                  {{ getDifferenceCount(conflict.localAgent, conflict.remoteAgent) }} differences
                </div>
              </div>
              <svg
                v-if="conflict.resolution"
                class="w-4 h-4 text-success flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
          </div>
        </aside>

        <!-- Diff View -->
        <div class="flex-1 flex flex-col overflow-hidden" v-if="selectedConflict">
          <!-- Navigation -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-surface-variant bg-white">
            <div class="flex items-center gap-2">
              <button
                class="p-1 text-secondary-600 hover:text-secondary-900 disabled:text-secondary-300 transition-colors"
                :disabled="selectedConflictIndex === 0"
                @click="goToPrevious"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span class="text-sm text-secondary-700">
                Conflict {{ selectedConflictIndex + 1 }} of {{ localConflicts.length }}
              </span>
              <button
                class="p-1 text-secondary-600 hover:text-secondary-900 disabled:text-secondary-300 transition-colors"
                :disabled="selectedConflictIndex === localConflicts.length - 1"
                @click="goToNext"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div class="text-sm font-medium text-secondary-900">
              {{ selectedConflict.localAgent.metadata.name }}
            </div>
          </div>

          <!-- Resolution Options -->
          <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-variant bg-surface-1">
            <span class="text-sm font-medium text-secondary-700">Choose resolution:</span>
            <button
              class="flex-1 px-3 py-2 text-sm font-medium rounded-m3-md transition-all border-2"
              :class="selectedConflict.resolution === 'keep-local'
                ? 'bg-primary-container border-primary text-on-primary-container'
                : 'bg-surface border-outline text-on-surface hover:border-primary'"
              @click="setResolution('keep-local')"
            >
              ← Keep Local
            </button>
            <button
              class="flex-1 px-3 py-2 text-sm font-medium rounded-m3-md transition-all border-2"
              :class="selectedConflict.resolution === 'merge'
                ? 'bg-tertiary-container border-tertiary text-on-tertiary-container'
                : 'bg-surface border-outline text-on-surface hover:border-tertiary'"
              @click="setResolution('merge')"
            >
              ⟷ Merge Both
            </button>
            <button
              class="flex-1 px-3 py-2 text-sm font-medium rounded-m3-md transition-all border-2"
              :class="selectedConflict.resolution === 'keep-remote'
                ? 'bg-success-container border-success text-on-success-container'
                : 'bg-surface border-outline text-on-surface hover:border-success'"
              @click="setResolution('keep-remote')"
            >
              Keep Remote →
            </button>
          </div>

          <!-- Diff Content -->
          <div class="flex-1 overflow-y-auto">
            <div class="grid grid-cols-2 divide-x divide-surface-variant h-full">
              <!-- Local Version -->
              <div class="p-4 space-y-4 bg-primary-container/30">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-3 h-3 bg-primary rounded-m3-md-full"></div>
                  <h3 class="text-sm font-semibold text-secondary-900">Local Version</h3>
                </div>

                <!-- System Prompt -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">System Prompt</div>
                  <div class="text-sm text-secondary-900 bg-surface rounded-m3-md p-3 border border-outline font-mono text-xs whitespace-pre-wrap">
                    {{ selectedConflict.localAgent.systemPrompt }}
                  </div>
                </div>

                <!-- Tools -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">Tools</div>
                  <div class="space-y-1">
                    <div
                      v-for="tool in selectedConflict.localAgent.tools"
                      :key="tool.toolId"
                      class="text-xs px-2 py-1 bg-surface rounded-m3-md border border-outline flex items-center justify-between"
                    >
                      <span>{{ tool.toolId }}</span>
                      <span v-if="tool.required" class="text-[10px] text-primary">required</span>
                    </div>
                    <div v-if="!selectedConflict.localAgent.tools?.length" class="text-xs text-secondary-500 italic">
                      No tools configured
                    </div>
                  </div>
                </div>

                <!-- Config -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">Configuration</div>
                  <div class="text-xs text-secondary-900 bg-surface rounded-m3-md p-3 border border-outline font-mono">
                    <div>Temperature: {{ selectedConflict.localAgent.config?.temperature ?? 'default' }}</div>
                    <div>Max Tokens: {{ selectedConflict.localAgent.config?.maxTokens ?? 'default' }}</div>
                  </div>
                </div>

                <!-- Metadata -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">Description</div>
                  <div class="text-xs text-secondary-900 bg-surface rounded-m3-md p-3 border border-outline">
                    {{ selectedConflict.localAgent.metadata.description }}
                  </div>
                </div>
              </div>

              <!-- Remote Version -->
              <div class="p-4 space-y-4 bg-success-container/30">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-3 h-3 bg-success rounded-m3-md-full"></div>
                  <h3 class="text-sm font-semibold text-secondary-900">Remote Version</h3>
                </div>

                <!-- System Prompt -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">System Prompt</div>
                  <div class="text-sm text-secondary-900 bg-surface rounded-m3-md p-3 border border-outline font-mono text-xs whitespace-pre-wrap">
                    {{ selectedConflict.remoteAgent.systemPrompt }}
                  </div>
                </div>

                <!-- Tools -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">Tools</div>
                  <div class="space-y-1">
                    <div
                      v-for="tool in selectedConflict.remoteAgent.tools"
                      :key="tool.toolId"
                      class="text-xs px-2 py-1 bg-surface rounded-m3-md border border-outline flex items-center justify-between"
                    >
                      <span>{{ tool.toolId }}</span>
                      <span v-if="tool.required" class="text-[10px] text-success">required</span>
                    </div>
                    <div v-if="!selectedConflict.remoteAgent.tools?.length" class="text-xs text-secondary-500 italic">
                      No tools configured
                    </div>
                  </div>
                </div>

                <!-- Config -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">Configuration</div>
                  <div class="text-xs text-secondary-900 bg-surface rounded-m3-md p-3 border border-outline font-mono">
                    <div>Temperature: {{ selectedConflict.remoteAgent.config?.temperature ?? 'default' }}</div>
                    <div>Max Tokens: {{ selectedConflict.remoteAgent.config?.maxTokens ?? 'default' }}</div>
                  </div>
                </div>

                <!-- Metadata -->
                <div>
                  <div class="text-xs font-medium text-secondary-700 mb-1">Description</div>
                  <div class="text-xs text-secondary-900 bg-surface rounded-m3-md p-3 border border-outline">
                    {{ selectedConflict.remoteAgent.metadata.description }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="flex items-center justify-between px-6 py-4 border-t border-surface-variant bg-white">
        <div class="text-sm text-secondary-600">
          <span v-if="hasUnresolvedConflicts" class="text-warning">
            ⚠ {{ localConflicts.length - conflictStats.resolved }} conflicts remaining
          </span>
          <span v-else class="text-success">
            ✓ All conflicts resolved
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            class="px-4 py-2 text-sm font-medium text-secondary-700 hover:text-secondary-900 transition-colors"
            @click="handleCancel"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm font-medium rounded-m3-md transition-all"
            :class="hasUnresolvedConflicts
              ? 'bg-secondary-200 text-secondary-500 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700 shadow-elevation-1'"
            :disabled="hasUnresolvedConflicts"
            @click="handleResolve"
          >
            Apply Resolutions
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
