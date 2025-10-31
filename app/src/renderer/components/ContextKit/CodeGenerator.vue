<script setup lang="ts">
import { ref, computed } from 'vue';
import { useContextKitStore, type CodeArtifact } from '@/stores/contextKitStore';
import ErrorAlert from './ErrorAlert.vue';
import OperationProgress from './OperationProgress.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'close': [];
}>();

const contextKitStore = useContextKitStore();

const selectedSpecId = ref<string>('');
const targetLanguage = ref<string>('typescript');
const targetFramework = ref<string>('');
const isGenerating = ref(false);
const generatedArtifacts = ref<CodeArtifact[]>([]);
const expandedFiles = ref<Set<string>>(new Set());

const availableSpecs = computed(() => {
  return Array.from(contextKitStore.generatedSpecs.entries()).map(([id, spec]) => ({
    id,
    label: spec.spec_id,
    title: spec.title || 'Untitled',
  }));
});

const languageOptions = [
  { value: 'typescript', label: 'TypeScript', icon: 'TS' },
  { value: 'python', label: 'Python', icon: 'PY' },
  { value: 'go', label: 'Go', icon: 'GO' },
  { value: 'rust', label: 'Rust', icon: 'RS' },
  { value: 'java', label: 'Java', icon: 'JV' },
];

const frameworksByLanguage: Record<string, string[]> = {
  typescript: ['React', 'Vue', 'Angular', 'Express', 'NestJS', 'Next.js'],
  python: ['FastAPI', 'Django', 'Flask', 'Pytest'],
  go: ['Gin', 'Echo', 'Fiber'],
  rust: ['Actix', 'Rocket', 'Axum'],
  java: ['Spring Boot', 'Quarkus', 'Micronaut'],
};

const availableFrameworks = computed(() => {
  return frameworksByLanguage[targetLanguage.value] || [];
});

const artifactTree = computed(() => {
  // Build a tree structure from flat artifact list
  const tree: Record<string, CodeArtifact[]> = {};
  
  generatedArtifacts.value.forEach(artifact => {
    const dir = artifact.path.split('/').slice(0, -1).join('/') || 'root';
    if (!tree[dir]) {
      tree[dir] = [];
    }
    tree[dir].push(artifact);
  });
  
  return tree;
});

const totalFiles = computed(() => generatedArtifacts.value.length);
const totalLines = computed(() => {
  return generatedArtifacts.value.reduce((sum, artifact) => {
    return sum + (artifact.content?.split('\n').length || 0);
  }, 0);
});

async function generateCode() {
  if (!selectedSpecId.value || !targetLanguage.value) return;

  isGenerating.value = true;
  try {
    const result = await contextKitStore.generateCode(
      selectedSpecId.value,
      targetLanguage.value,
      targetFramework.value || undefined
    );
    
    if (result) {
      generatedArtifacts.value = result.artifacts;
    }
  } finally {
    isGenerating.value = false;
  }
}

function toggleFileExpansion(path: string) {
  if (expandedFiles.value.has(path)) {
    expandedFiles.value.delete(path);
  } else {
    expandedFiles.value.add(path);
  }
}

