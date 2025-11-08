# Tasks: AI Assistant Safe Tooling Upgrade

**Input**: Design documents from `/specs/001-ai-assistant-tools/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks included where functional requirements mandate regression coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- Add shared tasks for running constitutionally required pipelines whenever stories modify context entities.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare environment scaffolding and dependencies required by all stories.

- [x] T001 Update Azure OpenAI and Ollama placeholders in `app/.env.example` per quickstart.md
- [x] T002 [P] Add OpenAI Node SDK dependency in `app/package.json` and refresh `app/pnpm-lock.yaml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

- [x] T003 Create assistant domain models and tool descriptors in `app/src/shared/assistant/types.ts`
- [x] T004 Implement provider configuration loader with per-tool toggles in `app/src/main/services/providerConfig.ts`
- [x] T005 Wire preload bridge stubs for session, message, and tool channels in `app/src/preload/assistantBridge.ts`
- [x] T006 Seed renderer store with session state scaffolding in `app/src/renderer/stores/assistantStore.ts`

**Checkpoint**: Foundation ready – user story implementation can now begin.

---

## Phase 3: User Story 1 - Operate pipelines safely (Priority: P1) 🎯 MVP

**Goal**: Allow operators to run allowlisted pipelines through Azure while capturing telemetry and enforcing safety guardrails.

**Independent Test**: From the assistant UI, request a validation pipeline run and confirm the assistant (1) confirms scope, (2) executes via allowlisted tool, and (3) records telemetry while refusing an unauthorized command.

### Tests for User Story 1

- [x] T007 [P] [US1] Add pipeline execution happy-path spec in `app/tests/services/assistantPipeline.spec.ts`
- [x] T008 [P] [US1] Add unauthorized tool rejection spec in `app/tests/services/assistantToolGuard.spec.ts`

### Implementation for User Story 1

- [x] T009 [US1] Implement Azure provider client leveraging OpenAI SDK in `app/src/main/services/providers/azureClient.ts`
- [x] T010 [US1] Refactor tool orchestrator to enforce allowlist and telemetry in `app/src/main/services/toolOrchestrator.ts`
- [x] T011 [US1] Expose pipeline run command over IPC bridge in `app/src/preload/assistantBridge.ts`
- [x] T012 [US1] Render pipeline confirmation and audit feedback in `app/src/renderer/components/assistant/ToolPanel.vue`
- [x] T013 [US1] Persist telemetry events to structured log sink in `app/src/main/services/telemetryWriter.ts`
- [x] T014 [US1] Document pipeline run workflow updates in `specs/001-ai-assistant-tools/quickstart.md`

**Checkpoint**: User Story 1 independently delivers the safe pipeline execution MVP.

---

## Phase 4: User Story 2 - Capture repository context (Priority: P2)

**Goal**: Provide consistent read-only context retrieval with aligned conversation roles across Azure and Ollama providers.

**Independent Test**: Request a file summary using each provider and confirm transcripts use identical role sequencing with provenance and no unintended writes.

### Tests for User Story 2

- [x] T015 [P] [US2] Add conversation parity regression spec in `app/tests/services/assistantConversation.spec.ts`

### Implementation for User Story 2

- [x] T016 [US2] Implement conversation manager enforcing role sequencing in `app/src/main/services/conversationManager.ts`
- [x] T017 [US2] Harmonize streaming handlers for both providers in `context-repo/.context/pipelines/ai-common.mjs`
- [x] T018 [US2] Add provenance-aware transcript view in `app/src/renderer/components/assistant/TranscriptView.vue`
- [x] T019 [US2] Implement read-only file retrieval tool in `app/src/main/services/tools/readContextFile.ts`
- [x] T020 [US2] Surface read tool responses with source metadata in `app/src/renderer/components/assistant/ResponsePane.vue`

**Checkpoint**: User Stories 1 and 2 function independently with provider parity maintained.

---

## Phase 5: User Story 3 - Prepare change proposals (Priority: P3)

