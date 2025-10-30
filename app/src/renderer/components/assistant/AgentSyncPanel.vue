<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useAgentStore } from '@/stores/agentStore';
import { useContextStore } from '@/stores/contextStore';

const agentStore = useAgentStore();
const contextStore = useContextStore();

const { isLoading, error } = storeToRefs(agentStore);

// Sync state
const syncStatus = ref<any>(null);
const isExpanded = ref(false);
const commitMessage = ref('');
const lastSyncTime = ref<string | null>(null);
const syncHistory = ref<Array<{ time: string; message: string; type: 'pull' | 'push' | 'sync' }>>([]);

// UI state
const activeOperation = ref<'pull' | 'push' | 'sync' | null>(null);
const operationResult = ref<{ success: boolean; message: string } | null>(null);

const hasRemote = ref(false);

const statusIcon = computed(() => {
  if (!syncStatus.value) return '○';
  if (syncStatus.value.hasConflict) return '⚠';
  if (syncStatus.value.hasChanges) return '●';
  if (syncStatus.value.behind > 0 && syncStatus.value.ahead > 0) return '↕';
  if (syncStatus.value.behind > 0) return '↓';
  if (syncStatus.value.ahead > 0) return '↑';
  return '✓';
});

const statusColor = computed(() => {
  if (!syncStatus.value) return 'text-secondary-400';
  if (syncStatus.value.hasConflict) return 'text-error-600';
  if (syncStatus.value.hasChanges) return 'text-yellow-600';
  if (syncStatus.value.behind > 0 || syncStatus.value.ahead > 0) return 'text-blue-600';
  return 'text-green-600';
});

const statusText = computed(() => {
  if (!syncStatus.value) return 'Unknown';
  if (syncStatus.value.hasConflict) return 'Conflict';
  if (syncStatus.value.hasChanges) return 'Local changes';
  if (syncStatus.value.behind > 0 && syncStatus.value.ahead > 0) {
    return `${syncStatus.value.ahead} ahead, ${syncStatus.value.behind} behind`;
  }
  if (syncStatus.value.behind > 0) return `${syncStatus.value.behind} behind`;
  if (syncStatus.value.ahead > 0) return `${syncStatus.value.ahead} ahead`;
  return 'Up to date';
});

const canPull = computed(() => syncStatus.value?.canPull && !isLoading.value);
const canPush = computed(() => syncStatus.value?.canPush && commitMessage.value.trim() && !isLoading.value);
const canSync = computed(() => !isLoading.value && hasRemote.value);

onMounted(async () => {
  await checkRemote();
  if (hasRemote.value) {
    await refreshStatus();
  }
});

watch(() => contextStore.repoPath, async () => {
  await checkRemote();
  if (hasRemote.value) {
    await refreshStatus();
  }
});

async function checkRemote() {
  hasRemote.value = await agentStore.hasRemote();
}

async function refreshStatus() {
  try {
    syncStatus.value = await agentStore.getSyncStatus();
  } catch (err) {
    console.error('Failed to get sync status:', err);
  }
}

async function pullAgents() {
  activeOperation.value = 'pull';
  operationResult.value = null;

  const success = await agentStore.pullAgents();
  
  operationResult.value = {
    success,
    message: success ? 'Successfully pulled agents' : agentStore.error || 'Pull failed'
  };

  if (success) {
    lastSyncTime.value = new Date().toLocaleString();
    syncHistory.value.unshift({
      time: new Date().toLocaleTimeString(),
      message: 'Pulled from remote',
      type: 'pull'
    });
    if (syncHistory.value.length > 10) syncHistory.value.pop();
  }

  await refreshStatus();
  activeOperation.value = null;

  // Clear result after 5 seconds
  setTimeout(() => {
    operationResult.value = null;
  }, 5000);
}

async function pushAgents() {
  if (!commitMessage.value.trim()) return;

  activeOperation.value = 'push';
  operationResult.value = null;

  const message = commitMessage.value.trim();
  const success = await agentStore.pushAgents(message);
  
  operationResult.value = {
    success,
    message: success ? 'Successfully pushed agents' : agentStore.error || 'Push failed'
  };

  if (success) {
    commitMessage.value = '';
    lastSyncTime.value = new Date().toLocaleString();
    syncHistory.value.unshift({
      time: new Date().toLocaleTimeString(),
      message: message,
      type: 'push'
    });
    if (syncHistory.value.length > 10) syncHistory.value.pop();
  }

  await refreshStatus();
  activeOperation.value = null;

  setTimeout(() => {
    operationResult.value = null;
  }, 5000);
}

