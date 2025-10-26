<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useContextStore } from '@/stores/contextStore';

const contextStore = useContextStore();

interface Principle {
  id: string;
  title: string;
  summary: string;
  details?: string;
  appliesTo: string[];
  nonNegotiable: boolean;
  requirements?: Array<{
    id: string;
    statement: string;
    severity: string;
  }>;
  references?: string[];
}

interface Constitution {
  id: string;
  name: string;
  version: string;
  status: string;
  summary: string;
  principles: Principle[];
}

const constitution = ref<Constitution | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Fallback articles for display structure
const articles = ref<Record<string, any>>({
  I: {
    number: 'I',
    title: 'Library-First Principle',
    description: 'Every feature must begin as a standalone library',
    gates: [
      { id: 'lib-first', check: 'Feature implemented as library?', critical: true },
      { id: 'no-inline', check: 'No direct implementation in app code?', critical: true },
    ],
  },
  II: {
    number: 'II',
    title: 'CLI Interface Mandate',
    description: 'Every library must expose functionality through CLI',
    gates: [
      { id: 'cli-exists', check: 'CLI interface exists?', critical: true },
      { id: 'text-io', check: 'Accepts text input / produces text output?', critical: true },
      { id: 'json-support', check: 'Supports JSON format?', critical: false },
    ],
  },
  III: {
    number: 'III',
    title: 'Test-First Imperative',
    description: 'No code before tests (TDD)',
    gates: [
      { id: 'tests-written', check: 'Unit tests written before implementation?', critical: true },
      { id: 'tests-approved', check: 'Tests validated and approved?', critical: true },
      { id: 'red-phase', check: 'Tests confirmed to FAIL (Red phase)?', critical: true },
    ],
  },
  IV: {
    number: 'IV',
    title: 'Dependency Declarations',
    description: 'All dependencies explicitly declared',
    gates: [
      { id: 'deps-declared', check: 'All dependencies in package.json/requirements?', critical: true },
      { id: 'no-globals', check: 'No undeclared global dependencies?', critical: true },
    ],
  },
  V: {
    number: 'V',
    title: 'Interface Contracts',
    description: 'Explicit contracts for all interfaces',
    gates: [
      { id: 'contracts-defined', check: 'Interface contracts defined?', critical: true },
      { id: 'contract-tests', check: 'Contract tests exist?', critical: true },
    ],
  },
  VI: {
    number: 'VI',
    title: 'Observability Requirements',
    description: 'All functionality must be observable',
    gates: [
      { id: 'logging', check: 'Structured logging implemented?', critical: false },
      { id: 'metrics', check: 'Key metrics exposed?', critical: false },
      { id: 'tracing', check: 'Trace IDs propagated?', critical: false },
    ],
  },
  VII: {
    number: 'VII',
    title: 'Simplicity Gate',
    description: 'Minimize project structure and complexity',
    gates: [
      { id: 'max-projects', check: 'Using ≤3 projects?', critical: true },
      { id: 'no-future-proof', check: 'No future-proofing?', critical: true },
      { id: 'justified-complexity', check: 'Complexity documented if >3 projects?', critical: false },
    ],
  },
  VIII: {
    number: 'VIII',
    title: 'Anti-Abstraction Gate',
    description: 'Use frameworks directly, avoid unnecessary layers',
    gates: [
      { id: 'framework-direct', check: 'Using framework directly?', critical: true },
      { id: 'single-model', check: 'Single model representation?', critical: true },
      { id: 'no-wrappers', check: 'No unnecessary wrappers/adapters?', critical: false },
    ],
  },
  IX: {
    number: 'IX',
    title: 'Integration-First Gate',
    description: 'Test in realistic environments',
    gates: [
      { id: 'real-db', check: 'Using real database (not mocks)?', critical: false },
      { id: 'real-services', check: 'Using actual service instances?', critical: false },
      { id: 'contract-tests-first', check: 'Contract tests mandatory before implementation?', critical: true },
    ],
  },
});

const selectedArticle = ref<string | null>(null);
const showGateDetails = ref(false);

const principleList = computed(() => constitution.value?.principles || []);
const currentPrinciple = computed(() => {
  if (!selectedArticle.value || !constitution.value) return null;
  const index = parseInt(selectedArticle.value) - 1;
  return constitution.value.principles[index] || null;
});

