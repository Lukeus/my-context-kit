# Material 3 Design System - With Brand Edition

## Overview

This design system provides a comprehensive, token-driven approach to styling Vue components using Tailwind CSS with Material Design 3 principles and Intel brand colors.

**Core Principle**: Never use hardcoded color names (like `bg-blue-500` or `text-red-600`). Always use semantic design tokens.

## Token Categories

### 1. Primary Colors (Intel Blue)
Main brand actions, CTAs, and primary emphasis.

```vue
<!-- ✅ CORRECT -->
<button class="bg-primary text-white hover:bg-primary-700">
  Primary Action
</button>

<div class="text-primary-900 bg-primary-50">
  Subtle primary container
</div>

<!-- ❌ WRONG -->
<button class="bg-blue-600 text-white">Action</button>
```

**Available tokens:**
- `primary-50` through `primary-900` - Scale from lightest to darkest
- `primary-container` - Container background
- `primary-on-container` - Text on container

### 2. Secondary Colors (Intel Gray)
Supporting elements, less prominent UI, body text.

```vue
<!-- ✅ CORRECT -->
<p class="text-secondary-700">Body text content</p>
<div class="bg-secondary-100 border-secondary-300">Card</div>

<!-- ❌ WRONG -->
<p class="text-gray-700">Content</p>
```

### 3. Tertiary Colors (Intel Cyan)
Accents, highlights, and contrasting elements.

```vue
<!-- ✅ CORRECT -->
<span class="bg-tertiary-100 text-tertiary-800">Accent Badge</span>

<!-- ❌ WRONG -->
<span class="bg-cyan-100 text-cyan-800">Badge</span>
```

### 4. Semantic Status Colors

Never use generic colors for status indicators. Use semantic tokens:

#### Success States
```vue
<!-- ✅ CORRECT -->
<div class="bg-success-100 text-success-800 border-success-300">
  Operation completed successfully
</div>

<!-- ❌ WRONG -->
<div class="bg-green-100 text-green-800">Success</div>
```

#### Error States
```vue
<!-- ✅ CORRECT -->
<div class="bg-error-100 text-error-800 border-error-300">
  Error occurred
</div>

<!-- ❌ WRONG -->
<div class="bg-red-100 text-red-800">Error</div>
```

#### Warning States
```vue
<!-- ✅ CORRECT -->
<div class="bg-warning-100 text-warning-800 border-warning-300">
  Warning message
</div>

<!-- ❌ WRONG -->
<div class="bg-yellow-100 text-yellow-800">Warning</div>
```

#### Info States
```vue
<!-- ✅ CORRECT -->
<div class="bg-info-100 text-info-800 border-info-300">
  Information notice
</div>

<!-- ❌ WRONG -->
<div class="bg-blue-100 text-blue-800">Info</div>
```

### 5. Surface Colors

Background and container colors with proper elevation.

```vue
<!-- ✅ CORRECT -->
<div class="bg-surface">Main background</div>
<div class="bg-surface-1">Elevated surface level 1</div>
<div class="bg-surface-2 border-surface-variant">Card with border</div>

<!-- ❌ WRONG -->
<div class="bg-white">Background</div>
<div class="bg-gray-50">Card</div>
```

### 6. Status Indicator Colors

For entity/task status badges and dots:

```vue
<script setup lang="ts">
function getStatusClasses(status: string): string {
  const statusMap: Record<string, string> = {
    'proposed': 'bg-info-100 text-info-800',
    'in-progress': 'bg-warning-100 text-warning-800',
    'doing': 'bg-warning-100 text-warning-800',
    'done': 'bg-success-100 text-success-800',
    'blocked': 'bg-error-100 text-error-800',
    'needs-review': 'bg-warning-200 text-warning-900',
    'todo': 'bg-secondary-100 text-secondary-800',
  };
  
  return statusMap[status] || 'bg-secondary-100 text-secondary-700';
}
</script>

<template>
  <!-- ✅ CORRECT -->
  <span :class="getStatusClasses(entity.status)" class="px-2 py-1 rounded-m3-md text-xs">
    {{ entity.status }}
  </span>
  
  <!-- Status dot -->
  <span class="h-3 w-3 rounded-m3-full" :class="getStatusClasses(entity.status)" />
</template>
```

## Material 3 Components

### Elevation and Shadows

Use Material 3 elevation system for depth:

```vue
<!-- ✅ CORRECT -->
<div class="shadow-elevation-1">Subtle elevation</div>
<div class="shadow-elevation-2 hover:shadow-elevation-3">Interactive card</div>
<div class="shadow-elevation-5">Modal overlay</div>

<!-- ❌ WRONG -->
<div class="shadow-lg">Card</div>
```

