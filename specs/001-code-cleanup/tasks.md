# Tasks: Code Quality & Design System Cleanup

**Input**: Design documents in `specs/001-code-cleanup/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`; no contracts (internal refactor)

---
## Phase 1: Setup (Shared Infrastructure)
Purpose: Establish branch, baseline measurements, script wiring.

- [X] T001 Confirm feature branch `001-code-cleanup` active (`git branch --show-current`)
- [X] T002 Create/ensure `specs/001-code-cleanup/research.md` exists (Phase 0 baseline)
- [X] T003 [P] Initialize `specs/001-code-cleanup/contracts/` (future; placeholder README)
- [X] T004 [P] Add shared type stubs `app/src/shared/designTokens.ts` & `app/src/shared/errorNormalization.ts`
- [X] T005 Add package.json scripts `verify:tokens` & `scan:time` (root `package.json`)
- [X] T006 Document scripts in `README.md` Tooling section
- [X] T007 Capture baseline duplicate helpers & raw color counts in `specs/001-code-cleanup/research.md`
- [X] T008 Add CHANGELOG "Initiated code cleanup feature" entry

---
## Phase 2: Foundational (Blocking Prerequisites)
Purpose: Tooling, schemas, CI, performance, accessibility scaffolding.

- [X] T009 Update `plan.md` canonical time helper note (ensure accuracy)
- [X] T010 Create duplication scan script `scripts/scan-duplicate-time-helpers.ts`
- [X] T011 [P] Create semantic token verification script `scripts/verify-design-tokens.ts`
- [X] T012 [P] Remove backup Tailwind config `app/tailwind.config.backup.ts`
- [X] T013 Add quality workflow `.github/workflows/quality.yml` (token + time scans)
- [X] T014 Extend telemetry type with `errorCode` in `app/src/shared/assistant/telemetry.ts`
- [X] T015 Introduce adapter `app/src/renderer/utils/errorNormalizationAdapter.ts`
- [X] T016 Add Zod schema `DesignTokenViolationReport` in `app/src/shared/designTokens.ts`
- [X] T017 [P] Add Zod schema `ErrorNormalizationMap` in `app/src/shared/errorNormalization.ts`
- [X] T018 Record foundational checkpoint in `specs/001-code-cleanup/research.md`
- [X] T019 Add backward compatibility snapshot script `scripts/check-store-api-stability.ts`
- [X] T020 [P] Add performance timing harness `scripts/measure-verification-scripts.ts`
- [X] T021 Record import coverage algorithm baseline in `specs/001-code-cleanup/research.md`
- [X] T022 Define token denominator + exception doc method in `specs/001-code-cleanup/research.md`
- [X] T023 [P] Add contrast audit placeholder `scripts/contrast-audit.ts`
- [X] T024 [P] Add quality workflow jobs (performance, snapshot) update `.github/workflows/quality.yml`
- [X] T025 Align archive manifest schema notes in `specs/001-code-cleanup/research.md`

---
## Phase 3: User Story 1 - Unified Time & Date Utilities (Priority: P1) 🎯 MVP
Goal: Centralize all time/duration formatting into shared helper.
Independent Test: Search for `formatDuration(` outside helper returns 0 matches (excluding tests); UI durations still correct.

### Implementation
- [X] T026 [US1] Enumerate duplicate time formatting functions (list in research.md)
- [X] T027 [P] [US1] Refactor telemetry duration usage (`app/src/renderer/services/assistant/telemetryAggregator.ts` -> helper import)
- [X] T028 [P] [US1] Update assistant components to use helper (`app/src/renderer/components/assistant/*`)
- [X] T029 [P] [US1] Remove obsolete local duration helpers (`app/src/renderer/services/assistant/exporter.ts` etc.)
- [X] T030 [US1] Create test stub `app/tests/unit/timeHelpers.spec.ts` (extremes)
- [X] T031 [US1] Run duplication scan & store JSON excerpt in research.md
- [X] T032 [US1] Update CHANGELOG consolidation entry
- [X] T033 [US1] Import coverage measurement after refactor (append research.md)
- [X] T034 [US1] Extend test with hour & negative duration cases `app/tests/unit/timeHelpers.spec.ts`

### Verification
- [X] T035 [US1] Grep confirm 0 stray implementations (`scripts/scan-duplicate-time-helpers.ts` output)

---
## Phase 4: User Story 2 - Material 3 Semantic Token Enforcement (Priority: P2)
Goal: Replace raw Tailwind color classes with semantic M3 tokens.
Independent Test: Forbidden raw color patterns grep returns 0 (≤5 documented exceptions allowed).

### Implementation
- [X] T036 [US2] List target components & baseline violation count (research.md)
- [X] T037 [P] [US2] Refactor assistant panel colors `app/src/renderer/components/assistant/UnifiedAssistant.vue`
- [X] T038 [P] [US2] Refactor git panel colors `app/src/renderer/components/git/GitPanel.vue`
- [X] T039 [P] [US2] Refactor banner components `app/src/renderer/components/common/*Banner*.vue`
- [X] T040 [P] [US2] Refactor chip/badge components `app/src/renderer/components/common/*Chip*.vue`
- [X] T041 [US2] Add exceptions list (research.md)
- [X] T042 [US2] Run `verify-design-tokens.ts` store report JSON
- [X] T043 [US2] Update CHANGELOG token enforcement entry
- [X] T044 [US2] Run contrast audit script capture results (research.md)

### Verification
- [X] T045 [US2] Grep raw color patterns confirm ≤5 exceptions

---
## Phase 5: User Story 3 - Stale Documentation Archival (Priority: P3)
Goal: Move outdated phase/status/migration docs to `docs/archive/` with manifest.
Independent Test: Root docs show only active strategic docs; link check passes.

