# Component Migration Guide

This guide demonstrates how to migrate from legacy component patterns to the new shared component library.

## Table of Contents

1. [Modal Migration](#modal-migration)
2. [Alert Migration](#alert-migration)
3. [Card Migration](#card-migration)
4. [Badge Migration](#badge-migration)
5. [Button Migration](#button-migration)

---

## Modal Migration

### Before (Legacy Pattern)

```vue
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[960px] max-w-[95vw] max-h-[92vh] flex flex-col border border-surface-variant">
          <div class="px-6 py-5 border-b border-surface-variant">
            <h2 class="text-xl font-semibold">Settings</h2>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <!-- Content -->
          </div>
          <div class="px-6 py-4 border-t border-surface-variant">
            <button @click="save">Save</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const showModal = ref(false);

function save() {
  // ...
  showModal.value = false;
}
</script>
```

### After (Using BaseModal)

```vue
<template>
  <BaseModal :show="showModal" @close="showModal = false" size="xl">
    <template #header>
      <h2 class="text-xl font-semibold">Settings</h2>
    </template>

    <!-- Content (automatically scrollable) -->

    <template #footer>
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="showModal = false">
          Cancel
        </BaseButton>
        <BaseButton variant="primary" @click="save">
          Save
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseModal, BaseButton } from '@/components/shared';

const showModal = ref(false);

function save() {
  // ...
  showModal.value = false;
}
</script>
```

**Benefits:**
- ✅ Automatic Esc key handling
- ✅ Backdrop click-to-close
- ✅ ARIA attributes included
- ✅ Consistent transitions
- ✅ ~40 lines reduced per component

---

## Alert Migration

### Before (Legacy Pattern)

```vue
<template>
  <div v-if="error" class="bg-error-50 border border-error-200 rounded-m3-md px-4 py-3 flex items-start gap-3">
    <svg class="w-5 h-5 text-error-600" fill="currentColor" viewBox="0 0 20 20">
      <path fill-rule="evenodd" d="..." />
    </svg>
    <div class="flex-1">
      <p class="text-sm text-error-700 font-medium">{{ error }}</p>
      <button @click="error = null" class="mt-2 text-xs text-error-600 underline">
        Dismiss
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const error = ref<string | null>(null);

function handleError(message: string) {
  error.value = message;
}
</script>
```

### After (Using BaseAlert)

```vue
<template>
  <BaseAlert
    v-if="error"
    severity="error"
    :message="error"
    @dismiss="error = null"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseAlert } from '@/components/shared';

const error = ref<string | null>(null);

function handleError(message: string) {
  error.value = message;
}
</script>
```

**With Action Button:**

```vue
<BaseAlert
  severity="warning"
  title="Service Degraded"
  message="The Context Kit service is experiencing issues."
  action-label="Retry Connection"
  :action-callback="retryConnection"
  @dismiss="dismissWarning"
/>
```

**Benefits:**
- ✅ Consistent severity colors
- ✅ Built-in animations
- ✅ ARIA live regions
- ✅ ~30 lines reduced per component

---

## Card Migration

### Before (Legacy Pattern)

```vue
<template>
  <div
    class="rounded-m3-md border border-surface-variant bg-white shadow-elevation-1 p-4 hover:shadow-elevation-3 transition-all cursor-pointer"
    @click="selectAgent"
  >
    <div class="flex items-start justify-between mb-2">
      <h4 class="font-medium text-sm">{{ agent.name }}</h4>
      <span class="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-m3-md">
        Active
      </span>
    </div>
    <p class="text-xs text-secondary-600">{{ agent.description }}</p>
    <div class="mt-4 pt-3 border-t border-surface-variant flex justify-end gap-2">
      <button @click.stop="edit">Edit</button>
      <button @click.stop="remove">Delete</button>
    </div>
  </div>
</template>
```

### After (Using BaseCard)

```vue
<template>
  <BaseCard
    variant="outlined"
    hoverable
    clickable
    @click="selectAgent"
  >
    <template #header>
      <div class="flex items-start justify-between">
        <h4 class="font-medium text-sm">{{ agent.name }}</h4>
        <BaseBadge variant="primary" size="xs">Active</BaseBadge>
      </div>
    </template>

    <p class="text-xs text-secondary-600">{{ agent.description }}</p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <BaseButton variant="tertiary" size="sm" @click.stop="edit">
          Edit
        </BaseButton>
        <BaseButton variant="danger" size="sm" @click.stop="remove">
          Delete
        </BaseButton>
      </div>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
import { BaseCard, BaseBadge, BaseButton } from '@/components/shared';

// ...
</script>
```

**Benefits:**
- ✅ Consistent card variants
- ✅ Built-in hover states
- ✅ Selection state support
- ✅ ~20 lines reduced per card

---

## Badge Migration

### Before (Legacy Pattern)

```vue
<template>
  <span
    class="px-2 py-0.5 text-xs font-semibold rounded-m3-md"
    :class="{
      'bg-primary-100 text-primary-700': status === 'active',
      'bg-green-100 text-green-700': status === 'healthy',
      'bg-orange-100 text-orange-700': status === 'degraded',
      'bg-error-100 text-error-700': status === 'error'
    }"
  >
    {{ statusText }}
  </span>
</template>
```

### After (Using BaseBadge)

```vue
<template>
  <BaseBadge :variant="statusVariant" size="sm">
    {{ statusText }}
  </BaseBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge, type BadgeVariant } from '@/components/shared';

const statusVariant = computed<BadgeVariant>(() => {
  const variants: Record<string, BadgeVariant> = {
    active: 'primary',
    healthy: 'success',
    degraded: 'warning',
    error: 'error'
  };
  return variants[status.value] || 'secondary';
});
</script>
```

**Benefits:**
- ✅ Centralized variant mapping
- ✅ Consistent sizing
- ✅ Outline and rounded options
- ✅ ~10 lines reduced per badge

---

## Button Migration

### Before (Legacy Pattern)

```vue
<template>
  <button
    class="px-4 py-2 text-sm font-medium rounded-m3-md shadow-elevation-1 transition-colors"
    :class="isPrimary ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-surface-variant text-secondary-700 hover:bg-surface-variant/80'"
    :disabled="isLoading || disabled"
    @click="handleClick"
  >
    <span v-if="isLoading" class="animate-spin">⟳</span>
    {{ label }}
  </button>
</template>
```

### After (Using BaseButton)

```vue
<template>
  <BaseButton
    :variant="isPrimary ? 'primary' : 'secondary'"
    :loading="isLoading"
    :disabled="disabled"
    @click="handleClick"
  >
    {{ label }}
  </BaseButton>
</template>

<script setup lang="ts">
import { BaseButton } from '@/components/shared';

// ...
</script>
```

**Icon-Only Button:**

```vue
<BaseButton variant="ghost" icon-only size="sm" aria-label="Close">
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
</BaseButton>
```

**Benefits:**
- ✅ Consistent button variants
- ✅ Built-in loading states
- ✅ Focus ring management
- ✅ Icon-only support

---

## Complete Migration Example

Here's a full component migration from legacy patterns to shared components:

### Before

```vue
<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-surface rounded-m3-xl w-full max-w-2xl p-6">
        <header class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Agent Settings</h2>
          <button class="p-2 text-secondary-600 hover:text-secondary-900" @click="close">✕</button>
        </header>

        <div v-if="error" class="mb-4 bg-error-50 border border-error-200 rounded-m3-md p-4">
          <p class="text-sm text-error-700">{{ error }}</p>
        </div>

        <div class="space-y-4">
          <div
            v-for="agent in agents"
            :key="agent.id"
            class="border border-surface-variant rounded-m3-md p-4 hover:shadow-elevation-2 cursor-pointer"
            @click="selectAgent(agent)"
          >
            <div class="flex items-center justify-between">
              <h4 class="font-medium">{{ agent.name }}</h4>
              <span
                class="px-2 py-0.5 text-xs rounded-m3-md"
                :class="agent.isActive ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-700'"
              >
                {{ agent.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
        </div>

        <footer class="mt-6 flex justify-end gap-2">
          <button class="px-4 py-2 bg-surface-variant rounded-m3-md" @click="close">
            Cancel
          </button>
          <button class="px-4 py-2 bg-primary-600 text-white rounded-m3-md" @click="save">
            Save
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 80+ lines of template + logic
</script>
```

### After

```vue
<template>
  <BaseModal :show="show" @close="close" size="md" title="Agent Settings">
    <template #header>
      <h2 class="text-lg font-semibold">Agent Settings</h2>
    </template>

    <BaseAlert
      v-if="error"
      severity="error"
      :message="error"
      class="mb-4"
      @dismiss="error = null"
    />

    <div class="space-y-4">
      <BaseCard
        v-for="agent in agents"
        :key="agent.id"
        variant="outlined"
        hoverable
        clickable
        @click="selectAgent(agent)"
      >
        <div class="flex items-center justify-between">
          <h4 class="font-medium">{{ agent.name }}</h4>
          <BaseBadge :variant="agent.isActive ? 'primary' : 'secondary'" size="sm">
            {{ agent.isActive ? 'Active' : 'Inactive' }}
          </BaseBadge>
        </div>
      </BaseCard>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <BaseButton variant="secondary" @click="close">
          Cancel
        </BaseButton>
        <BaseButton variant="primary" @click="save">
          Save
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseAlert, BaseCard, BaseBadge, BaseButton } from '@/components/shared';

// ~40 lines of template + logic (50% reduction)
</script>
```

**Overall Benefits:**
- ✅ 50% code reduction
- ✅ Consistent Material 3 styling
- ✅ Improved accessibility
- ✅ Easier maintenance
- ✅ Better testability

---

## TypeScript Type Imports

```typescript
import type { AlertSeverity, BadgeVariant, BadgeSize, ButtonVariant, ButtonSize } from '@/components/shared';

// Use in component props or computed values
const severity = computed<AlertSeverity>(() => {
  return hasError ? 'error' : 'info';
});
```

---

## Auto-Import Configuration (Optional)

Add to `vite.renderer.config.ts`:

```typescript
import Components from 'unplugin-vue-components/vite';

export default {
  plugins: [
    Components({
      dirs: ['src/renderer/components/shared'],
      dts: 'src/renderer/components/shared/components.d.ts',
    }),
  ],
};
```

This allows using shared components without explicit imports:

```vue
<template>
  <!-- No import needed! -->
  <BaseModal :show="true">
    <BaseAlert severity="success" message="Done!" />
  </BaseModal>
</template>
```

---

## Next Steps

1. Review the shared component implementations
2. Choose a low-risk component to migrate first (e.g., a badge or alert)
3. Test the migration thoroughly
4. Gradually migrate remaining components
5. Remove legacy patterns once all migrations are complete

For questions or issues, refer to `CODE_REVIEW_COMPONENT_REUSABILITY.md`.
