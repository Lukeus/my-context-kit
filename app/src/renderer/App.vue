<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import ContextTree from './components/ContextTree.vue';
import YamlEditor from './components/YamlEditor.vue';
import ImpactPanel from './components/ImpactPanel.vue';
import GraphView from './components/GraphView.vue';
import GitPanel from './components/GitPanel.vue';
import WelcomeDocumentation from './components/WelcomeDocumentation.vue';
import ContextBuilderModal from './components/ContextBuilderModal.vue';
import AISettingsModal from './components/AISettingsModal.vue';
import AIAssistantPanel from './components/AIAssistantPanel.vue';
import { useContextStore } from './stores/contextStore';
import { useBuilderStore } from './stores/builderStore';

const contextStore = useContextStore();
const builderStore = useBuilderStore();

const statusMessage = ref('Ready');
const showGraphModal = ref(false);
const showGitModal = ref(false);
const showAISettings = ref(false);
const showRepoManager = ref(false);
const newRepoLabel = ref('');
const newRepoPath = ref('');
const repoFormError = ref('');
const isSavingRepo = ref(false);
const repoActionMessage = ref('');
const removingRepoId = ref<string | null>(null);
const repoSelection = ref('');
const isHeaderExpanded = ref(false);

// Panel state
const leftPanelOpen = ref(true);
const rightPanelOpen = ref(true);
const leftPanelWidth = ref(256); // 64 * 4 = 256px (w-64)
const rightPanelWidth = ref(380);
const rightPanelView = ref<'impact' | 'assistant'>('impact');

const isResizingLeft = ref(false);
const isResizingRight = ref(false);

const activeEntity = computed(() => contextStore.activeEntity);
const repoOptions = computed(() => contextStore.repoOptions);
const isRepoConfigured = computed(() => Boolean(contextStore.repoPath?.trim().length));
const repoStatusHint = computed(() => {
  if (isRepoConfigured.value) {
    return '';
  }
  return 'Select or add a context repository to unlock validation, impact analysis, and Git features.';
});

const activeRepoMeta = computed(() => contextStore.getActiveRepoMeta());
const repoSummaryLine = computed(() => {
  if (activeRepoMeta.value) {
    return activeRepoMeta.value.path;
  }
  return 'No repository configured';
});
const repoLastUsedDisplay = computed(() => {
  if (!activeRepoMeta.value) {
    return '';
  }
  try {
    return new Date(activeRepoMeta.value.lastUsed).toLocaleString();
  } catch {
    return activeRepoMeta.value.lastUsed;
  }
});
const totalEntities = computed(() => contextStore.entityCount);
const typeLabelMap: Record<string, string> = {
  governance: 'Governance',
  feature: 'Feature',
  userstory: 'User Story',
  spec: 'Specification',
  task: 'Task',
  service: 'Service',
  package: 'Package'
};
const activeEntitySummary = computed(() => {
  const entity = activeEntity.value;
  if (!entity) {
    return 'Welcome documentation';
  }
  const typeLabel = typeLabelMap[entity._type] || (entity._type ? entity._type.charAt(0).toUpperCase() + entity._type.slice(1) : 'Entity');
  const id = entity.id || 'Untitled';
  return `${typeLabel} • ${id}`;
});

const activeEntityDescription = computed(() => {
  const entity = activeEntity.value;
  if (!entity) {
    return 'Select an item from the context tree to inspect its YAML definition.';
  }
  return entity.title || entity.name || 'No additional details available.';
});

const isImpactView = computed(() => rightPanelView.value === 'impact');
const isAssistantView = computed(() => rightPanelView.value === 'assistant');

// Panel resize handlers
function startResizeLeft() {
  isResizingLeft.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function startResizeRight() {
  isResizingRight.value = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function handleMouseMove(e: MouseEvent) {
  if (isResizingLeft.value) {
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 500) {
      leftPanelWidth.value = newWidth;
    }
  } else if (isResizingRight.value) {
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 280 && newWidth <= 600) {
      rightPanelWidth.value = newWidth;
    }
  }
}

watch(
  () => contextStore.activeRepoId,
  (newId) => {
    repoSelection.value = newId ?? '';
  },
  { immediate: true }
);

watch(
  () => contextStore.repoPath,
  () => {
    repoActionMessage.value = '';
  }
);

watch(showRepoManager, async (isOpen) => {
  if (isOpen) {
    await contextStore.refreshRepoRegistry();
  }
});

