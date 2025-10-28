<script setup lang="ts">
import { useRouting } from '../composables/useRouting';

const { breadcrumbs, navigateToPath } = useRouting();
</script>

<template>
  <nav 
    v-if="breadcrumbs.length > 1" 
    class="flex items-center gap-2 px-4 py-2 bg-surface-1 border-b border-surface-variant text-sm"
    aria-label="Breadcrumb">
    <svg class="w-4 h-4 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
    
    <div class="flex items-center gap-2">
      <button
        v-for="(crumb, i) in breadcrumbs"
        :key="crumb.path"
        @click="navigateToPath(crumb.path)"
        class="flex items-center gap-2 group">
        
        <!-- Separator -->
        <svg 
          v-if="i > 0"
          class="w-4 h-4 text-secondary-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        
        <!-- Breadcrumb label -->
        <span
          :class="[
            i === breadcrumbs.length - 1
              ? 'text-primary-700 font-semibold'
              : 'text-secondary-600 hover:text-primary-600 hover:underline transition-colors'
          ]">
          {{ crumb.name }}
        </span>
      </button>
    </div>
  </nav>
</template>
