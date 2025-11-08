# Feature Specification: Code Quality & Design System Cleanup

**Feature Branch**: `001-code-cleanup`  
**Created**: 2025-11-08  
**Status**: Draft (Ready for Clarify/Plan)  
**Input**: User description: "Consolidate duplicate time utilities, enforce Material 3 semantic tokens, archive stale docs, unify error handling, remove backup Tailwind file"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Unified Time & Date Utilities (Priority: P1)

Engineering contributor eliminates duplicated time formatting and duration utilities scattered across services and Vue components by centralizing them into a single `timeHelpers.ts` API, reducing maintenance risk and ensuring performance & formatting consistency.

**Why this priority**: Directly reduces code duplication (23 duplicate functions) and lowers future defect surface; simplest high-impact cleanup enabling later refactors.

**Independent Test**: After refactor, deleting any former duplicate implementations does not break build or UI; all duration & timestamp displays still render expected formats via shared helpers.

**Acceptance Scenarios**:

1. **Given** the application after consolidation, **When** searching the codebase for `formatDuration(` outside `timeHelpers.ts`, **Then** zero matches (excluding tests) are found.
2. **Given** a telemetry panel view, **When** durations exceed 60s, **Then** they are displayed in minutes with one decimal (e.g., `3.5m`) consistent with shared helper.
3. **Given** an assistant tool result timestamp, **When** rendered, **Then** locale safe time string originates from centralized helper (verified via import path audit).

---

### User Story 2 - Material 3 Semantic Token Enforcement (Priority: P2)

Designer/engineer refactors hardcoded Tailwind color classes (e.g., `bg-blue-50`, `text-green-700`) to semantic Material 3 tokens (`bg-info-50`, `text-success-700`, `bg-surface`, `text-secondary-600`) ensuring visual consistency and future themeability.

**Why this priority**: Large violation count (65+ instances) impacts consistency, accessibility contrast, and theming agility; medium complexity due to multiple components.

**Independent Test**: Running a pattern search for forbidden raw color classes yields zero matches post-refactor; visual regression retains intended meaning (status, severity) via semantic palette.

**Acceptance Scenarios**:

1. **Given** refactored components, **When** running grep for `bg-blue-` / `text-green-` / `bg-yellow-` / `bg-red-` in renderer components, **Then** result count is zero (excluding design docs).
2. **Given** a success alert, **When** inspected, **Then** it uses `bg-success-*` tokens, not generic green scale.
3. **Given** dark/light mode toggle (future capability), **When** applied, **Then** semantic tokens adapt without further component changes (verified via token mapping test stub).

---

### User Story 3 - Stale Documentation Archival (Priority: P3)

Maintainer archives superseded phase/status/migration markdown files into a single `docs/archive/` folder and produces a summarized changelog entry, removing clutter while preserving historical traceability.

**Why this priority**: Low direct user impact but improves contributor onboarding & reduces misdirection from outdated files; simple batch operation.

**Independent Test**: Running file search for `STATUS.md` / `*_COMPLETE.md` in root docs excluding `archive/` returns only active strategic documents (e.g., constitution, design system).

**Acceptance Scenarios**:

1. **Given** archival done, **When** listing `docs/` (non-recursive), **Then** no phase completion clutter appears (moved to `docs/archive/`).
2. **Given** a newcomer reading `CHANGELOG.md`, **When** scanning recent entries, **Then** cleanup tasks and rationale are documented.
3. **Given** CI spell/link check, **When** executed, **Then** archiving introduces no broken internal links.

---

### User Story 4 - Unified Error Handling Surface (Priority: P4)

Engineer standardizes renderer + main + pipeline error shaping (human message + machine code + optional details) while retaining context-specific classifier layers (`errorClassifier.ts`, `useContextKitErrors`) reducing branching logic and improving telemetry consistency.

**Why this priority**: Medium complexity; enhances observability and reduces duplication; depends on prior simplification (time utilities) but mostly orthogonal.

**Independent Test**: Trigger sample errors (validation, network, unknown) and confirm unified shape reaches UI & telemetry with consistent `code` values, minimizing divergent parsing.

