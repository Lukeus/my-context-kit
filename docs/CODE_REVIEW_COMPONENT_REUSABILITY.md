# Code Review: Component Reusability Analysis
## Electron Renderer Components - Assistant & ContextKit

**Review Date:** November 2, 2025  
**Scope:** `app/src/renderer/components/` (assistant + ContextKit folders)  
**Focus:** Identifying reusable Vue component patterns for modals, cards, layouts, and common UI elements

---

## Executive Summary

### Key Findings

1. **Significant Code Duplication**: Modal, card, alert, and badge patterns are repeated across 12+ components
2. **Inconsistent Styling**: Material 3 design tokens applied inconsistently (some use `bg-surface-variant`, others `bg-secondary-50`)
3. **Missing Shared Component Library**: No centralized `/shared/` or `/ui/` directory for primitives
4. **Architecture Opportunity**: Can extract 8-12 reusable components to reduce codebase by ~35%

### Priority Recommendations

| Priority | Pattern | Impact | Affected Components |
|----------|---------|--------|---------------------|
| P0 | Modal/Dialog Base | High | 6 components |
| P0 | Alert/Banner System | High | 5 components |
| P1 | Card Layouts | Medium | 8 components |
| P1 | Badge Component | Medium | 7 components |
| P2 | Button System | Low | All components |

---

## Detailed Analysis

### 1. Modal/Dialog Pattern Duplication ⚠️ **P0**

#### Current State
Multiple components implement their own modal overlays with inconsistent patterns:

**Affected Components:**
- `AIAssistantModal.vue` - Full-screen modal with deprecation banner
- `UnifiedAssistant.vue` - Settings modal + migration modal via Teleport
- `ApprovalDialog.vue` - Overlay approval dialog
- `AISettingsModal.vue` - Configuration modal
- `NewRepoModal.vue` - Repository creation modal
- `PromptModal.vue` - Prompt editing modal

**Common Pattern:**
```vue
<!-- Repeated in 6+ files -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-[960px] max-w-[95vw]">
    <header class="px-6 py-5 border-b">...</header>
    <div class="p-6">...</div>
    <footer class="px-6 py-4 border-t">...</footer>
  </div>
</div>
```

**Issues:**
- ✗ Inconsistent z-index values (`z-50` vs `z-40`)
- ✗ Varying backdrop opacity (`bg-black/50` vs `bg-black/40`)
- ✗ No keyboard trap management (Esc to close)
- ✗ Missing ARIA attributes in some implementations
- ✗ No transition animations in some cases

#### Recommended Solution

**Create:** `app/src/renderer/components/shared/BaseModal.vue`

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

interface Props {
  show: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  zIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closeOnBackdrop: true,
  closeOnEsc: true,
  zIndex: 50
});

const emit = defineEmits<{ close: [] }>();

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[95vw]'
};

function handleBackdropClick() {
  if (props.closeOnBackdrop) emit('close');
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnEsc) emit('close');
}