**Elevation levels:**
- `elevation-0` - No shadow (flat)
- `elevation-1` - Subtle (buttons, chips)
- `elevation-2` - Cards, tiles
- `elevation-3` - FABs, menus
- `elevation-4` - Navigation drawer
- `elevation-5` - Modals, dialogs

### Border Radius

Use Material 3 shape tokens:

```vue
<!-- ✅ CORRECT -->
<button class="rounded-m3-md">Button</button>
<div class="rounded-m3-lg">Card</div>
<span class="rounded-m3-full">Badge</span>

<!-- ❌ WRONG -->
<button class="rounded-lg">Button</button>
```

**Shape tokens:**
- `m3-none` - 0px (sharp corners)
- `m3-xs` - 4px (subtle rounding)
- `m3-sm` - 8px (small components)
- `m3-md` - 12px (default for most components)
- `m3-lg` - 16px (cards, large surfaces)
- `m3-xl` - 28px (prominent components)
- `m3-full` - 9999px (pills, badges, avatar)

## Common Patterns

### Buttons

```vue
<!-- Primary Button -->
<button class="px-4 py-2 bg-primary text-white rounded-m3-md hover:bg-primary-700 active:bg-primary-800 shadow-elevation-1 hover:shadow-elevation-2 transition-all">
  Primary Action
</button>

<!-- Secondary Button -->
<button class="px-4 py-2 bg-secondary-100 text-secondary-900 rounded-m3-md hover:bg-secondary-200 border border-secondary-300 transition-all">
  Secondary Action
</button>

<!-- Danger Button -->
<button class="px-4 py-2 bg-error text-white rounded-m3-md hover:bg-error-700 active:bg-error-800 shadow-elevation-1 hover:shadow-elevation-2 transition-all">
  Delete
</button>

<!-- Disabled state -->
<button class="px-4 py-2 bg-primary text-white rounded-m3-md opacity-50 cursor-not-allowed" disabled>
  Disabled
</button>
```

### Cards

```vue
<div class="bg-surface rounded-m3-lg border border-surface-variant shadow-elevation-2 hover:shadow-elevation-3 transition-all">
  <div class="px-6 py-4 border-b border-surface-variant">
    <h3 class="text-lg font-semibold text-secondary-900">Card Title</h3>
  </div>
  <div class="px-6 py-4">
    <p class="text-secondary-700">Card content</p>
  </div>
</div>
```

### Badges

```vue
<!-- Status Badge -->
<span class="px-3 py-1 rounded-m3-full text-xs font-medium bg-success-100 text-success-800 border border-success-300">
  Active
</span>

<!-- Count Badge -->
<span class="px-2 py-0.5 rounded-m3-full text-xs font-semibold bg-error text-white">
  5
</span>
```

### Alerts/Banners

```vue
<!-- Success Alert -->
<div class="flex items-center gap-3 px-4 py-3 rounded-m3-md bg-success-100 border-2 border-success-300">
  <svg class="w-5 h-5 text-success-700" />
  <span class="text-success-900 font-medium">Operation completed successfully</span>
</div>

<!-- Error Alert -->
<div class="flex items-center gap-3 px-4 py-3 rounded-m3-md bg-error-100 border-2 border-error-300">
  <svg class="w-5 h-5 text-error-700" />
  <span class="text-error-900 font-medium">An error occurred</span>
</div>

<!-- Warning Alert -->
<div class="flex items-center gap-3 px-4 py-3 rounded-m3-md bg-warning-100 border-2 border-warning-300">
  <svg class="w-5 h-5 text-warning-700" />
  <span class="text-warning-900 font-medium">Please review this carefully</span>
</div>

<!-- Info Alert -->
<div class="flex items-center gap-3 px-4 py-3 rounded-m3-md bg-info-100 border-2 border-info-300">
  <svg class="w-5 h-5 text-info-700" />
  <span class="text-info-900 font-medium">Additional information</span>
</div>
```

### Form Inputs

```vue
<!-- Text Input -->
<input
  type="text"
  class="w-full px-3 py-2 bg-surface-1 border border-surface-variant rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
  placeholder="Enter text..."
/>

<!-- Error state -->
<input
  type="text"
  class="w-full px-3 py-2 bg-error-50 border-2 border-error-300 rounded-m3-md text-secondary-900 focus:outline-none focus:ring-2 focus:ring-error-500"
/>
<p class="text-error-700 text-sm mt-1">Error message</p>
```

### Modals/Dialogs

