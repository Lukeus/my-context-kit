# Component Refactoring Checklist

Track progress on migrating legacy component patterns to the new shared component library.

## 📦 Shared Components Created

- [x] `BaseModal.vue` - Modal/dialog wrapper
- [x] `BaseAlert.vue` - Alert/banner system
- [x] `BaseCard.vue` - Card layouts
- [x] `BaseBadge.vue` - Status badges
- [x] `BaseButton.vue` - Button system
- [x] `index.ts` - Barrel exports
- [ ] `BaseInput.vue` - Form inputs (Phase 3)
- [ ] `BaseSelect.vue` - Select dropdowns (Phase 3)
- [ ] `BaseSpinner.vue` - Loading spinners (Phase 3)

---

## 🔄 P0: Modal Migrations (Week 1-2)

### Priority 1 (Low Risk)
- [ ] **AISettingsModal.vue** → `BaseModal`
  - Size: `md`
  - Slots: header, default, footer
  - Risk: Low (simple configuration modal)
  - Estimated time: 30 minutes

- [ ] **PromptModal.vue** → `BaseModal`
  - Size: `lg`
  - Slots: header, default, footer
  - Risk: Low (prompt editing)
  - Estimated time: 30 minutes

### Priority 2 (Medium Risk)
- [ ] **NewRepoModal.vue** → `BaseModal`
  - Size: `md`
  - Slots: header, default, footer
  - Risk: Medium (form validation logic)
  - Estimated time: 1 hour

- [ ] **ApprovalDialog.vue** → `BaseModal`
  - Size: `md`
  - Slots: header, default (diff preview), footer
  - Risk: Medium (diff rendering logic)
  - Estimated time: 1 hour

### Priority 3 (High Risk)
- [ ] **AIAssistantModal.vue** → `BaseModal` (or deprecate fully)
  - Size: `xl`
  - **Note:** This component is deprecated - consider full removal
  - Risk: High (legacy dependencies)
  - Estimated time: 2 hours or mark for deletion

- [ ] **UnifiedAssistant.vue** Settings Modal → `BaseModal`
  - Size: `md`
  - Extract inline modal to component
  - Risk: Medium (nested in main assistant)
  - Estimated time: 1 hour

- [ ] **UnifiedAssistant.vue** Migration Modal → `BaseModal`
  - Size: `lg`
  - Extract inline modal to component
  - Risk: Medium (nested in main assistant)
  - Estimated time: 1 hour

---

## 🚨 P0: Alert Migrations (Week 2)

### Replace with BaseAlert

- [ ] **ErrorAlert.vue** (ContextKit)
  - Strategy: Update component to use `BaseAlert` internally
  - Maintain existing API for backward compatibility
  - Risk: Low
  - Estimated time: 30 minutes

- [ ] **FallbackBanner.vue** (assistant)
  - Replace with `<BaseAlert severity="warning" />`
  - Update parent components (`UnifiedAssistant.vue`)
  - Risk: Low
  - Estimated time: 30 minutes

- [ ] **ServiceStatusBanner.vue** (ContextKit)
  - Replace with `<BaseAlert>` with dynamic severity
  - Risk: Low
  - Estimated time: 30 minutes

### Refactor Inline Alerts

- [ ] **AIAssistantModal.vue** - Deprecation banner
  - Replace with `<BaseAlert severity="warning" />`
  - Risk: Low (component being deprecated)
  - Estimated time: 15 minutes

- [ ] **ToolPanel.vue** - Pipeline feedback alerts
  - Replace inline `pipelineFeedback.success` with `<BaseAlert severity="success" />`
  - Replace inline `pipelineFeedback.error` with `<BaseAlert severity="error" />`
  - Risk: Low
  - Estimated time: 30 minutes

- [ ] **ContextKitHub.vue** - Service status alerts
  - Replace inline error display with `<BaseAlert severity="error" />`
  - Risk: Low
  - Estimated time: 20 minutes

---

## 📇 P1: Card Migrations (Week 3)

### Component-Level Cards

- [ ] **AgentCard.vue**
  - Refactor to use `<BaseCard>` with header/footer slots
  - Maintain grid + list view modes
  - Risk: Medium (complex conditional styling)
  - Estimated time: 1.5 hours

