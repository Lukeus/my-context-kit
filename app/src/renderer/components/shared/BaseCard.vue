<script setup lang="ts">
/**
 * BaseCard Component
 * 
 * Reusable card container with variants, hover states, selection, and slot-based layout.
 * Replaces 8+ duplicate card implementations across the app.
 * 
 * @example
 * <BaseCard variant="elevated" hoverable clickable @click="selectAgent">
 *   <template #header>
 *     <h4 class="font-semibold">Card Title</h4>
 *   </template>
 *   <p>Card content</p>
 *   <template #footer>
 *     <button>Action</button>
 *   </template>
 * </BaseCard>
 */

interface Props {
  variant?: 'elevated' | 'outlined' | 'filled';
  hoverable?: boolean;
  clickable?: boolean;
  selected?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'outlined',
  hoverable: false,
  clickable: false,
  selected: false,
  padding: 'md'
});

const emit = defineEmits<{ click: [] }>();

const variantClasses = {
  elevated: 'bg-surface shadow-elevation-2 border-0',
  outlined: 'bg-white border border-surface-variant shadow-elevation-1',
  filled: 'bg-surface-container-low border-0'
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6'
};

function handleClick() {
  if (props.clickable) {
    emit('click');
  }
}
</script>

<template>
  <div
    :class=" [
      'rounded-m3-md transition-all duration-200',
      variantClasses[variant],
      paddingClasses[padding],
      {
        'hover:shadow-elevation-3': hoverable,
        'cursor-pointer': clickable,
        'ring-2 ring-primary-600': selected
      }
    ]"
    @click="handleClick"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
  >
    <!-- Header Slot -->
    <header v-if="$slots.header" class="mb-3">
      <slot name="header" />
    </header>

    <!-- Default Content Slot -->
    <div>
      <slot />
    </div>

    <!-- Footer Slot -->
    <footer v-if="$slots.footer" class="mt-4 pt-3 border-t border-surface-variant">
      <slot name="footer" />
    </footer>
  </div>
</template>
