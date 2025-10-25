<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useContextStore } from '../stores/contextStore';
import { useImpactStore } from '../stores/impactStore';
import ProgressCompletionCard from './ProgressCompletionCard.vue';
import NewRepoModal from './NewRepoModal.vue';

const contextStore = useContextStore();
const impactStore = useImpactStore();

const recent = ref<string[]>([]);
const pinned = ref<string[]>([]);
const showNewRepoModal = ref(false);

async function loadPrefs() {
  try {
    const rec = await window.api.settings.get('recentEntities');
    recent.value = Array.isArray(rec?.value) ? rec.value : [];
  } catch {}
  try {
    const pin = await window.api.settings.get('pinnedEntities');
    pinned.value = Array.isArray(pin?.value) ? pin.value : [];
  } catch {}
}

function isPinned(id: string) {
  return pinned.value.includes(id);
}

async function togglePin(id: string) {
  const next = isPinned(id) ? pinned.value.filter(x => x !== id) : [id, ...pinned.value];
  pinned.value = next;
  try { await window.api.settings.set('pinnedEntities', next); } catch {}
}

function openEntity(id: string) {
  contextStore.setActiveEntity(id);
}

const stale = computed(() => impactStore.impactReport?.staleIds || []);

const constitution = computed(() => {
  const entities = Object.values(contextStore.entities);
  return entities.find(e => e._type === 'governance') || null;
});

onMounted(() => {
  loadPrefs();
});
</script>