**Acceptance Scenarios**:
1. **Given** a pipeline timeout, **When** surfaced in UI, **Then** telemetry & UI share the same `code: TIMEOUT` and suggestion set.
2. **Given** a validation failure thrown as `ValidationError`, **When** rendered, **Then** user-friendly message appears without stack unless dev mode.
3. **Given** unknown error object, **When** processed, **Then** standardized fallback `UNKNOWN_ERROR` appears with optional dev diagnostic.

---

### User Story 5 - Tailwind Backup Removal & Config Integrity (Priority: P5)

Engineer removes `tailwind.config.backup.ts` and validates active config includes Material 3 tokens and semantic palette definitions, preventing accidental reversion.

**Why this priority**: Trivial but prevents regression; last step after token enforcement.

**Independent Test**: Build succeeds; style tokens resolve; no accidental reference to deleted backup file.

**Acceptance Scenarios**:
1. **Given** build pipeline, **When** running `pnpm build`, **Then** no import errors referencing backup file occur.
2. **Given** design tokens usage audit, **When** scanning config, **Then** palette + elevation + shape tokens are present.


---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Duplicate helper missed in obscure test folder → nightly lint rule (`forbidden-patterns`) fails build.
- Component still using raw `rounded-lg` → design token audit flags shape token violation.
- Archived doc file referenced by README link → link check fails; remediation required.
- Concurrent refactor + branch merge causing partial semantic token application (mixed old/new classes) → visual regression test detects mismatched tokens.
- Error shape divergence (renderer adds property absent in main) → schema contract test fails.
- Git branch naming collision (another `001-*`) → script auto-increments number; spec remains consistent.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: Eliminate duplicate time/duration helpers; all formatting uses `timeHelpers.ts` exported API (`formatDuration`, `formatTime`, `nowIso`). Durations ≥ 3,600,000 ms format as `${(ms/3600000).toFixed(2)}h`; negative durations clamp to `0ms` and emit a development warning (no user-facing error). Hour formatting is required for telemetry > 1h.
- **FR-002**: Provide detection (script) enforcing no direct usage of raw Tailwind color scale classes for semantic categories (pattern: `bg-(blue|red|green|yellow|gray|purple|cyan|amber)-[0-9]{2,3}` / `text-(blue|red|green|yellow|gray|purple|cyan|amber)-[0-9]{2,3}`) in renderer components.
- **FR-003**: Remediate ≥95% of baseline raw color class occurrences to semantic M3 tokens. Denominator: `baseline_raw_occurrences` captured in Phase 0 (frozen hash). Compliance formula: `refactored_occurrences / baseline_raw_occurrences ≥ 0.95`. Residual exceptions (max 5) documented with file path, rationale, and intended future replacement token in `research.md`.
- **FR-004**: Remove `tailwind.config.backup.ts` and verify build passes using only `tailwind.config.ts` with Material 3 + semantic palette; ensure no script references the deleted file.
- **FR-005**: Introduce renderer error normalization adapter producing `{ code, message, userMessage, retryable, details? }`; unify mapping across `errorClassifier.ts` and `useContextKitErrors` without duplicate conditional branches > 3 lines for same code. Unknown throwables (string/number) normalize to `UNKNOWN_ERROR` with safe user message.
- **FR-006**: Standardize telemetry error events to include `errorCode` (string) and optional `details` object; 100% of new or modified errors in cleanup scope carry codes (`VALIDATION_ERROR`, `TIMEOUT`, `UNKNOWN_ERROR`, `DESIGN_TOKEN_VIOLATION`). Adding a new code requires amending this spec.
- **FR-007**: Archive stale documentation (≥30 identified files) into `docs/archive/` with a manifest and summary entry in `CHANGELOG.md` describing consolidation and rationale.
- **FR-008**: Provide automated verification script `scripts/verify-design-tokens.ts` scanning Vue components producing a `DesignTokenViolationReport` (see Key Entities). CI fails on any violation count > 0 unless marked as documented exception.
- **FR-009**: Provide automated duplication scan script `scripts/scan-duplicate-time-helpers.ts` ensuring no residual `formatDuration` function definitions outside canonical file; CI fails if count > 0.
- **FR-010**: Maintain backward compatibility: no breaking changes to public Pinia store types (snapshot diff of exported store type signatures must remain identical except import path changes). A snapshot diff task validates stability.

### Non-Goals

- Introduce dynamic theming or dark mode (future work).
- Replace existing error domain classes (`AppError`)—wrapper only.
- Modify AI assistant feature logic outside presentation of error/time formatting.
- Deprecate existing telemetry schema beyond added errorCode field.

