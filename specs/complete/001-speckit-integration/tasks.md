---

description: "Task list derived from Spec Kit context integration design"
---

# Tasks: Spec Kit Context Integration

**Input**: Design documents from `/specs/001-speckit-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/speckit-fetch.openapi.yaml, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. Tests are included where explicitly required by the specification and research decisions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Fits parallel execution (distinct files, no blocking dependencies)
- **[Story]**: User story label (US1, US2, US3) for story phases
- Every task references exact file paths or command contexts
- Shared tasks for validation pipelines appear in the final phase

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare repository state directories and scripts required by downstream phases.

- [x] T001 Create `.context/state/.gitignore` to ignore `*.lock` while keeping JSON telemetry tracked in context-repo/.context/state/.gitignore
- [x] T002 [P] Seed Spec Kit fetch summary stub matching the data model in context-repo/.context/state/speckit-fetch.json
- [x] T003 [P] Add pnpm script `speckit:fetch` invoking the new pipeline in context-repo/package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared typing and tooling so all user stories consume consistent Spec Kit models.

- [x] T004 Add `@shared/*` alias for shared modules in app/tsconfig.base.json, app/vite.main.config.ts, app/vite.renderer.config.ts, and app/vite.preload.config.ts
- [x] T005 [P] Create Spec Kit shared types for cache snapshots, fetch summaries, preview documents, and pipeline reports in app/src/shared/speckit.ts
- [x] T006 [P] Update Vitest and Playwright resolvers to honor `@shared/*` in app/vitest.config.ts and app/playwright.config.ts

---

## Phase 3: User Story 1 - Product manager seeds context from Spec Kit (Priority: P1) 🎯 MVP

**Goal**: Provide a deterministic Spec Kit fetch pipeline that hydrates `.context/speckit-cache` with locked releases and structured telemetry.

**Independent Test**: Trigger a fetch on a clean workspace and confirm `.context/state/speckit-fetch.json` records the snapshot while reruns report no changes without corrupting cache contents.

- [x] T007 Implement deterministic fetch pipeline with lock enforcement and structured JSON output in context-repo/.context/pipelines/speckit-fetch.mjs
- [x] T008 [P] Define fetch summary JSON Schema aligned with data-model.md in context-repo/.context/schemas/speckit-fetch.schema.json
- [x] T009 Wire Spec Kit CLI entry to call the new fetch pipeline in context-repo/.context/pipelines/speckit.mjs
- [x] T010 Extend SpeckitService with `fetch` that invokes `speckit-fetch.mjs`, persists summaries, and logs timings in app/src/main/services/SpeckitService.ts
- [x] T011 [P] Register `speckit:fetch` IPC handler returning typed results in app/src/main/ipc/handlers/speckit.handlers.ts
- [x] T012 [P] Expose `window.api.speckit.fetch` with updated type declarations in app/src/main/preload.ts
- [x] T013 Update Pinia workflow store with fetch status, cache freshness guard, and summary hydration in app/src/renderer/stores/speckitStore.ts
- [x] T014 Refresh SpeckitWizard controls to trigger fetches, show progress, and surface stale-cache prompts in app/src/renderer/components/SpeckitWizard.vue
- [x] T015 [P] Create reusable fetch status panel for summaries and errors in app/src/renderer/components/speckit/SpeckitFetchStatus.vue
- [x] T016 [P] Add Vitest coverage for `SpeckitService.fetch` success, stale, and lock scenarios in app/tests/services/SpeckitService.spec.ts
- [x] T017 [P] Add mock fetch summaries for unit and E2E fixtures in app/tests/mocks/speckit-fetch-success.json and app/tests/mocks/speckit-fetch-stale.json
- [x] T018 Validate happy-path and stale-cache flows with Playwright in app/e2e/sdd-workflow.spec.ts (new Spec Kit fetch describe block)

---

## Phase 4: User Story 2 - Developer previews Spec Kit content as entities (Priority: P2)

**Goal**: Let developers browse cached markdown grouped by entity type, preview content, and choose templates to seed YAML entities.

**Independent Test**: After fetching, display markdown previews with filtering and confirm selection flows route chosen documents into the existing entity generation step without leaving the app.

- [x] T019 Extend SpeckitService to enumerate cached markdown metadata grouped by entity type in app/src/main/services/SpeckitService.ts
- [x] T020 [P] Register `speckit:listPreviews` IPC handler exposing preview collections in app/src/main/ipc/handlers/speckit.handlers.ts
- [x] T021 [P] Publish `window.api.speckit.listPreviews` bridge with strict typing in app/src/main/preload.ts
- [x] T022 [P] Create renderer Spec Kit client for fetch/list operations in app/src/renderer/services/speckitClient.ts
- [x] T023 Establish dedicated preview Pinia store with filter/search state in app/src/renderer/stores/speckitLibraryStore.ts
- [x] T024 Integrate preview list and filters into SpeckitWizard with Composition API patterns in app/src/renderer/components/SpeckitWizard.vue
- [x] T025 [P] Build markdown preview pane component reusing existing renderer pipeline in app/src/renderer/components/speckit/SpeckitPreviewPane.vue
- [x] T026 Wire preview selection into entity generation requests without manual YAML editing in app/src/renderer/components/speckit/SpeckitWizard.vue
- [x] T027 [P] Cover preview store filtering and selection logic with Vitest in app/tests/stores/speckitLibraryStore.spec.ts
- [x] T028 Exercise preview browsing and filtering in Playwright via app/e2e/speckit-preview.spec.ts

---

## Phase 5: User Story 3 - Release manager validates pipelines after Spec Kit-driven updates (Priority: P3)

**Goal**: Automatically run validation, graph, impact, and prompt pipelines after entity generation and surface actionable status to release managers.

**Independent Test**: Generate entities from Spec Kit markdown and verify all context-repo pipelines run sequentially with UI feedback for pass/fail cases linked to offending artifacts when failures occur.

- [x] T029 Implement post-generation pipeline orchestrator that chains validate, build-graph, impact, and generate in app/src/main/services/SpeckitService.ts or a dedicated module under app/src/main/services/
- [x] T030 [P] Add IPC handler `speckit:runPipelines` returning pipeline verification reports in app/src/main/ipc/handlers/speckit.handlers.ts
- [x] T031 [P] Bridge pipeline execution API through preload exports and global typing in app/src/main/preload.ts
- [x] T032 Update Speckit workflow store to trigger pipeline orchestration after entity creation and persist results in app/src/renderer/stores/speckitStore.ts
- [x] T033 [P] Render pipeline status cards with links to source markdown and generated YAML in app/src/renderer/components/speckit/SpeckitPipelineStatus.vue
- [x] T034 [P] Add Vitest coverage for pipeline orchestration success/failure branches in app/tests/services/SpeckitService.spec.ts (new describe block)
- [x] T035 Validate pipeline result surfacing with Playwright in app/e2e/speckit-pipelines.spec.ts
- [x] T036 Document automated pipeline verification flow and stale-cache guardrails in specs/001-speckit-integration/quickstart.md

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Align documentation, diagrams, and verification scripts across the workspace.

- [x] T037 Update C4 diagrams to include Spec Kit SaaS boundary and pipeline flow in context-repo/c4/context-sync-mvp.md and create component detail in context-repo/c4/component-sync.md
- [x] T038 Document Spec Kit prerequisites, fetch workflow, and 7-day freshness policy in README.md
- [x] T039 Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` within app/ to confirm no regressions
- [x] T040 Run `pnpm validate`, `pnpm build-graph`, `pnpm impact`, and `pnpm generate` within context-repo/ to verify pipelines stay green

---

## Dependencies & Execution Order

- Phase flow: Setup → Foundational → User Story 1 → User Story 2 → User Story 3 → Polish
- User story dependency graph:

```
US1 (P1) → US2 (P2) → US3 (P3)
```

US2 depends on fetch telemetry from US1. US3 depends on entity generation paths introduced in US2.

## Parallel Execution Examples

- **User Story 1**: After T010, run T011 and T012 in parallel while UI work (T014–T015) proceeds independently from test updates (T016–T018).
- **User Story 2**: Execute Pinia store (T023) and preview pane component (T025) concurrently once IPC bridge (T020–T022) lands.
- **User Story 3**: Develop UI status component (T033) in parallel with Vitest additions (T034) while Playwright coverage (T035) waits for orchestrator wiring (T029–T032).

## Implementation Strategy

1. Deliver MVP by completing Setup, Foundational, and all User Story 1 tasks (T001–T018) to unlock deterministic fetching.
2. Layer User Story 2 tasks (T019–T028) to provide preview and selection capabilities once fetch telemetry is stable.
3. Finish User Story 3 (T029–T036) to automate constitutional pipelines and reporting, then tackle polish tasks (T037–T040).
4. At each user story completion, run the associated Vitest and Playwright suites before moving forward.
