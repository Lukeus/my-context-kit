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

// Component prop types
type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'xs' | 'sm' | 'md';

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
    ? 'border border-outline text-primary bg-transparent'
    : 'bg-primary-container text-on-primary-container',
  secondary: props.outline
    ? 'border border-outline text-secondary bg-transparent'
    : 'bg-surface-variant text-on-surface-variant',
  success: props.outline
    ? 'border border-outline text-success bg-transparent'
    : 'bg-success-container text-on-success-container',
  warning: props.outline
    ? 'border border-outline text-warning bg-transparent'
    : 'bg-warning-container text-on-warning-container',
  error: props.outline
    ? 'border border-outline text-error bg-transparent'
    : 'bg-error-container text-on-error-container',
  info: props.outline
    ? 'border border-outline text-info bg-transparent'
    : 'bg-info-container text-on-info-container'
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