- [ ] **ProgressCompletionCard.vue**
  - Replace with `<BaseCard variant="filled">`
  - Risk: Low
  - Estimated time: 30 minutes

### Inline Card Patterns

- [ ] **ContextKitHub.vue** - Status metrics cards (4 instances)
  - Extract to `<BaseCard variant="outlined">` components
  - Risk: Low
  - Estimated time: 1 hour

- [ ] **ContextKitHub.vue** - Quick action cards (3 instances)
  - Replace with `<BaseCard hoverable clickable>`
  - Risk: Low
  - Estimated time: 45 minutes

- [ ] **ToolPanel.vue** - Telemetry cards
  - Replace with `<BaseCard variant="outlined">`
  - Risk: Low
  - Estimated time: 30 minutes

- [ ] **KanbanBoard.vue** - Task cards
  - Replace inline card divs with `<BaseCard>`
  - Risk: Medium (drag-drop interactions)
  - Estimated time: 1 hour

- [ ] **AgentLibrary.vue** - Agent grid cards
  - Consolidate with `AgentCard.vue` using `<BaseCard>`
  - Risk: Low
  - Estimated time: 45 minutes

---

## 🏷️ P1: Badge Migrations (Week 3)

### Component-Level Badges

- [ ] **ProviderBadge.vue**
  - Refactor to use `<BaseBadge>` internally
  - Maintain existing API
  - Risk: Low
  - Estimated time: 20 minutes

- [ ] **MigrationStatus.vue**
  - Replace with `<BaseBadge variant="..." />`
  - Risk: Low
  - Estimated time: 15 minutes

### Inline Badge Patterns

- [ ] **UnifiedAssistant.vue** - Status badges (ACTIVE, panel labels)
  - Replace with `<BaseBadge variant="primary">`
  - Risk: Low
  - Estimated time: 30 minutes

- [ ] **AgentCard.vue** - Complexity + custom badges
  - Replace with `<BaseBadge>` with computed variants
  - Risk: Low
  - Estimated time: 20 minutes

- [ ] **ToolPanel.vue** - Pipeline capability indicators
  - Replace with `<BaseBadge>` for enabled/disabled states
  - Risk: Low
  - Estimated time: 20 minutes

- [ ] **ContextKitHub.vue** - Health status badges
  - Replace with `<BaseBadge variant="success|error">`
  - Risk: Low
  - Estimated time: 15 minutes

- [ ] **Other components** - Scan for inline badge patterns
  - Search for `class=".*px-2 py-0.5.*rounded.*bg-.*"` regex
  - Replace with `<BaseBadge>`
  - Risk: Low
  - Estimated time: 1 hour

---

## 🔘 P2: Button Migrations (Week 4)

### High-Impact Refactors

- [ ] **All modal footer buttons** (6 modals)
  - Replace with `<BaseButton variant="primary|secondary">`
  - Risk: Low
  - Estimated time: 2 hours

- [ ] **All card action buttons** (8+ cards)
  - Replace with `<BaseButton variant="tertiary|danger" size="sm">`
  - Risk: Low
  - Estimated time: 2 hours

- [ ] **All toolbar icon buttons** (multiple components)
  - Replace with `<BaseButton variant="ghost" icon-only>`
  - Risk: Low
  - Estimated time: 2 hours

### Form Buttons

- [ ] **ToolPanel.vue** - Run pipeline, preview file buttons
  - Replace with `<BaseButton :loading="isBusy">`
  - Risk: Low
  - Estimated time: 30 minutes

- [ ] **ContextKitHub.vue** - Service control buttons
  - Replace with `<BaseButton variant="primary" :loading="isStarting">`
  - Risk: Low
  - Estimated time: 30 minutes

---

## 🧪 Testing Checklist

### Unit Tests (Per Component)

- [ ] **BaseModal.vue**
  - [ ] Renders when `show` prop is `true`
  - [ ] Closes on backdrop click when `closeOnBackdrop` is `true`
  - [ ] Closes on Esc key when `closeOnEsc` is `true`
  - [ ] Applies correct size classes
  - [ ] Renders slots correctly
  - [ ] ARIA attributes present