async function loadConstitution() {
  if (!contextStore.repoPath) return;
  
  isLoading.value = true;
  error.value = null;
  
  try {
    // Read the constitution YAML file
    const filePath = `${contextStore.repoPath}\\contexts\\governance\\constitution.yaml`;
    const result = await window.api.fs.readFile(filePath);
    
    if (result.ok && result.content) {
      // Parse YAML (simple parsing, or we could use generate to render it)
      // For now, just try to find the entity in the context store
      const entity = contextStore.entities.find(e => e._type === 'governance' && e.id === 'CONST-CTX-SYNC');
      if (entity) {
        constitution.value = entity as unknown as Constitution;
      }
    } else {
      error.value = result.error || 'Failed to load constitution';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load constitution';
  } finally {
    isLoading.value = false;
  }
}

function selectArticle(index: number) {
  selectedArticle.value = String(index + 1);
  showGateDetails.value = true;
}

function closeDetails() {
  showGateDetails.value = false;
}

onMounted(() => {
  loadConstitution();
});
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <!-- Header -->
    <div class="px-6 py-4 bg-surface-2 border-b border-surface-variant">
      <h2 class="text-lg font-semibold text-primary-700">Constitutional Governance</h2>
      <p class="text-xs text-secondary-600 mt-1">The 9 Articles of Development</p>
    </div>

    <!-- Articles List -->
    <div class="flex-1 overflow-y-auto p-4 space-y-2">
      <div
        v-for="article in articleList"
        :key="article.number"
        @click="selectArticle(article.number)"
        class="p-4 bg-surface-1 border border-surface-variant rounded-m3-md hover:bg-surface-2 cursor-pointer transition-colors"
      >
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-m3-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0">
            {{ article.number }}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-secondary-900">{{ article.title }}</h3>
            <p class="text-xs text-secondary-600 mt-1">{{ article.description }}</p>
            <div class="flex items-center gap-2 mt-2">
              <span class="text-[11px] px-2 py-0.5 bg-error-50 text-error-700 rounded-m3-small">
                {{ article.gates.filter(g => g.critical).length }} Critical
              </span>
              <span class="text-[11px] px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-m3-small">
                {{ article.gates.filter(g => !g.critical).length }} Advisory
              </span>
            </div>
          </div>
          <div class="text-secondary-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Gate Details Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showGateDetails && currentArticle"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style="background-color: rgba(0, 0, 0, 0.5)"
          @click.self="closeDetails"
        >
          <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 bg-surface-2 border-b border-surface-variant">
              <div>
                <h3 class="text-lg font-semibold text-primary-700">
                  Article {{ currentArticle.number }}: {{ currentArticle.title }}
                </h3>
                <p class="text-xs text-secondary-600 mt-1">{{ currentArticle.description }}</p>
              </div>
              <button
                @click="closeDetails"
                class="text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 p-2 rounded-m3-full transition-all"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Gate Checklist -->
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h4 class="text-sm font-semibold text-secondary-900 mb-3">Compliance Gates</h4>
                <div class="space-y-2">
                  <div
                    v-for="gate in currentArticle.gates"
                    :key="gate.id"
                    class="flex items-start gap-3 p-3 bg-surface-1 rounded-m3-md border"
                    :class="gate.critical ? 'border-error-200' : 'border-yellow-200'"
                  >
                    <div
                      class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                      :class="gate.critical ? 'bg-error-100 text-error-700' : 'bg-yellow-100 text-yellow-700'"
                    >
                      {{ gate.critical ? '!' : 'i' }}
                    </div>
                    <div class="flex-1">
                      <div class="text-sm text-secondary-900">{{ gate.check }}</div>
                      <div class="text-xs text-secondary-600 mt-1">
                        {{ gate.critical ? 'Critical - Must pass' : 'Advisory - Recommended' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="pt-4 border-t border-surface-variant">
                <h4 class="text-sm font-semibold text-secondary-900 mb-2">Enforcement</h4>
                <p class="text-xs text-secondary-600">
                  This article is automatically enforced during the Speckit workflow.
                  Implementation plans that fail critical gates will be flagged for review.
                </p>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 bg-surface-2 border-t border-surface-variant flex justify-end">
              <button
                @click="closeDetails"
                class="px-4 py-2 text-sm bg-primary text-white rounded-m3-lg hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
