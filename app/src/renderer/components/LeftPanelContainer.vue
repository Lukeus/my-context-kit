<script setup lang="ts">
import { computed } from 'vue';
import ContextTree from './ContextTree.vue';
import C4DiagramList from './C4DiagramList.vue';

interface Props {
  activeView: 'entities' | 'c4' | 'git' | 'hub' | 'docs' | 'ai' | 'graph' | 'validate';
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'ask-about-entity': [entityId: string];
}>();

function handleAskAboutEntity(entityId: string) {
  emit('ask-about-entity', entityId);
}

// Determine which panel content to show based on active view
const panelContent = computed(() => {
  switch (props.activeView) {
    case 'entities':
      return 'context-tree';
    case 'c4':
      return 'c4-list';
    default:
      return null; // No left panel for other views
  }
});

const shouldShow = computed(() => panelContent.value !== null);
</script>

<template>
  <Transition name="slide-fade">
    <div v-if="shouldShow" class="h-full flex flex-col bg-surface-1 border-r border-surface-variant">
      <!-- Context Tree View -->
      <div v-if="panelContent === 'context-tree'" class="h-full">
        <ContextTree @ask-about-entity="handleAskAboutEntity" />
      </div>
      
      <!-- C4 Diagram List View -->
      <div v-else-if="panelContent === 'c4-list'" class="h-full">
        <C4DiagramList />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
</style>
