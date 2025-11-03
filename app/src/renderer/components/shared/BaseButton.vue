<script setup lang="ts">
/**
 * BaseButton Component
 * 
 * Unified button component with variants, sizes, loading states, and icon support.
 * Standardizes button styling across the entire application.
 * 
 * @example
 * <BaseButton variant="primary" @click="save">Save</BaseButton>
 * <BaseButton variant="danger" loading>Deleting...</BaseButton>
 * <BaseButton variant="ghost" icon-only size="sm">
 *   <svg>...</svg>
 * </BaseButton>
 */

// Component prop types
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  iconOnly: false,
  fullWidth: false
});

const emit = defineEmits<{ click: [event: MouseEvent] }>();

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
}
</script>

<template>
  <button
    :class=" [
      'inline-flex items-center justify-center gap-2 font-medium rounded-m3-md transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-primary/50',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      {
        'bg-primary-600 text-white hover:bg-primary-700 shadow-elevation-1': variant === 'primary' && !disabled && !loading,
        'bg-surface-variant text-secondary-700 hover:bg-surface-variant/80': variant === 'secondary' && !disabled && !loading,
        'text-primary-700 hover:bg-primary-50': variant === 'tertiary' && !disabled && !loading,
        'bg-error-600 text-white hover:bg-error-700 shadow-elevation-1': variant === 'danger' && !disabled && !loading,
        'hover:bg-surface-variant': variant === 'ghost' && !disabled && !loading,
        'px-3 py-1.5 text-sm': size === 'sm' && !iconOnly,
        'px-4 py-2 text-sm': size === 'md' && !iconOnly,
        'px-6 py-3 text-base': size === 'lg' && !iconOnly,
        'p-2 w-8 h-8': iconOnly && size === 'sm',
        'p-2 w-10 h-10': iconOnly && size === 'md',
        'p-3 w-12 h-12': iconOnly && size === 'lg',
        'w-full': fullWidth
      }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="animate-spin text-lg" aria-label="Loading">⟳</span>
    <slot />
  </button>
</template>
