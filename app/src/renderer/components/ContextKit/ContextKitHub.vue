<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useContextKitStore } from '@/stores/contextKitStore';
import { useContextStore } from '@/stores/contextStore';
import ErrorAlert from './ErrorAlert.vue';
import OperationProgress from './OperationProgress.vue';

const contextKitStore = useContextKitStore();
const contextStore = useContextStore();

const emit = defineEmits<{
  'open-inspector': [];
  'open-spec-wizard': [];
  'open-spec-log': [];
}>();

const isStarting = ref(false);
const isStopping = ref(false);

const statusColor = computed(() => {
  // Map service states to semantic status tokens
  if (!contextKitStore.serviceStatus) return 'bg-status-todo';
  if (contextKitStore.isServiceHealthy) return 'bg-success';
  if (contextKitStore.isServiceRunning) return 'bg-warning';
  return 'bg-error';
});

const statusText = computed(() => {
  if (!contextKitStore.serviceStatus) return 'Checking Status...';
  if (contextKitStore.isServiceHealthy) return 'Healthy';
  if (contextKitStore.isServiceRunning) return 'Degraded';
  return 'Offline';
});

const uptimeDisplay = computed(() => {
  const uptime = contextKitStore.serviceStatus?.uptime;
  if (!uptime) return 'N/A';
  
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
});

const recentActivity = computed(() => {
  const activity: Array<{ type: string; label: string; timestamp: string; id: string }> = [];
  
  // Collect recent specs (max 5)
  Array.from(contextKitStore.generatedSpecs.entries())
    .slice(0, 3)
    .forEach(([id, spec]) => {
      activity.push({
        type: 'spec',
        label: `Spec: ${spec.spec_id}`,
        timestamp: 'Recently',
        id,
      });
    });
  
  // Collect recent prompts (max 2)
  Array.from(contextKitStore.generatedPrompts.entries())
    .slice(0, 2)
    .forEach(([id, prompt]) => {
      activity.push({
        type: 'prompt',
        label: `Promptified: ${prompt.spec_id}`,
        timestamp: 'Recently',
        id,
      });
    });
  
  return activity.slice(0, 5);
});

const totalSpecs = computed(() => contextKitStore.generatedSpecs.size);
const totalPrompts = computed(() => contextKitStore.generatedPrompts.size);
const totalCode = computed(() => contextKitStore.generatedCode.size);

async function handleStartService() {
  isStarting.value = true;
  try {
    await contextKitStore.startService();
  } finally {
    isStarting.value = false;
  }
}

async function handleStopService() {
  isStopping.value = true;
  try {
    await contextKitStore.stopService();
  } finally {
    isStopping.value = false;
  }
}

async function handleRefreshStatus() {
  await contextKitStore.checkServiceStatus();
}

onMounted(() => {
  // Check service status on mount
  void contextKitStore.checkServiceStatus();
});
</script>

