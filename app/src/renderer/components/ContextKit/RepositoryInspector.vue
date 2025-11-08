<script setup lang="ts">
import { ref, computed } from 'vue';
import { useContextKitStore, type InspectResponse } from '@/stores/contextKitStore';
import { useContextStore } from '@/stores/contextStore';
import ErrorAlert from './ErrorAlert.vue';
import OperationProgress from './OperationProgress.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  'close': [];
}>();

const contextKitStore = useContextKitStore();
const contextStore = useContextStore();

const activeTab = ref<'overview' | 'entities' | 'recommendations'>('overview');
const depth = ref(2);
const selectedTypes = ref<string[]>([]);
const isInspecting = ref(false);
const inspectionResult = ref<InspectResponse | null>(null);

const availableTypes = ['feature', 'userstory', 'spec', 'task', 'service', 'package'];

const hasInspected = computed(() => inspectionResult.value !== null);

function toggleType(type: string) {
  const index = selectedTypes.value.indexOf(type);
  if (index > -1) {
    selectedTypes.value.splice(index, 1);
  } else {
    selectedTypes.value.push(type);
  }
}

async function runInspection() {
  if (!contextStore.repoPath) {
    return;
  }

  isInspecting.value = true;

  try {
    const result = await contextKitStore.inspectContext(
      contextStore.repoPath,
      selectedTypes.value.length > 0 ? selectedTypes.value : undefined,
      depth.value
    );

    if (result) {
      inspectionResult.value = result;
      activeTab.value = 'overview';
    }
  } finally {
    isInspecting.value = false;
  }
}