function stopResize() {
  isResizingLeft.value = false;
  isResizingRight.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

// Keyboard shortcuts
async function handleKeyboard(e: KeyboardEvent) {
  // Ctrl+N or Cmd+N to create new entity
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    // Open builder with default entity type (feature)
    await contextStore.initializeStore();
    builderStore.initBuilder('feature', {}, contextStore.repoPath);
  }
}

onMounted(async () => {
  // Initialize context store on app mount
  await contextStore.initializeStore();
  await contextStore.refreshRepoRegistry();
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', stopResize);
  window.addEventListener('keydown', handleKeyboard);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', stopResize);
  window.removeEventListener('keydown', handleKeyboard);
});

const runValidation = async () => {
  statusMessage.value = 'Validating...';
  const result = await contextStore.validateRepo();
  statusMessage.value = result.ok ? 'Validation passed ✓' : `Validation failed: ${result.error || 'Unknown error'}`;
};

const reloadGraph = async () => {
  statusMessage.value = 'Refreshing graph...';
  const isSuccess = await contextStore.loadGraph();
  const fallbackMessage = 'Failed to refresh graph';
  const errorDetail = typeof contextStore.error === 'string' ? contextStore.error : null;
  statusMessage.value = isSuccess ? 'Graph refreshed ✓' : (errorDetail || fallbackMessage);
};

function openImpactPanel() {
  rightPanelView.value = 'impact';
  rightPanelOpen.value = true;
}

function openAssistantPanel() {
  rightPanelView.value = 'assistant';
  rightPanelOpen.value = true;
}

function toggleHeader() {
  isHeaderExpanded.value = !isHeaderExpanded.value;
}

function handleImpactAction() {
  if (!rightPanelOpen.value || !isImpactView.value) {
    openImpactPanel();
  } else {
    rightPanelOpen.value = false;
  }
}

function handleAssistantAction() {
  if (!rightPanelOpen.value || !isAssistantView.value) {
    openAssistantPanel();
  } else {
    rightPanelOpen.value = false;
  }
}

function openBuilderModal(type: string = 'feature') {
  if (!contextStore.repoPath) {
    showRepoManager.value = true;
    repoFormError.value = 'Select a repository before creating new entities.';
    return;
  }
  repoFormError.value = '';
  repoActionMessage.value = '';
  builderStore.initBuilder(type, {}, contextStore.repoPath);
}

function toggleLeftPanel() {
  leftPanelOpen.value = !leftPanelOpen.value;
}

async function handleRepoChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const newId = target.value;
  if (!newId) {
    return;
  }
  if (newId === contextStore.activeRepoId) {
    return;
  }
  repoFormError.value = '';
  repoActionMessage.value = '';
  try {
    await contextStore.selectActiveRepo(newId);
    repoActionMessage.value = 'Repository activated';
  } catch (err: any) {
    repoFormError.value = err?.message || 'Failed to switch repository';
  }
}

function openRepoManager() {
  repoFormError.value = '';
  repoActionMessage.value = '';
  newRepoLabel.value = '';
  newRepoPath.value = '';
  showRepoManager.value = true;
}

async function handleAddRepo() {
  repoFormError.value = '';
  repoActionMessage.value = '';
  isSavingRepo.value = true;
  try {
    const result = await contextStore.addRepository({
      label: newRepoLabel.value,
      path: newRepoPath.value,
    });
    if (!result.ok) {
      repoFormError.value = result.error || 'Failed to add repository';
      return;
    }
    repoActionMessage.value = 'Repository added successfully';
    newRepoLabel.value = '';
    newRepoPath.value = '';
  } finally {
    isSavingRepo.value = false;
  }
}