### Out of Scope

- Performance optimization of time helper calls (micro-impact).
- Full design token generation automation pipeline.
- Removal of already archived historical specs.

### Key Entities

- **TimeFormatting**: Logical service providing duration + timestamp normalization; attributes: `formatDuration(ms)`, `formatTime(iso)`, `nowIso()`.
- **DesignTokenViolationReport**: `{ id: string; generatedAt: ISO8601; violations: { filePath: string; line: number; rawClass: string; suggestedToken?: string }[]; total: number; allowedExceptions: string[] }`.
- **DocArchiveManifest**: `{ archivedFiles: { originalPath: string; newPath: string; }[]; archivedCount: number; generatedAt: ISO8601; changelogEntryAdded: boolean }`.
- **ErrorNormalizationMap**: `{ [code: string]: { retryable: boolean; defaultUserMessage: string } }` ensuring single source with fallback `UNKNOWN_ERROR`.

### Architecture Impact (C4)

- **Component Diagram**: Update to show consolidated `Shared/TimeHelpers` module consumed by renderer components & telemetry scripts (path: `app/src/renderer/services/assistant/timeHelpers.ts`).
- **Component Diagram**: Add `DesignTokenVerification Script` node under tooling pipeline referencing semantic tokens config.
- **Context Diagram**: No change (internal refactor only).
- **Container Diagram**: Note removal of `tailwind.config.backup.ts` reducing configuration duplication.
- All updates recorded in `context-repo/c4/` with version bump annotation.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Duplicate time/duration function definitions outside canonical helper reduced to 0 (search-based metric) within this branch.
- **SC-002**: Hardcoded color class violations reduced from 65+ to ≤5 documented exceptions (target 100% semantic compliance minus justified cases).
- **SC-003**: Build & lint pipeline adds new verification script; CI fails on any new violation—post-merge baseline 0.
- **SC-004**: Error events produced in cleanup scope show 100% `errorCode` coverage (sample telemetry audit of ≥20 events).
- **SC-005**: Documentation root markdown file count (excluding archive) reduced by ≥30% without broken links (link check passes: zero broken references).
- **SC-006**: Time helper import coverage: ≥95% of components that display durations reference canonical helper file. Coverage algorithm: (components_importing_helper / components_with_duration_rendering) ≥ 0.95 where `components_with_duration_rendering` = unique `.vue` files containing previous `formatDuration` usage at baseline.

### Non-Functional Requirements

- **NF-ACC-001**: Semantic token replacements must preserve or improve WCAG AA contrast; at least sampled high-risk components audited.
- **NF-PERF-001**: Each verification script (`verify-design-tokens`, `scan-duplicate-time-helpers`) executes in < 2000 ms on baseline dev machine (cold run, Node 20, no cache) and < 1000 ms warm.
- **NF-OBS-001**: Telemetry events enriched with `errorCode` and optional `designTokenViolationCount` field when violations detected.
- **NF-SEC-001**: New scripts must not access secrets or introduce new environment variable dependencies.

## Assumptions

- Existing unit tests cover most components; refactors will rely on snapshot adjustments only where token classes changed.
- No runtime theming toggle yet—semantic tokens map directly to static palette.
- Telemetry schema extension (errorCode) is backward compatible for consumers ignoring new field.

## Risks

- Refactor breadth could introduce subtle visual regressions (mitigation: quick screenshot diff or Storybook style checks if available).
- Incomplete archival could leave orphan references (mitigation: link check automation).
- Developers unfamiliar with semantic tokens may reintroduce raw colors (mitigation: lint/script enforcement + documentation pointer).
- Accessibility regression if semantic token mapping reduces contrast (mitigation: contrast audit script / manual spot check).
- Performance regression if scripts scale poorly (mitigation: timing harness, enforce NF-PERF-001 thresholds).

## Dependencies

- Tailwind config must already define semantic tokens (verified in design system doc).
- Linting pipeline capable of running custom script (Node + ts-node available).

## No Clarifications Needed

Specification applies industry-standard defaults; no ambiguous choices requiring stakeholder input (0 `[NEEDS CLARIFICATION]` markers).

## Completion Criteria

All FR & SC metrics satisfied; CI gate passes with new verification scripts; archival changelog entry merged.