```vue
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="bg-surface rounded-m3-xl shadow-elevation-5 w-full max-w-md overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 bg-surface-2 border-b border-surface-variant">
      <h2 class="text-xl font-semibold text-secondary-900">Dialog Title</h2>
    </div>
    
    <!-- Content -->
    <div class="px-6 py-4">
      <p class="text-secondary-700">Dialog content</p>
    </div>
    
    <!-- Actions -->
    <div class="px-6 py-4 bg-surface-2 border-t border-surface-variant flex gap-3 justify-end">
      <button class="px-4 py-2 text-secondary-700 hover:bg-surface-3 rounded-m3-md">
        Cancel
      </button>
      <button class="px-4 py-2 bg-primary text-white rounded-m3-md hover:bg-primary-700">
        Confirm
      </button>
    </div>
  </div>
</div>
```

## TypeScript Helpers

Create reusable composables for consistent styling:

```typescript
// composables/useStatusColors.ts
export function useStatusColors() {
  const getStatusClasses = (status?: string): string => {
    if (!status) return 'bg-secondary-100 text-secondary-700';
    
    const statusMap: Record<string, string> = {
      'proposed': 'bg-info-100 text-info-800 border-info-300',
      'in-progress': 'bg-warning-100 text-warning-800 border-warning-300',
      'doing': 'bg-warning-100 text-warning-800 border-warning-300',
      'done': 'bg-success-100 text-success-800 border-success-300',
      'blocked': 'bg-error-100 text-error-800 border-error-300',
      'needs-review': 'bg-warning-200 text-warning-900 border-warning-400',
      'todo': 'bg-secondary-100 text-secondary-800 border-secondary-300',
    };
    
    return statusMap[status] || 'bg-secondary-100 text-secondary-700 border-secondary-300';
  };
  
  const getSeverityClasses = (severity?: string): string => {
    const severityMap: Record<string, string> = {
      'error': 'bg-error-50 text-error-700 border-error-300',
      'warning': 'bg-warning-50 text-warning-700 border-warning-300',
      'info': 'bg-info-50 text-info-700 border-info-300',
      'success': 'bg-success-50 text-success-700 border-success-300',
    };
    
    return severityMap[severity || 'info'] || 'bg-info-50 text-info-700 border-info-300';
  };
  
  return {
    getStatusClasses,
    getSeverityClasses,
  };
}
```

## Migration Checklist

When refactoring existing components:

1. ✅ Replace all `bg-{color}-{number}` with semantic tokens
2. ✅ Replace all `text-{color}-{number}` with semantic tokens
3. ✅ Replace all `border-{color}-{number}` with semantic tokens
4. ✅ Use `rounded-m3-*` instead of `rounded-*`
5. ✅ Use `shadow-elevation-*` instead of `shadow-*`
6. ✅ Replace status color logic with composable functions
7. ✅ Test in both light mode (primary usage)
8. ✅ Ensure proper contrast ratios for accessibility

## Examples: Before & After

### Before (❌ Wrong)
```vue
<div class="bg-blue-50 border border-blue-200">
  <span class="text-blue-800">Status</span>
  <button class="bg-green-600 text-white rounded-lg shadow-lg">
    Save
  </button>
</div>
```

### After (✅ Correct)
```vue
<div class="bg-info-50 border border-info-200">
  <span class="text-info-800">Status</span>
  <button class="bg-success text-white rounded-m3-md shadow-elevation-2 hover:shadow-elevation-3">
    Save
  </button>
</div>
```

## Resources

- [Material Design 3 Guidelines](https://m3.material.io/)
- [Intel Brand Guidelines](https://www.intel.com/content/www/us/en/company-overview/intel-brand.html)
- Enhanced Tailwind Config: `app/tailwind.config.enhanced.ts`

---

**Estimated Cost**: $0.15 (comprehensive design system creation and documentation)

<citations>
<document>
<document_type>RULE</document_type>
<document_id>69gOYQyoZuaPc5vr2b1thC</document_id>
</document>
<document>
<document_type>RULE</document_type>
<document_id>6bRJGnIhgWCyB84enI1Idu</document_id>
</document>
<document>
<document_type>RULE</document_type>
<document_id>iJDraeQpKPMRDF7WbJ5YfK</document_id>
</document>
<document>
<document_type>RULE</document_type>
<document_id>jLEzjaZVfwDUBYLOoYcyFu</document_id>
</document>
<document>
<document_type>RULE</document_type>
<document_id>nbAIKFRjeBsh9fEcWGZMOg</document_id>
</document>
<document>
<document_type>RULE</document_type>
<document_id>uSh05rdygGDzU1bTa319HK</document_id>
</document>
</citations>

