<script setup lang="ts">
import { ref, computed, onMounted, watch, Suspense } from 'vue';
import { useContextStore } from '../stores/contextStore';
import C4DiagramRenderer from './C4DiagramRenderer.vue';

interface C4Diagram {
  file: string;
  title: string;
  content: string;
  system?: string;
  level?: string;
  feature?: string;
  projection?: any;
}

const contextStore = useContextStore();

const diagrams = ref<C4Diagram[]>([]);
const selectedDiagram = ref<C4Diagram | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const showEditor = ref(false);
const editorContent = ref('');
const newDiagramTitle = ref('');
const showNewDiagramForm = ref(false);

// Tab state for selected diagram
const activeTab = ref<'preview' | 'editor' | 'analysis'>('preview');

const hasRepo = computed(() => Boolean(contextStore.repoPath));

async function loadDiagrams() {
  if (!contextStore.repoPath) {
    error.value = 'No repository configured';
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    const result = await window.api.c4.loadDiagrams(contextStore.repoPath);
    
    if (result.success && result.diagrams) {
      diagrams.value = result.diagrams;
      if (diagrams.value.length > 0 && !selectedDiagram.value) {
        selectDiagram(diagrams.value[0]);
      }
    } else {
      error.value = result.error || 'Failed to load diagrams';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load diagrams';
  } finally {
    isLoading.value = false;
  }
}

function selectDiagram(diagram: C4Diagram) {
  selectedDiagram.value = diagram;
  editorContent.value = diagram.content;
  showEditor.value = false;
  activeTab.value = 'preview';
}

function openEditor() {
  if (selectedDiagram.value) {
    editorContent.value = selectedDiagram.value.content;
    activeTab.value = 'editor';
  }
}

async function saveDiagram() {
  if (!selectedDiagram.value || !contextStore.repoPath) return;

  try {
    const filePath = `${contextStore.repoPath}/c4/${selectedDiagram.value.file}`;
    await window.api.files.write(filePath, editorContent.value);
    
    // Update the diagram content
    selectedDiagram.value.content = editorContent.value;
    
    // Reload diagrams
    await loadDiagrams();
    
    activeTab.value = 'preview';
  } catch (err: any) {
    error.value = err.message || 'Failed to save diagram';
  }
}

function cancelEdit() {
  if (selectedDiagram.value) {
    editorContent.value = selectedDiagram.value.content;
  }
  activeTab.value = 'preview';
}

function createNewDiagram() {
  showNewDiagramForm.value = true;
  newDiagramTitle.value = '';
}

async function handleCreateDiagram() {
  if (!newDiagramTitle.value.trim() || !contextStore.repoPath) return;

  const fileName = newDiagramTitle.value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const template = `%%c4: system=NewSystem level=C2

\`\`\`mermaid
C4Context
  title ${newDiagramTitle.value}
  
  Person(user, "User", "System user")
  System(system, "System", "Main system")
  
  Rel(user, system, "Uses")
\`\`\`
`;

  try {
    const filePath = `${contextStore.repoPath}/c4/${fileName}.md`;
    await window.api.files.write(filePath, template);
    
    await loadDiagrams();
    showNewDiagramForm.value = false;
    newDiagramTitle.value = '';
  } catch (err: any) {
    error.value = err.message || 'Failed to create diagram';
  }
}

function cancelNewDiagram() {
  showNewDiagramForm.value = false;
  newDiagramTitle.value = '';
}

async function analyzeDiagram() {
  if (!selectedDiagram.value || !contextStore.repoPath) return;

  try {
    const filePath = `${contextStore.repoPath}/c4/${selectedDiagram.value.file}`;
    const result = await window.api.c4.analyze(filePath);
    
    if (result.success) {
      activeTab.value = 'analysis';
    } else {
      error.value = result.error || 'Analysis failed';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to analyze diagram';
  }
}

// Watch for active entity changes from the LeftPanelContainer
watch(() => contextStore.activeEntity, (entity) => {
  if (entity && entity._type === 'c4diagram') {
    const diagram = diagrams.value.find(d => d.id === entity.id);
    if (diagram) {
      selectDiagram(diagram);
    }
  }
});

onMounted(() => {
  if (hasRepo.value) {
    loadDiagrams();
  }
  
  // If there's already an active C4 diagram, select it
  if (contextStore.activeEntity && contextStore.activeEntity._type === 'c4diagram') {
    const diagram = diagrams.value.find(d => d.id === contextStore.activeEntity!.id);
    if (diagram) {
      selectDiagram(diagram);
    }
  }
});
</script>

<template>
  <div class="h-full flex flex-col bg-gradient-to-br from-surface via-surface-1 to-surface-2">
    <!-- Main content: Diagram viewer/editor -->
    <div class="flex-1 flex flex-col">
      <div v-if="!selectedDiagram" class="flex-1 flex items-center justify-center text-secondary-500">
        <div class="text-center max-w-md">
          <svg class="w-24 h-24 mx-auto mb-4 text-secondary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <h3 class="text-xl font-semibold mb-2">No diagram selected</h3>
          <p class="text-sm">Select a diagram from the list or create a new one to get started.</p>
        </div>
      </div>

      <div v-else class="flex-1 flex flex-col">
        <!-- Diagram header -->
        <div class="p-6 border-b border-surface-variant bg-surface-1">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h1 class="text-2xl font-bold text-secondary-900">{{ selectedDiagram.title }}</h1>
              <p class="text-sm text-secondary-600 mt-1">{{ selectedDiagram.file }}</p>
            </div>
            <button
              @click="loadDiagrams"
              class="px-3 py-1.5 rounded-m3-md text-xs font-semibold border border-secondary-200 text-secondary-700 hover:bg-secondary-50">
              Refresh
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex gap-2">
            <button
              @click="activeTab = 'preview'"
              class="px-4 py-2 text-sm font-semibold rounded-m3-md transition-all"
              :class="activeTab === 'preview' ? 'bg-primary-100 text-primary-800 shadow-elevation-1' : 'text-secondary-700 hover:bg-surface-2'">
              Preview
            </button>
            <button
              @click="openEditor"
              class="px-4 py-2 text-sm font-semibold rounded-m3-md transition-all"
              :class="activeTab === 'editor' ? 'bg-primary-100 text-primary-800 shadow-elevation-1' : 'text-secondary-700 hover:bg-surface-2'">
              Editor
            </button>
            <button
              @click="analyzeDiagram"
              class="px-4 py-2 text-sm font-semibold rounded-m3-md transition-all"
              :class="activeTab === 'analysis' ? 'bg-primary-100 text-primary-800 shadow-elevation-1' : 'text-secondary-700 hover:bg-surface-2'">
              Analysis
            </button>
          </div>
        </div>

        <!-- Tab content -->
        <div class="flex-1 overflow-auto">
          <!-- Preview tab -->
          <div v-if="activeTab === 'preview'" class="p-6">
            <Suspense>
              <C4DiagramRenderer :content="selectedDiagram.content" />
              <template #fallback>
                <div class="flex items-center justify-center p-12">
                  <p class="text-secondary-500">Loading diagram renderer...</p>
                </div>
              </template>
            </Suspense>
          </div>

          <!-- Editor tab -->
          <div v-else-if="activeTab === 'editor'" class="h-full flex flex-col">
            <div class="flex-1 p-6">
              <textarea
                v-model="editorContent"
                class="w-full h-full p-4 font-mono text-sm border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface resize-none"
                placeholder="Enter Mermaid C4 diagram syntax..."></textarea>
            </div>
            <div class="p-4 border-t border-surface-variant bg-surface-2 flex gap-3 justify-end">
              <button
                @click="cancelEdit"
                class="px-4 py-2 rounded-m3-md text-sm font-semibold border border-surface-variant text-secondary-700 hover:bg-surface transition-colors">
                Cancel
              </button>
              <button
                @click="saveDiagram"
                class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-elevation-2 transition-all">
                Save Changes
              </button>
            </div>
          </div>

          <!-- Analysis tab -->
          <div v-else-if="activeTab === 'analysis'" class="p-6">
            <div class="max-w-4xl">
              <h3 class="text-lg font-semibold text-secondary-900 mb-4">Diagram Analysis</h3>
              <p class="text-sm text-secondary-600">Analysis results will appear here. Use the C4 analyzer service to extract nodes, relationships, and validation insights.</p>
              
              <div class="mt-6 p-4 rounded-m3-md border border-surface-variant bg-surface-1">
                <p class="text-xs text-secondary-500">The analysis feature uses the C4AnalyzerService to parse diagram metadata, nodes, relationships, and infer capabilities. Results include validation for scaffolding readiness.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New diagram modal -->
    <div
      v-if="showNewDiagramForm"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="cancelNewDiagram">
      <div class="bg-surface rounded-m3-md shadow-elevation-5 p-6 w-full max-w-md">
        <h2 class="text-xl font-bold text-secondary-900 mb-4">Create New C4 Diagram</h2>
        
        <div class="mb-4">
          <label class="block text-sm font-semibold text-secondary-700 mb-2">Diagram Title</label>
          <input
            v-model="newDiagramTitle"
            type="text"
            placeholder="e.g., System Context"
            class="w-full px-4 py-2 border border-surface-variant rounded-m3-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface"
            @keyup.enter="handleCreateDiagram" />
        </div>

        <p class="text-xs text-secondary-500 mb-4">
          A new markdown file will be created in the <code class="px-1 py-0.5 bg-surface-2 rounded-m3-md">c4/</code> directory with a Mermaid C4 diagram template.
        </p>

        <div class="flex gap-3 justify-end">
          <button
            @click="cancelNewDiagram"
            class="px-4 py-2 rounded-m3-md text-sm font-semibold border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors">
            Cancel
          </button>
          <button
            @click="handleCreateDiagram"
            :disabled="!newDiagramTitle.trim()"
            class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-elevation-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            Create Diagram
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