async function syncAgents() {
  activeOperation.value = 'sync';
  operationResult.value = null;

  const message = commitMessage.value.trim() || 'Sync agent profiles';
  const success = await agentStore.syncAgents(message);
  
  operationResult.value = {
    success,
    message: success ? 'Successfully synced agents' : agentStore.error || 'Sync failed'
  };

  if (success) {
    commitMessage.value = '';
    lastSyncTime.value = new Date().toLocaleString();
    syncHistory.value.unshift({
      time: new Date().toLocaleTimeString(),
      message: 'Synced with remote',
      type: 'sync'
    });
    if (syncHistory.value.length > 10) syncHistory.value.pop();
  }

  await refreshStatus();
  activeOperation.value = null;

  setTimeout(() => {
    operationResult.value = null;
  }, 5000);
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div class="border-b border-surface-variant bg-white">
    <!-- Sync Status Bar (Always Visible) -->
    <button
      v-if="hasRemote"
      class="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-1 transition-colors"
      @click="toggleExpanded"
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-lg" :class="statusColor">{{ statusIcon }}</span>
          <div class="text-left">
            <div class="text-sm font-medium text-secondary-900">Git Sync</div>
            <div class="text-xs text-secondary-600">{{ statusText }}</div>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="lastSyncTime" class="text-xs text-secondary-500">
          Last sync: {{ lastSyncTime }}
        </span>
        <svg
          class="w-4 h-4 text-secondary-600 transition-transform"
          :class="{ 'rotate-180': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <!-- No Remote Message -->
    <div v-else class="px-4 py-3 text-sm text-secondary-600 bg-surface-1">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>No Git remote configured. Sync features disabled.</span>
      </div>
    </div>

    <!-- Expanded Sync Panel -->
    <Transition name="expand">
      <div v-if="isExpanded && hasRemote" class="border-t border-surface-variant bg-surface-1">
        <div class="p-4 space-y-4">
          <!-- Operation Result -->
          <Transition name="fade">
            <div
              v-if="operationResult"
              class="text-xs px-3 py-2 rounded-m3-md flex items-center gap-2"
              :class="operationResult.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-error-50 text-error-700 border border-error-200'"
            >
              <svg
                v-if="operationResult.success"
                class="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <svg
                v-else
                class="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
              <span>{{ operationResult.message }}</span>
            </div>
          </Transition>

          <!-- Commit Message Input -->
          <div>
            <label class="text-xs font-medium text-secondary-700 block mb-1">
              Commit Message
            </label>
            <input
              v-model="commitMessage"
              type="text"
              placeholder="Update agent profiles..."
              class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              :disabled="isLoading"
            />
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2">
            <button
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-m3-md transition-all"
              :class="canPull
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-secondary-200 text-secondary-500 cursor-not-allowed'"
              :disabled="!canPull"
              @click="pullAgents"
            >
              <svg
                class="w-4 h-4"
                :class="{ 'animate-spin': activeOperation === 'pull' }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{{ activeOperation === 'pull' ? 'Pulling...' : 'Pull' }}</span>
            </button>

            <button
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-m3-md transition-all"
              :class="canPush
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-secondary-200 text-secondary-500 cursor-not-allowed'"
              :disabled="!canPush"
              @click="pushAgents"
            >
              <svg
                class="w-4 h-4"
                :class="{ 'animate-spin': activeOperation === 'push' }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>{{ activeOperation === 'push' ? 'Pushing...' : 'Push' }}</span>
            </button>

            <button
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-m3-md transition-all"
              :class="canSync
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-secondary-200 text-secondary-500 cursor-not-allowed'"
              :disabled="!canSync"
              @click="syncAgents"
            >
              <svg
                class="w-4 h-4"
                :class="{ 'animate-spin': activeOperation === 'sync' }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{{ activeOperation === 'sync' ? 'Syncing...' : 'Sync' }}</span>
            </button>
          </div>

          <!-- Sync History -->
          <div v-if="syncHistory.length > 0" class="pt-3 border-t border-surface-variant">
            <div class="text-xs font-medium text-secondary-700 mb-2">Recent Activity</div>
            <div class="space-y-1 max-h-32 overflow-y-auto">
              <div
                v-for="(item, index) in syncHistory.slice(0, 5)"
                :key="index"
                class="flex items-center gap-2 text-xs text-secondary-600"
              >
                <span
                  class="flex-shrink-0 w-12 text-[10px] px-1.5 py-0.5 rounded-m3-md font-medium"
                  :class="{
                    'bg-blue-100 text-blue-700': item.type === 'pull',
                    'bg-green-100 text-green-700': item.type === 'push',
                    'bg-primary-100 text-primary-700': item.type === 'sync'
                  }"
                >
                  {{ item.type }}
                </span>
                <span class="text-secondary-500">{{ item.time }}</span>
                <span class="flex-1 truncate">{{ item.message }}</span>
              </div>
            </div>
          </div>

          <!-- Refresh Status Button -->
          <button
            class="w-full text-xs text-secondary-600 hover:text-secondary-900 font-medium py-1 transition-colors"
            :disabled="isLoading"
            @click="refreshStatus"
          >
            Refresh Status
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
