# Unified Assistant Accessibility Checklist (Initial Draft)

**Feature**: Assistant Sidecar Unification (Phase 2)  
**Date**: 2025-11-07  
**Owners**: Assistant Platform Team  
**Related Requirements**: FR-020 (Accessibility), FR-034 (Visual Contrast)

## Focus Order
- Primary toggle button opens unified assistant panel (focus trapped within dialog once opened).
- Sequential focus order: panel container → message composer → send button → tool palette items (left-to-right) → telemetry panel toggle → approvals dialog trigger → export/menu actions.
- Escape key closes the panel and returns focus to the launcher button.
- Tab/Shift+Tab cycle is linear without dead-ends; focus indicators use Material 3 focus ring tokens.

## Landmark & Role Mapping
- Panel root uses `role="dialog"` with `aria-modal="true"` while active.
- Transcript list marked with `role="log"` and `aria-live="polite"` for streaming updates.
- Tool queue status badges use `role="status"` with concise text (Queued, Running, Succeeded, Failed).
- Provider badge uses `role="status"` with descriptive `aria-label` (`Current provider: <name>`).

## Keyboard Interaction
- Message composer supports Enter (send) and Shift+Enter (newline).
- Tool palette shortcuts: Alt+1..9 (planned) — interim navigation uses Tab/Shift+Tab.
- Approval dialog: Enter confirms, Escape cancels, focus returns to originating control.
- Telemetry panel toggle accessible via keyboard; retains focus after activation.

## Visual Contrast Checks (FR-034)
- Provider badge foreground/background combinations meet ≥4.5:1 contrast (validated via T028O test).
- Primary action buttons follow Material 3 “primary” tokens with ≥4.5:1 contrast on light surfaces.
- Limited Read-Only Mode banner planned colors: `bg-warning-container` + `text-warning-on-container` (contrast ≥4.5:1).

## Screen Reader Notes
- Streaming updates announce incremental tokens via polite live region; final message announces completion summary.
- Tool invocation results include heading level 3 (`<h3>`) with tool name for quick navigation.
- Approval dialog uses labelled buttons (`Approve change`, `Reject change`) and descriptive diff summary.

## Outstanding Gaps / Next Steps
1. Document keyboard shortcuts in on-screen help (pending T040/T085).
2. Verify telemetry panel charts with accessible text alternatives (Phase 3).
3. Confirm Limited Read-Only Mode banner audibility (ties to T027/T052L).
4. Add unit test coverage for dialog focus trapping (planned with T051C).
5. Audit streaming live region for verbosity (ensure batching when tokens arrive rapidly).

> TODO(T028K-FollowUp): Revisit checklist post-Phase 3 to incorporate unified assistant UX refinements and finalized shortcut bindings.