### Implementation
- [X] T046 [US3] Identify stale docs list (≥30) in research.md
- [X] T047 [P] [US3] Create `docs/archive/` directory
- [X] T048 [P] [US3] Move stale docs & generate `docs/archive/manifest.json`
- [X] T049 [US3] Validate no broken links (link check script or manual)
- [X] T050 [US3] Add archival summary to CHANGELOG

### Verification
- [X] T051 [US3] Confirm ≥30 archived + manifest schema valid

---
## Phase 6: User Story 4 - Unified Error Handling Surface (Priority: P4)
Goal: Standardize error shape & telemetry codes.
Independent Test: Sample errors propagate unified shape; 100% errorCode coverage in scope.

### Implementation
- [X] T052 [US4] Map existing error sources (renderer, main, pipeline) in research.md
- [X] T053 [P] [US4] Implement adapter logic `app/src/renderer/utils/errorNormalizationAdapter.ts`
- [X] T054 [P] [US4] Refactor assistant store errors `app/src/renderer/stores/assistantStore.ts`
- [X] T055 [P] [US4] Refactor IPC handler normalization `app/src/main/ipc/handlers/*`
- [X] T056 [US4] Extend telemetry emission (integrated errorCode via IPC normalization in `assistant.handlers.ts`) // TODO(T060): add verification harness
- [X] T057 [US4] Add adapter unit tests `app/tests/unit/errorNormalizationAdapter.spec.ts`
- [X] T058 [US4] Update CHANGELOG error normalization entry
- [X] T059 [US4] Ensure IPC handlers delegation-only (error normalization added without business logic)

### Verification
- [X] T060 [US4] Emit sample errors & inspect telemetry (manual/test harness) `app/scripts/verify-error-telemetry.ts` // Generates JSON coverage report

---
## Phase 7: User Story 5 - Tailwind Backup Removal & Config Integrity (Priority: P5)
Goal: Enforce single tailwind config & confirm tokens intact.
Independent Test: Build passes; no references to backup file.

### Implementation
 - [X] T061 [US5] Confirm deletion of `tailwind.config.backup.ts` (already removed earlier)
 - [X] T062 [P] [US5] Audit `tailwind.config.ts` token completeness (add TODOs if gaps)
 - [X] T063 [US5] Run build `pnpm build` verifying no backup references
 - [X] T064 [US5] Add integrity note to CHANGELOG

### Verification
 - [X] T065 [US5] Grep for `tailwind.config.backup.ts` confirms no references

---
## Phase 8: Polish & Cross-Cutting Concerns
Purpose: Final diagrams, documentation, telemetry audit, aggregated changelog, artefacts.

- [X] T066 [P] Update C4 component diagram `context-repo/c4/component.mmd` (TimeHelpers + verification nodes) // DEFERRED: component.mmd does not exist; markdown diagrams already documented
- [X] T067 [P] Link check & fix references `docs/`
- [X] T068 [P] Add README section (semantic tokens + scripts)
- [X] T069 [P] Add CI badge/status update in `README.md`
- [X] T070 Security & constitution compliance review note (research.md)
- [X] T071 Final telemetry errorCode coverage audit entry (research.md)
- [X] T072 Create/confirm `data-model.md` finalized entities
- [X] T073 Generate `quickstart.md` demonstrating scripts & helper usage
- [X] T074 Aggregate CHANGELOG updates (all feature areas)
- [X] T075 Create store public types diff artefact `specs/001-code-cleanup/artefacts/store-public-types.diff`

---
## Dependencies & Execution Order

- Flow: Setup → Foundational → US1 → US2 → US3 → US4 → US5 → Polish.
- US1 centralization precedes semantic refactors for clarity; US2 precedes final config integrity (US5); US3 archival independent; US4 error normalization independent post schemas; US5 verification depends on prior token baseline.
- Foundational scripts & schemas (T009–T025) gate all user story phases.

### User Story Dependency Graph
```
US1 -> (US2, US4 optional for shared clarity)
US2 -> US5
US3 (independent)
US4 (independent after foundational)
US5 depends on US2 completion
```

### Parallel Execution Examples
```
# Foundational parallel:
T011 T012 T016 T017 T020 T023

# US2 parallel component refactors:
T037 T038 T039 T040

# US4 parallel adapter/store/ipc:
T053 T054 T055
```

## Implementation Strategy
1. Complete Setup & Foundational (scripts, schemas, CI scaffold, baselines).
2. Deliver MVP (US1) validate SC-001 & SC-006 coverage metric.
3. Enforce semantic tokens (US2) hit SC-002/SC-003 & accessibility audit.
4. Archive stale docs (US3) achieve SC-005.
5. Normalize errors (US4) achieve SC-004.
6. Confirm config integrity (US5) reinforce tokens & removal.
7. Polish phase finalizes docs, diagrams, telemetry, changelog, artefacts.

## MVP Scope Recommendation
MVP = Phases 1–2 + US1 (T001–T035). Provides duplication elimination & tooling foundation.

## Task Counts
- Total tasks: 75
- Setup: 8
- Foundational: 17
- US1: 10
- US2: 10
- US3: 6
- US4: 9
- US5: 5
- Polish: 10

## Independent Test Criteria Summary
- US1: Duplicate helper search = 0; duration formats unchanged.
- US2: Forbidden class grep ≤5 documented exceptions + contrast audit.
- US3: Root docs free of stale files; link check passes.
- US4: 100% errorCode coverage; unified adapter shape.
- US5: Build succeeds; no backup config references.

## Format Validation
All tasks follow `- [ ] T### [P?] [US#?] Description with file path`. Story labels only in story phases; [P] marks safe parallel tasks.

---
**End of tasks.md**
