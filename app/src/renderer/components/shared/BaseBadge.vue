<script setup lang="ts">
/**
 * BaseBadge Component
 * 
 * Unified badge/tag component with variant-based styling and sizing.
 * Replaces 7+ duplicate badge implementations across the app.
 * 
 * @example
 * <BaseBadge variant="success" size="sm">Healthy</BaseBadge>
 * <BaseBadge variant="warning" outline>Degraded</BaseBadge>
 * <BaseBadge variant="error" rounded>Offline</BaseBadge>
 */

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'xs' | 'sm' | 'md';

interface Props {
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  rounded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'sm',
  outline: false,
  rounded: false
});

const variantClasses = {
  primary: props.outline 
    ? 'border border-primary-300 text-primary-700 bg-transparent'
    : 'bg-primary-100 text-primary-700',
  secondary: props.outline
    ? 'border border-secondary-300 text-secondary-700 bg-transparent'
    : 'bg-secondary-100 text-secondary-700',
  success: props.outline
    ? 'border border-green-300 text-green-700 bg-transparent'
    : 'bg-green-100 text-green-700',
  warning: props.outline
    ? 'border border-orange-300 text-orange-700 bg-transparent'
    : 'bg-orange-100 text-orange-700',
  error: props.outline
    ? 'border border-error-300 text-error-700 bg-transparent'
    : 'bg-error-100 text-error-700',
  info: props.outline
    ? 'border border-blue-300 text-blue-700 bg-transparent'
    : 'bg-blue-100 text-blue-700'
};

const sizeClasses = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm'
};
</script>

<template>
  <span
    :class=" [
      'inline-flex items-center gap-1 font-semibold',
      variantClasses[variant],
      sizeClasses[size],
      rounded ? 'rounded-full' : 'rounded-m3-md'
    ]"
  >
    <slot />
  </span>
</template>
