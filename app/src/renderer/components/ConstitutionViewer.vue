<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useEnterpriseStore } from '../stores/enterpriseStore';
import type { MergedConstitution, ConstitutionSection } from '../../types/enterprise';

const route = useRoute();
const router = useRouter();
const enterpriseStore = useEnterpriseStore();

const repoPath = ref('');
const constitution = ref<MergedConstitution | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedTab = ref<'merged' | 'conflicts'>('merged');

onMounted(async () => {
  const queryRepo = route.query.repo as string;
  if (!queryRepo) {
    error.value = 'No repository specified';
    return;
  }
  
  // For now, use a placeholder path since we don't have actual local paths
  // In real usage, this would come from repo selection
  repoPath.value = `/path/to/${queryRepo}`;
  
  await loadConstitution();
});

watch(() => route.query.repo, async () => {
  if (route.query.repo) {
    await loadConstitution();
  }
});

async function loadConstitution() {
  loading.value = true;
  error.value = null;
  
  try {
    constitution.value = await enterpriseStore.getEffectiveConstitution(repoPath.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load constitution';
    console.error('Error loading constitution:', err);
  } finally {
    loading.value = false;
  }
}

const hasConflicts = computed(() => {
  return (constitution.value?.conflicts.length ?? 0) > 0;
});

const mergedSections = computed(() => {
  return constitution.value?.sections ?? [];
});

function goBack() {
  router.push('/enterprise');
}

function getSectionIcon(section: ConstitutionSection) {
  if (section.source === 'global') return '🌐';
  if (section.source === 'local') return '📁';
  return '🔀';
}

function getSectionBadge(source: string) {
  if (source === 'global') {
    return { label: 'Global', classes: 'bg-primary-100 text-primary-800' };
  }
  if (source === 'local') {
    return { label: 'Local', classes: 'bg-secondary-100 text-secondary-800' };
  }
  return { label: 'Merged', classes: 'bg-surface-variant text-secondary-700' };
}
</script>

<template>
  <div class="h-full overflow-auto bg-gradient-to-br from-surface via-surface-1 to-surface-2">
    <div class="max-w-6xl mx-auto px-8 py-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4">
        <button
          type="button"
          class="p-2 rounded-m3-md hover:bg-surface-2 text-secondary-700 transition-colors"
          @click="goBack">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div class="flex-1">
          <h1 class="text-3xl font-bold text-secondary-900">Constitution Viewer</h1>
          <p class="text-sm text-secondary-600 mt-1">
            Repository: <span class="font-semibold">{{ route.query.repo }}</span>
          </p>
        </div>
        <div v-if="hasConflicts" class="flex items-center gap-2 px-4 py-2 rounded-m3-md bg-warning-50 border border-warning-200">
          <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="text-sm font-semibold text-warning-900">{{ constitution?.conflicts.length }} conflicts detected</span>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="rounded-m3-md border border-error-200 bg-error-50 px-6 py-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 class="text-sm font-semibold text-error-900">Error</h3>
            <p class="text-sm text-error-700 mt-1">{{ error }}</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 px-6 py-12 text-center">
        <div class="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-m3-md-full animate-spin"></div>
        <p class="text-sm text-secondary-600 mt-4">Loading constitution...</p>
      </div>

      <!-- Tabs -->
      <div v-if="!loading && constitution" class="flex items-center gap-2 border-b border-surface-variant">
        <button
          type="button"
          class="px-4 py-3 text-sm font-semibold transition-all border-b-2"
          :class="selectedTab === 'merged' ? 'text-primary-700 border-primary-700' : 'text-secondary-600 border-transparent hover:text-secondary-900'"
          @click="selectedTab = 'merged'">
          Merged Constitution
        </button>
        <button
          v-if="hasConflicts"
          type="button"
          class="px-4 py-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2"
          :class="selectedTab === 'conflicts' ? 'text-primary-700 border-primary-700' : 'text-secondary-600 border-transparent hover:text-secondary-900'"
          @click="selectedTab = 'conflicts'">
          Conflicts
          <span class="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-m3-md-full bg-warning-100 text-warning-800">
            {{ constitution.conflicts.length }}
          </span>
        </button>
      </div>

      <!-- Merged View -->
      <div v-if="!loading && constitution && selectedTab === 'merged'" class="space-y-4">
        <div
          v-for="(section, index) in mergedSections"
          :key="index"
          class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 overflow-hidden">
          <div class="px-6 py-4 bg-surface-2 border-b border-surface-variant flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <span class="text-2xl">{{ getSectionIcon(section) }}</span>
              <div>
                <h3 class="text-lg font-semibold text-secondary-900">{{ section.title }}</h3>
                <p v-if="section.path" class="text-xs text-secondary-600 mt-1 font-mono">{{ section.path }}</p>
              </div>
            </div>
            <span class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-m3-md"
              :class="getSectionBadge(section.source).classes">
              {{ getSectionBadge(section.source).label }}
            </span>
          </div>
          <div class="px-6 py-5">
            <div class="prose prose-sm max-w-none text-secondary-800 whitespace-pre-wrap font-mono text-xs leading-relaxed">{{ section.content }}</div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="mergedSections.length === 0" class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 px-6 py-12 text-center">
          <svg class="w-12 h-12 mx-auto text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="text-lg font-semibold text-secondary-900 mt-4">No sections found</h3>
          <p class="text-sm text-secondary-600 mt-2">This repository has no constitution sections.</p>
        </div>
      </div>

      <!-- Conflicts View -->
      <div v-if="!loading && constitution && selectedTab === 'conflicts'" class="space-y-4">
        <div
          v-for="(conflict, index) in constitution.conflicts"
          :key="index"
          class="rounded-m3-md border-2 border-warning-300 bg-warning-50 shadow-elevation-2 overflow-hidden">
          <div class="px-6 py-4 bg-warning-100 border-b-2 border-warning-300">
            <div class="flex items-start gap-3">
              <svg class="w-6 h-6 text-warning-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 class="text-lg font-semibold text-warning-900">Conflict in: {{ conflict.path }}</h3>
                <p class="text-sm text-warning-800 mt-1">{{ conflict.reason }}</p>
              </div>
            </div>
          </div>
          <div class="grid md:grid-cols-2 gap-px bg-warning-200">
            <!-- Global Version -->
            <div class="bg-surface px-6 py-5">
              <div class="flex items-center gap-2 mb-3">
                <span class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-m3-md bg-primary-100 text-primary-800">
                  🌐 Global
                </span>
                <h4 class="text-sm font-semibold text-secondary-900">{{ conflict.globalSection.title }}</h4>
              </div>
              <div class="prose prose-sm max-w-none text-secondary-800 whitespace-pre-wrap font-mono text-xs leading-relaxed bg-surface-1 rounded-m3-md px-4 py-3 border border-surface-variant">{{ conflict.globalSection.content }}</div>
            </div>
            <!-- Local Version -->
            <div class="bg-surface px-6 py-5">
              <div class="flex items-center gap-2 mb-3">
                <span class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-m3-md bg-secondary-100 text-secondary-800">
                  📁 Local
                </span>
                <h4 class="text-sm font-semibold text-secondary-900">{{ conflict.localSection.title }}</h4>
              </div>
              <div class="prose prose-sm max-w-none text-secondary-800 whitespace-pre-wrap font-mono text-xs leading-relaxed bg-surface-1 rounded-m3-md px-4 py-3 border border-surface-variant">{{ conflict.localSection.content }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Metadata Footer -->
      <div v-if="!loading && constitution" class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 px-6 py-4">
        <dl class="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt class="font-semibold text-secondary-900">Repository Path</dt>
            <dd class="text-secondary-600 mt-1 font-mono text-xs truncate">{{ constitution.localRepoPath }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-secondary-900">Merged Sections</dt>
            <dd class="text-secondary-600 mt-1">{{ constitution.sections.length }}</dd>
          </div>
          <div>
            <dt class="font-semibold text-secondary-900">Conflicts</dt>
            <dd class="text-secondary-600 mt-1">
              {{ constitution.conflicts.length }}
              <span v-if="constitution.conflicts.length === 0" class="text-primary-600 font-semibold">✓ None</span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>