<template>
  <div class="h-full overflow-auto bg-gradient-to-br from-surface via-surface-1 to-surface-2">
    <!-- Compact Hero Section -->
    <div class="relative overflow-hidden border-b border-surface-variant">
      <div class="absolute inset-0 bg-gradient-to-r from-primary-600/5 via-secondary-500/3 to-transparent"></div>
      <div class="relative px-8 py-4">
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-bold text-primary-900">Context Hub</h1>
            <p class="text-sm text-secondary-600 mt-0.5">System Spec context management</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button 
              @click="$emit('palette')" 
              class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-lg bg-primary-600 text-white hover:bg-primary-700 shadow-elevation-1 hover:shadow-elevation-2 transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span class="hidden sm:inline">Command Palette</span>
              <kbd class="hidden lg:inline-block px-1.5 py-0.5 text-xs bg-white/20 rounded border border-white/30">Ctrl+K</kbd>
            </button>
            <button 
              @click="showNewRepoModal = true" 
              class="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-m3-lg bg-secondary-600 text-white hover:bg-secondary-700 shadow-elevation-1 hover:shadow-elevation-2 transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span class="hidden sm:inline">New Repo</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Grid -->
    <div class="px-8 py-6">
      <div class="max-w-7xl mx-auto">
        <!-- Constitution Summary -->
        <div v-if="constitution" class="mb-6 bg-primary-900 rounded-m3-xl shadow-elevation-3 overflow-hidden">
          <div class="px-6 py-8 text-white">
            <div class="flex items-start gap-4">
              <div class="p-3 bg-white/20 rounded-m3-xl backdrop-blur-sm flex-shrink-0">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <h2 class="text-2xl font-bold">{{ constitution.name || constitution.title || constitution.id }}</h2>
                  <span v-if="constitution.status" class="px-3 py-1 text-xs font-semibold rounded-m3-full bg-white/20 uppercase tracking-wide">{{ constitution.status }}</span>
                </div>
                <p v-if="constitution.summary" class="text-base text-primary-50 leading-relaxed mb-4">{{ constitution.summary }}</p>
                <div class="flex items-center gap-4 text-sm text-primary-100">
                  <div v-if="constitution.version" class="flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>Version {{ constitution.version }}</span>
                  </div>
                  <div v-if="constitution.ratifiedOn" class="flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Ratified {{ constitution.ratifiedOn }}</span>
                  </div>
                  <button 
                    @click="openEntity(constitution.id)" 
                    class="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-m3-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all"
                  >
                    View Full Constitution
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-3">
          <!-- Progress Completion Card -->
          <ProgressCompletionCard />

          <!-- Pinned Items Card -->
          <div class="bg-surface rounded-m3-xl border border-surface-variant shadow-elevation-2 hover:shadow-elevation-3 transition-all overflow-hidden">
            <div class="bg-primary-600 px-5 py-4 flex items-center gap-3">
              <div class="p-2 bg-white/20 rounded-m3-lg">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div>
                <h3 class="text-base font-semibold text-white">Pinned</h3>
                <p class="text-xs text-primary-100">Quick access items</p>
              </div>
            </div>
            <div class="p-4">
              <div v-if="pinned.length === 0" class="text-center py-8">
                <svg class="w-12 h-12 text-secondary-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <p class="text-sm text-secondary-600">No pinned items yet</p>
                <p class="text-xs text-secondary-500 mt-1">Pin items from Recent or Tree</p>
              </div>
              <div v-else class="space-y-2">
                <div 
                  v-for="id in pinned" 
                  :key="id" 
                  class="flex items-center gap-2"
                >
                  <button 
                    class="group flex-1 text-left px-4 py-3 rounded-m3-lg hover:bg-primary-50 border border-transparent hover:border-primary-200 flex items-center gap-3 transition-all"
                    @click="openEntity(id)"
                  >
                    <div class="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0"></div>
                    <span class="text-sm font-medium text-secondary-900 truncate">{{ id }}</span>
                  </button>
                  <button 
                    class="text-xs px-2.5 py-1 rounded-m3-full bg-surface-2 hover:bg-error-50 hover:text-error-700 border border-surface-variant hover:border-error-200 transition-colors flex-shrink-0" 
                    @click="togglePin(id)"
                  >
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity Card -->
          <div class="bg-surface rounded-m3-xl border border-surface-variant shadow-elevation-2 hover:shadow-elevation-3 transition-all overflow-hidden">
            <div class="bg-secondary-700 px-5 py-4 flex items-center gap-3">
              <div class="p-2 bg-white/20 rounded-m3-lg">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 class="text-base font-semibold text-white">Recent</h3>
                <p class="text-xs text-secondary-100">Your activity history</p>
              </div>
            </div>
            <div class="p-4">
              <div v-if="recent.length === 0" class="text-center py-8">
                <svg class="w-12 h-12 text-secondary-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-sm text-secondary-600">No recent activity</p>
                <p class="text-xs text-secondary-500 mt-1">Open an entity to start</p>
              </div>
              <div v-else class="space-y-2">
                <div 
                  v-for="id in recent" 
                  :key="id" 
                  class="flex items-center gap-2"
                >
                  <button 
                    class="group flex-1 text-left px-4 py-3 rounded-m3-lg hover:bg-secondary-50 border border-transparent hover:border-secondary-200 flex items-center gap-3 transition-all"
                    @click="openEntity(id)"
                  >
                    <div class="w-2 h-2 rounded-full bg-secondary-500 flex-shrink-0"></div>
                    <span class="text-sm font-medium text-secondary-900 truncate">{{ id }}</span>
                  </button>
                  <button 
                    class="text-xs px-2.5 py-1.5 rounded-m3-full border transition-all flex-shrink-0"
                    :class="isPinned(id) ? 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100' : 'bg-surface-2 text-secondary-700 border-surface-variant hover:bg-surface-3'"
                    @click="togglePin(id)"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Needs Review Card -->
          <div class="bg-surface rounded-m3-xl border border-surface-variant shadow-elevation-2 hover:shadow-elevation-3 transition-all overflow-hidden">
            <div class="bg-orange-600 px-5 py-4 flex items-center gap-3">
              <div class="p-2 bg-white/20 rounded-m3-lg">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="text-base font-semibold text-white">Needs Review</h3>
                  <button 
                    class="p-1 hover:bg-white/10 rounded-full transition-colors group relative"
                    title="Items are marked for review when they're connected to changed entities or have validation issues"
                  >
                    <svg class="w-4 h-4 text-white/80 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
                <p class="text-xs text-yellow-100">Connected to changed entities</p>
              </div>
            </div>
            <div class="p-4">
              <div v-if="!stale.length" class="text-center py-8">
                <svg class="w-12 h-12 text-secondary-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-sm text-secondary-600">All clear!</p>
                <p class="text-xs text-secondary-500 mt-1">Run Impact Analysis to detect items needing review</p>
              </div>
              <div v-else class="space-y-2">
                <button 
                  v-for="id in stale.slice(0, 10)" 
                  :key="id" 
                  class="group w-full text-left px-4 py-3 rounded-m3-lg hover:bg-yellow-50 border border-transparent hover:border-yellow-200 flex items-center gap-3 transition-all"
                  @click="openEntity(id)"
                >
                  <svg class="w-4 h-4 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-medium text-secondary-900 truncate">{{ id }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Repo Modal -->
    <NewRepoModal v-if="showNewRepoModal" @close="showNewRepoModal = false" />
  </div>
</template>