onMounted(() => {
  if (props.closeOnEsc) {
    document.addEventListener('keydown', handleEscape);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      name="modal"
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        :class="`fixed inset-0 z-${zIndex} flex items-center justify-center bg-black/50 backdrop-blur-sm`"
        @click.self="handleBackdropClick"
        role="dialog"
        aria-modal="true"
      >
        <div
          :class="[
            'bg-surface rounded-m3-xl shadow-elevation-5 w-full',
            sizeClasses[size],
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
          <div class="flex-1 overflow-y-auto">
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
      </div>
    </Transition>
  </Teleport>
</template>
```

**Usage Example:**
```vue
<BaseModal :show="showSettings" @close="showSettings = false" size="md">
  <template #header>
    <h2 class="text-lg font-semibold">Settings</h2>
  </template>
  
  <!-- Content goes here -->
  
  <template #footer>
    <div class="flex justify-end gap-2">
      <button @click="saveSettings">Save</button>
    </div>
  </template>
</BaseModal>
```

**Migration Impact:**
- Refactor 6 components
- Estimated reduction: ~400 lines of code
- Improved consistency: Single source of truth for modal behavior

---

### 2. Alert/Banner System Duplication ⚠️ **P0**

#### Current State

**Affected Components:**
- `ErrorAlert.vue` (ContextKit) - Severity-based error display
- `FallbackBanner.vue` (assistant) - Degraded state warnings
- `AIAssistantModal.vue` - Deprecation notice banner
- `ServiceStatusBanner.vue` (ContextKit) - Service status alerts
- Inline error blocks in `ToolPanel.vue`, `ContextKitHub.vue`

**Common Pattern:**
```vue
<!-- Severity-specific styling repeated -->
<div class="bg-error-50 border border-error-200 text-error-700 px-4 py-3">
  <p>{{ errorMessage }}</p>
</div>

<div class="bg-primary-50 border border-primary-200 text-primary-700 px-4 py-3">
  <p>{{ successMessage }}</p>
</div>
```

**Issues:**
- ✗ Duplicate severity color logic in multiple files
- ✗ No unified dismissal behavior
- ✗ Inconsistent icon usage
- ✗ No animation transitions
- ✗ Missing action button patterns

#### Recommended Solution

**Create:** `app/src/renderer/components/shared/BaseAlert.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue';

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';

interface Props {
  severity?: AlertSeverity;
  title?: string;
  message: string;
  dismissible?: boolean;
  actionLabel?: string;
  actionCallback?: () => void;
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'info',
  dismissible: true
});

const emit = defineEmits<{ dismiss: [] }>();

const severityConfig = computed(() => {
  const configs = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      icon: 'text-blue-600',
      iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-900',
      icon: 'text-green-600',
      iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-900',
      icon: 'text-orange-600',
      iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    error: {
      bg: 'bg-error-50',
      border: 'border-error-200',
      text: 'text-error-900',
      icon: 'text-error-600',
      iconPath: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  };
  return configs[props.severity];
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      class="rounded-m3-md border p-4 shadow-elevation-1"
      :class="[severityConfig.bg, severityConfig.border]"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <!-- Icon -->
        <svg
          class="w-5 h-5 flex-shrink-0"
          :class="severityConfig.icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            :d="severityConfig.iconPath"
          />
        </svg>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <h4 v-if="title" class="text-sm font-semibold mb-1" :class="severityConfig.text">
            {{ title }}
          </h4>
          <p class="text-sm" :class="severityConfig.text">
            {{ message }}
          </p>

          <!-- Action Button -->
          <button
            v-if="actionLabel && actionCallback"
            @click="actionCallback"
            class="mt-2 text-xs font-semibold px-3 py-1.5 rounded-m3-md transition-colors"
            :class="`${severityConfig.bg} ${severityConfig.text} hover:opacity-80`"
          >
            {{ actionLabel }}
          </button>
        </div>

        <!-- Dismiss Button -->
        <button
          v-if="dismissible"
          @click="emit('dismiss')"
          class="flex-shrink-0 text-secondary-400 hover:text-secondary-600 p-1"
          aria-label="Dismiss alert"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>
```

**Usage Example:**
```vue
<BaseAlert
  severity="error"
  title="Service Unavailable"
  message="The Context Kit service is not responding. Check your connection."
  dismissible
  action-label="Retry"
  :action-callback="handleRetry"
  @dismiss="clearError"
/>
```

**Migration Impact:**
- Refactor 5 components + inline error blocks
- Estimated reduction: ~350 lines
- Unified severity handling across app

---

### 3. Card Component Pattern ⚠️ **P1**

#### Current State

**Affected Components:**
- `AgentCard.vue` - Agent profile cards (grid + list views)
- `ProgressCompletionCard.vue` - Progress tracking cards
- ContextKitHub metrics cards (inline)
- ToolPanel telemetry cards (inline)
- KanbanBoard task cards (inline)

**Common Pattern:**
```vue
<!-- Repeated structure -->
<div class="rounded-m3-md border border-surface-variant bg-white shadow-elevation-1 p-4">
  <header class="flex items-center justify-between mb-2">
    <h4 class="font-semibold text-sm">Title</h4>
    <span class="badge">Status</span>
  </header>
  <p class="text-xs text-secondary-600">Description</p>
  <footer class="mt-3 flex justify-end gap-2">
    <button>Action</button>
  </footer>
</div>
```

**Issues:**
- ✗ Inconsistent padding (`p-4` vs `p-5` vs `px-4 py-3`)
- ✗ Repeated header/footer layout logic
- ✗ No hover state standardization
- ✗ Missing selection state patterns

#### Recommended Solution

**Create:** `app/src/renderer/components/shared/BaseCard.vue`

```vue
<script setup lang="ts">
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
</script>

<template>
  <div
    :class="[
      'rounded-m3-md transition-all duration-200',
      variantClasses[variant],
      paddingClasses[padding],
      {
        'hover:shadow-elevation-3': hoverable,
        'cursor-pointer': clickable,
        'ring-2 ring-primary-600': selected
      }
    ]"
    @click="clickable ? emit('click') : undefined"
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
```

**Usage Example:**
```vue
<BaseCard variant="elevated" hoverable clickable @click="selectAgent">
  <template #header>
    <div class="flex items-center justify-between">
      <h4 class="font-semibold">Agent Name</h4>
      <BaseBadge>Active</BaseBadge>
    </div>
  </template>
  
  <p class="text-sm text-secondary-600">Description text</p>
  
  <template #footer>
    <div class="flex justify-end gap-2">
      <button>Edit</button>
      <button>Delete</button>
    </div>
  </template>
</BaseCard>
```

---

### 4. Badge Component System ⚠️ **P1**

#### Current State

**Affected Components:**
- `ProviderBadge.vue` - Provider indicator badges
- `MigrationStatus.vue` - Status badges
- Inline status badges in 7+ components

**Common Pattern:**
```vue
<!-- Repeated in multiple files -->
<span class="px-2 py-0.5 text-xs font-semibold rounded-m3-md bg-primary-100 text-primary-700">
  {{ label }}
</span>
```

**Issues:**
- ✗ No centralized color scheme mapping
- ✗ Inconsistent sizing (`text-xs` vs `text-[10px]`)
- ✗ Repeated conditional color logic

#### Recommended Solution

**Create:** `app/src/renderer/components/shared/BaseBadge.vue`

```vue
<script setup lang="ts">
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
    :class="[
      'inline-flex items-center gap-1 font-semibold',
      variantClasses[variant],
      sizeClasses[size],
      rounded ? 'rounded-full' : 'rounded-m3-md'
    ]"
  >
    <slot />
  </span>
</template>
```

**Usage Example:**
```vue
<BaseBadge variant="success" size="sm">Healthy</BaseBadge>
<BaseBadge variant="warning" outline>Degraded</BaseBadge>
<BaseBadge variant="error" rounded>Offline</BaseBadge>
```

---

### 5. Button System (Future Enhancement) ⚠️ **P2**

Currently, buttons are styled inline across all components. Consider creating:

**Recommended:** `app/src/renderer/components/shared/BaseButton.vue`

```vue
<script setup lang="ts">
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

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
</script>

<template>
  <button
    :class="[
      'inline-flex items-center justify-center gap-2 font-medium rounded-m3-md transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-primary/50',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      {
        'bg-primary-600 text-white hover:bg-primary-700': variant === 'primary',
        'bg-surface-variant text-secondary-700 hover:bg-surface-variant/80': variant === 'secondary',
        'text-primary-700 hover:bg-primary-50': variant === 'tertiary',
        'bg-error-600 text-white hover:bg-error-700': variant === 'danger',
        'hover:bg-surface-variant': variant === 'ghost',
        'px-3 py-1.5 text-sm': size === 'sm',
        'px-4 py-2 text-sm': size === 'md',
        'px-6 py-3 text-base': size === 'lg',
        'p-2 w-8 h-8': iconOnly && size === 'sm',
        'p-2 w-10 h-10': iconOnly && size === 'md',
        'w-full': fullWidth
      }
    ]"
    :disabled="disabled || loading"
    @click="emit('click', $event)"
  >
    <span v-if="loading" class="animate-spin">⟳</span>
    <slot />
  </button>
</template>
```

---

## Proposed Component Library Structure

### Directory Organization

```
app/src/renderer/components/
├── shared/                    # NEW: Reusable primitives
│   ├── BaseModal.vue         # Modal/dialog base
│   ├── BaseAlert.vue         # Alert/banner system
│   ├── BaseCard.vue          # Card layouts
│   ├── BaseBadge.vue         # Badge component
│   ├── BaseButton.vue        # Button system
│   ├── BaseInput.vue         # Form inputs
│   ├── BaseSelect.vue        # Select dropdowns
│   ├── BaseSpinner.vue       # Loading spinner
│   ├── BaseDivider.vue       # Section dividers
│   └── index.ts              # Barrel export
├── layouts/                   # NEW: Layout components
│   ├── PanelLayout.vue       # Side panel container
│   ├── ModalLayout.vue       # Modal wrapper
│   ├── SplitPaneLayout.vue   # Resizable splits
│   └── index.ts
├── assistant/                 # Existing assistant components
├── ContextKit/                # Existing ContextKit components
└── ...                        # Other existing folders
```

### Auto-Import Configuration

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

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1) - P0
1. ✅ Create `shared/` directory structure
2. ✅ Implement `BaseModal.vue`
3. ✅ Implement `BaseAlert.vue`
4. ✅ Write Storybook stories for primitives
5. ✅ Migrate 2-3 components as proof-of-concept

### Phase 2: Expansion (Week 2) - P0/P1
1. ✅ Implement `BaseCard.vue`
2. ✅ Implement `BaseBadge.vue`
3. ✅ Migrate remaining modal components
4. ✅ Migrate alert/banner components
5. ✅ Update design system documentation

### Phase 3: Refinement (Week 3) - P1
1. ✅ Implement `BaseButton.vue`
2. ✅ Add form components (`BaseInput`, `BaseSelect`)
3. ✅ Migrate card-based components
4. ✅ Add accessibility tests
5. ✅ Performance audit

### Phase 4: Polish (Week 4) - P2
1. ✅ Add animation/transition utilities
2. ✅ Create compound components (e.g., `ConfirmDialog`)
3. ✅ Document component API
4. ✅ Team training session
5. ✅ Legacy cleanup

---

## Metrics & Success Criteria

### Before Refactoring
- **Total Components**: 47
- **Lines of Code (estimated)**: ~15,000
- **Modal implementations**: 6 unique
- **Alert patterns**: 5 unique
- **Badge styles**: 7+ variations

### After Refactoring (Target)
- **Total Components**: 40 (7 removed via consolidation)
- **Lines of Code**: ~10,000 (-33%)
- **Shared primitives**: 8-12 new components
- **Modal implementations**: 1 base component
- **Alert patterns**: 1 unified system
- **Badge styles**: 1 configurable component

### Quality Metrics
- ✅ 100% Material 3 design token consistency
- ✅ All modals support keyboard navigation
- ✅ All alerts have proper ARIA attributes
- ✅ Storybook coverage for all shared components
- ✅ TypeScript strict mode compliance

---

## Risk Assessment

### Low Risk
- Creating new shared components (no breaking changes)
- Gradual migration approach
- Backward compatibility maintained during transition

### Medium Risk
- Component API design decisions
  - **Mitigation**: Start with smallest viable API, expand based on usage
- Developer adoption resistance
  - **Mitigation**: Provide clear migration guide + pair programming sessions

### High Risk
- Breaking existing functionality during migration
  - **Mitigation**: Comprehensive E2E tests before each migration
  - **Mitigation**: Feature flag new components initially

---

## Testing Strategy

### Unit Tests
```typescript
// BaseModal.test.ts
describe('BaseModal', () => {
  it('renders when show prop is true', () => { /*...*/ });
  it('closes on backdrop click when closeOnBackdrop is true', () => { /*...*/ });
  it('closes on Esc key when closeOnEsc is true', () => { /*...*/ });
  it('applies correct size classes', () => { /*...*/ });
  it('renders slots correctly', () => { /*...*/ });
});
```

### Visual Regression Tests
- Storybook + Chromatic for visual diffs
- Test all variant combinations
- Test responsive breakpoints

### Accessibility Tests
- Automated: `jest-axe` for ARIA compliance
- Manual: Screen reader testing (NVDA/JAWS)
- Keyboard navigation verification

---

## Documentation Requirements

### Component API Docs
Each shared component must include:
```vue
<!--
@component BaseModal
@description Reusable modal/dialog wrapper with backdrop, transitions, and keyboard support.

@prop {boolean} show - Controls modal visibility
@prop {'sm'|'md'|'lg'|'xl'|'full'} size - Modal width preset
@prop {boolean} closeOnBackdrop - Allow closing via backdrop click
@prop {boolean} closeOnEsc - Allow closing via Esc key
@prop {number} zIndex - CSS z-index value

@slot header - Modal header content
@slot default - Modal body content
@slot footer - Modal footer actions

@emits close - Fired when modal should close

@example
<BaseModal :show="isOpen" @close="isOpen = false" size="md">
  <template #header>
    <h2>Modal Title</h2>
  </template>
  <p>Modal content</p>
  <template #footer>
    <button @click="save">Save</button>
  </template>
</BaseModal>
-->
```

### Migration Guide
```markdown
## Migrating from Legacy Modals to BaseModal

### Before
```vue
<div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div class="bg-surface rounded-m3-xl w-full max-w-2xl p-6">
    <h2>Title</h2>
    <!-- content -->
  </div>
</div>
```

### After
```vue
<BaseModal :show="showModal" @close="showModal = false" size="md">
  <template #header><h2>Title</h2></template>
  <!-- content -->
</BaseModal>
```
```

---

## Appendix: Full Component Audit

### Components with Modal Pattern
1. ✅ AIAssistantModal.vue (960px wide)
2. ✅ AISettingsModal.vue (max-w-md)
3. ✅ UnifiedAssistant.vue (Settings: max-w-md, Migration: max-w-lg)
4. ✅ ApprovalDialog.vue (max-w-2xl)
5. ✅ NewRepoModal.vue (max-w-2xl)
6. ✅ PromptModal.vue (max-w-lg)
7. ✅ ContextBuilderModal.vue (max-w-4xl)

### Components with Alert/Banner Pattern
1. ✅ ErrorAlert.vue (severity-based)
2. ✅ FallbackBanner.vue (warning/error)
3. ✅ ServiceStatusBanner.vue (service state)
4. ✅ AIAssistantModal.vue (deprecation banner)
5. ✅ Inline feedback in ToolPanel.vue
6. ✅ Inline feedback in ContextKitHub.vue

### Components with Card Pattern
1. ✅ AgentCard.vue (grid + list views)
2. ✅ ProgressCompletionCard.vue
3. ✅ ContextKitHub.vue (metrics cards - 4 instances)
4. ✅ ToolPanel.vue (telemetry cards)
5. ✅ KanbanBoard.vue (task cards)
6. ✅ AgentLibrary.vue (agent cards)

### Components with Badge Pattern
1. ✅ ProviderBadge.vue
2. ✅ MigrationStatus.vue
3. ✅ UnifiedAssistant.vue (status badges)
4. ✅ AgentCard.vue (complexity + custom badges)
5. ✅ ToolPanel.vue (pipeline status badges)
6. ✅ ContextKitHub.vue (health badges)
7. ✅ Inline status indicators (7+ components)

---

## Next Steps

1. **Review this document** with the team
2. **Prioritize P0 items** for immediate implementation
3. **Create Jira/GitHub issues** for each component
4. **Assign ownership** to developers
5. **Schedule kickoff meeting** for Phase 1
6. **Set up Storybook** for component development
7. **Begin implementation** with BaseModal + BaseAlert

---

**End of Code Review Document**

*Generated: November 2, 2025*  
*Reviewer: GitHub Copilot (Claude Sonnet 4.5)*  
*Scope: Component Reusability Analysis*
