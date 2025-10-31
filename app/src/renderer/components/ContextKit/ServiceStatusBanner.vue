<script setup lang="ts">
import { computed } from 'vue';
import { useContextKitStore } from '@/stores/contextKitStore';

const contextKitStore = useContextKitStore();

const statusColor = computed(() => {
  if (!contextKitStore.serviceStatus) return 'bg-gray-500';
  if (contextKitStore.isServiceHealthy) return 'bg-green-600';
  if (contextKitStore.isServiceRunning) return 'bg-yellow-600';
  return 'bg-red-600';
});

const statusText = computed(() => {
  if (!contextKitStore.serviceStatus) return 'Checking...';
  if (contextKitStore.isServiceHealthy) return 'Context Kit Service: Healthy';
  if (contextKitStore.isServiceRunning) return 'Context Kit Service: Degraded';
  return 'Context Kit Service: Offline';
});

const statusIcon = computed(() => {
  if (contextKitStore.isServiceHealthy) return '✓';
  if (contextKitStore.isServiceRunning) return '⚠';
  return '✕';
});

const showBanner = computed(() => {
  // Only show banner if service is not healthy
  return !contextKitStore.isServiceHealthy;
});

async function handleStartService() {
  await contextKitStore.startService();
}

async function handleRefresh() {
  await contextKitStore.checkServiceStatus();
}
</script>

<template>
  <div
    v-if="showBanner"
    class="flex items-center justify-between px-4 py-3 rounded-lg shadow-sm"
    :class="statusColor"
    role="alert"
  >
    <div class="flex items-center gap-3">
      <span class="text-2xl text-white" aria-hidden="true">{{ statusIcon }}</span>
      <div class="text-white">
        <div class="font-medium">{{ statusText }}</div>
        <div v-if="contextKitStore.serviceStatus?.lastError" class="text-sm opacity-90 mt-1">
          {{ contextKitStore.serviceStatus.lastError }}
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        v-if="!contextKitStore.isServiceRunning"
        @click="handleStartService"
        class="px-4 py-2 bg-white text-gray-900 rounded-md font-medium hover:bg-gray-100 transition-colors"
        :disabled="contextKitStore.isLoading"
      >
        {{ contextKitStore.isLoading ? 'Starting...' : 'Start Service' }}
      </button>
      
      <button
        @click="handleRefresh"
        class="px-4 py-2 bg-white/10 text-white rounded-md font-medium hover:bg-white/20 transition-colors"
        :disabled="contextKitStore.isLoading"
        title="Check service status"
      >
        ↻ Refresh
      </button>
      
      <button
        @click="showBanner = false"
        class="text-white hover:bg-white/10 rounded p-1"
        aria-label="Dismiss banner"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
