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
	- NOTE: Banner copy must reference "Limited Read-Only Mode" terminology.
- [*] T028 Add unified session export utility in `app/src/renderer/services/assistant/exporter.ts`
 - [ ] T081 [P] Update C4 diagrams early (`context-repo/c4/context-sync-mvp.md`, `component-sync.md`) to reflect unified assistant + sidecar + embeddings + gating artifact (MERGE BLOCKER per Constitution Principle I lock-step; MUST complete before further assistant UI merges)
- // TODO(T081): Implement diagram updates; ensure sidecar boundary + gating artifact generator + embeddings checksum flow are visually represented and cross-reference FR-039/FR-040 in diagram notes.
 - [ ] T028A [P] Add deterministic embeddings pipeline script `.context/pipelines/build-embeddings.mjs` (FR-039)
- // TODO(T028A): Create script scaffolding; accept corpus config, generate embeddings, produce sorted vector list before hashing.
 - [ ] T028B [P] Add embeddings checksum telemetry emission logic (FR-039)
- // TODO(T028B): Extend telemetry emitter with checksum field; emit after successful pipeline completion; validate SHA-256.
 - [ ] T028C Add gating artifact generator script `scripts/ci/run-gates.ts` producing `generated/gate-status.json` (FR-040)
- // TODO(T028C): Script should aggregate sidecarOnly, checksumMatch, classificationEnforced; fail CI if any false.
 - [ ] T028D Add manifest schema validation step in `manifest.ts` (FR-038)
- // TODO(T028D): Integrate JSON schema validation; on failure trigger Limited Read-Only Mode banner.
 - [ ] T028E Add provider capability validation test skeleton (links to Phase 4 test) (FR-038)
- // TODO(T028E): Create test scaffold asserting invalid manifest blocks tools and logs telemetry event.
 - [ ] T028F [P] Add system prompt sanitization utility `app/src/renderer/services/assistant/promptSanitizer.ts` (FR-035)
- // TODO(T028F): Implement pattern removal (credentials, >5 blank lines); expose sanitize(prompt: string): SanitizeResult.
 - [ ] T028G [P] Implement tool classification map & enforcement `app/src/renderer/services/assistant/toolClassification.ts` (segregate safe vs mutating) (FR-032)
- // TODO(T028G): Define enum SafetyClass; enforce approval policy branches including destructive double-confirm.
 - [ ] T028H [P] Add classification gating unit test skeleton `app/tests/unit/assistant/tool-classification.spec.ts` (FR-032)
- // TODO(T028H): Cover readOnly (no approval), mutating (single), destructive (double-confirm + reason required).
 - [ ] T028I [P] Add sidecar invocation verification script `scripts/ci/assert-sidecar-only.ts` (ensures SC-001; fails build if regex matches forbidden imports: /@azure\\/openai|langchain|openai\\s*from/ in app/src **except** context-kit-service Python; outputs JSON { disallowedCount, files:[] } and exits 1 if disallowedCount>0)
- // TODO(T028I): Implement file scan excluding sidecar service; integrate into CI pipeline before test stage.
 - [ ] T028J Add JSON export schema validation test skeleton `app/tests/unit/assistant/export-schema.spec.ts` (FR-019) (assert canonical ordering [id,role,content,createdAt,safetyClass,toolMeta,approvals]; required fields id,role,content,createdAt; validate UUID + ISO8601 formats; approvals[] shape { id, approved:boolean, approvedAt? })
- // TODO(T028J): Build sample export; assert ordering & field validation; add negative case for missing createdAt.
 - [ ] T028K [P] Produce early accessibility checklist `docs/a11y/unified-assistant-initial.md` (partial FR-020) before MVP freeze
- // TODO(T028K): Document focus order, dialog roles, keyboard shortcuts baseline; mark gaps for Phase 6.
 - [ ] T028L Add first-token latency harness `app/scripts/perf/first-token-latency.ts` + test `app/tests/perf/first-token-latency.spec.ts` (SC-005)
- // TODO(T028L): Implement harness capturing timestamp at request dispatch and first stream chunk; aggregate p50/p95.

**Checkpoint**: Foundational layer complete – begin user story phases.

---
## Phase 3: User Story 1 - Unified Assistant Experience (Priority: P1) 🎯 MVP
**Goal**: Single consolidated assistant UI supporting conversation, tools, streaming, approvals, edit suggestions.
**Independent Test**: User can start a session, send a message (streaming), run a tool, receive edit suggestion, approve change – all in unified component.

### Implementation
- [*] T029 [P] [US1] Create `UnifiedAssistant.vue` in `app/src/renderer/components/assistant/UnifiedAssistant.vue`
 - [ ] T029A [P] [US1] Integrate legacy mode tags (improvement/clarification/general) mapping in `assistantStore.ts` (FR-023)
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
 - [ ] T049A [P] Performance test: transcript rendering p95 frame time <33ms (`app/tests/perf/transcript-render.spec.ts`) (FR-002)
