<script setup lang="ts">
import { computed } from 'vue';
import { useContextStore } from '../stores/contextStore';

const contextStore = useContextStore();

// Status values that indicate completion
const COMPLETED_STATUSES = ['done', 'completed', 'delivered', 'closed'];
const IN_PROGRESS_STATUSES = ['doing', 'in-progress', 'in-review', 'needs-review', 'testing'];

interface CompletionStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  percentage: number;
}

const completionStats = computed((): CompletionStats => {
  const allEntities = Object.values(contextStore.entities);
  
  if (allEntities.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      percentage: 0
    };
  }

  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;

  allEntities.forEach(entity => {
    const status = (entity.status || '').toLowerCase();
    
    if (COMPLETED_STATUSES.includes(status)) {
      completed++;
    } else if (IN_PROGRESS_STATUSES.includes(status)) {
      inProgress++;
    } else {
      notStarted++;
    }
  });

  const percentage = Math.round((completed / allEntities.length) * 100);

  return {
    total: allEntities.length,
    completed,
    inProgress,
    notStarted,
    percentage
  };
});

const progressColor = computed(() => {
  const pct = completionStats.value.percentage;
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-blue-500';
  if (pct >= 25) return 'bg-yellow-500';
  return 'bg-orange-500';
});

const progressRingOffset = computed(() => {
  const circumference = 2 * Math.PI * 54; // radius = 54
  const offset = circumference - (completionStats.value.percentage / 100) * circumference;
  return offset;
});
</script>

<template>
  <div class="bg-surface rounded-m3-xl border border-surface-variant shadow-elevation-2 hover:shadow-elevation-3 transition-all overflow-hidden">
    <div class="bg-gradient-to-br from-green-600 to-green-700 px-5 py-4 flex items-center gap-3">
      <div class="p-2 bg-white/20 rounded-m3-lg">
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div>
        <h3 class="text-base font-semibold text-white">Progress</h3>
        <p class="text-xs text-green-100">Overall completion</p>
      </div>
    </div>
    <div class="p-6">
      <div v-if="completionStats.total === 0" class="text-center py-8">
        <svg class="w-12 h-12 text-secondary-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-sm text-secondary-600">No entities loaded</p>
        <p class="text-xs text-secondary-500 mt-1">Load a repository to see progress</p>
      </div>
      <div v-else class="space-y-6">
        <!-- Circular Progress Ring -->
        <div class="flex justify-center">
          <div class="relative w-32 h-32">
            <!-- Background circle -->
            <svg class="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="54"
                stroke="currentColor"
                stroke-width="8"
                fill="none"
                class="text-surface-3"
              />
              <!-- Progress circle -->
              <circle
                cx="64"
                cy="64"
                r="54"
                stroke="currentColor"
                stroke-width="8"
                fill="none"
                :stroke-dasharray="2 * Math.PI * 54"
                :stroke-dashoffset="progressRingOffset"
                :class="progressColor"
                class="transition-all duration-500 ease-out"
                stroke-linecap="round"
              />
            </svg>
            <!-- Percentage text in center -->
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <div class="text-3xl font-bold text-secondary-900">{{ completionStats.percentage }}%</div>
              <div class="text-xs text-secondary-600 mt-1">Complete</div>
            </div>
          </div>
        </div>

        <!-- Stats breakdown -->
        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-green-500"></div>
              <span class="text-secondary-700 font-medium">Completed</span>
            </div>
            <span class="text-secondary-900 font-semibold">{{ completionStats.completed }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span class="text-secondary-700 font-medium">In Progress</span>
            </div>
            <span class="text-secondary-900 font-semibold">{{ completionStats.inProgress }}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-secondary-300"></div>
              <span class="text-secondary-700 font-medium">Not Started</span>
            </div>
            <span class="text-secondary-900 font-semibold">{{ completionStats.notStarted }}</span>
          </div>
          <div class="pt-3 border-t border-surface-variant flex items-center justify-between text-sm font-semibold">
            <span class="text-secondary-800">Total Entities</span>
            <span class="text-secondary-900">{{ completionStats.total }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
