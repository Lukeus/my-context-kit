<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useGitStore } from '../stores/gitStore';
import { useImpactStore } from '../stores/impactStore';

const gitStore = useGitStore();
const impactStore = useImpactStore();

const activeTab = ref<'status' | 'commit' | 'branches'>('status');
const commitMessage = ref('');
const selectedFiles = ref<string[]>([]);
const newBranchName = ref('');
const showBranchModal = ref(false);

const changedEntities = computed(() => {
  return gitStore.changedFiles
    .filter(f => f.includes('contexts/'))
    .map(f => {
      const parts = f.split('/');
      return parts[parts.length - 1].replace('.yaml', '').replace('.yml', '');
    });
});

const commitMessageTemplate = computed(() => {
  if (changedEntities.value.length === 0) return '';
  
  const entities = changedEntities.value.slice(0, 3).join(', ');
  const more = changedEntities.value.length > 3 ? ` and ${changedEntities.value.length - 3} more` : '';
  
  return `feat: Update ${entities}${more}\n\nChanges:\n- `;
});

function toggleFileSelection(file: string) {
  const index = selectedFiles.value.indexOf(file);
  if (index > -1) {
    selectedFiles.value.splice(index, 1);
  } else {
    selectedFiles.value.push(file);
  }
}

function selectAllFiles() {
  selectedFiles.value = [...gitStore.changedFiles];
}

function clearSelection() {
  selectedFiles.value = [];
}

function useTemplate() {
  commitMessage.value = commitMessageTemplate.value;
}

async function handleCommit() {
  if (!commitMessage.value.trim()) {
    alert('Please enter a commit message');
    return;
  }

  const filesToCommit = selectedFiles.value.length > 0 ? selectedFiles.value : undefined;
  const success = await gitStore.commit(commitMessage.value, filesToCommit);

  if (success) {
    commitMessage.value = '';
    selectedFiles.value = [];
    activeTab.value = 'status';
    await gitStore.loadStatus();
  }
}

async function handleCreateBranch() {
  if (!newBranchName.value.trim()) {
    alert('Please enter a branch name');
    return;
  }

  const success = await gitStore.createBranch(newBranchName.value, true);

  if (success) {
    newBranchName.value = '';
    showBranchModal.value = false;
  }
}

async function handleCheckout(branchName: string) {
  await gitStore.checkout(branchName);
}

function getFileStatus(file: string): string {
  if (gitStore.status?.modified.includes(file)) return 'M';
  if (gitStore.status?.created.includes(file)) return 'A';
  if (gitStore.status?.deleted.includes(file)) return 'D';
  return '?';
}

function getFileStatusColor(file: string): string {
  const status = getFileStatus(file);
  if (status === 'M') return 'text-yellow-600 bg-yellow-100';
  if (status === 'A') return 'text-green-600 bg-green-100';
  if (status === 'D') return 'text-red-600 bg-red-100';
  return 'text-gray-600 bg-gray-100';
}