function handleClose() {
  // Reset state
  inspectionResult.value = null;
  activeTab.value = 'overview';
  
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
        <div class="flex items-center justify-between px-6 py-4 bg-primary-700 text-white">
          <div>
            <h2 class="text-xl font-semibold">Repository Inspector</h2>
            <p class="text-sm text-white/80">Analyze entities, relationships, and gaps</p>
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

        <!-- Configuration Panel (when not inspected) -->
        <div v-if="!hasInspected" class="flex-1 overflow-y-auto px-6 py-6">
          <div class="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 class="text-lg font-semibold text-secondary-900">Configuration</h3>
              <p class="text-sm text-secondary-600 mt-1">
                Configure inspection parameters
              </p>
            </div>

            <div class="p-6 rounded-m3-lg bg-surface-1 border border-surface-variant space-y-6">
              <!-- Depth Slider -->
              <div>
                <label class="block text-sm font-medium text-secondary-700 mb-3">
                  Relationship Depth: {{ depth }}
                </label>
                <input
                  v-model.number="depth"
                  type="range"
                  min="1"
                  max="5"
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-secondary-600 mt-1">
                  <span>Shallow (1)</span>
                  <span>Deep (5)</span>
                </div>
              </div>

              <!-- Entity Type Filters -->
              <div>
                <label class="block text-sm font-medium text-secondary-700 mb-3">
                  Entity Types (leave empty for all)
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="type in availableTypes"
                    :key="type"
                    @click="toggleType(type)"
                    class="px-4 py-2 rounded-m3-full text-sm font-medium border transition-colors capitalize"
                    :class="selectedTypes.includes(type)
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-surface-2 text-secondary-700 border-surface-variant hover:bg-surface-3'"
                  >
                    {{ type }}
                  </button>
                </div>
              </div>

              <!-- Repository Info -->
              <div class="p-4 rounded-m3-md bg-primary-50 border border-primary-200">
                <p class="text-sm font-medium text-primary-900">Repository Path</p>
                <p class="text-xs text-primary-700 mt-1 font-mono">{{ contextStore.repoPath }}</p>
              </div>
            </div>

            <OperationProgress :operation="contextKitStore.currentOperation" />

            <ErrorAlert 
              :error="contextKitStore.lastError"
              @dismiss="contextKitStore.clearError()"
            />
          </div>
        </div>

        <!-- Results Panel (when inspected) -->
        <div v-else class="flex-1 flex flex-col overflow-hidden">
          <!-- Tabs -->
          <div class="flex gap-2 px-6 py-3 bg-surface-1 border-b border-surface-variant">
            <button
              @click="activeTab = 'overview'"
              class="px-4 py-2 rounded-m3-md text-sm font-medium transition-colors"
              :class="activeTab === 'overview' 
                ? 'bg-primary-600 text-white' 
                : 'text-secondary-700 hover:bg-surface-2'"
            >
              Overview
            </button>
            <button
              @click="activeTab = 'entities'"
              class="px-4 py-2 rounded-m3-md text-sm font-medium transition-colors"
              :class="activeTab === 'entities' 
                ? 'bg-primary-600 text-white' 
                : 'text-secondary-700 hover:bg-surface-2'"
            >
              Entities ({{ inspectionResult.overview.total_entities }})
            </button>
            <button
              @click="activeTab = 'recommendations'"
              class="px-4 py-2 rounded-m3-md text-sm font-medium transition-colors"
              :class="activeTab === 'recommendations' 
                ? 'bg-primary-600 text-white' 
                : 'text-secondary-700 hover:bg-surface-2'"
            >
              Recommendations ({{ inspectionResult.recommendations.length }})
            </button>
          </div>

          <!-- Tab Content -->
          <div class="flex-1 overflow-y-auto px-6 py-6">
            <!-- Overview Tab -->
            <div v-if="activeTab === 'overview'" class="space-y-6">
              <div class="grid gap-4 sm:grid-cols-3">
                <div class="p-4 rounded-m3-lg bg-primary-container border border-outline">
                  <p class="text-sm font-medium text-on-primary-container">Total Entities</p>
                  <p class="text-3xl font-bold text-on-primary-container mt-2">
                    {{ inspectionResult.overview.total_entities }}
                  </p>
                </div>

                <div class="p-4 rounded-m3-lg bg-primary-container border border-outline">
                  <p class="text-sm font-medium text-on-primary-container">Entity Types</p>
                  <p class="text-3xl font-bold text-on-primary-container mt-2">
                    {{ Object.keys(inspectionResult.overview.by_type).length }}
                  </p>
                </div>

                <div class="p-4 rounded-m3-lg bg-warning-container border border-outline">
                  <p class="text-sm font-medium text-on-warning-container">Gaps Found</p>
                  <p class="text-3xl font-bold text-on-warning-container mt-2">
                    {{ inspectionResult.gaps.length }}
                  </p>
                </div>
              </div>

              <div class="p-6 rounded-m3-lg bg-surface-1 border border-surface-variant">
                <h4 class="text-base font-semibold text-secondary-900 mb-4">By Type</h4>
                <div class="space-y-3">
                  <div
                    v-for="(count, type) in inspectionResult.overview.by_type"
                    :key="type"
                    class="flex items-center justify-between"
                  >
                    <span class="text-sm font-medium text-secondary-700 capitalize">{{ type }}</span>
                    <span class="px-3 py-1 rounded-m3-full bg-primary-100 text-primary-800 text-sm font-semibold">
                      {{ count }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="p-6 rounded-m3-lg bg-surface-1 border border-surface-variant">
                <h4 class="text-base font-semibold text-secondary-900 mb-4">By Status</h4>
                <div class="space-y-3">
                  <div
                    v-for="(count, status) in inspectionResult.overview.by_status"
                    :key="status"
                    class="flex items-center justify-between"
                  >
                    <span class="text-sm font-medium text-secondary-700 capitalize">{{ status }}</span>
                    <span class="px-3 py-1 rounded-m3-full bg-secondary-100 text-secondary-800 text-sm font-semibold">
                      {{ count }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="p-4 rounded-m3-md bg-success-container border border-outline">
                <p class="text-sm font-medium text-on-success-container">
                  Inspection completed in {{ inspectionResult.duration_ms }}ms
                </p>
              </div>
            </div>

            <!-- Entities Tab -->
            <div v-else-if="activeTab === 'entities'" class="space-y-3">
              <div
                v-for="entity in inspectionResult.entities"
                :key="entity.id"
                class="p-4 rounded-m3-md bg-surface-1 border border-surface-variant hover:border-primary-300 transition-colors"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <h4 class="font-semibold text-secondary-900">{{ entity.id }}</h4>
                      <span class="px-2 py-0.5 rounded-m3-full bg-primary-100 text-primary-800 text-xs font-medium capitalize">
                        {{ entity.type }}
                      </span>
                      <span 
                        v-if="entity.status"
                        class="px-2 py-0.5 rounded-m3-full bg-secondary-100 text-secondary-800 text-xs font-medium capitalize"
                      >
                        {{ entity.status }}
                      </span>
                    </div>
                    <p v-if="entity.title" class="text-sm text-secondary-600 mt-1">{{ entity.title }}</p>
                    
                    <div v-if="Object.keys(entity.relationships).length > 0" class="mt-3 space-y-1">
                      <div
                        v-for="(ids, relType) in entity.relationships"
                        :key="relType"
                        class="text-xs text-secondary-600"
                      >
                        <span class="font-medium capitalize">{{ relType }}:</span>
                        <span class="ml-1">{{ ids.join(', ') }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recommendations Tab -->
            <div v-else-if="activeTab === 'recommendations'" class="space-y-4">
              <div v-if="inspectionResult.gaps.length > 0" class="space-y-3">
                <h4 class="text-base font-semibold text-secondary-900">Gaps Identified</h4>
                <div
                  v-for="(gap, index) in inspectionResult.gaps"
                  :key="index"
                  class="p-4 rounded-m3-md bg-warning-container border border-outline"
                >
                  <p class="text-sm text-on-warning-container">{{ gap }}</p>
                </div>
              </div>

              <div v-if="inspectionResult.recommendations.length > 0" class="space-y-3">
                <h4 class="text-base font-semibold text-secondary-900">Recommendations</h4>
                <div
                  v-for="(rec, index) in inspectionResult.recommendations"
                  :key="index"
                  class="p-4 rounded-m3-md bg-primary-container border border-outline"
                >
                  <p class="text-sm text-on-primary-container">{{ rec }}</p>
                </div>
              </div>

              <div v-if="inspectionResult.gaps.length === 0 && inspectionResult.recommendations.length === 0" class="text-center py-12">
                <div class="p-4 rounded-m3-full bg-success-container w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p class="text-lg font-semibold text-secondary-900">Repository Looks Great!</p>
                <p class="text-sm text-secondary-600 mt-1">No gaps or issues identified</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 bg-surface-1 border-t border-surface-variant">
          <button
            v-if="hasInspected"
            @click="inspectionResult = null"
            class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
          >
            New Inspection
          </button>
          <div v-else></div>

          <div class="flex gap-2">
            <button
              @click="handleClose"
              class="px-4 py-2 rounded-m3-md border border-surface-variant text-secondary-700 hover:bg-surface-2 transition-colors text-sm font-medium"
            >
              Close
            </button>

            <button
              v-if="!hasInspected"
              @click="runInspection"
              :disabled="isInspecting || !contextStore.repoPath"
              class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isInspecting ? 'Inspecting...' : 'Run Inspection' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