**Goal**: Enable controlled write operations, diff previews, and PR preparation with human approval checkpoints.

**Independent Test**: Request a scoped spec edit, review the diff preview, approve the change, and confirm the assistant stages the modification and drafts a PR summary without auto-submitting.

### Tests for User Story 3

- [x] T021 [P] [US3] Add approval flow regression spec in `app/tests/services/assistantApprovals.spec.ts`

### Implementation for User Story 3

- [x] T022 [US3] Implement diff preview generator for scoped edits in `app/src/main/services/tools/writeContextPatch.ts`
- [x] T023 [US3] Extend pending approvals management in `app/src/renderer/stores/assistantStore.ts`
- [x] T024 [US3] Build approval dialog with explicit confirmation gates in `app/src/renderer/components/assistant/ApprovalDialog.vue`
- [x] T025 [US3] Integrate simple-git PR preparation workflow in `app/src/main/services/tools/openPullRequest.ts`
- [x] T026 [US3] Capture approval outcomes in telemetry writer `app/src/main/services/telemetryWriter.ts`
- [ ] T027 [US3] Update quickstart instructions with approval and PR steps in `specs/001-ai-assistant-tools/quickstart.md`

**Checkpoint**: All user stories now operate independently with human-in-the-loop safeguards.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize documentation, architecture updates, and pipeline validations across stories.

- [ ] T028 Refresh assistant architecture sections in `docs/ai-enhancements-implementation-plan.md`
- [ ] T029 Update context-level C4 diagram in `context-repo/c4/context-sync-mvp.md`
- [ ] T030 Update component-level C4 diagram in `context-repo/c4/component-sync.md`
- [ ] T031 Run constitutional pipelines (`pnpm validate`, `pnpm impact`, `pnpm generate`) in `context-repo/`
- [ ] T032 Perform end-to-end smoke verification script documented in `specs/001-ai-assistant-tools/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No prerequisites.
- **Foundational (Phase 2)**: Depends on Phase 1; blocks all user stories.
- **User Story Phases (3–5)**: Each depends on Phase 2 completion; stories can proceed in priority order (P1 → P2 → P3) or parallel once foundations are stable.
- **Polish (Phase 6)**: Depends on completion of targeted user stories.

### User Story Dependencies

- **US1**: Depends on foundational tool descriptors, provider config, and preload bridge.
- **US2**: Depends on US1 only for shared telemetry plumbing but can run after Phase 2 as long as telemetry writer stubs exist.
- **US3**: Depends on approval data structures introduced in Phase 2 and telemetry writer enhancements from US1.

### Within Each User Story

- Execute marked tests (T007, T008, T015, T021) before implementation tasks to confirm red/green cycles.
- Complete model/service layers before renderer/UI bindings to maintain clear dependencies.
- Update documentation tasks (T014, T027) after functional work is validated.

## Parallel Opportunities

- T001 and T002 can proceed concurrently.
- Foundational tasks T003–T006 touch distinct files and can be parallelized once scoped.
- In US1, tests T007/T008 run in parallel; implementation tasks T009–T013 can be split by file ownership.
- In US2, T016–T020 can be parallelized with coordination on shared types.
- In US3, tasks T022–T026 span separate files enabling multi-developer execution after interface alignment.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phases 1 and 2.
2. Execute Phase 3 (US1) tasks through T014.
3. Validate telemetry and pipeline guardrails via T007 and T008.
4. Demo MVP before proceeding.

### Incremental Delivery

1. Deliver US1 (pipeline safety) as MVP.
2. Layer US2 for read parity once MVP stabilizes.
3. Add US3 for change proposal automation, keeping approvals manual.
4. Close with Phase 6 polish tasks and constitutional pipeline runs.

### Parallel Team Strategy

- Assign one developer to US1 (Azure SDK + pipeline tools), another to US2 (conversation parity), and a third to US3 (approval + PR flow) once foundational work is complete.
- Coordinate via shared type definitions from Phase 2 to minimize integration friction.
