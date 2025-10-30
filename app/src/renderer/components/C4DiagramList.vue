<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useContextStore } from '../stores/contextStore';

interface C4Diagram {
  id: string;
  file: string;
  title: string;
  content: string;
  system?: string;
  level?: string;
  feature?: string;
  projection?: any;
  _type: 'c4diagram';
}

const contextStore = useContextStore();

const diagrams = ref<C4Diagram[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const newDiagramTitle = ref('');
const showNewDiagramForm = ref(false);

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
      diagrams.value = result.diagrams.map((d: any) => ({
        ...d,
        id: d.file.replace('.md', ''),
        _type: 'c4diagram'
      }));
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
  contextStore.setActiveEntity(diagram);
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

onMounted(() => {
  if (hasRepo.value) {
    loadDiagrams();
  }
});
</script>

<template>
  <div class="h-full flex flex-col bg-surface-1">
    <!-- Header -->
    <div class="p-4 border-b border-surface-variant bg-surface-2 flex-shrink-0">
      <h2 class="text-lg font-semibold mb-3 text-primary-700">C4 Architecture</h2>
      
      <!-- Stats -->
      <div class="text-xs text-secondary-600">
        {{ diagrams.length }} {{ diagrams.length === 1 ? 'diagram' : 'diagrams' }}
      </div>
    </div>

    <!-- Empty/Error States -->
    <div v-if="!hasRepo" class="p-4 text-sm text-secondary-600">
      <div class="text-center py-8">
        <svg class="w-12 h-12 mx-auto mb-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h5l2 2h5a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        <p>Configure a repository to manage C4 diagrams.</p>
      </div>
    </div>

    <div v-else-if="isLoading" class="p-4 text-sm text-secondary-600">
      <div class="text-center py-8">
        <svg class="animate-spin h-8 w-8 text-primary-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading diagrams...</p>
      </div>
    </div>

    <div v-else-if="error && diagrams.length === 0" class="p-4 text-sm text-error-600">
      <div class="text-center py-8">
        <svg class="w-12 h-12 mx-auto mb-3 text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z" />
        </svg>
        <p>{{ error }}</p>
      </div>
    </div>

    <div v-else-if="diagrams.length === 0" class="p-4 text-sm text-secondary-600">
      <div class="text-center py-8">
        <svg class="w-12 h-12 mx-auto mb-3 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="mb-2">No C4 diagrams found.</p>
        <p class="text-xs">Create your first diagram to get started.</p>
      </div>
    </div>

    <!-- Diagram List -->
    <div v-else class="flex-1 overflow-y-auto">
      <ul class="divide-y divide-surface-variant">
        <li
          v-for="diagram in diagrams"
          :key="diagram.id"
          @click="selectDiagram(diagram)"
          class="px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors group"
          :class="{ 'bg-primary-50 border-l-4 border-primary': contextStore.activeEntity?.id === diagram.id }"
        >
          <div class="flex items-start gap-3">
            <div class="p-2 rounded-m3-md bg-primary-50 text-primary-700 flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium text-secondary-900 truncate group-hover:text-primary-700">
                {{ diagram.title }}
              </h3>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-if="diagram.system" class="text-[10px] px-1.5 py-0.5 rounded-m3-md bg-surface-3 text-secondary-600">
                  {{ diagram.system }}
                </span>
                <span v-if="diagram.level" class="text-[10px] px-1.5 py-0.5 rounded-m3-md bg-primary-100 text-primary-700 font-medium">
                  {{ diagram.level }}
                </span>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Footer actions -->
    <div class="p-4 border-t border-surface-variant bg-surface-2 space-y-2">
      <button
        v-if="!showNewDiagramForm"
        @click="createNewDiagram"
        :disabled="!hasRepo"
        class="w-full px-4 py-2.5 text-sm bg-primary text-white rounded-m3-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium flex items-center justify-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Diagram
      </button>
      
      <!-- New Diagram Form -->
      <div v-if="showNewDiagramForm" class="space-y-2">
        <input
          v-model="newDiagramTitle"
          type="text"
          placeholder="Diagram title..."
          class="w-full px-3 py-2 text-sm border border-surface-variant rounded-m3-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          @keyup.enter="handleCreateDiagram"
          @keyup.escape="cancelNewDiagram"
          autofocus
        />
        <div class="flex gap-2">
          <button
            @click="handleCreateDiagram"
            :disabled="!newDiagramTitle.trim()"
            class="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-m3-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Create
          </button>
          <button
            @click="cancelNewDiagram"
            class="flex-1 px-3 py-1.5 text-xs font-medium bg-surface-3 text-secondary-700 rounded-m3-md hover:bg-surface-4 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
      
      <button
        @click="loadDiagrams"
        :disabled="!hasRepo || isLoading"
        class="w-full px-4 py-2.5 text-sm bg-surface-3 text-secondary-900 rounded-m3-md hover:bg-surface-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
      >
        {{ isLoading ? 'Loading...' : 'Refresh' }}
      </button>
    </div>
  </div>
</template>
