<script setup lang="ts">
/**
 * BaseModal Component
 * 
 * Reusable modal/dialog wrapper with backdrop, transitions, keyboard support, and ARIA compliance.
 * Replaces 6+ duplicate modal implementations across the app.
 * 
 * @example
 * <BaseModal :show="isOpen" @close="isOpen = false" size="md">
 *   <template #header>
 *     <h2>Modal Title</h2>
 *   </template>
 *   <p>Modal content</p>
 *   <template #footer>
 *     <button @click="save">Save</button>
 *   </template>
 * </BaseModal>
 */

import { onMounted, onUnmounted, computed } from 'vue';

interface Props {
  show: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  zIndex?: number;
  title?: string;
  ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closeOnBackdrop: true,
  closeOnEsc: true,
  zIndex: 50
});

const emit = defineEmits<{ close: [] }>();

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]'
  };
  return sizes[props.size];
});

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    emit('close');
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnEsc) {
    emit('close');
  }
}

onMounted(() => {
  if (props.closeOnEsc) {
    document.addEventListener('keydown', handleEscape);
  }
  // Prevent body scroll when modal is open
  if (props.show) {
    document.body.style.overflow = 'hidden';
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        :style="{ zIndex }"
        @click.self="handleBackdropClick"
        role="dialog"
        :aria-modal="true"
        :aria-label="ariaLabel || title"
      >
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="show"
            :class=" [
              'bg-surface rounded-m3-xl shadow-elevation-5 w-full',
              sizeClasses,
              'flex flex-col max-h-[92vh] border border-surface-variant'
            ]"
          >
            <!-- Header Slot -->
            <header
              v-if="$slots.header"
              class="px-6 py-5 border-b border-surface-variant bg-surface-container-low flex-shrink-0"
            >
              <slot name="header" />
            </header>

            <!-- Body Slot -->
            <div class="flex-1 overflow-y-auto px-6 py-5">
              <slot />
            </div>

            <!-- Footer Slot -->
            <footer
              v-if="$slots.footer"
              class="px-6 py-4 border-t border-surface-variant bg-surface-container-low flex-shrink-0"
            >
              <slot name="footer" />
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
</script>
