<script setup lang="ts">
/**
 * AppLayout Component
 * 
 * Provides a VS Code-like layout with a fixed bottom toolbar.
 * Usage:
 * <AppLayout>
 *   <template #header>...</template>
 *   <template #default>...</template>
 *   <template #toolbar>...</template>
 * </AppLayout>
 */
</script>

<template>
  <div class="flex flex-col min-h-screen bg-surface relative">
    <!-- Header (optional) -->
    <header v-if="$slots.header" class="w-full flex-shrink-0 bg-surface-container-low border-b border-outline-variant">
      <slot name="header" />
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto pb-14">
      <slot />
    </main>

    <!-- Bottom Toolbar -->
    <footer class="w-full flex-shrink-0 fixed bottom-0 left-0 z-40 bg-surface-container-high border-t border-outline-variant shadow-elevation-2 h-14">
      <div class="max-w-7xl mx-auto flex items-center justify-between px-4 py-2 h-14">
        <slot name="toolbar" />
      </div>
    </footer>
  </div>
</template>
