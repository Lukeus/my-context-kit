<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { oneDark } from '@codemirror/theme-one-dark';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

// Local state
const editorContainer = ref<HTMLElement | null>(null);
const editorView = ref<EditorView | null>(null);
const isDirty = ref(false);
const isSaving = ref(false);
const saveMessage = ref('');
const validationErrors = ref<any[]>([]);
const filePath = ref<string | null>(null);

const hasValidationErrors = computed(() => validationErrors.value.length > 0);

// Methods
async function resolveFilePath() {
  if (!contextStore.activeEntity || !contextStore.repoPath) {
    filePath.value = null;
    return;
  }

  const result = await window.api.fs.findEntityFile(
    contextStore.repoPath,
    contextStore.activeEntity._type,
    contextStore.activeEntity.id
  );

  if (result.ok && result.filePath) {
    filePath.value = result.filePath;
  } else {
    filePath.value = null;
    saveMessage.value = result.error || 'File not found';
  }
}

async function loadFile() {
  await resolveFilePath();
  
  if (!filePath.value) {
    editorView.value?.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: '' }
    });
    return;
  }

  try {
    const result = await window.api.fs.readFile(filePath.value);
    
    if (result.ok && result.content !== undefined) {
      editorView.value?.dispatch({
        changes: { from: 0, to: editorView.value.state.doc.length, insert: result.content }
      });
      isDirty.value = false;
      saveMessage.value = '';
      validationErrors.value = [];
    } else {
      saveMessage.value = `Error loading file: ${result.error}`;
    }
  } catch (error: any) {
    saveMessage.value = `Error: ${error.message}`;
  }
}

async function saveFile() {
  if (!filePath.value || !editorView.value) return;
  
  isSaving.value = true;
  saveMessage.value = 'Saving...';
  
  try {
    const content = editorView.value.state.doc.toString();
    const writeResult = await window.api.fs.writeFile(filePath.value, content);
    
    if (!writeResult.ok) {
      saveMessage.value = `Save failed: ${writeResult.error}`;
      return;
    }
    
    // Trigger validation after save
    saveMessage.value = 'Validating...';
    const validateResult = await contextStore.validateRepo();
    
    if (validateResult.ok) {
      isDirty.value = false;
      saveMessage.value = 'Saved ✓';
      validationErrors.value = [];
      
      // Reload graph to reflect changes
      await contextStore.loadGraph();
    } else {
      saveMessage.value = 'Saved but validation failed';
      
      // Parse validation errors for this file
      if (validateResult.errors) {
        validationErrors.value = validateResult.errors.filter((err: any) => 
          err.file && err.file.includes(contextStore.activeEntity?.id || '')
        );
      }
    }
  } catch (error: any) {
    saveMessage.value = `Error: ${error.message}`;
  } finally {
    isSaving.value = false;
    
    // Clear message after 3 seconds
    setTimeout(() => {
      if (saveMessage.value !== 'Saving...' && saveMessage.value !== 'Validating...') {
        saveMessage.value = '';
      }
    }, 3000);
  }
}

function initEditor() {
  if (!editorContainer.value) return;
  
  editorView.value = new EditorView({
    extensions: [
      basicSetup,
      yaml(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isDirty.value = true;
        }
      })
    ],
    parent: editorContainer.value,
  });
  
  loadFile();
}

function destroyEditor() {
  if (editorView.value) {
    editorView.value.destroy();
    editorView.value = null;
  }
}

// Watch for entity changes
watch(() => contextStore.activeEntityId, () => {
  loadFile();
});

// Watch for graph updates (e.g., after AI edits are applied)
watch(() => contextStore.graph, () => {
  // Only reload if the editor is not dirty (user hasn't made local changes)
  if (!isDirty.value && contextStore.activeEntityId) {
    loadFile();
  }
}, { deep: true });

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveFile();
  }
}

// Lifecycle
onMounted(() => {
  initEditor();
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  destroyEditor();
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface-variant bg-surface-2 shadow-elevation-1">
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold text-primary-700">YAML Editor</h3>
        <span v-if="filePath" class="text-xs text-secondary-600 font-mono truncate max-w-md">
          {{ filePath }}
        </span>
      </div>
      
      <div class="flex items-center gap-3">
        <span v-if="isDirty" class="text-xs text-tertiary-700 font-medium flex items-center gap-1">
          <span class="w-2 h-2 bg-tertiary-500 rounded-full"></span>
          Unsaved
        </span>
        <span v-if="saveMessage" class="text-xs text-secondary-700">{{ saveMessage }}</span>
        
        <button
          @click="saveFile"
          :disabled="!isDirty || isSaving || !filePath"
          class="px-4 py-2 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-elevation-1 hover:shadow-elevation-2 transition-all font-medium"
        >
          {{ isSaving ? 'Saving...' : 'Save (Ctrl+S)' }}
        </button>
      </div>
    </div>
    
    <!-- Validation Errors Panel -->
    <div v-if="hasValidationErrors" class="px-4 py-3 bg-error-50 border-b border-error-200">
      <h4 class="text-sm font-semibold text-error-900 mb-2">Validation Errors:</h4>
      <div class="space-y-1 max-h-24 overflow-y-auto">
        <div
          v-for="(error, idx) in validationErrors"
          :key="idx"
          class="text-xs text-error-800 font-mono"
        >
          {{ error.message || JSON.stringify(error) }}
        </div>
      </div>
    </div>
    
    <!-- CodeMirror Container -->
    <div ref="editorContainer" class="flex-1 overflow-auto"></div>
    
    <!-- Status Bar -->
    <div class="flex items-center justify-between px-4 py-2 border-t border-surface-variant bg-surface-2 text-xs text-secondary-700">
      <span v-if="contextStore.activeEntity">
        Editing: <span class="font-mono text-primary-700">{{ contextStore.activeEntity.id }}</span>
      </span>
      <span v-else class="text-secondary-500">
        No file loaded
      </span>
      <span class="text-secondary-500">YAML Mode</span>
    </div>
  </div>
</template>

<style>
/* CodeMirror container fills available space */
.cm-editor {
  height: 100%;
}

.cm-scroller {
  overflow: auto;
}
</style>
