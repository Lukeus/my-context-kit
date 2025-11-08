<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useEnterpriseStore } from '../stores/enterpriseStore';
import { useRouter } from 'vue-router';

const enterpriseStore = useEnterpriseStore();
const router = useRouter();
const isRefreshing = ref(false);

onMounted(async () => {
  await enterpriseStore.initialize();
  if (enterpriseStore.isConfigured) {
    await enterpriseStore.loadRepos();
  }
});

const statusBadge = computed(() => {
  if (!enterpriseStore.isConfigured) {
    return { label: 'Not Configured', tone: 'bg-secondary-100 text-secondary-700' };
  }
  if (enterpriseStore.isEnterpriseRepoSynced) {
    return { label: 'Synced', tone: 'bg-primary-100 text-primary-800' };
  }
  return { label: 'Not Synced', tone: 'bg-warning-100 text-warning-700' };
});

const syncStatus = computed(() => {
  const status = enterpriseStore.enterpriseRepoStatus;
  if (!status?.cloned) return 'Not cloned';
  if (status.hasChanges) return `Uncommitted changes on ${status.branch}`;
  return `Up to date on ${status.branch}`;
});

async function handleSync() {
  try {
    await enterpriseStore.syncEnterpriseRepo();
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

async function handleRefresh() {
  isRefreshing.value = true;
  try {
    await enterpriseStore.refreshRepos();
  } finally {
    isRefreshing.value = false;
  }
}

function navigateToSettings() {
  router.push('/enterprise/settings');
}

function navigateToConstitution(repoName: string) {
  router.push({
    path: '/enterprise/constitution',
    query: { repo: repoName }
  });
}
</script>

<template>
  <div class="h-full overflow-auto bg-gradient-to-br from-surface via-surface-1 to-surface-2">
    <div class="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 class="text-3xl font-bold text-secondary-900">Enterprise Orchestration</h1>
          <p class="text-sm text-secondary-600 mt-1">Manage enterprise specifications and constitutions</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-m3-md bg-surface-2 hover:bg-surface-3 text-secondary-900 text-sm font-semibold border border-surface-variant transition-all"
            :disabled="!enterpriseStore.isConfigured"
            @click="handleRefresh">
            <svg class="w-4 h-4 inline-block mr-2" :class="{ 'animate-spin': isRefreshing }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-m3-md bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all"
            @click="navigateToSettings">
            Configure
          </button>
        </div>
      </div>

      <!-- Status Card -->
      <section class="rounded-m3-md border border-surface-variant shadow-elevation-3 bg-surface-1 overflow-hidden">
        <div class="bg-primary-700/90 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-white/60">Enterprise Specs Repository</p>
            <h2 class="text-2xl font-bold tracking-tight mt-1">
              {{ enterpriseStore.config.enterpriseSpecsRepo || 'Not configured' }}
            </h2>
            <p class="text-sm text-white/80">
              Organization: {{ enterpriseStore.config.gheOrg || 'N/A' }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              v-if="enterpriseStore.isConfigured"
              class="px-4 py-2 rounded-m3-md bg-white text-primary-700 text-sm font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all disabled:opacity-50"
              :disabled="enterpriseStore.syncing"
              @click="handleSync">
              {{ enterpriseStore.syncing ? 'Syncing...' : 'Sync Now' }}
            </button>
            <span class="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-m3-md bg-white/10 border border-white/30">
              <span class="inline-flex h-2 w-2 rounded-m3-md-full" :class="enterpriseStore.isEnterpriseRepoSynced ? 'bg-green-400' : 'bg-yellow-400'"></span>
              {{ statusBadge.label }}
            </span>
          </div>
        </div>
        <div class="px-6 py-4 bg-surface-2/50">
          <p class="text-sm text-secondary-700">
            <span class="font-semibold">Status:</span> {{ syncStatus }}
          </p>
        </div>
      </section>

      <!-- Error Display -->
      <div v-if="enterpriseStore.error" class="rounded-m3-md border border-error-200 bg-error-50 px-6 py-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-error-900">Error</h3>
            <p class="text-sm text-error-700 mt-1">{{ enterpriseStore.error }}</p>
          </div>
          <button
            type="button"
            class="text-error-600 hover:text-error-800"
            @click="enterpriseStore.clearError">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Not Configured State -->
      <div v-if="!enterpriseStore.isConfigured" class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 px-8 py-12 text-center">
        <svg class="w-16 h-16 mx-auto text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h2 class="text-xl font-bold text-secondary-900 mt-4">Get Started with Enterprise Orchestration</h2>
        <p class="text-sm text-secondary-600 mt-2 max-w-md mx-auto">
          Configure your GitHub Enterprise organization and specifications repository to begin managing constitutions and specs across your enterprise.
        </p>
        <button
          type="button"
          class="mt-6 px-6 py-3 rounded-m3-md bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all"
          @click="navigateToSettings">
          Configure Now
        </button>
      </div>

      <!-- Repository List -->
      <section v-else class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-secondary-900">Enterprise Repositories</h2>
          <span class="text-sm text-secondary-600">{{ enterpriseStore.repos.length }} repositories</span>
        </div>

        <!-- Loading State -->
        <div v-if="enterpriseStore.loading && enterpriseStore.repos.length === 0" class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 px-6 py-12 text-center">
          <div class="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-m3-md-full animate-spin"></div>
          <p class="text-sm text-secondary-600 mt-4">Loading repositories...</p>
        </div>

        <!-- Repository Grid -->
        <div v-else-if="enterpriseStore.repos.length > 0" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="repo in enterpriseStore.repos"
            :key="repo.name"
            class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 hover:shadow-elevation-3 transition-all overflow-hidden">
            <div class="px-5 py-4">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <h3 class="text-base font-semibold text-secondary-900 truncate">{{ repo.name }}</h3>
                  <p v-if="repo.description" class="text-sm text-secondary-600 mt-1 line-clamp-2">
                    {{ repo.description }}
                  </p>
                </div>
                <a
                  v-if="repo.url"
                  :href="repo.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-secondary-500 hover:text-secondary-700 flex-shrink-0">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <span
                  v-if="repo.hasConstitution"
                  class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-m3-md bg-primary-100 text-primary-800">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Constitution
                </span>
                <span
                  v-if="repo.hasSpecs"
                  class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-m3-md bg-secondary-100 text-secondary-800">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Specs
                </span>
                <span
                  v-if="!repo.hasConstitution && !repo.hasSpecs"
                  class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-m3-md bg-secondary-100 text-secondary-600">
                  No governance files
                </span>
              </div>

              <button
                v-if="repo.hasConstitution"
                type="button"
                class="mt-4 w-full px-4 py-2 rounded-m3-md bg-surface-2 hover:bg-surface-3 text-secondary-900 text-sm font-semibold border border-surface-variant transition-all"
                @click="navigateToConstitution(repo.name)">
                View Constitution
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2 px-6 py-12 text-center">
          <svg class="w-12 h-12 mx-auto text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 class="text-lg font-semibold text-secondary-900 mt-4">No repositories found</h3>
          <p class="text-sm text-secondary-600 mt-2">
            No repositories were discovered in your organization. Check your configuration or permissions.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