onMounted(async () => {
  await gitStore.loadStatus();
  await gitStore.loadBranches();
});
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-surface-variant bg-surface-2">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-primary-700">Git Integration</h2>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-secondary-600">Branch:</span>
            <span class="text-xs font-mono bg-primary-100 text-primary-800 px-2 py-1 rounded-m3-sm">
              {{ gitStore.currentBranch || 'unknown' }}
            </span>
            <span v-if="gitStore.hasUncommittedChanges" class="text-xs text-tertiary-700">
              ({{ gitStore.changedFilesCount }} changes)
            </span>
          </div>
        </div>
        <button
          @click="gitStore.loadStatus(); gitStore.loadBranches()"
          :disabled="gitStore.isLoading"
          class="p-2 hover:bg-gray-100 rounded transition-colors"
          title="Refresh"
        >
          <svg class="w-4 h-4" :class="{ 'animate-spin': gitStore.isLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="gitStore.error" class="px-4 py-2 bg-error-50 border-b border-error-200 text-sm text-error-700">
      {{ gitStore.error }}
      <button @click="gitStore.clearError" class="ml-2 underline hover:text-error-900">Dismiss</button>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-surface-variant bg-surface-1">
      <button
        @click="activeTab = 'status'"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
        :class="activeTab === 'status' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
      >
        Status
      </button>
      <button
        @click="activeTab = 'commit'"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
        :class="activeTab === 'commit' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
      >
        Commit
      </button>
      <button
        @click="activeTab = 'branches'"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
        :class="activeTab === 'branches' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
      >
        Branches
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- Status Tab -->
      <div v-if="activeTab === 'status'" class="space-y-4">
        <div v-if="!gitStore.hasUncommittedChanges" class="text-center py-8 text-gray-500">
          <svg class="w-16 h-16 mx-auto mb-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="font-medium">Working directory clean</p>
          <p class="text-sm mt-1">No uncommitted changes</p>
        </div>

        <div v-else>
          <h3 class="text-sm font-semibold text-gray-700 mb-2">Changed Files ({{ gitStore.changedFilesCount }})</h3>
          <div class="space-y-1">
            <div
              v-for="file in gitStore.changedFiles"
              :key="file"
              class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-sm"
            >
              <span
                class="px-1.5 py-0.5 text-xs font-mono rounded"
                :class="getFileStatusColor(file)"
              >
                {{ getFileStatus(file) }}
              </span>
              <span class="flex-1 font-mono text-xs text-gray-700">{{ file }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Commit Tab -->
      <div v-if="activeTab === 'commit'" class="space-y-4">
        <div v-if="!gitStore.hasUncommittedChanges" class="text-center py-8 text-gray-500">
          <p>No changes to commit</p>
        </div>

        <div v-else>
          <!-- File Selection -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-700">Files to Commit</h3>
              <div class="flex gap-2">
                <button
                  @click="selectAllFiles"
                  class="text-xs text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <button
                  v-if="selectedFiles.length > 0"
                  @click="clearSelection"
                  class="text-xs text-gray-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <div class="space-y-1 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
              <label
                v-for="file in gitStore.changedFiles"
                :key="file"
                class="flex items-center gap-2 p-1 hover:bg-gray-50 rounded text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="selectedFiles.includes(file)"
                  @change="toggleFileSelection(file)"
                  class="rounded"
                />
                <span class="text-xs font-mono text-gray-700">{{ file }}</span>
              </label>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              {{ selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'All files will be committed' }}
            </p>
          </div>

          <!-- Commit Message -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-semibold text-gray-700">Commit Message</label>
              <button
                v-if="commitMessageTemplate"
                @click="useTemplate"
                class="text-xs text-blue-600 hover:underline"
              >
                Use Template
              </button>
            </div>
            <textarea
              v-model="commitMessage"
              rows="6"
              placeholder="Enter commit message..."
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            ></textarea>
          </div>

          <!-- Commit Button -->
          <button
            @click="handleCommit"
            :disabled="!commitMessage.trim() || gitStore.isLoading"
            class="w-full px-4 py-2.5 bg-primary text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-elevation-1 hover:shadow-elevation-2 font-medium"
          >
            {{ gitStore.isLoading ? 'Committing...' : 'Commit Changes' }}
          </button>
        </div>
      </div>

      <!-- Branches Tab -->
      <div v-if="activeTab === 'branches'" class="space-y-4">
        <button
          @click="showBranchModal = true"
          class="w-full px-4 py-2.5 bg-primary text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 transition-all shadow-elevation-1 hover:shadow-elevation-2 font-medium"
        >
          Create New Branch
        </button>

        <div>
          <h3 class="text-sm font-semibold text-gray-700 mb-2">All Branches</h3>
          <div class="space-y-1">
            <button
              v-for="branch in gitStore.allBranches"
              :key="branch"
              @click="handleCheckout(branch)"
              class="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-sm text-left"
              :class="{ 'bg-blue-50 border border-blue-200': branch === gitStore.currentBranch }"
            >
              <svg v-if="branch === gitStore.currentBranch" class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <span class="font-mono" :class="{ 'font-semibold text-blue-600': branch === gitStore.currentBranch }">
                {{ branch }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Branch Creation Modal -->
    <Teleport to="body">
      <div
        v-if="showBranchModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        @click.self="showBranchModal = false"
      >
        <div class="bg-white rounded-lg shadow-xl w-96 p-6">
          <h3 class="text-lg font-semibold mb-4">Create New Branch</h3>
          <input
            v-model="newBranchName"
            type="text"
            placeholder="feature/my-new-feature"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            @keyup.enter="handleCreateBranch"
          />
          <div class="flex gap-2 justify-end">
            <button
              @click="showBranchModal = false"
              class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleCreateBranch"
              :disabled="!newBranchName.trim() || gitStore.isLoading"
              class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create & Checkout
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