- // TODO(T049A): Use virtualization mock & performance marks; compute 30-run distribution.
 - [ ] T050A [P] Filter persistence test (`app/tests/unit/assistant/filter-persistence.spec.ts`) (FR-014)
- // TODO(T050A): Verify filter state resets on new session creation.
	- [ ] T051B Atomic state update invariants test (`app/tests/unit/assistant/atomic-updates.spec.ts`) (FR-031)
	- // TODO(T051B): Simulate failure mid-transaction and assert rollback of all related arrays.
	- [ ] T052A Limited Read-Only Mode activation test (`app/tests/unit/assistant/fallback-mode.spec.ts`) (FR-011)
	- // TODO(T052A): Force sidecar unavailability; assert banner + disabled tools.
	- [ ] T052B Version incompatibility banner test (`app/tests/unit/assistant/version-incompat-banner.spec.ts`) (FR-028)
	- // TODO(T052B): Inject incompatible manifest version; expect banner + disabled tool palette.
	- [ ] T052C Transcript export markdown/JSON test (`app/tests/unit/assistant/export-transcript.spec.ts`) (FR-019)
	- // TODO(T052C): Validate canonical JSON ordering and Markdown heading formatting.
	- [ ] T052D Legacy mode tag persistence test (`app/tests/unit/assistant/legacy-modes.spec.ts`) (FR-023)
	- // TODO(T052D): Import legacy messages and assert mode tags mapped.
	- [ ] T052E System prompt sanitization test (`app/tests/unit/assistant/prompt-sanitizer.spec.ts`) (FR-035)
	- // TODO(T052E): Provide sample prompt containing credentials and blank lines; assert redaction & collapse.
	- [ ] T052F Tool status rendering test (`app/tests/unit/assistant/tool-status-render.spec.ts`) (FR-009)
	- // TODO(T052F): Simulate queued→running→succeeded transitions; verify DOM updates with safety class badge.
		- [ ] T052G Prompt LOC/component count enforcement script task placeholder (FR-001)
		- // TODO(T052G): Implement static analyzer counting inline code blocks & references; fail on thresholds.
		- [ ] T052H Transcript performance harness implementation (`app/scripts/perf/transcript-harness.ts`) (FR-002)
		- // TODO(T052H): Capture frame render times using RAF timestamps while rendering synthetic 500-message transcript.
		- [ ] T052I Diff summarization algorithm threshold test (`app/tests/unit/assistant/diff-summarization.spec.ts`) (FR-037)
		- // TODO(T052I): Provide diff just over 800 lines and another >100KB raw; assert summarization triggers.
		- [ ] T052J Gating artifact schema validation test (`app/tests/unit/assistant/gating-schema.spec.ts`) (FR-040)
		- // TODO(T052J): Load generated/gate-status.json; assert boolean fields all true else test fails.
		- [ ] T052O Interaction latency harness & test (`app/scripts/perf/interaction-latency.ts`, `app/tests/perf/interaction-latency.spec.ts`) (SC-002)
		- // TODO(T052O): Simulate ask+tool+approval sequence over 30 runs; compute median <180s else fail; capture JSON metrics.
		- [ ] T052K Timeout error formatting test (`app/tests/unit/assistant/timeout-format.spec.ts`) (FR-041)
		- // TODO(T052K): Mock timeout error; assert suggestedAction within allowed enum and retry button conditional.
		- [ ] T052L Partial capability fallback test (`app/tests/unit/assistant/partial-capability-fallback.spec.ts`) (FR-038 Limited Read-Only Mode)
		- // TODO(T052L): Provide manifest missing required tool; assert fallback disables only unsupported tool & banner.
		- [ ] T052M Embeddings checksum collision simulation test (`app/tests/unit/assistant/embeddings-collision.spec.ts`) (FR-039)
		- // TODO(T052M): Force altered vector order to ensure checksum change detected; assert mismatch flagged.
		- [ ] T052N Concurrent approvals isolation test (`app/tests/unit/assistant/concurrent-approvals.spec.ts`) (Edge Case: user action on one approval must not auto-approve others)
		- // TODO(T052N): Queue two approvals; approve one; assert second remains pending.

### Tests (Optional but added for robustness)
- [ ] T049 [P] [US1] Vitest: streaming message assembly test `app/tests/unit/assistant/streaming.spec.ts`
- [ ] T050 [P] [US1] Vitest: edit suggestion apply workflow test `app/tests/unit/assistant/edit-apply.spec.ts`
- [ ] T051 [P] [US1] Vitest: telemetry emission test `app/tests/unit/assistant/telemetry.spec.ts`
- [ ] T052 [US1] Playwright: end-to-end unified assistant interaction `app/tests/e2e/unified-assistant.spec.ts`
 - [ ] T051A Vitest: approval logging integrity test `app/tests/unit/assistant/approval-logging.spec.ts` (FR-017)
