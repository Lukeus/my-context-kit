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
export { default as ModalHeader } from './ModalHeader.vue';

// Note: Component prop types are available directly from their respective Vue files
// For TypeScript usage, import components and use their Props interfaces
// Example: ComponentProps<typeof BaseButton> for accessing ButtonVariant, ButtonSize
