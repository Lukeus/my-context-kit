<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import ContextTree from './components/ContextTree.vue';
import YamlEditor from './components/YamlEditor.vue';
import ImpactPanel from './components/ImpactPanel.vue';
import GraphView from './components/GraphView.vue';
import GitPanel from './components/GitPanel.vue';
import WelcomeDocumentation from './components/WelcomeDocumentation.vue';
import ContextBuilderModal from './components/ContextBuilderModal.vue';
import AISettingsModal from './components/AISettingsModal.vue';
import AIAssistantModal from './components/AIAssistantModal.vue';
import { useContextStore } from './stores/contextStore';
import { useImpactStore } from './stores/impactStore';
import { useBuilderStore } from './stores/builderStore';

const contextStore = useContextStore();
const impactStore = useImpactStore();
const builderStore = useBuilderStore();

const statusMessage = ref('Ready');
const showGraphModal = ref(false);
const showGitModal = ref(false);
const showAIAssistant = ref(false);
const showAISettings = ref(false);

// Panel state
const leftPanelOpen = ref(true);
const rightPanelOpen = ref(true);
const leftPanelWidth = ref(256); // 64 * 4 = 256px (w-64)
const rightPanelWidth = ref(320); // 80 * 4 = 320px (w-80)

const isResizingLeft = ref(false);
const isResizingRight = ref(false);

const activeEntity = computed(() => contextStore.activeEntity);

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
  
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', stopResize);
  window.addEventListener('keydown', handleKeyboard);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', stopResize);
  window.removeEventListener('keydown', handleKeyboard);
});

const testValidation = async () => {
  statusMessage.value = 'Validating...';
  const result = await contextStore.validateRepo();
  statusMessage.value = result.ok ? 'Validation passed ✓' : `Validation failed: ${result.error || 'Unknown error'}`;
};

function toggleLeftPanel() {
  leftPanelOpen.value = !leftPanelOpen.value;
}

function toggleRightPanel() {
  rightPanelOpen.value = !rightPanelOpen.value;
}
</script>

<template>
  <div class="flex flex-col h-full bg-surface">
    <!-- Sticky Header with Material 3 Design -->
    <header class="sticky top-0 z-50 bg-primary text-white shadow-elevation-3">
      <div class="px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">Context-Sync</h1>
            <p class="text-sm text-primary-100">Spec-driven development context manager</p>
          </div>
        </div>
        <div class="flex gap-2.5">
          <!-- Left Panel Toggle -->
          <button
            @click="toggleLeftPanel"
            class="p-2.5 bg-primary-700 hover:bg-primary-600 active:bg-primary-800 rounded-m3-lg transition-all shadow-elevation-2 hover:shadow-elevation-3 border border-primary-600 hover:border-primary-500"
            :title="leftPanelOpen ? 'Hide Context Tree' : 'Show Context Tree'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <button
            @click="contextStore.setActiveEntity(null)"
            class="px-4 py-2.5 bg-primary-700 hover:bg-primary-600 active:bg-primary-800 rounded-m3-lg transition-all shadow-elevation-2 hover:shadow-elevation-3 flex items-center gap-2 font-medium border border-primary-600 hover:border-primary-500"
            title="Return to Welcome Page"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>
          <button
            @click="showGitModal = true"
            class="px-4 py-2.5 bg-primary-700 hover:bg-primary-600 active:bg-primary-800 rounded-m3-lg transition-all shadow-elevation-2 hover:shadow-elevation-3 flex items-center gap-2 font-medium border border-primary-600 hover:border-primary-500"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Git
          </button>
          <button
            @click="showGraphModal = true"
            class="px-4 py-2.5 bg-primary-700 hover:bg-primary-600 active:bg-primary-800 rounded-m3-lg transition-all shadow-elevation-2 hover:shadow-elevation-3 flex items-center gap-2 font-medium border border-primary-600 hover:border-primary-500"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Graph
          </button>
          <button
            @click="showAIAssistant = true"
            class="px-4 py-2.5 bg-primary-700 hover:bg-primary-600 active:bg-primary-800 rounded-m3-lg transition-all shadow-elevation-2 hover:shadow-elevation-3 flex items-center gap-2 font-medium border border-primary-600 hover:border-primary-500"
            title="AI Assistant"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI
          </button>
          
          <!-- Right Panel Toggle -->
          <button
            @click="toggleRightPanel"
            class="p-2.5 bg-primary-700 hover:bg-primary-600 active:bg-primary-800 rounded-m3-lg transition-all shadow-elevation-2 hover:shadow-elevation-3 border border-primary-600 hover:border-primary-500"
            :title="rightPanelOpen ? 'Hide Impact Panel' : 'Show Impact Panel'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </div>
    </header>

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

      <!-- Right Panel (Impact Analysis) -->
      <aside
        v-if="rightPanelOpen"
        :style="{ width: rightPanelWidth + 'px' }"
        class="bg-surface-1 border-l border-surface-variant shadow-elevation-1 relative flex-shrink-0"
      >
        <ImpactPanel />
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
    <AIAssistantModal
      :show="showAIAssistant"
      @close="showAIAssistant = false"
      @open-settings="showAISettings = true"
    />
    <AISettingsModal v-if="showAISettings" @close="showAISettings = false" />
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
</style>