- [ ] **BaseAlert.vue**
  - [ ] Renders with correct severity styles
  - [ ] Dismisses on button click
  - [ ] Action callback executes
  - [ ] Transitions work correctly
  - [ ] ARIA live region present

- [ ] **BaseCard.vue**
  - [ ] Applies correct variant classes
  - [ ] Hover state works
  - [ ] Click event emits
  - [ ] Selection ring displays
  - [ ] Slots render correctly

- [ ] **BaseBadge.vue**
  - [ ] Applies correct variant colors
  - [ ] Sizing works correctly
  - [ ] Outline mode renders
  - [ ] Rounded mode renders

- [ ] **BaseButton.vue**
  - [ ] Applies correct variant styles
  - [ ] Loading state displays spinner
  - [ ] Disabled state prevents clicks
  - [ ] Icon-only mode works
  - [ ] Focus ring displays

### Integration Tests

- [ ] Migrated modals work in parent components
- [ ] Migrated alerts display correctly
- [ ] Migrated cards maintain functionality
- [ ] Migrated badges display correctly
- [ ] Migrated buttons handle clicks

### Visual Regression Tests

- [ ] Storybook stories created for all shared components
- [ ] Chromatic snapshots captured
- [ ] All variant combinations tested
- [ ] Responsive breakpoints verified

### Accessibility Tests

- [ ] `jest-axe` tests pass for all components
- [ ] Screen reader testing completed (NVDA/JAWS)
- [ ] Keyboard navigation verified
- [ ] Focus management working

---

## 📖 Documentation Checklist

- [x] `CODE_REVIEW_COMPONENT_REUSABILITY.md` written
- [x] `COMPONENT_MIGRATION_GUIDE.md` created
- [x] `COMPONENT_REVIEW_SUMMARY.md` summarized
- [x] Component JSDoc comments added
- [ ] Storybook stories created
- [ ] Design system documentation updated
- [ ] Team training session scheduled
- [ ] Migration progress tracked in this file

---

## 🎯 Acceptance Criteria

### Code Quality
- [ ] All shared components pass TypeScript strict mode
- [ ] All shared components have 100% test coverage
- [ ] All shared components documented with JSDoc
- [ ] All shared components have Storybook stories

### Migration Completeness
- [ ] 6/6 modal implementations migrated
- [ ] 5/5 alert implementations migrated
- [ ] 8/8 card implementations migrated
- [ ] 7+/7+ badge implementations migrated
- [ ] All button implementations migrated

### Design System Compliance
- [ ] 100% Material 3 design token usage
- [ ] Consistent spacing/padding across components
- [ ] Unified color scheme mapping
- [ ] Standardized focus states

### Performance
- [ ] No performance regressions measured
- [ ] Bundle size reduction verified
- [ ] Lighthouse scores maintained or improved

---

## 📊 Progress Tracking

### Week 1 (Foundation)
- [x] Shared component library created (5 components)
- [x] Documentation written (3 documents)
- [ ] First 2 modal migrations completed
- [ ] Team review conducted

### Week 2 (Expansion)
- [ ] Remaining 4 modals migrated
- [ ] All 5 alert patterns migrated
- [ ] Design system docs updated
- [ ] Tests written for shared components

### Week 3 (Refinement)
- [ ] All 8 card patterns migrated
- [ ] All 7+ badge patterns migrated
- [ ] Form components added
- [ ] Accessibility audit completed

### Week 4 (Polish)
- [ ] All button patterns migrated
- [ ] Storybook stories completed
- [ ] Legacy cleanup performed
- [ ] Team training delivered

---

## 🔍 Post-Migration Review

### Metrics to Capture
- [ ] Total lines of code removed
- [ ] Number of components consolidated
- [ ] Bundle size difference
- [ ] Performance benchmark results
- [ ] Test coverage percentage
- [ ] Developer satisfaction survey

### Lessons Learned
- [ ] What went well?
- [ ] What could be improved?
- [ ] Any unexpected challenges?
- [ ] Recommendations for future refactors

---

**Last Updated:** November 2, 2025  
**Status:** Foundation Complete (Week 1)  
**Next Milestone:** Begin P0 modal migrations
