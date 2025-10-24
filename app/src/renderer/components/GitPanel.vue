<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useGitStore } from '../stores/gitStore';
import { useImpactStore } from '../stores/impactStore';

const gitStore = useGitStore();
const impactStore = useImpactStore();

const activeTab = ref<'status' | 'commit' | 'branches' | 'pr'>('status');
const commitMessage = ref('');
const selectedFiles = ref<string[]>([]);
const newBranchName = ref('');
const showBranchModal = ref(false);
const showDiffModal = ref(false);
const selectedFileForDiff = ref<string | null>(null);
const prTitle = ref('');
const prBody = ref('');
const prBase = ref('main');
const showPRModal = ref(false);

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
  
  let template = `feat: Update ${entities}${more}\n\nChanges:\n- `;
  
  // Add impact info if available
  if (impactStore.report && impactStore.report.stale?.length > 0) {
    template += `\n\nImpact: ${impactStore.report.stale.slice(0, 5).join(', ')} need review`;
  }
  
  return template;
});

const prBodyTemplate = computed(() => {
  if (changedEntities.value.length === 0) return '';
  
  const entities = changedEntities.value.join(', ');
  let body = `## Changes\n\nUpdated entities: ${entities}\n\n`;
  
  // Add impact analysis
  if (impactStore.report) {
    body += `## Impact Analysis\n\n`;
    if (impactStore.report.stale && impactStore.report.stale.length > 0) {
      body += `**Stale items (${impactStore.report.stale.length}):** ${impactStore.report.stale.join(', ')}\n\n`;
    }
    if (impactStore.report.issues && impactStore.report.issues.length > 0) {
      body += `**Issues:**\n`;
      impactStore.report.issues.forEach((issue: any) => {
        body += `- ${issue.id}: ${issue.message}\n`;
      });
    }
  }
  
  return body;
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

async function handleViewDiff(file: string) {
  selectedFileForDiff.value = file;
  await gitStore.loadDiff(file);
  showDiffModal.value = true;
}

function usePRTemplate() {
  prBody.value = prBodyTemplate.value;
}

async function handleCreatePR() {
  if (!prTitle.value.trim()) {
    alert('Please enter a PR title');
    return;
  }
  
  const result = await gitStore.createPR(prTitle.value, prBody.value, prBase.value);
  
  if (result.ok) {
    alert(`PR created successfully: ${result.url}`);
    prTitle.value = '';
    prBody.value = '';
    showPRModal.value = false;
  }
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

function parseDiff(diffText: string) {
  if (!diffText) return [];
  
  const lines = diffText.split('\n');
  return lines.map(line => {
    // Additions
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return { type: 'add', content: line };
    }
    // Deletions
    if (line.startsWith('-') && !line.startsWith('---')) {
      return { type: 'remove', content: line };
    }
    // Diff headers (diff --git, index, +++, ---)
    if (line.startsWith('diff --git') || line.startsWith('index ') || 
        line.startsWith('---') || line.startsWith('+++')) {
      return { type: 'header', content: line };
    }
    // Range info (@@ -1,5 +1,5 @@)
    if (line.startsWith('@@')) {
      return { type: 'info', content: line };
    }
    // Normal context lines
    return { type: 'normal', content: line };
  });
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
      <button
        @click="activeTab = 'pr'"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-all hover:bg-surface-3"
        :class="activeTab === 'pr' ? 'border-primary text-primary-700' : 'border-transparent text-secondary-600'"
      >
        Pull Request
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
              class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded text-sm cursor-pointer group"
              @click="handleViewDiff(file)"
            >
              <span
                class="px-1.5 py-0.5 text-xs font-mono rounded"
                :class="getFileStatusColor(file)"
              >
                {{ getFileStatus(file) }}
              </span>
              <span class="flex-1 font-mono text-xs text-gray-700">{{ file }}</span>
              <svg class="w-4 h-4 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
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

      <!-- PR Tab -->
      <div v-if="activeTab === 'pr'" class="space-y-4">
        <div v-if="!gitStore.hasUncommittedChanges" class="text-center py-8 text-gray-500">
          <p>No changes available for PR creation</p>
          <p class="text-sm mt-1">Commit your changes first</p>
        </div>

        <div v-else>
          <div class="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
            <p class="text-sm text-yellow-800">
              <strong>Note:</strong> Make sure to commit and push your changes before creating a PR.
            </p>
          </div>

          <!-- PR Title -->
          <div class="mb-4">
            <label class="text-sm font-semibold text-gray-700 block mb-2">PR Title</label>
            <input
              v-model="prTitle"
              type="text"
              placeholder="feat: Add new feature..."
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- PR Body -->
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-semibold text-gray-700">PR Description</label>
              <button
                @click="usePRTemplate"
                class="text-xs text-blue-600 hover:underline"
              >
                Use Template
              </button>
            </div>
            <textarea
              v-model="prBody"
              rows="10"
              placeholder="Describe the changes..."
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            ></textarea>
          </div>

          <!-- Base Branch -->
          <div class="mb-4">
            <label class="text-sm font-semibold text-gray-700 block mb-2">Base Branch</label>
            <input
              v-model="prBase"
              type="text"
              placeholder="main"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Create PR Button -->
          <button
            @click="handleCreatePR"
            :disabled="!prTitle.trim() || gitStore.isLoading"
            class="w-full px-4 py-2.5 bg-green-600 text-white rounded-m3-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-elevation-1 hover:shadow-elevation-2 font-medium"
          >
            {{ gitStore.isLoading ? 'Creating PR...' : 'Create Pull Request' }}
          </button>

          <p class="text-xs text-gray-500 mt-2">
            This will use GitHub CLI (gh) to create the PR
          </p>
        </div>
      </div>
    </div>

    <!-- Branch Creation Modal -->
    <Teleport to="body">
      <div
        v-if="showBranchModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20"
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

    <!-- Diff Viewer Modal -->
    <Teleport to="body">
      <div
        v-if="showDiffModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20"
        @click.self="showDiffModal = false"
      >
        <div class="bg-white rounded-xl shadow-2xl w-3/4 h-3/4 flex flex-col overflow-hidden">
          <div class="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <svg class="w-6 h-6 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <h3 class="text-lg font-semibold text-white">File Changes</h3>
                <p class="text-xs text-blue-100 font-mono truncate max-w-2xl">{{ selectedFileForDiff }}</p>
              </div>
            </div>
            <button
              @click="showDiffModal = false"
              class="p-2 hover:bg-blue-800 rounded-lg transition-colors"
              title="Close"
            >
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-auto bg-slate-50">
            <div v-if="gitStore.diff" class="font-mono text-sm">
              <!-- Parse and render diff lines with syntax highlighting -->
              <div 
                v-for="(line, index) in parseDiff(gitStore.diff)"
                :key="index"
                :class="[
                  'px-6 py-1 leading-relaxed',
                  line.type === 'add' && 'bg-green-50 text-green-800 border-l-4 border-green-500',
                  line.type === 'remove' && 'bg-red-50 text-red-800 border-l-4 border-red-500',
                  line.type === 'header' && 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-400',
                  line.type === 'info' && 'bg-gray-100 text-gray-600 border-l-4 border-gray-400',
                  line.type === 'normal' && 'bg-white text-gray-700'
                ]"
              >
                <span class="select-text whitespace-pre-wrap break-all">{{ line.content }}</span>
              </div>
            </div>
            <div v-else class="flex items-center justify-center h-full text-gray-500">
              <div class="text-center">
                <svg class="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="font-medium">No changes to display</p>
              </div>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              @click="showDiffModal = false"
              class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