function downloadArtifact(artifact: CodeArtifact) {
  const blob = new Blob([artifact.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = artifact.path.split('/').pop() || 'file.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAll() {
  generatedArtifacts.value.forEach(artifact => {
    downloadArtifact(artifact);
  });
}

function copyArtifactContent(artifact: CodeArtifact) {
  navigator.clipboard.writeText(artifact.content);
}

function handleClose() {
  // Reset state
  selectedSpecId.value = '';
  targetLanguage.value = 'typescript';
  targetFramework.value = '';
  generatedArtifacts.value = [];
  expandedFiles.value.clear();
  
  emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 bg-green-700 text-white">
          <div>
            <h2 class="text-xl font-semibold">Code Generator</h2>
            <p class="text-sm text-white/80">Generate production-ready code from specifications</p>
          </div>
          <button
            @click="handleClose"
            class="text-white hover:bg-white/10 rounded-m3-full p-2 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Configuration Panel (when not generated) -->
        <div v-if="generatedArtifacts.length === 0" class="flex-1 overflow-y-auto px-6 py-6">
          <div class="max-w-3xl mx-auto space-y-6">
            <div>
              <h3 class="text-lg font-semibold text-secondary-900">Configuration</h3>
              <p class="text-sm text-secondary-600 mt-1">
                Configure code generation parameters
              </p>
            </div>

            <div class="p-6 rounded-m3-lg bg-surface-1 border border-surface-variant space-y-6">
              <!-- Spec Selection -->
              <div>
                <label class="block text-sm font-medium text-secondary-700 mb-3">
                  Select Specification
                </label>
                <select
                  v-model="selectedSpecId"
                  class="w-full px-4 py-3 rounded-m3-md border border-surface-variant bg-surface text-secondary-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  :disabled="isGenerating"
                >
                  <option value="">Choose a spec...</option>
                  <option 
                    v-for="spec in availableSpecs" 
                    :key="spec.id" 
                    :value="spec.id"
                  >
                    {{ spec.label }} - {{ spec.title }}
                  </option>
                </select>
              </div>

              <!-- Language Selection -->
              <div>
                <label class="block text-sm font-medium text-secondary-700 mb-3">
                  Target Language
                </label>
                <div class="grid gap-3 sm:grid-cols-5">
                  <button
                    v-for="lang in languageOptions"
                    :key="lang.value"
                    @click="targetLanguage = lang.value; targetFramework = ''"
                    :disabled="isGenerating"
                    class="flex flex-col items-center p-3 rounded-m3-lg border transition-all disabled:opacity-50"
                    :class="targetLanguage === lang.value
                      ? 'bg-green-50 border-green-600 shadow-elevation-1'
                      : 'bg-surface-2 border-surface-variant hover:bg-surface-3'"
                  >
                    <div 
                      class="w-10 h-10 rounded-m3-md flex items-center justify-center mb-2 text-xs font-bold"
                      :class="targetLanguage === lang.value ? 'bg-green-600 text-white' : 'bg-surface-3 text-secondary-600'"
                    >
                      {{ lang.icon }}
                    </div>
                    <span 
                      class="text-xs font-semibold"
                      :class="targetLanguage === lang.value ? 'text-green-900' : 'text-secondary-700'"
                    >
                      {{ lang.label }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Framework Selection -->
              <div v-if="availableFrameworks.length > 0">
                <label class="block text-sm font-medium text-secondary-700 mb-3">
                  Framework (Optional)
                </label>
                <select
                  v-model="targetFramework"
                  class="w-full px-4 py-3 rounded-m3-md border border-surface-variant bg-surface text-secondary-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  :disabled="isGenerating"
                >
                  <option value="">None / Generic</option>
                  <option 
                    v-for="framework in availableFrameworks" 
                    :key="framework" 
                    :value="framework"
                  >
                    {{ framework }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Generate Button -->
            <div class="flex justify-center">
              <button
                @click="generateCode"
                :disabled="!selectedSpecId || !targetLanguage || isGenerating"
                class="px-6 py-3 rounded-m3-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ isGenerating ? 'Generating Code...' : 'Generate Code' }}
              </button>
            </div>

            <!-- Progress Display -->
            <OperationProgress :operation="contextKitStore.currentOperation" />

            <!-- Error Display -->
            <ErrorAlert 
              :error="contextKitStore.lastError"
              @dismiss="contextKitStore.clearError()"
            />
          </div>
        </div>

        <!-- Results Panel (when generated) -->
        <div v-else class="flex-1 flex flex-col overflow-hidden">
          <!-- Stats Bar -->
          <div class="px-6 py-4 bg-surface-1 border-b border-surface-variant">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-6">
                <div>
                  <p class="text-xs text-secondary-600">Files Generated</p>
                  <p class="text-lg font-bold text-secondary-900">{{ totalFiles }}</p>
                </div>
                <div>
                  <p class="text-xs text-secondary-600">Total Lines</p>
                  <p class="text-lg font-bold text-secondary-900">{{ totalLines }}</p>
                </div>
                <div>
                  <p class="text-xs text-secondary-600">Language</p>
                  <p class="text-sm font-semibold text-secondary-900 capitalize">{{ targetLanguage }}</p>
                </div>
                <div v-if="targetFramework">
                  <p class="text-xs text-secondary-600">Framework</p>
                  <p class="text-sm font-semibold text-secondary-900">{{ targetFramework }}</p>
                </div>
              </div>
              <button
                @click="downloadAll"
                class="px-4 py-2 rounded-m3-md bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
              >
                <svg class="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download All
              </button>
            </div>
          </div>

          <!-- Artifact Tree -->
          <div class="flex-1 overflow-y-auto px-6 py-6">
            <div class="space-y-6">
              <div v-for="(artifacts, dir) in artifactTree" :key="dir" class="space-y-2">
                <h4 class="text-sm font-semibold text-secondary-700 uppercase tracking-wide">
                  {{ dir === 'root' ? 'Root Directory' : dir }}
                </h4>
                
                <div
                  v-for="artifact in artifacts"
                  :key="artifact.path"
                  class="rounded-m3-md border border-surface-variant bg-surface-1 overflow-hidden"
                >
                  <!-- File Header -->
                  <div 
                    class="flex items-center justify-between px-4 py-3 bg-surface-2 cursor-pointer hover:bg-surface-3 transition-colors"
                    @click="toggleFileExpansion(artifact.path)"
                  >
                    <div class="flex items-center gap-3">
                      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p class="text-sm font-semibold text-secondary-900 font-mono">
                          {{ artifact.path.split('/').pop() }}
                        </p>
                        <p class="text-xs text-secondary-600">
                          {{ artifact.content.split('\n').length }} lines
                        </p>
                      </div>
                    </div>
                    
                    <div class="flex items-center gap-2">
                      <button
                        @click.stop="copyArtifactContent(artifact)"
                        class="px-3 py-1.5 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface text-xs font-medium transition-colors"
                        title="Copy content"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        @click.stop="downloadArtifact(artifact)"
                        class="px-3 py-1.5 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface text-xs font-medium transition-colors"
                        title="Download file"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <svg 
                        class="w-5 h-5 text-secondary-600 transition-transform"
                        :class="expandedFiles.has(artifact.path) ? 'rotate-180' : ''"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <!-- File Content (Expandable) -->
                  <div v-if="expandedFiles.has(artifact.path)" class="p-4 bg-surface-3">
                    <pre class="text-xs text-secondary-900 overflow-x-auto font-mono">{{ artifact.content }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 bg-surface-1 border-t border-surface-variant">
          <button
            v-if="generatedArtifacts.length > 0"
            @click="generatedArtifacts = []; expandedFiles.clear()"
            class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            New Generation
          </button>
          <div v-else></div>

          <button
            @click="handleClose"
            class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