async function handleRemoveRepo(id: string) {
  repoFormError.value = '';
  repoActionMessage.value = '';
  removingRepoId.value = id;
  try {
    const result = await contextStore.removeRepository(id);
    if (!result.ok) {
      repoFormError.value = result.error || 'Failed to remove repository';
      return;
    }
    repoActionMessage.value = 'Repository removed';
  } finally {
    removingRepoId.value = null;
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface">
    <!-- Sticky Header with Material 3 Design -->
    <header class="sticky top-0 z-50 shadow-elevation-3">
      <div class="bg-gradient-to-r from-primary-900 via-primary-700 to-secondary-800 text-white">
        <div class="px-6 py-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-m3-xl bg-white/10 border border-white/20 shadow-elevation-2">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </div>
              <div>
                <h1 class="text-xl font-semibold tracking-tight">Context-Sync</h1>
                <p class="text-xs text-primary-100">Spec-driven development workspace</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                @click="openBuilderModal()"
                class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-m3-full bg-white/15 hover:bg-white/25 border border-white/20 transition-all hover:shadow-elevation-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                New Entity
              </button>
              <button
                @click="openAssistantPanel()"
                class="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-m3-full bg-white/15 hover:bg-white/25 border border-white/20 transition-all hover:shadow-elevation-2"
                title="Open AI Assistant"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Assistant
              </button>
              <button
                @click="toggleHeader"
                class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-m3-full bg-white/15 hover:bg-white/25 border border-white/20 transition-all hover:shadow-elevation-2"
                :aria-expanded="isHeaderExpanded"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="isHeaderExpanded ? 'M19 9l-7 7-7-7' : 'M5 9l7 7 7-7'" />
                </svg>
                <span>{{ isHeaderExpanded ? 'Hide overview' : 'Show overview' }}</span>
              </button>
            </div>
          </div>

          <Transition name="header-collapse">
            <div v-if="isHeaderExpanded" class="mt-5 space-y-5">
              <div class="grid gap-4 md:grid-cols-3">
                <div class="bg-surface-1/95 text-secondary-900 rounded-m3-lg border border-white/25 shadow-elevation-2 backdrop-blur-sm p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-xs font-semibold uppercase tracking-wide text-secondary-600">Repository</p>
                      <h2 class="text-base font-semibold text-secondary-900 truncate">{{ activeRepoMeta ? activeRepoMeta.label : 'No repository selected' }}</h2>
                      <p class="text-xs text-secondary-600 mt-1 truncate">{{ repoSummaryLine }}</p>
                    </div>
                    <button
                      class="px-3 py-1.5 text-xs font-semibold rounded-m3-full bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-elevation-1"
                      @click="openRepoManager"
                    >
                      Manage
                    </button>
                  </div>
                  <div class="mt-4 space-y-2">
                    <label class="text-xs font-medium text-secondary-600">Switch repository</label>
                    <select
                      class="w-full px-3 py-2 text-sm rounded-m3-md border border-surface-variant bg-surface-2 text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      :value="repoSelection"
                      :disabled="repoOptions.length === 0"
                      @change="handleRepoChange"
                    >
                      <option value="" disabled>Select repository</option>
                      <option
                        v-for="repo in repoOptions"
                        :key="repo.id"
                        :value="repo.id"
                      >
                        {{ repo.label }}
                      </option>
                    </select>
                  </div>
                  <p v-if="activeRepoMeta" class="text-[11px] text-secondary-500 mt-3">Last used {{ repoLastUsedDisplay }}</p>
                  <p v-else class="text-[11px] text-secondary-500 mt-3">{{ repoStatusHint }}</p>
                </div>

                <div class="bg-surface-1/95 text-secondary-900 rounded-m3-lg border border-white/25 shadow-elevation-2 backdrop-blur-sm p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-secondary-600">Quick Actions</p>
                      <h2 class="text-base font-semibold text-secondary-900">Stay in flow</h2>
                    </div>
                    <span class="px-2.5 py-1 text-xs font-semibold rounded-m3-full bg-primary-100 text-primary-700">
                      Entities {{ totalEntities }}
                    </span>
                  </div>
                  <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <button
                      @click="contextStore.setActiveEntity(null)"
                      class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Home
                    </button>
                    <button
                      @click="showGraphModal = true"
                      :disabled="!isRepoConfigured"
                      class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Graph
                    </button>
                    <button
                      @click="showGitModal = true"
                      :disabled="!isRepoConfigured"
                      class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      Git
                    </button>
                    <button
                      @click="runValidation"
                      :disabled="!isRepoConfigured"
                      class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6M5 7h14" />
                      </svg>
                      Validate
                    </button>
                    <button
                      @click="toggleLeftPanel"
                      class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all"
                      :title="leftPanelOpen ? 'Hide Context Tree' : 'Show Context Tree'"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Context
                    </button>
                    <button
                      @click="handleImpactAction()"
                      class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border transition-all"
                      :class="rightPanelOpen && isImpactView ? 'bg-primary-600 text-white border-primary-400 shadow-elevation-2' : 'border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1'"
                      :title="rightPanelOpen && isImpactView ? 'Hide Impact Panel' : 'Open Impact Panel'"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Impact
                    </button>
                    <button
                      @click="handleAssistantAction()"
                      class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border transition-all"
                      :class="rightPanelOpen && isAssistantView ? 'bg-primary-600 text-white border-primary-400 shadow-elevation-2' : 'border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1'"
                      :title="rightPanelOpen && isAssistantView ? 'Hide Assistant Panel' : 'Open Assistant Panel'"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Assistant
                    </button>
                  </div>
                </div>

                <div class="bg-surface-1/95 text-secondary-900 rounded-m3-lg border border-white/25 shadow-elevation-2 backdrop-blur-sm p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wide text-secondary-600">Workspace</p>
                      <h2 class="text-base font-semibold text-secondary-900">Focus overview</h2>
                    </div>
                    <span class="text-xs font-medium text-secondary-500">{{ isRepoConfigured ? 'Repo connected' : 'Setup required' }}</span>
                  </div>
                  <div class="mt-4 space-y-4">
                    <div class="rounded-m3-md bg-surface-3 border border-surface-variant px-3 py-2 shadow-elevation-1">
                      <p class="text-sm font-semibold text-secondary-900">{{ activeEntitySummary }}</p>
                      <p class="text-xs text-secondary-600 mt-1">{{ activeEntityDescription }}</p>
                    </div>
                    <button
                      @click="reloadGraph"
                      :disabled="!isRepoConfigured"
                      class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-md border border-surface-variant bg-surface-2 hover:bg-surface-3 hover:shadow-elevation-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v6h6M20 20v-6h-6M5 11a9 9 0 0114-6.708M19 13a9 9 0 01-14 6.708" />
                      </svg>
                      Refresh graph
                    </button>
                    <div class="text-xs text-secondary-600">{{ statusMessage }}</div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <div
      v-if="!isRepoConfigured"
      class="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm px-6 py-3 flex items-center gap-2"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z" />
      </svg>
      <span>{{ repoStatusHint }}</span>
    </div>

    <!-- Main content -->
    <main class="flex-1 flex overflow-hidden relative">
      <!-- Left Panel (Context Tree) -->
      <aside
        v-if="leftPanelOpen"
        :style="{ width: leftPanelWidth + 'px' }"
        class="bg-surface-1 border-r border-surface-variant shadow-elevation-1 relative flex-shrink-0"
      >
        <ContextTree />
        <!-- Resize handle -->
        <div
          @mousedown="startResizeLeft"
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary-300 transition-colors group"
        >
          <div class="absolute inset-y-0 right-0 w-1 bg-transparent group-hover:bg-primary-400"></div>
        </div>
      </aside>

      <!-- Center area with YAML Editor or Welcome -->
      <section class="flex-1 flex flex-col overflow-hidden min-w-0">
        <!-- Active Entity View -->
        <div v-if="activeEntity" class="h-full">
          <YamlEditor />
        </div>

        <!-- Welcome Documentation view when no entity selected -->
        <WelcomeDocumentation v-else />
      </section>

      <!-- Right Panel (Impact Analysis / AI Assistant) -->
      <aside
        v-if="rightPanelOpen"
        :style="{ width: rightPanelWidth + 'px' }"
        class="bg-surface-1 border-l border-surface-variant shadow-elevation-1 relative flex-shrink-0"
      >
        <div class="h-full flex flex-col">
          <div class="px-4 py-3 border-b border-surface-variant bg-surface-2 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button
                @click="openImpactPanel()"
                class="px-3 py-1.5 text-xs font-semibold rounded-m3-full transition-all"
                :class="isImpactView ? 'bg-primary-600 text-white shadow-elevation-1' : 'bg-surface-3 text-secondary-700 hover:bg-surface-4'"
              >Impact</button>
              <button
                @click="openAssistantPanel()"
                class="px-3 py-1.5 text-xs font-semibold rounded-m3-full transition-all"
                :class="isAssistantView ? 'bg-primary-600 text-white shadow-elevation-1' : 'bg-surface-3 text-secondary-700 hover:bg-surface-4'"
              >Assistant</button>
            </div>
            <span class="text-[11px] text-secondary-600" v-if="isAssistantView">Repository-aware guidance</span>
            <span class="text-[11px] text-secondary-600" v-else>Impact analysis tools</span>
          </div>
          <div class="flex-1 overflow-hidden">
            <ImpactPanel v-if="isImpactView" />
            <AIAssistantPanel v-else @open-settings="showAISettings = true" />
          </div>
        </div>
        <!-- Resize handle -->
        <div
          @mousedown="startResizeRight"
          class="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary-300 transition-colors group"
        >
          <div class="absolute inset-y-0 left-0 w-1 bg-transparent group-hover:bg-primary-400"></div>
        </div>
      </aside>
    </main>

    <!-- Git Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showGitModal"
          class="fixed inset-0 z-50 flex items-center justify-center"
          style="background-color: rgba(0, 0, 0, 0.5);"
          @click.self="showGitModal = false"
        >
          <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[600px] h-[80vh] flex flex-col overflow-hidden">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-surface-variant">
              <h2 class="text-xl font-semibold text-primary-700">Git Workflow</h2>
              <button
                @click="showGitModal = false"
                class="text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 p-2 rounded-m3-full transition-all"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Git Content -->
            <div class="flex-1 overflow-hidden">
              <GitPanel />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Graph Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showGraphModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          style="background-color: rgba(0, 0, 0, 0.5);"
          @click.self="showGraphModal = false"
        >
          <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[95vw] h-[90vh] flex flex-col overflow-hidden">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-surface-variant">
              <h2 class="text-xl font-semibold text-primary-700">Dependency Graph Visualization</h2>
              <button
                @click="showGraphModal = false"
                class="text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 p-2 rounded-m3-full transition-all"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- Graph Content -->
            <div class="flex-1 overflow-hidden">
              <GraphView />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    
    <!-- Context Builder Modal -->
    <ContextBuilderModal />
    <AISettingsModal v-if="showAISettings" @close="showAISettings = false" />

    <!-- Repo Manager Modal -->
    <Transition name="modal">
      <div
        v-if="showRepoManager"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background-color: rgba(0, 0, 0, 0.5);"
        @click.self="showRepoManager = false"
      >
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-surface-variant">
            <div>
              <h2 class="text-xl font-semibold text-primary-700">Manage Repositories</h2>
              <p class="text-xs text-secondary-600">Switch between or add context repositories.</p>
            </div>
            <button
              @click="showRepoManager = false"
              class="text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 p-2 rounded-m3-full transition-all"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div class="space-y-2">
              <h3 class="text-sm font-semibold text-secondary-700">Registered Repositories</h3>
              <div v-if="repoOptions.length === 0" class="text-xs text-secondary-500">
                No repositories registered yet.
              </div>
              <ul v-else class="space-y-2">
                <li
                  v-for="repo in repoOptions"
                  :key="repo.id"
                  class="border border-surface-variant rounded-m3-md px-3 py-2 flex items-center justify-between"
                >
                  <div class="min-w-0">
                    <div class="text-sm font-medium text-secondary-900 truncate">{{ repo.label }}</div>
                    <div class="text-xs text-secondary-500 truncate">{{ repo.path }}</div>
                    <div class="text-[11px] text-secondary-400">
                      Last used: {{ new Date(repo.lastUsed).toLocaleString() }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="text-xs px-2 py-1 rounded-m3-md border border-primary-500 text-primary-600 hover:bg-primary-50"
                      :disabled="contextStore.activeRepoId === repo.id"
                      @click="contextStore.selectActiveRepo(repo.id)"
                    >
                      Activate
                    </button>
                    <button
                      class="text-xs px-2 py-1 rounded-m3-md border border-error-300 text-error-600 hover:bg-error-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      :disabled="(contextStore.activeRepoId === repo.id && repoOptions.length <= 1) || removingRepoId === repo.id"
                      @click="handleRemoveRepo(repo.id)"
                    >
                      <span v-if="removingRepoId === repo.id" class="animate-pulse">Removing…</span>
                      <span v-else>Remove</span>
                    </button>
                  </div>
                </li>
              </ul>
            </div>

            <div class="pt-4 border-t border-surface-variant space-y-3">
              <h3 class="text-sm font-semibold text-secondary-700">Add Repository</h3>
              <div class="space-y-2">
                <label class="block text-xs text-secondary-600">Label</label>
                <input
                  v-model="newRepoLabel"
                  type="text"
                  class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-1"
                  placeholder="e.g. Main Context Repo"
                />
              </div>
              <div class="space-y-2">
                <label class="block text-xs text-secondary-600">Path</label>
                <input
                  v-model="newRepoPath"
                  type="text"
                  class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary bg-surface-1"
                  placeholder="C:\\path\\to\\context-repo"
                />
              </div>
              <button
                class="w-full px-4 py-2.5 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
                :disabled="isSavingRepo"
                @click="handleAddRepo"
              >
                <span v-if="isSavingRepo" class="animate-pulse">Saving…</span>
                <span v-else>Add Repository</span>
              </button>
              <div v-if="repoFormError" class="text-xs text-error-600">{{ repoFormError }}</div>
              <div v-else-if="repoActionMessage" class="text-xs text-primary-600">{{ repoActionMessage }}</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.header-collapse-enter-active,
.header-collapse-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.header-collapse-enter-from,
.header-collapse-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
