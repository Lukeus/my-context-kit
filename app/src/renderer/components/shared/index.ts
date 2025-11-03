/**
 * Shared Component Library - Barrel Export
 * 
 * Centralized exports for all reusable UI primitives.
 * Import these components instead of creating ad-hoc implementations.
 * 
 * @example
 * import { BaseModal, BaseAlert, BaseCard } from '@/components/shared';
 */

export { default as BaseModal } from './BaseModal.vue';
export { default as BaseAlert } from './BaseAlert.vue';
export { default as BaseCard } from './BaseCard.vue';
export { default as BaseBadge } from './BaseBadge.vue';
export { default as BaseButton } from './BaseButton.vue';
export { default as AppLayout } from './AppLayout.vue';

// Re-export types for convenience
export type { AlertSeverity } from './BaseAlert.vue';
export type { BadgeVariant, BadgeSize } from './BaseBadge.vue';
export type { ButtonVariant, ButtonSize } from './BaseButton.vue';
