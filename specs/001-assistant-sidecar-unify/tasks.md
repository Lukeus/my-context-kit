# Tasks: Assistant Sidecar Unification

**Input**: Design documents from `/specs/001-assistant-sidecar-unify/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Phase 1: Setup (Shared Infrastructure)
**Purpose**: Establish baseline environment & repo hygiene before feature code.

- [*] T001 Configure sidecar service env variables in `context-kit-service/.env.example` (add placeholders for provider keys)
- [*] T002 Add deprecation notice banner in `app/src/renderer/stores/aiStore.ts` top-level comment
- [*] T003 [P] Add feature flag `UNIFIED_ASSISTANT_ENABLED` in `app/src/renderer/stores/assistantStore.ts`
- [*] T004 Initialize `app/src/renderer/services/sidecar/` directory with README placeholder
- [*] T005 [P] Ensure TypeScript strict settings unchanged (`app/tsconfig.json`) add TODO markers for any lax settings
- [*] T006 Add base telemetry event type extensions in `app/src/shared/assistant/telemetry.ts`
- [*] T007 [P] Create capability manifest interface in `app/src/shared/assistant/capabilities.ts`
- [*] T008 Add migration record interface in `app/src/shared/assistant/migration.ts`
- [*] T009 [P] Update `.github/copilot-instructions.md` to include sidecar usage note (script already updated, verify edits)

---
## Phase 2: Foundational (Blocking Prerequisites)
**Purpose**: Core structures required by all user stories.

- [*] T010 Implement sidecar HTTP client shell in `app/src/renderer/services/sidecar/client.ts`
- [*] T011 [P] Implement capability manifest fetch logic in `app/src/renderer/services/sidecar/manifest.ts`
- [*] T012 Add queue manager class in `app/src/renderer/services/assistant/queueManager.ts`
- [*] T013 [P] Extend `assistantStore.ts` state with telemetry arrays & capabilityVersion
- [*] T014 Implement telemetry emission helper in `app/src/renderer/services/assistant/telemetryEmitter.ts`
- [*] T015 [P] Add IPC handler adjustments in `app/src/main/ipc/handlers/assistant/sessionHandlers.ts`
- [*] T016 Add preload bridge extensions in `app/src/preload/assistantBridge.ts` for new APIs
- [*] T017 [P] Create diff summarization utility in `app/src/renderer/services/assistant/diffSummarizer.ts`
- [*] T018 Implement migration adapter skeleton in `app/src/renderer/services/assistant/migrationAdapter.ts`
- [*] T019 [P] Add tool invocation status types in `app/src/shared/assistant/toolInvocation.ts`
- [*] T020 Implement sidecar fallback detection in `app/src/renderer/services/sidecar/health.ts`
- [*] T021 [P] Add accessibility focus traversal map in `app/src/renderer/components/assistant/a11y-map.ts`
- [X] T022 Add concurrency limiter (<=3) enforcement logic in `assistantStore.ts` (NOTE: Already implemented via T012 queue manager - COMPLETE)
- [*] T023 [P] Add provider identity display token mapping in `app/src/renderer/services/assistant/providerTokens.ts`
- [*] T024 Implement automatic manifest refresh scheduler in `app/src/renderer/services/assistant/manifestScheduler.ts`
- [*] T025 [P] Add approval decision logger in `app/src/renderer/services/assistant/approvalLogger.ts`
- [*] T026 Implement large output summarizer in `app/src/renderer/services/assistant/outputSummarizer.ts`
- [*] T027 [P] Add read-only fallback banner component placeholder in `app/src/renderer/components/assistant/FallbackBanner.vue`
- [*] T028 Add unified session export utility in `app/src/renderer/services/assistant/exporter.ts`

**Checkpoint**: Foundational layer complete – begin user story phases.

---
## Phase 3: User Story 1 - Unified Assistant Experience (Priority: P1) 🎯 MVP
**Goal**: Single consolidated assistant UI supporting conversation, tools, streaming, approvals, edit suggestions.
**Independent Test**: User can start a session, send a message (streaming), run a tool, receive edit suggestion, approve change – all in unified component.

### Implementation
- [*] T029 [P] [US1] Create `UnifiedAssistant.vue` in `app/src/renderer/components/assistant/UnifiedAssistant.vue`
- [*] T030 [P] [US1] Integrate transcript view subcomponent `TranscriptView.vue` (adjust existing or create new)
- [*] T031 [US1] Implement message composer with streaming toggle in `app/src/renderer/components/assistant/MessageComposer.vue`
- [*] T032 [US1] Wire tool palette component `ToolPalette.vue` invoking sidecar tools
- [*] T033 [P] [US1] Implement approval dialog `ApprovalDialog.vue`
- [*] T034 [US1] Integrate diff viewer component `DiffViewer.vue` supporting full file + summarization
- [*] T035 [P] [US1] Add provider badge component `ProviderBadge.vue`
- [*] T036 [US1] Add transcript filtering controls `TranscriptFilters.vue`
- [*] T037 [P] [US1] Implement telemetry panel `TelemetryPanel.vue` (session stats)
- [*] T038 [US1] Hook queue manager and concurrency limiter into `assistantStore.ts`
- [*] T039 [US1] Implement edit suggestion apply workflow (store + approval) in `assistantStore.ts`
- [*] T040 [US1] Add accessibility roles & keyboard navigation to `UnifiedAssistant.vue`
- [*] T041 [US1] Implement streaming token accumulator and finalize merge into message
- [*] T042 [US1] Implement error messaging for timeouts & capability mismatches in `UnifiedAssistant.vue`
- [*] T043 [US1] Add session export action (markdown) to UI
- [*] T044 [US1] Replace legacy modal triggers with unified assistant activation in `app/src/renderer/components/` entry points
- [*] T045 [US1] Add deprecation toast when legacy `AIAssistantModal` accessed
- [*] T046 [US1] Implement success/error counts summary for session in `TelemetryPanel.vue`
- [*] T047 [US1] Integrate manifest refresh manual action button
- [*] T048 [US1] Ensure atomic state updates (wrap critical mutations) in `assistantStore.ts`

### Tests (Optional but added for robustness)
- [ ] T049 [P] [US1] Vitest: streaming message assembly test `app/tests/unit/assistant/streaming.spec.ts`
- [ ] T050 [P] [US1] Vitest: edit suggestion apply workflow test `app/tests/unit/assistant/edit-apply.spec.ts`
- [ ] T051 [P] [US1] Vitest: telemetry emission test `app/tests/unit/assistant/telemetry.spec.ts`
- [ ] T052 [US1] Playwright: end-to-end unified assistant interaction `app/tests/e2e/unified-assistant.spec.ts`

**Checkpoint**: MVP delivered (US1 tasks complete). Proceed only after validation.

---
## Phase 4: User Story 2 - Sidecar Tooling Integration (Priority: P2)
**Goal**: All tooling routed through sidecar with structured outputs and error handling.
**Independent Test**: Each pipeline tool executed via sidecar produces expected result and telemetry entry; errors handled gracefully.

### Implementation
- [*] T053 [P] [US2] Implement tool invocation abstraction in `app/src/renderer/services/assistant/toolInvoker.ts`
- [*] T054 [US2] Add standardized tool result renderer `ToolResult.vue`
- [*] T055 [P] [US2] Implement error classification utility `app/src/renderer/services/assistant/errorClassifier.ts`
- [*] T056 [US2] Integrate sidecar health checks into tool invocation preflight
- [*] T057 [P] [US2] Implement retry logic for failed tool invocations (partial retry) in `toolInvoker.ts`
- [*] T058 [US2] Add queue visualization component `ToolQueue.vue`
- [*] T059 [P] [US2] Implement large output summarization UI expansion in `ToolResult.vue`
- [*] T060 [US2] Add capability mismatch banner logic consumption in `UnifiedAssistant.vue`
- [*] T061 [P] [US2] Implement telemetry aggregation (tool durations) `app/src/renderer/services/assistant/telemetryAggregator.ts`
- [*] T062 [US2] Add provider identity labeling for tool results
- [*] T063 [US2] Integrate manual manifest refresh button action wiring

### Tests
- [ ] T064 [P] [US2] Vitest: tool queue concurrency test `app/tests/unit/assistant/tool-queue.spec.ts`
- [ ] T065 [P] [US2] Vitest: capability mismatch gating test `app/tests/unit/assistant/manifest-gate.spec.ts`
- [ ] T066 [P] [US2] Vitest: retry logic test `app/tests/unit/assistant/retry.spec.ts`
- [ ] T067 [US2] Playwright: sidecar tool execution flow `app/tests/e2e/tooling-flow.spec.ts`

**Checkpoint**: Sidecar tooling stable with telemetry.

---
## Phase 5: User Story 3 - Graceful Legacy Migration (Priority: P3)
**Goal**: Automatic legacy migration with fallback manual import; no data loss; transparent user notifications.
**Independent Test**: Legacy data imported automatically; manual import works after dismissal; migrated sessions flagged.

### Implementation
- [X] T068 [P] [US3] Implement migration scan logic in `migrationAdapter.ts`
- [X] T069 [US3] Implement auto migration trigger on first assistant load
- [X] T070 [P] [US3] Implement manual import action & UI button `MigrationControls.vue`
- [X] T071 [US3] Implement deduplication algorithm in `migrationAdapter.ts`
- [X] T072 [P] [US3] Add migration status indicator `MigrationStatus.vue`
- [X] T073 [US3] Implement migration telemetry emission
- [X] T074 [P] [US3] Implement migration error handling & rollback routine
- [X] T075 [US3] Flag migrated sessions visually in `UnifiedAssistant.vue`
- [X] T076 [US3] Add audit export for migration record `app/src/renderer/services/assistant/migrationExport.ts`

### Tests
- [ ] T077 [P] [US3] Vitest: migration mapping test `app/tests/unit/assistant/migration-mapping.spec.ts`
- [ ] T078 [P] [US3] Vitest: deduplication accuracy test `app/tests/unit/assistant/migration-dedupe.spec.ts`
- [ ] T079 [P] [US3] Vitest: rollback on failure test `app/tests/unit/assistant/migration-rollback.spec.ts`
- [ ] T080 [US3] Playwright: migration end-to-end test `app/tests/e2e/migration-flow.spec.ts`

**Checkpoint**: Migration complete; legacy modal can be fully deprecated.

---
## Phase 6: Polish & Cross-Cutting Concerns
**Purpose**: Performance, documentation, security, deprecation completion.

- [ ] T081 [P] Update C4 diagrams (`context-repo/c4/context-sync-mvp.md`, `component-sync.md`)
- [ ] T082 Refactor duplicated helpers (telemetry/time calc) in `assistantStore.ts` & services
- [ ] T083 [P] Performance test script for tool durations `app/scripts/perf/tool-durations.ts`
- [ ] T084 Add security review notes in `docs/SECURITY.md` referencing approvals flow
- [ ] T085 [P] Comprehensive accessibility audit adjustments `UnifiedAssistant.vue` & subcomponents
- [ ] T086 Remove legacy modal component `app/src/renderer/components/AIAssistantModal.vue` with deprecation note
- [ ] T087 [P] Add embeddings pipeline script `context-repo/.context/pipelines/build-embeddings.mjs` (wrapper)
- [ ] T088 Update quickstart with migration & manifest sections expansion `specs/001-assistant-sidecar-unify/quickstart.md`
- [ ] T089 [P] Add README section about unified assistant at repo root `README.md`
- [ ] T090 Final telemetry schema documentation `docs/ai-enhancements-completed.md`
- [ ] T091 [P] Run validation & impact pipelines and capture results `context-repo/` logs
- [ ] T092 Lint & typecheck final pass; resolve any TODO markers

---
## Dependencies & Execution Order

Phase order: Setup → Foundational → US1 (MVP) → US2 → US3 → Polish.
User story dependencies: US2 and US3 depend on Foundational, independent of US1 but may enhance its components.

---
## Parallel Opportunities
- Marked [P] tasks across phases allow multi-dev execution (e.g., T029, T030, T033 can parallel).
- Test tasks (Vitest) can run concurrently after implementation stubs.

---
## Independent Test Criteria per Story
- US1: Perform full conversation + tool + edit apply + approval within unified UI.
- US2: All tools route through sidecar, telemetry captured, error handling and retry work.
- US3: Automatic migration success, manual import fallback, deduplication accuracy >95%.

---
## MVP Scope
MVP includes completion of phases: Setup, Foundational, and US1 tasks (T001–T052). Delivers unified assistant experience without full tooling robustness or migration.

---
## Format Validation
All tasks follow required format: `- [ ] T### [P]? [US#]? Description with file path`. Parallelizable tasks marked [P]; user story tasks labeled [US1], [US2], [US3]; phases clearly separated.
