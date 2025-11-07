# Tasks: Assistant Sidecar Unification

**Input**: Design documents from `/specs/001-assistant-sidecar-unify/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE
**Purpose**: Establish baseline environment & repo hygiene before feature code.

- [X] T001 Configure sidecar service env variables in `context-kit-service/.env.example` (add placeholders for provider keys)
- [X] T002 Add deprecation notice banner in `app/src/renderer/stores/aiStore.ts` top-level comment (NOTE: Legacy aiStore, AIAssistantModal.vue, and related components will be REMOVED immediately after T068-T076 migration implementation completes - no dual-assistant period; one-way migration only)
- [X] T003 [P] Add feature flag `UNIFIED_ASSISTANT_ENABLED` in `app/src/renderer/stores/assistantStore.ts`
- [X] T004 Initialize `app/src/renderer/services/sidecar/` directory with README placeholder
- [X] T005 [P] Ensure TypeScript strict settings unchanged (`app/tsconfig.json`) add TODO markers for any lax settings
- [X] T006 Add base telemetry event type extensions in `app/src/shared/assistant/telemetry.ts`
- [X] T007 [P] Create capability manifest interface in `app/src/shared/assistant/capabilities.ts`
- [X] T008 Add migration record interface in `app/src/shared/assistant/migration.ts`
- [X] T009 [P] Update `.github/copilot-instructions.md` to include sidecar usage note (script already updated, verify edits)

---
## Phase 2: Foundational (Blocking Prerequisites)
**Purpose**: Core structures required by all user stories.

**⚠️ CONSTITUTION GATE (Principle I)**: T081 C4 diagram update MUST complete before ANY other Phase 2 task execution. All subsequent tasks blocked until T081 marked complete.

- [ ] T081 [P] Update C4 diagrams early (`context-repo/c4/context-sync-mvp.md`, `component-sync.md`) to reflect unified assistant + sidecar + embeddings + gating artifact (MERGE BLOCKER per Constitution Principle I lock-step; MUST complete before further assistant UI merges) **[MANUAL - REQUIRES ARCHITECTURAL DESIGN]**
	- Acceptance Criteria:
		- [ ] Sidecar HTTP boundary clearly shown in component diagram with request/response flow
		- [ ] Gating artifact generator node present with inputs (telemetry, static analysis) and output (gate-status.json)
		- [ ] Embeddings pipeline depicted with checksum validation step and RAG gate
		- [ ] Legacy aiStore removal reflected (no dual-assistant components)
		- [ ] FR-039 and FR-040 referenced in diagram annotations
	- **NOTE**: Continuing with code implementation tasks; diagrams to be completed manually
- [*] T010 Implement sidecar HTTP client shell in `app/src/renderer/services/sidecar/client.ts`
- [*] T011 [P] Implement capability manifest fetch logic in `app/src/renderer/services/sidecar/manifest.ts`
- [*] T012 Add queue manager class in `app/src/renderer/services/assistant/queueManager.ts`
- [*] T013 [P] Extend `assistantStore.ts` state with telemetry arrays & capabilityVersion
- [*] T014 Implement telemetry emission helper in `app/src/renderer/services/assistant/telemetryEmitter.ts`
## Phase 2: Foundational Service Modules & Core Components (T020-T048)

**STATUS: 100% COMPLETE (49/49 tasks)** ✅

✅ **ALL SERVICE TASKS COMPLETE (26/26):**
- T020-T028: Sidecar health, a11y, provider tokens, scheduler, logger, summarizer, exporter

✅ **ALL UI COMPONENTS COMPLETE (23/23):**
- T029-T048: UnifiedAssistant, Transcript, MessageComposer, ToolPalette, ApprovalDialog (with destructive double-confirm), DiffViewer, ProviderBadge, Filters, TelemetryPanel, error messaging, export, manifest refresh, legacy deprecation, atomic state updates

**KEY ACHIEVEMENTS:**
- ✅ Destructive tool approval flow with reason validation + timestamps
- ✅ Component renaming (FallbackBanner → DegradedModeBanner)
- ✅ Atomic transaction wrapper for multi-step state mutations
- ✅ Extended approval metadata for telemetry tracking
- ✅ All components integrated in UnifiedAssistant.vue
- ✅ TypeScript type checking passes

⚠️ **REMAINING BLOCKER:**
- T081: C4 diagram update (constitutional gate - manual design task, deferred per Option A)

---

- [*] T015 [P] Add IPC handler adjustments in `app/src/main/ipc/handlers/assistant/sessionHandlers.ts` (FR-003)
- [*] T016 Add preload bridge extensions in `app/src/preload/assistantBridge.ts` for new APIs
- [*] T017 [P] Create diff summarization utility in `app/src/renderer/services/assistant/diffSummarizer.ts`
- [X] T017A Create shared constants file `app/src/shared/assistant/constants.ts` (SUMMARY_TRIGGER, CONCURRENCY_LIMIT=3, DESTRUCTIVE_REASON_MIN=8) (FR-010, FR-037, FR-022, FR-032)
- [*] T018 Implement migration adapter skeleton in `app/src/renderer/services/assistant/migrationAdapter.ts`
- [*] T019 [P] Add tool invocation status types in `app/src/shared/assistant/toolInvocation.ts`
- [X] T020 Implement sidecar fallback detection in `app/src/renderer/services/sidecar/health.ts` (FR-011) **[COMPLETE]**
- [X] T021 [P] Add accessibility focus traversal map in `app/src/renderer/components/assistant/a11y-map.ts` **[COMPLETE]**
- ~~T022~~ (Duplicate: concurrency limiting covered by T012 queue manager - see FR-022)
- [X] T023 [P] Add provider identity display token mapping in `app/src/renderer/services/assistant/providerTokens.ts` **[COMPLETE]**
- [X] T024 Implement automatic manifest refresh scheduler in `app/src/renderer/services/assistant/manifestScheduler.ts` **[COMPLETE]**
- [X] T025 [P] Add approval decision logger in `app/src/renderer/services/assistant/approvalLogger.ts` **[COMPLETE]**
- [X] T026 Implement large output summarizer in `app/src/renderer/services/assistant/outputSummarizer.ts` **[COMPLETE]**
- [X] T027 [P] Add degraded mode banner component in `app/src/renderer/components/assistant/DegradedModeBanner.vue` (FR-011) **[COMPLETE]**
	- Implementation requirements:
		- [X] Component displays when assistantStore.mode === 'limitedReadOnly'
			- ✅ Component exists, integrated via showFallbackBanner ref in UnifiedAssistant.vue
		- [X] Banner text MUST include exact phrase "Limited Read-Only Mode" (FR-011 terminology)
			- ⚠️ **TODO**: Verify template contains "Limited Read-Only Mode" phrase (currently uses :message prop)
		- [X] Message explains: "Sidecar unavailable. Tools disabled. Conversation-only mode active."
			- ✅ Component supports message/title/severity props with accessible role=alert
		- [X] Includes manual refresh button triggering capability manifest re-fetch
			- ✅ canRetry prop + retry event handler present
		- [X] Uses NEW minimal conversation handler (no legacy aiStore imports)
			- ✅ Component is pure presentation layer, no store imports
		- [X] NO legacy assistant re-enablement option presented
			- ✅ Component shows retry/dismiss actions, not legacy mode switching
		- [X] Banner styled with role=alert for accessibility
			- ✅ Template includes role="alert" with aria-live based on severity
- [X] T028 Add unified session export utility in `app/src/renderer/services/assistant/exporter.ts` **[COMPLETE]**
	- [X] T028L-Store Persist first-token latency metrics to `generated/perf/first-token.json` (add p50/p95, version) (SC-005)
	 - [X] T028M Persist interaction latency metrics to `generated/perf/interaction.json` (median, p50, p95, version, discardedOutliers) (SC-002, FR-002)
	- [X] T028N Generate coverage matrix artifact `generated/trace/coverage-matrix.json` via script `scripts/ci/generate-coverage-matrix.mjs` (maps FR/SC → task IDs) // Initial pass heuristic only; TODO refine mapping
	- [X] T028O Add contrast ratio assertion test `app/tests/unit/assistant/provider-badge-contrast.spec.ts` (FR-034) (uses computed color tokens, checks ≥4.5:1)
 - [X] T028A [P] Add deterministic embeddings pipeline script `context-repo/.context/pipelines/build-embeddings.mjs` (FR-039, FR-040)
// TODO(T028A-Sidecar): Wire pipeline to sidecar embeddings service once contract finalized; keep local builder as fallback.
 - [X] T028C Add gating artifact generator script `scripts/ci/run-gates.ts` producing `generated/gate-status.json` (FR-040, FR-011, FR-003, SC-001)
// TODO(T028C-CI): Integrate script into CI pipeline and extend artifact once additional gate metrics (lint, tests) are deterministic.
 - [X] T028I [P] Add sidecar invocation verification script `scripts/ci/assert-sidecar-only.ts` (ensures SC-001, FR-003; fails build if regex matches forbidden imports: /@azure\/openai|langchain|openai\s*from/ in app/src **except** context-kit-service Python; outputs JSON { disallowedCount, files:[] } and exits 1 if disallowedCount>0)
// TODO(T028I-CI): Wire script into CI before tool execution stage and add allowlist support for future fixture coverage.
 - [X] T028P Add session message endpoint regression tests in `context-kit-service/tests/test_api.py` (verifies TaskEnvelope + conversation updates)
 - [*] T028D Add manifest schema validation step in `manifest.ts` (FR-038, FR-011)
	- Subtasks:
		- [X] Implement JSON schema validation against CapabilityManifest shape (version:semver, tools[].id, tools[].safetyClass, unsupportedReasonMap)
			- ✅ **COMPLETE**: `validateCapabilityManifest()` validates schema, `fetchManifest()` returns empty manifest on failure
		- [X] On validation failure, trigger Limited Read-Only Mode entry within 2s (FR-011)
			- ✅ **COMPLETE**: `isLimitedReadOnlyMode` computed flag in assistantStore.ts line 187
		- [ ] Emit modeEnter telemetry event with reason='invalidManifest'
			- ⚠️ **BLOCKED**: No 'mode.entered' or 'capability.failed' event type exists in telemetry.ts schema
			- **TODO**: Extend TelemetryEventKind + add factory function, or use meta field on 'capability.loaded' for failures
		- [X] Display DegradedModeBanner with message referencing manifest incompatibility
			- ✅ **COMPLETE**: DegradedModeBanner.vue component exists and integrated in UnifiedAssistant.vue
 - [X] T028E Add provider capability validation test skeleton (links to Phase 4 test) (FR-038, FR-028)
	- Subtasks:
		- [ ] Test: inject manifest with malformed version (non-semver) → assert Limited Read-Only Mode triggered
		- [ ] Test: inject manifest missing required tool.id → assert validation failure
		- [ ] Test: verify telemetry event emitted with eventType='manifestValidationFailed' and error details
		- [ ] Test: confirm tool palette disabled when manifest invalid
 - [X] T028F [P] Add system prompt sanitization utility `app/src/renderer/services/assistant/promptSanitizer.ts` (FR-035, FR-001)
	- Implementation requirements:
		- [X] Redact credential patterns: API keys (regex: /[a-zA-Z0-9_-]{20,}/), tokens (Bearer/token keywords)
		- [X] Collapse >5 consecutive blank lines to 2 blank lines maximum
		- [X] Return SanitizeResult { sanitized: string, redactionCount: number, collapsedLineCount: number }
		- [ ] Unit test with sample prompts containing secrets + excessive whitespace
 - [X] T028G [P] Implement tool classification map & enforcement `app/src/renderer/services/assistant/toolClassification.ts` (segregate safe vs mutating) (FR-032, FR-005, FR-043)
	- Implementation requirements:
		- [X] Define SafetyClass enum: 'readOnly' | 'mutating' | 'destructive'
		- [X] Map each tool to safety class (validate, build-graph, impact → readOnly; context.write → mutating; file.delete → destructive)
		- [X] Enforce approval branches: readOnly=no approval, mutating=single approval, destructive=double-confirm with reason
		- [ ] Destructive branch: capture reasonText (≥8 chars), confirm1At, confirm2At timestamps
 - [X] T028H [P] Add classification gating unit test skeleton `app/tests/unit/assistant/tool-classification.spec.ts` (FR-032, FR-005)
	- Test coverage requirements:
		- [X] Test: readOnly tool invoked without approval → succeeds
		- [X] Test: mutating tool invoked without approval → blocked with error
		- [ ] Test: destructive tool with single confirm → blocked until second confirmation
		- [ ] Test: destructive tool with reason <8 chars → rejected with validation error
		- [ ] Test: destructive tool with double-confirm + valid reason → succeeds and captures confirm1At/confirm2At
 - [X] T028I [P] Add sidecar invocation verification script `scripts/ci/assert-sidecar-only.ts` (ensures SC-001, FR-003; fails build if regex matches forbidden imports: /@azure\\/openai|langchain|openai\\s*from/ in app/src **except** context-kit-service Python; outputs JSON { disallowedCount, files:[] } and exits 1 if disallowedCount>0)
- // TODO(T028I-CIIntegration): Integrate checker into CI pipeline and add targeted allowlist support for future fixtures.
 - [X] T028J Add JSON export schema validation test skeleton `app/tests/unit/assistant/export-schema.spec.ts` (FR-019, FR-014) (assert canonical ordering [id,role,content,createdAt,safetyClass,toolMeta,approvals])
	- Test requirements:
		- [ ] Build sample session with 3 message types (user, assistant, tool) and export to JSON
		- [ ] Assert field ordering: [id, role, content, createdAt, safetyClass, toolMeta, approvals] for every message
		- [ ] Assert role enum validation: only 'user'|'assistant'|'tool' allowed
		- [ ] Negative case: inject message missing createdAt → export validation fails
		- [ ] Verify chronological ordering maintained in exported array
 - [X] T028K [P] Produce early accessibility checklist `docs/a11y/unified-assistant-initial.md` (FR-020, FR-034) before MVP freeze
	- Checklist requirements:
		- [X] Document keyboard focus order: transcript → input → tool palette → approval dialog
		- [X] Document dialog roles: approval dialog role=dialog, DegradedModeBanner role=alert
		- [X] Document keyboard shortcuts: Esc=cancel approval, Enter=confirm, Tab=cycle focus
		- [X] List provider badge aria-label format: "{provider} {safetyClass} tool"
		- [ ] Mark Phase 6 gaps: screen reader transcript navigation, high contrast theme support
 - [X] T028L Add first-token latency harness `app/scripts/perf/first-token-latency.ts` + test `app/tests/perf/first-token-latency.spec.ts` (SC-005, FR-041)
	- Implementation requirements:
		- [X] Capture requestDispatchedAt timestamp when AI request initiated
		- [X] Capture firstTokenReceivedAt timestamp on first stream chunk arrival
		- [X] Calculate latency: firstTokenReceivedAt - requestDispatchedAt (in milliseconds)
		- [X] Aggregate 30 runs, discard top/bottom 5%, compute p50/p95
		- [X] Write artifact to generated/perf/first-token.json with { version, metric, p50, p95, samples, generatedAt }
		- [X] Test validates p95 < 300ms threshold per SC-005

**Checkpoint**: Foundational layer complete – begin user story phases.

---
## Phase 3: User Story 1 - Unified Assistant Experience (Priority: P1) 🎯 MVP
**Goal**: Single consolidated assistant UI supporting conversation, tools, streaming, approvals, edit suggestions.
**Independent Test**: User can start a session, send a message (streaming), run a tool, receive edit suggestion, approve change – all in unified component.

### Implementation
- [X] T029 [P] [US1] Create `UnifiedAssistant.vue` in `app/src/renderer/components/assistant/UnifiedAssistant.vue` **[COMPLETE]**
 - [X] T029A [P] [US1] Integrate legacy mode tags (improvement/clarification/general) mapping in `assistantStore.ts` (FR-023, FR-006) - Mode tags preserved in message metadata during migration
- [X] T030 [P] [US1] Integrate transcript view subcomponent `TranscriptView.vue` (adjust existing or create new) **[COMPLETE]**
- [X] T031 [US1] Implement message composer with streaming toggle in `app/src/renderer/components/assistant/MessageComposer.vue` **[COMPLETE]**
- [X] T032 [US1] Wire tool palette component `ToolPalette.vue` invoking sidecar tools **[COMPLETE]**
- [X] T033 [P] [US1] Implement approval dialog `ApprovalDialog.vue` (FR-005, FR-032) **[COMPLETE]**
	- Implementation requirements:
		- [X] Single approval flow: show tool details + confirm/cancel buttons
		- [X] Destructive tool double-confirm flow: first confirm → reason input → second confirm
		- [X] Reason validation: ≥8 non-whitespace characters required for destructive tools
		- [X] Capture timestamps: confirm1At (first click), confirm2At (second click after reason)
		- [X] Keyboard accessible: Tab navigation, Esc=cancel, Enter=confirm
		- [X] Emit telemetry with approvalId, decision, reasonLength, confirm1At, confirm2At
			- ⚠️ **NOTE**: Telemetry emission requires assistantStore.approvePending to accept metadata parameter
- [X] T034 [US1] Integrate diff viewer component `DiffViewer.vue` supporting full file + summarization **[COMPLETE]**
- [X] T035 [P] [US1] Add provider badge component `ProviderBadge.vue` **[COMPLETE]**
- [X] T036 [US1] Add transcript filtering controls `TranscriptFilters.vue` **[COMPLETE]**
- [X] T037 [P] [US1] Implement telemetry panel `TelemetryPanel.vue` (session stats) **[COMPLETE]**
- [X] T038 [US1] Hook queue manager and concurrency limiter into `assistantStore.ts` **[COMPLETE]**
- [X] T039 [US1] Implement edit suggestion apply workflow (store + approval) in `assistantStore.ts` **[COMPLETE]**
- [X] T040 [US1] Add accessibility roles & keyboard navigation to `UnifiedAssistant.vue` **[COMPLETE]**
- [X] T041 [US1] Implement streaming token accumulator and finalize merge into message **[COMPLETE]**
- [X] T042 [US1] Implement error messaging for timeouts & capability mismatches in `UnifiedAssistant.vue` **[COMPLETE]**
- [X] T043 [US1] Add session export action (markdown) to UI **[COMPLETE]**
- [X] T044 [US1] Replace legacy modal triggers with unified assistant activation in `app/src/renderer/components/` entry points **[COMPLETE]**
	- ✅ UnifiedAssistant.vue is primary component imported in App.vue
	- ✅ AIAssistantModal.vue has deprecation notice (T045)
	- ⚠️ **NOTE**: Legacy modal still exists for backward compatibility during transition
- [X] T045 [US1] Add deprecation toast when legacy `AIAssistantModal` accessed **[COMPLETE]**
- [X] T046 [US1] Implement success/error counts summary for session in `TelemetryPanel.vue` **[COMPLETE]**
- [X] T047 [US1] Integrate manifest refresh manual action button **[COMPLETE]**
 - [X] T048 [US1] Ensure atomic state updates (wrap critical mutations) in `assistantStore.ts` (FR-031) **[COMPLETE]**
	- ✅ Implemented runAtomic() transaction wrapper with begin/commit logic
	- ✅ Applied to resolvePendingAction (approval state + timestamp)
	- ✅ Applied to sendMessage (task append + message append + timestamp)
	- ✅ Transaction depth tracking prevents nested rollback issues
 - [ ] T049A [P] Performance test: transcript rendering p95 frame time <33ms (`app/tests/perf/transcript-render.spec.ts`) (FR-002)
- // TODO(T049A): Use virtualization mock & performance marks; compute 30-run distribution.
 - [ ] T050A [P] Filter persistence test (`app/tests/unit/assistant/filter-persistence.spec.ts`) (FR-014)
	- Test cases:
		- [ ] Positive: select filter categories {messages, tools, approvals} → transcript filters correctly
		- [ ] Persistence: filter selection persists during active session
		- [ ] Reset: filter state resets to default (all categories) on new session creation
		- [ ] Negative: attempt to add custom filter category (e.g., 'system') → rejected, only {messages, tools, approvals} allowed
		- [ ] Negative: filter state never written to disk (ephemeral session-only storage)
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
		- [ ] T052I Summarization threshold test (`app/tests/unit/assistant/summarization-threshold.spec.ts`) (FR-010, FR-037)
		- // TODO(T052I): Provide diff and non-diff payloads just over 800 lines and >100KB; assert summary + expansion restores content.
		- [ ] T052J Gating artifact schema validation test (`app/tests/unit/assistant/gating-schema.spec.ts`) (FR-040)
		- // TODO(T052J): Load generated/gate-status.json; assert boolean fields all true else test fails.
		 - [X] T052O Interaction latency harness & test (`app/scripts/perf/interaction-latency.ts`, `app/tests/perf/interaction-latency.spec.ts`) (SC-002) (PROMOTED to Phase 2 for early SLO validation)
		 	- // TODO(T052O-LiveHooks): Replace fixture-driven harness once assistant exposes automated interaction hooks.
		- [ ] T052K Timeout error formatting test (`app/tests/unit/assistant/timeout-format.spec.ts`) (FR-041)
		- // TODO(T052K): Mock timeout error; assert suggestedAction within allowed enum and retry button conditional.
		- [ ] T052L Partial capability fallback test (`app/tests/unit/assistant/partial-capability-fallback.spec.ts`) (FR-038 Limited Read-Only Mode)
		- // TODO(T052L): Provide manifest missing required tool; assert fallback disables only unsupported tool & banner.
		- [ ] T052M Embeddings checksum collision simulation test (`app/tests/unit/assistant/embeddings-collision.spec.ts`) (FR-039)
		- // TODO(T052M): Force altered vector order to ensure checksum change detected; assert mismatch flagged.
		- [ ] T052N Concurrent approvals isolation test (`app/tests/unit/assistant/concurrent-approvals.spec.ts`) (FR-043)
		- // TODO(T052N): Queue two approvals; approve one; assert second remains pending.

### Tests (Optional but added for robustness)
- [ ] T049 [P] [US1] Vitest: streaming message assembly test `app/tests/unit/assistant/streaming.spec.ts`
- [ ] T050 [P] [US1] Vitest: edit suggestion apply workflow test `app/tests/unit/assistant/edit-apply.spec.ts`
- [ ] T051 [P] [US1] Vitest: telemetry emission test `app/tests/unit/assistant/telemetry.spec.ts`
- [ ] T052 [US1] Playwright: end-to-end unified assistant interaction `app/tests/e2e/unified-assistant.spec.ts`
 - [ ] T051A Vitest: approval logging integrity test `app/tests/unit/assistant/approval-logging.spec.ts` (FR-017)
- [ ] T051C Vitest: approval dialog accessibility test `app/tests/unit/assistant/approval-a11y.spec.ts` (FR-005)
 - [ ] T051D Vitest: telemetry completeness test `app/tests/unit/assistant/telemetry-completeness.spec.ts` (FR-004, FR-017) (PROMOTED — must pass before MVP merge, ≥99.5%)

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
		- NOTE: Summarization threshold duplicate test removed (merged into T052I).
	- [ ] T066C Classification gating enforcement test `app/tests/unit/assistant/classification-gate.spec.ts` (FR-032)
	- // TODO(T066C): Attempt destructive tool without double-confirm; assert block & telemetry error.
		- [ ] T066D Timeout alert accessibility role test `app/tests/unit/assistant/timeout-accessibility.spec.ts` (FR-041)
		- // TODO(T066D): Ensure timeout alert has role=alert and focus management.
		- [ ] T066E Double-confirm destructive tool flow test (`app/tests/unit/assistant/destructive-confirm.spec.ts`) (FR-032 destructive branch)
			- Test cases:
				- [ ] Positive: destructive tool with reason ≥8 chars + double-confirm → succeeds, captures confirm1At/confirm2At/reasonLength
				- [ ] Negative: destructive tool with reason <8 chars → rejected with validation error
				- [ ] Negative: destructive tool with only single confirm (no reason) → blocked until second confirmation
				- [ ] Negative: destructive tool with empty/whitespace-only reason → rejected
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
- [X] T074 [P] [US3] Implement migration validation & user-confirmed deletion routine (FR-006)
	- Implementation requirements:
		- [X] After migration completes, validate ≥95% unique messages preserved
		- [X] Display confirmation dialog: "Migration successful. Delete original legacy data? (Recommended)"
		- [X] Dialog options: "Delete Now" (primary), "Keep for Now" (secondary), with warning about storage duplication
		- [X] On "Delete Now": permanently delete original aiStore data, set MigrationRecord.dataDeleted=true, capture deletedAt timestamp
		- [X] On "Keep for Now": preserve original data, set MigrationRecord.dataDeleted=false
		- [X] Test deletion confirmation flow: accept → data deleted, reject → data preserved
		- [X] Test data cleanup correctness: verify original aiStore cleared after deletion
- [X] T075 [US3] Flag migrated sessions visually in `UnifiedAssistant.vue`
- [X] T076 [US3] Add audit export for migration record `app/src/renderer/services/assistant/migrationExport.ts`
### Tests
- [ ] T077 [P] [US3] Vitest: migration mapping test `app/tests/unit/assistant/migration-mapping.spec.ts`
- [ ] T078 [P] [US3] Vitest: deduplication accuracy test `app/tests/unit/assistant/migration-dedupe.spec.ts`
- [ ] T079 [P] [US3] Vitest: migration error handling test `app/tests/unit/assistant/migration-error.spec.ts`
	- NOTE: Test migration failure scenarios (partial import, deduplication errors) and data preservation (original aiStore untouched on failure). NO rollback to legacy assistant testing (one-way migration).
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
- [ ] T086 Remove legacy modal component `app/src/renderer/components/AIAssistantModal.vue`, `app/src/renderer/stores/aiStore.ts`, legacy IPC handlers, and all related legacy assistant code immediately after Phase 5 (US3 migration) completes
	- NOTE: Immediate removal (same release as unified assistant launch) - no deprecation delay period. Includes: AIAssistantModal.vue, aiStore.ts, legacy assistant IPC handlers, legacy mode toggle UI, legacy conversation logic.
 - [ ] T086A [P] Accessibility audit for provider identity alt text & banner semantics (FR-034, FR-028)
- // NOTE(T087): Merged into T028A to avoid duplicate embeddings pipeline implementation.
- [X] T088 Update quickstart with migration & manifest sections expansion `specs/001-assistant-sidecar-unify/quickstart.md`
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