<template>
  <div class="h-full overflow-auto bg-gradient-to-br from-surface via-surface-1 to-surface-2">
    <div class="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-primary-900">Context Kit</h1>
          <p class="text-sm text-secondary-600 mt-1">
            AI-powered specification generation and code synthesis pipeline
          </p>
        </div>
        <button
          @click="handleRefreshStatus"
          class="px-4 py-2 rounded-m3-md border border-primary-200 text-primary-700 hover:bg-primary-50 transition-colors text-sm font-medium"
          :disabled="contextKitStore.isLoading"
          title="Refresh service status"
        >
          <svg class="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <!-- Operation Progress -->
      <OperationProgress :operation="contextKitStore.currentOperation" />

      <!-- Error Display -->
      <ErrorAlert 
        :error="contextKitStore.lastError"
        @dismiss="contextKitStore.clearError()"
      />

      <!-- Service Status Card -->
      <section class="rounded-m3-md border border-surface-variant shadow-elevation-3 bg-surface-1 overflow-hidden">
        <div class="bg-primary-700/90 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-white/60">Python Service</p>
            <h2 class="text-2xl font-bold tracking-tight mt-1">Context Kit Service</h2>
            <p class="text-sm text-white/80">FastAPI + LangChain backend</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              v-if="!contextKitStore.isServiceRunning"
              @click="handleStartService"
              :disabled="isStarting"
              class="px-4 py-2 rounded-m3-md bg-white text-primary-700 text-sm font-semibold shadow-elevation-2 hover:shadow-elevation-3 transition-all disabled:opacity-50"
            >
              {{ isStarting ? 'Starting...' : 'Start Service' }}
            </button>
            <button
              v-else
              @click="handleStopService"
              :disabled="isStopping"
              class="px-4 py-2 rounded-m3-md bg-white/10 text-white text-sm font-semibold border border-white/30 hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              {{ isStopping ? 'Stopping...' : 'Stop Service' }}
            </button>
            <span 
              class="px-3 py-1 rounded-m3-full text-sm font-semibold text-on-primary"
              :class="statusColor"
            >
              {{ statusText }}
            </span>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 px-6 py-5 backdrop-blur">
          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Status</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">
              {{ contextKitStore.isServiceRunning ? 'Running' : 'Stopped' }}
            </p>
            <p class="text-xs text-secondary-500 mt-1">Port: {{ contextKitStore.serviceStatus?.port || 8000 }}</p>
          </div>

          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Uptime</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">{{ uptimeDisplay }}</p>
            <p class="text-xs text-secondary-500 mt-1">Since last start</p>
          </div>

          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Health</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">
              {{ contextKitStore.isServiceHealthy ? 'Optimal' : 'Degraded' }}
            </p>
            <span class="inline-flex items-center gap-2 text-[11px] font-semibold px-2.5 py-1 rounded-m3-md mt-3"
              :class="contextKitStore.isServiceHealthy ? 'bg-primary-100 text-primary-800' : 'bg-error-100 text-error-700'">
              <span class="inline-flex h-2 w-2 rounded-m3-full bg-current"></span>
              {{ contextKitStore.isServiceHealthy ? 'All dependencies OK' : 'Check dependencies' }}
            </span>
          </div>
          
          <div class="rounded-m3-md bg-surface-2 border border-surface-variant px-4 py-3">
            <p class="text-xs text-secondary-600">Repository</p>
            <p class="text-lg font-semibold text-secondary-900 mt-1">
              {{ contextStore.repoPath ? 'Connected' : 'None' }}
            </p>
            <button v-if="contextStore.repoPath" class="mt-3 text-xs font-semibold text-primary-700 hover:text-primary-900"
              @click="emit('open-inspector')">
              Inspect context
            </button>
            <p v-else class="text-xs text-secondary-500 mt-1">Connect a repository</p>
          </div>
        </div>

        <div v-if="contextKitStore.lastError" class="mx-6 mb-6">
          <ErrorAlert 
            :error="contextKitStore.lastError"
            @dismiss="contextKitStore.clearError()"
          />
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2">
        <div class="px-6 py-4 border-b border-surface-variant">
          <h2 class="text-lg font-semibold text-secondary-900">Quick Actions</h2>
          <p class="text-xs text-secondary-500">Access Context Kit workflows</p>
        </div>

        <div class="p-6 grid gap-4 sm:grid-cols-3">
          <button
            @click="emit('open-inspector')"
            :disabled="!contextKitStore.isServiceHealthy || !contextStore.repoPath"
            class="flex flex-col items-start p-4 rounded-m3-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div class="p-2 rounded-m3-md bg-primary-600 text-white mb-3">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 class="text-base font-semibold text-primary-900">Inspect Repository</h3>
            <p class="text-sm text-primary-700 mt-1">Analyze entities, relationships, and gaps</p>
          </button>

          <button
            @click="emit('open-spec-wizard')"
            :disabled="!contextKitStore.isServiceHealthy || !contextStore.repoPath"
            class="flex flex-col items-start p-4 rounded-m3-lg border border-secondary-200 bg-secondary-50 hover:bg-secondary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div class="p-2 rounded-m3-md bg-secondary-600 text-white mb-3">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 class="text-base font-semibold text-secondary-900">Generate Specification</h3>
            <p class="text-sm text-secondary-700 mt-1">Create technical specs from entities</p>
          </button>

          <button
            @click="emit('open-spec-log')"
            class="flex flex-col items-start p-4 rounded-m3-lg border border-surface-variant bg-surface-1 hover:bg-surface-2 transition-colors"
          >
            <div class="p-2 rounded-m3-md bg-surface-3 text-secondary-700 mb-3">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 class="text-base font-semibold text-secondary-900">View Spec Log</h3>
            <p class="text-sm text-secondary-700 mt-1">Browse generation history and artifacts</p>
          </button>
        </div>
      </section>

      <!-- Activity Metrics -->
      <section class="grid gap-6 sm:grid-cols-2">
        <!-- Stats -->
        <div class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2">
          <div class="px-6 py-4 border-b border-surface-variant">
            <h2 class="text-lg font-semibold text-secondary-900">Pipeline Metrics</h2>
            <p class="text-xs text-secondary-500">Cumulative generation statistics</p>
          </div>

          <div class="p-6 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-m3-md bg-primary-container text-on-primary-container">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-secondary-900">Specifications</p>
                  <p class="text-xs text-secondary-600">Generated specs</p>
                </div>
              </div>
              <span class="text-2xl font-bold text-secondary-900">{{ totalSpecs }}</span>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-m3-md bg-primary-container text-on-primary-container">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-secondary-900">Prompts</p>
                  <p class="text-xs text-secondary-600">Promptified specs</p>
                </div>
              </div>
              <span class="text-2xl font-bold text-secondary-900">{{ totalPrompts }}</span>
            </div>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="p-2 rounded-m3-md bg-success-container text-on-success-container">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div>
                  <p class="text-sm font-medium text-secondary-900">Code Artifacts</p>
                  <p class="text-xs text-secondary-600">Generated code</p>
                </div>
              </div>
              <span class="text-2xl font-bold text-secondary-900">{{ totalCode }}</span>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="rounded-m3-md border border-surface-variant bg-surface shadow-elevation-2">
          <div class="px-6 py-4 border-b border-surface-variant">
            <h2 class="text-lg font-semibold text-secondary-900">Recent Activity</h2>
            <p class="text-xs text-secondary-500">Latest pipeline operations</p>
          </div>

          <div class="p-6">
            <div v-if="recentActivity.length === 0" class="text-center py-8 text-secondary-500">
              <p class="text-sm">No recent activity</p>
              <p class="text-xs mt-1">Generate a spec to get started</p>
            </div>

            <ul v-else class="space-y-3">
              <li 
                v-for="item in recentActivity" 
                :key="item.id"
                class="flex items-start gap-3 p-3 rounded-m3-md bg-surface-1 border border-surface-variant"
              >
                <div 
                  class="p-1.5 rounded-m3-md flex-shrink-0"
                  :class="{
                    'bg-primary-container text-on-primary-container': item.type === 'spec' || item.type === 'prompt',
                    'bg-success-container text-on-success-container': item.type === 'code'
                  }"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-secondary-900 truncate">{{ item.label }}</p>
                  <p class="text-xs text-secondary-600">{{ item.timestamp }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Helpful Tips -->
      <section class="rounded-m3-lg border border-primary-200 bg-primary-50 p-6">
        <div class="flex gap-4">
          <div class="flex-shrink-0">
            <div class="p-2 rounded-m3-full bg-primary-600 text-white">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div>
            <h3 class="text-base font-semibold text-primary-900">Getting Started</h3>
            <p class="text-sm text-primary-700 mt-1">
              Context Kit uses AI to generate technical specifications from your context entities. 
              Start by inspecting your repository to understand your entity structure, then use the 
              spec generation wizard to create detailed specifications.
            </p>
            <p class="text-sm text-primary-700 mt-2">
              Generated specs can be promptified for AI agents and used to generate production-ready code.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
