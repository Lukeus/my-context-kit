<script setup lang="ts">
/**
 * ModalHeader Component
 * 
 * Reusable header for modals and panels with title, subtitle, actions, and close button.
 * Ensures all buttons are clickable with proper Tailwind styling and no inline CSS.
 * 
 * @example
 * <ModalHeader
 *   title="Context Assistant"
 *   subtitle="Grounded suggestions from your repository"
 *   @close="handleClose"
 * >
 *   <template #actions>
 *     <button class="icon-btn" @click="openSettings">
 *       <SettingsIcon />
 *     </button>
 *   </template>
 * </ModalHeader>
 */

interface Props {
  title: string;
  subtitle?: string;
  variant?: 'modal' | 'panel';
  showClose?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'modal',
  showClose: true
});

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <header
    class="flex items-center gap-3 border-b border-outline-variant"
    :class="[
      variant === 'modal' ? 'px-6 py-5 bg-surface-2 rounded-t-m3-xl' : 'px-3 py-2 bg-surface-container-low'
    ]"
  >
    <!-- Title section -->
    <div class="flex-shrink-0">
      <h2
        class="font-semibold whitespace-nowrap"
        :class="[
          variant === 'modal' ? 'text-xl text-secondary-900' : 'text-sm text-secondary-900 tracking-wide'
        ]"
        :title="title"
      >
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        class="text-secondary-600 mt-1 whitespace-nowrap"
        :class="[
          variant === 'modal' ? 'text-sm' : 'text-xs'
        ]"
      >
        {{ subtitle }}
      </p>
    </div>

    <!-- Actions slot (custom buttons) -->
    <div class="flex items-center gap-1 flex-1 min-w-0 justify-end">
      <slot name="actions" />
      
      <!-- Close button -->
      <button
        v-if="showClose"
        @click="emit('close')"
        class="p-2 rounded-m3-md text-secondary-600 hover:text-secondary-900 hover:bg-surface-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        :class="[
          variant === 'modal' ? 'w-10 h-10' : 'w-8 h-8'
        ]"
        aria-label="Close"
      >
        <svg
          class="w-full h-full"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </header>
</template>