- [ ] T051C Vitest: approval dialog accessibility test `app/tests/unit/assistant/approval-a11y.spec.ts` (FR-005)
- [ ] T051D Vitest: telemetry completeness test `app/tests/unit/assistant/telemetry-completeness.spec.ts` (FR-004, FR-017)

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
 - [ ] T064A [P] Concurrency cap enforcement test `app/tests/unit/assistant/concurrency-cap.spec.ts` (FR-022)
 - [ ] T065A [P] Provider capability validation test `app/tests/unit/assistant/provider-capabilities.spec.ts` (FR-038)
 - [ ] T066A [P] Partial retry selection UI test `app/tests/unit/assistant/partial-retry.spec.ts` (FR-030)
 - [ ] T066B Retry-on-timeout test `app/tests/unit/assistant/timeout-retry.spec.ts` (FR-041)
 - [ ] T059A Summarization threshold test `app/tests/unit/assistant/summarization-threshold.spec.ts` (FR-010)
- // TODO(T059A): Provide large output >100KB and separate >800 lines; assert summarization & expansion restores full payload.
	- [ ] T066C Classification gating enforcement test `app/tests/unit/assistant/classification-gate.spec.ts` (FR-032)
	- // TODO(T066C): Attempt destructive tool without double-confirm; assert block & telemetry error.
		- [ ] T066D Timeout alert accessibility role test `app/tests/unit/assistant/timeout-accessibility.spec.ts` (FR-041)
		- // TODO(T066D): Ensure timeout alert has role=alert and focus management.
		- [ ] T066E Double-confirm destructive tool flow test (`app/tests/unit/assistant/destructive-confirm.spec.ts`) (FR-032 destructive branch)
		- // TODO(T066E): Simulate destructive invocation; require reason + second confirm; assert both captured.
		- [ ] T066F Security regression test for approval bypass scenarios (`app/tests/unit/assistant/approval-security.spec.ts`) (verifies double-confirm enforced, reason required non-empty, cancellation doesn't leak state)
		- // TODO(T066F): Attempt bypass (programmatic state change); assert store prevents commit without approvals.

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
 - [ ] T077A Migration rollback scenario negative test (augment T079) (FR-006)

### Tests
- [ ] T077 [P] [US3] Vitest: migration mapping test `app/tests/unit/assistant/migration-mapping.spec.ts`
- [ ] T078 [P] [US3] Vitest: deduplication accuracy test `app/tests/unit/assistant/migration-dedupe.spec.ts`
- [ ] T079 [P] [US3] Vitest: rollback on failure test `app/tests/unit/assistant/migration-rollback.spec.ts`
- [ ] T080 [US3] Playwright: migration end-to-end test `app/tests/e2e/migration-flow.spec.ts`
 - [ ] T077B [P] Migration performance harness & test `app/scripts/perf/migration-perf.ts`, `app/tests/perf/migration-perf.spec.ts` (FR-006)
 	- // TODO(T077B): Measure p50/p95 migration durations for typical (≤500 messages) and large (≥2000 messages) datasets; assert p95 ≤5000ms for typical case.

**Checkpoint**: Migration complete; legacy modal can be fully deprecated.

---
## Phase 6: Polish & Cross-Cutting Concerns
**Purpose**: Performance, documentation, security, deprecation completion.

- [ ] T082 Refactor duplicated helpers (telemetry/time calc) in `assistantStore.ts` & services
- [ ] T083 [P] Performance test script for tool durations `app/scripts/perf/tool-durations.ts`
- [ ] T084 Add security review notes in `docs/SECURITY.md` referencing approvals flow
- [ ] T085 [P] Comprehensive accessibility audit adjustments `UnifiedAssistant.vue` & subcomponents
- [ ] T086 Remove legacy modal component `app/src/renderer/components/AIAssistantModal.vue` with deprecation note
 - [ ] T086A [P] Accessibility audit for provider identity alt text & banner semantics (FR-034, FR-028)
- [ ] T087 [P] Add embeddings pipeline script `context-repo/.context/pipelines/build-embeddings.mjs` (wrapper)
- [ ] T088 Update quickstart with migration & manifest sections expansion `specs/001-assistant-sidecar-unify/quickstart.md`
- [ ] T089 [P] Add README section about unified assistant at repo root `README.md`
- [ ] T090 Final telemetry schema documentation `docs/ai-enhancements-completed.md`
 - [ ] T090A Embeddings checksum reproducibility test (pytest) `context-kit-service/tests/test_embeddings_checksum.py` (FR-039)
 - [ ] T090B Gating artifact verification test `app/tests/unit/assistant/gating-artifact.spec.ts` (FR-040)
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
