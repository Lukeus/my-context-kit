# Feature Specification: Assistant Sidecar Unification

**Feature Branch**: `001-assistant-sidecar-unify`  
**Created**: 2025-11-02  
**Status**: Ready for Implementation (Blockers Pending: C4 diagrams T081, Embeddings determinism T028A/T028B/T087)  
**Input**: User description: "Rewire/update the UI and the backend to streamline the AI assistants/tooling to use the new lang sidecar backend."

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

### User Story 1 - Unified Assistant Experience (Priority: P1)

User opens the application and interacts with a single consolidated AI assistant interface (replacing split legacy modal/panel) that supports conversational queries, tool executions, streaming responses, edit suggestions, and approval workflows within one cohesive transcript/session view.

**Why this priority**: Delivers immediate user value by removing confusion between two assistants, reduces cognitive load, and enables consistent workflows for all AI-related tasks.

**Independent Test**: Launch app with feature flag enabled; user can perform a full conversation including (a) asking a general question, (b) triggering a tool (e.g., validate context), (c) receiving an edit suggestion, (d) approving an action; all without leaving the unified interface.

**Acceptance Scenarios**:

1. **Given** the user has no existing session, **When** they open the assistant, **Then** a new session is created with transcript, input box, and tool palette visible.
2. **Given** an active session, **When** the user triggers a pipeline tool, **Then** the tool invocation appears inline with status and eventual result appended to the transcript.
3. **Given** a streaming model provider configured, **When** the user asks a question, **Then** partial tokens appear incrementally until completion and are persisted as a single assistant message.
4. **Given** an assistant-generated edit suggestion, **When** the user clicks "Apply", **Then** an approval dialog shows diff summary and user can confirm or cancel.
5. **Given** a risky operation (write/change), **When** invoked, **Then** the system requires explicit approval and logs telemetry record.

---
### User Story 2 - Sidecar Tooling Integration (Priority: P2)

User performs AI-assisted operations (context validation, graph build, impact analysis, prompt generation) that are executed through the new language sidecar backend, with assistant transparently routing tool calls and surfacing structured outputs.

**Why this priority**: Enables scalable, maintainable backend abstraction (sidecar) improving reliability and separation of concerns while preserving existing pipeline capabilities.

**Independent Test**: Execute each tool via unified assistant and verify outputs originate from sidecar service (evidenced by telemetry source field) without fallback to legacy direct IPC path.

**Acceptance Scenarios**:

1. **Given** user selects a pipeline tool, **When** executed, **Then** request is sent to sidecar and result displayed with standardized success/error formatting.
2. **Given** sidecar returns an error, **When** assistant receives response, **Then** user sees human-readable error plus option to retry.
3. **Given** multiple tools are queued, **When** they execute, **Then** each appears with distinct status (pending/running/completed) and telemetry entries.

---
### User Story 3 - Graceful Legacy Migration (Priority: P3)

User with existing conversations in legacy `aiStore` can continue working seamlessly; the system performs one-way migration of prior messages without duplicate UI components, and legacy modal/store code is permanently removed after migration completes without data loss for active sessions.

**Why this priority**: Prevents disruption, maintains trust, and avoids forcing users to manually export/import previous work. One-way migration simplifies architecture by eliminating fallback complexity and duplicated functionality.

**Independent Test**: On upgrade build containing unified assistant, open previous version, create a conversation, then upgrade and verify unified assistant displays prior history via auto-migration with confirmation dialog offering immediate legacy data deletion.

**Acceptance Scenarios**:

1. **Given** legacy conversation history exists, **When** unified assistant loads first time, **Then** migration routine auto-imports legacy data and prompts user to confirm deletion of original aiStore data after successful validation.
2. **Given** user confirms deletion after migration, **When** migration completes, **Then** original aiStore data is permanently deleted and migration record persists with `{ sourceStore, importedAt, totalMessages, dataDeleted: true }` metadata.
3. **Given** migrated content includes edit suggestions, **When** displayed, **Then** suggestions are converted into unified format with apply workflow available.
4. **Given** migration completes successfully, **When** user attempts to access legacy assistant UI, **Then** legacy components are not rendered (code removed from build) and only unified assistant is available.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- Sidecar backend unavailable at startup (network/service down): assistant must enter "Limited Read-Only Mode" (conversation only, tools disabled) displaying availability banner.
- Tool execution timeout: user receives clear timeout message and retry option with suggested narrower scope.
- Streaming provider not configured: conversation falls back to non-streaming complete responses without UI jitter.
- Version mismatch between renderer expectations and sidecar capability manifest: assistant flags incompatibility and restricts unsupported tools.
- Concurrent approvals: multiple pending approvals appear; user action on one must not auto-approve others.
- Large tool output (e.g., big graph): result is summarized with expandable detail to prevent UI overwhelm.
- Migration conflict (same message imported twice): system deduplicates based on message id + timestamp.

## Requirements *(mandatory)*

The following Functional Requirements (FR) and Supporting Constraints (SC) are ACTIVE and supersede any prior commented placeholders. Each FR includes a measurable verification criterion. Terminology is standardized: degraded operation is "Limited Read-Only Mode" (conversation only, tools disabled) throughout.

### Functional Requirements

| ID | Statement | Measurability / Acceptance | Notes |
|----|-----------|-----------------------------|-------|
| FR-001 | System MUST enforce prompt complexity limits: system prompt length ≤ 10,000 chars AND total embedded component count ≤ 50 to prevent runaway context inflation. | Static prompt audit script (T052G) reports length & component counts; CI fails if exceeded; sample oversized prompt triggers violation. | Components defined as: fenced code block, reference token `[[ref:<id>]]`, inline diff block. Counting script enumerates these; blank lines collapsed (>5 to 2). |
| FR-002 | Transcript rendering performance MUST achieve p95 frame render time <33ms under load of 500 messages (standard reference machine: 4c/16GB RAM) ensuring smooth scrolling & interaction. | Performance harness (T049A, T052H) measures render loop over 30 runs; p95 <33ms; telemetry snapshot stored. | Supports UX responsiveness (ties to SC-002 multi-step speed). |
| FR-009 | UI MUST display real-time tool invocation status transitions (queued→running→succeeded/failed/canceled) with provider identity badge and safety class indicator. | Status rendering test (T052F) simulates lifecycle; asserts DOM updates & final state; all transitions visible. | Improves transparency; leverages telemetry. |
| FR-010 | Non-diff tool output summarization MUST trigger when output exceeds SUMMARY_TRIGGER thresholds (>100KB raw bytes OR >800 lines), showing summary stats + first 2 and last 2 segments with expand control. | Summarization threshold test (summarization-threshold) asserts triggering on each condition separately; expansion reveals full content. | Uses shared constants (`SUMMARY_TRIGGER`) with FR-037 to prevent drift. |
| FR-031 | Atomic session state updates MUST ensure operations either fully apply (all related messages/tools/approvals committed) or roll back on error (no partial arrays) with rollback completing <500ms. | Atomic invariants test (T051B) induces simulated failure mid-update; asserts counts unchanged and rollback latency <500ms. | Prevents inconsistent UI/telemetry states; enforces predictable recovery time. |

| ID | Statement | Measurability / Acceptance | Notes |
|----|-----------|-----------------------------|-------|
| (Existing FRs below extended with clarified wording) ||||
| FR-003 | System MUST enforce and verify SC-001 (sidecar-only execution) via static analysis + telemetry (no direct provider SDK or legacy IPC usage). | Static analysis script (T028I) reports 0 disallowed imports; telemetry: 100% toolInvocation.source === "sidecar". | Enforcement layer for SC-001 (invariant); separates policy from verification. |
| FR-004 | System MUST capture telemetry for every tool invocation (timestamp, toolId, durationMs, outcome, source, safetyClass). | Telemetry validation test asserts required keys non-null for ≥99% of invocations across test suite. | Supports observability & Principle V. |
| FR-005 | System MUST enforce explicit user approval before any file or repository mutation. Approval dialog must be fully keyboard-accessible (Tab order, Esc cancel, Enter confirm). | Vitest: approval flow test; accessibility audit ensures focus trap + ARIA role=dialog present. | Risk mitigation for destructive actions. |
| FR-006 | System MUST migrate legacy `aiStore` conversation history on first unified assistant launch (<5s p95 for typical history ≤500 messages) via one-way auto-import with user-confirmed deletion of original data after validation, deduplicating messages by (legacyId,timestamp) (dup count = 0). No rollback to legacy assistant after migration. | Migration perf harness logs p50/p95; dedup test asserts zero duplicates; mapping test verifies ≥95% unique messages preserved; deletion confirmation dialog test; post-migration legacy assistant access blocked. | User trust continuity; one-way migration eliminates fallback complexity; FR-006a merged here. |
| FR-011 | System MUST enter Limited Read-Only Mode within 2s when any trigger fires: (a) sidecar unreachable after 3 consecutive failed health probes, (b) capability manifest schema invalid, (c) gating artifact classificationEnforced=false. Exit emits modeExit telemetry within 2s of recovery. Limited mode uses NEW minimal conversation implementation (basic streaming, no tools) with NO dependency on legacy aiStore logic. | Outage test (T052A) health failure; invalid manifest test (capability-fallback); gating artifact test (T052J) all assert entry <2000ms and exit timing; banner visible; code inspection confirms no legacy aiStore imports in read-only conversation handler. | Consolidated explicit trigger list preventing terminology drift; clarifies no legacy fallback dependency. |
| FR-017 | Approval logging MUST capture ≥99.5% of decisions per session with structure { approvalId:UUID, toolId, safetyClass, decision:'approved'|'rejected', decidedAt:ISO8601, approverInput? }; no duplicate approvalId values per session; deficits trigger temporary feature flag. Measurement window: per-session (reset on session creation). | Integrity test (T051A) asserts required keys/uniqueness; completeness test (T051D) verifies rate ≥99.5% per session; simulated loss scenario flagged. | Enforces high reliability while allowing minimal transient losses. Per-session scope prevents accumulation of transient errors across long-running app lifetime. |
| FR-030 | Partial retry MUST allow selecting failed substeps when a multi-step tool invocation returns >1 failed segments; retry executes only selected subset and records telemetry { retryId, originalInvocationId, selectedCount, failedStepIds[], selectedStepIds[] }. | Partial retry UI test (T066A) simulates multi-step failure, asserts only selected substeps rerun; telemetry event includes arrays; negative case (empty selection) blocked. | Enhances efficiency and auditability for large pipeline recoveries (extended detail merged). |
| FR-014 | System MUST allow transcript filtering across EXACT category set {messages, tools, approvals}; selection persists for session lifetime only (not written to disk) and MUST reset on new session creation. No additional categories may appear. | Filter persistence test (T050A) validates reset; category enumeration test asserts only allowed set present; attempting to add custom category rejected. | Prevents hidden persisted or arbitrary filter state expansion. |
| FR-019 | System MUST support transcript export (Markdown + JSON) with deterministic JSON schema and stable ordering (chronological) plus stable Markdown formatting. | JSON validation test (T028J) validates schema: message { id:UUID, role ∈ [user,assistant,tool], content:string, createdAt:ISO8601, safetyClass?, toolMeta?, approvals: ApprovalEntry[] }. Field order canonical: [id, role, content, createdAt, safetyClass, toolMeta, approvals]. Markdown export includes header (Session ID, Created), each message as `### [role] (timestamp)` followed by content block. | Enables reproducible audits & diff stability (canonical ordering rationale). |
| FR-022 | Concurrency of running tool executions MUST be capped at 3; additional invocations queue FIFO. | Concurrency test asserts >3 submissions keep exactly 3 active; queue length decrements as tasks finish. | Performance predictability. |
| FR-023 | Legacy assistant mode tags (improvement/clarification/general) MUST map to unified metadata and be preserved in migrated sessions. | Migration + tag persistence tests verify mapping and display. | Backwards compatibility. |
| FR-028 | On capability manifest version incompatibility the system MUST display a banner and disable unsupported tools until resolved. | Version mismatch test triggers synthetic manifest; UI banner visible; disallowed tools disabled. | Prevents undefined behavior. |
| FR-032 | System MUST segregate tools by safety class: readOnly (no approval), mutating (single approval), destructive (double-confirm). Destructive workflow captures reason (≥8 non-whitespace chars) plus timestamps confirm1At & confirm2At and reasonLength; negative cases rejected. | Classification tests (T028G, T028H, T066C, T066E) ensure enforcement; telemetry includes safetyClass & destructive metadata for 100% relevant events. | User safety & audit (destructive detail merged; formerly FR-032a). |
| FR-035 | System MUST sanitize system prompts removing disallowed patterns (e.g., credentials, tokens, >5 consecutive blank lines) before dispatch. | Prompt sanitizer test feeds patterns; output redacts tokens and collapses whitespace. | Prevents data leakage. |
| FR-037 | Diff summarization MUST collapse large diffs when either (a) total lines > 800 OR (b) raw size > 100KB; summary shows: file path, total lines, added/removed counts, top 10 largest contiguous change hunks sorted by changed lines (descending) with line ranges (show all if <10). | Summarization test asserts triggering on each threshold individually and correct hunk selection count (≤10). | Unified threshold across all docs; UI performance & clarity. |
| FR-020 | Assistant UI MUST meet baseline accessibility (keyboard reachability, focus outlines, role=dialog for modals, aria-label for provider badges, contrast ≥ WCAG AA). | Accessibility test (T051C/T086A) + axe scan (<5 critical violations) + checklist artifact. | Ensures inclusive baseline; referenced by tasks T028K, T086A. |
| FR-034 | Provider identity badges MUST expose accessible name (aria-label: provider + safety class) and maintain contrast ≥4.5:1. | Badge accessibility test (T086A) asserts aria-label & contrast; negative case fails CI. | Completes accessibility coverage; resolves phantom task reference. |
| FR-043 | Concurrent approvals isolation: approving one pending destructive/mutating action MUST NOT auto-approve others; state changes confined to selected approvalId. | Isolation test (T052N) queues two approvals; approving one leaves other pending; telemetry emits single approval event. | Codifies edge case behavior explicitly. |
| FR-038 | Capability manifest MUST be schema-validated (version semver, tools[].id, tools[].safetyClass, unsupportedReasonMap keyed by tool id) before enabling tools; invalid manifest enters Limited Read-Only Mode. | Manifest validation test injects malformed manifest → mode fallback asserted. | Defensive robustness. |
| FR-039 | Embeddings pipeline MUST run deterministically producing checksum (SHA-256) of sorted vector entries; checksum recorded in telemetry & gating artifact. | Checksum reproducibility test matches recomputed value across two runs with identical input. | Deterministic RAG basis. |
| FR-040 | Gating artifact generator MUST emit `generated/gate-status.json` with structure { version, timestamp, gates: { sidecarOnly:boolean, checksumMatch:boolean, classificationEnforced:boolean } }. | Gating schema test validates presence + boolean types; all true required for release. | Release gate transparency. |
| FR-041 | Timeout handling MUST format errors uniformly: { code:'TIMEOUT', operation, suggestedAction } where suggestedAction ∈ ['retry','narrow-scope','check-sidecar','contact-support']. Retry option shown if operation is idempotent. | Timeout tests assert error shape + allowed suggestedAction value + retry presence. | Consistent UX & recovery. |

### Supporting Constraints (selected)

| ID | Constraint | Verification |
|----|-----------|--------------|
| SC-001 | 100% of AI tooling invocations must traverse sidecar boundary (no direct SDK usage). | Static analysis (T028I) + telemetry ratio check (enforced by FR-003). |
| SC-002 | Multi-step interaction median <3 minutes (ask+tool+approval sequence) on reference desktop (4c CPU / 16GB RAM). | Interaction harness test measures 30 user flows; median computed; CI fails if ≥180s. |
| SC-005 | First token latency p95 <300ms. | First-token harness (T028L) aggregated results. |

### Data Structures

`MigrationRecord`: { sourceStore:string, importedAt:ISO8601, totalMessages:number, deduplicatedCount:number, status:'success'|'partial'|'failed', dataDeleted:boolean, deletedAt?:ISO8601 }

`TelemetryEvent`: { eventId:UUID, eventType:string, timestamp:ISO8601, sessionId:UUID, outcome:'success'|'error', durationMs:number, toolId?, safetyClass? }
`ApprovalTelemetry`: { approvalId:UUID, toolId:string, safetyClass:string, decision:string, decidedAt:ISO8601, confirm1At?:ISO8601, confirm2At?:ISO8601, reasonLength?:number }

`CapabilityManifest`: { version:semver, tools: { id:string, safetyClass:'readOnly'|'mutating'|'destructive' }[], unsupportedReasonMap?: Record<string,string> }

## Clarifications

### Session 2025-11-07

- Q: For legacy code removal (T086), should removal happen in same commit as unified assistant merge or separately? → A: Same commit as unified assistant merge (atomic cutover)

### Migration Strategy (Legacy Removal)

**Approach**: One-way migration with immediate legacy code removal in atomic commit.

**Rationale**: Eliminates architectural complexity, prevents duplicated functionality, simplifies maintenance, and enforces clean cutover to unified assistant. Atomic removal (same commit as unified assistant merge) ensures no ambiguity about which assistant is active during development/testing and prevents accidental use of legacy paths.

**Timeline**:
1. **T002** (Phase 1): Implement migration routine with auto-import + user-confirmed deletion
2. **T074** (Phase 3): Integration testing validates migration correctness (NO rollback testing—one-way only)
3. **T086** (Phase 6): Remove legacy aiStore, AIAssistantModal.vue, legacy IPC handlers in SAME COMMIT as unified assistant feature merge (atomic cutover - no separate cleanup PR)
4. **T027**: Fallback banner reframed as "Degraded Mode Banner" (sidecar unavailable → tools disabled, conversation remains via new minimal handler)

**Data Handling**:
- **Before Migration**: Legacy aiStore data remains in application state
- **During Migration**: Auto-import runs, deduplicates, validates completeness
- **After Migration**: User prompted to confirm deletion; once confirmed, original aiStore data permanently deleted and `MigrationRecord.dataDeleted = true`
- **No Rollback**: Unified assistant sessions cannot be exported back to legacy format

**Sidecar Outage Behavior (FR-011)**:
- Limited Read-Only Mode uses **NEW minimal conversation implementation** (basic streaming Q&A, no tools)
- NO dependency on legacy aiStore conversation logic
- Legacy code not retained as fallback—ensures clean architectural separation

### Architectural Intent (Traceability)

These FRs drive: unified assistant module (UI + store), sidecar boundary (network indirection), deterministic pipelines (embeddings + gating), auditability (telemetry & export schema), safety (classification & approvals), performance (latency harness + diff summarization), and resiliency (Limited Read-Only Mode fallback on manifest invalidity or sidecar outage).

All diagram updates (C4 context + component) MUST reflect: single assistant UI (no legacy modal), sidecar boundary, embeddings pipeline, gating artifact generation. (Linked to task T081 – gating before feature merge.)

### Limited Read-Only Mode Definition

Triggered by explicit FR-011 triggers: (a) sidecar unreachable (3 failed probes), (b) invalid capability manifest, (c) gating artifact `classificationEnforced=false`. In this mode: tool palette disabled, message composer limited to plain Q&A, banner displayed, export enabled, telemetry continues (modeEnter/modeExit events). Recovery auto-attempted every 30s or manual refresh. Limited mode semantics: no tool invocations, safety class indicators hidden, capability refresh allowed, export & migration allowed.


### Measurable Outcomes

- **SC-001**: 100% of AI tooling invocations route through sidecar (no legacy direct calls) within 1 week of release verification.
- **SC-002**: Users successfully complete a unified assistant multi-step interaction (ask + tool + approval) in under 3 minutes (median) during usability test.

-- Legacy data structure is accessible for migration without requiring external export.
-- Automatic migration will complete within acceptable startup window (<5s median) for typical history sizes; large histories trigger background completion notice.
-- RAG features remain disabled (`RAG_DISABLED=true`) until embeddings determinism (FR-039) passes checksum reproducibility test (T090A).
-- Legacy aiStore code, AIAssistantModal.vue, and related components are REMOVED immediately after migration implementation completes (same release cycle as unified assistant launch). No legacy fallback or dual-assistant support.

-- Introducing new AI providers beyond existing two.
-- Real-time collaborative multi-user sessions.
-- Enabling RAG features while embeddings determinism (FR-039) not yet validated (gated by checksumMatch=true).
-- Supporting rollback from unified assistant to legacy aiStore after migration (one-way migration only).
-- Retaining legacy aiStore conversation logic for sidecar outage fallback (Limited Read-Only Mode uses new minimal implementation).

- Sidecar instability could degrade tooling reliability (mitigation: fallback read-only mode).
- Migration errors could cause user frustration (mitigation: dry-run validation & rollback on failure).

- Legacy migration executes automatically on first launch with fallback manual option (see FR-006).
- Full file diff is default; large files summarized with expandable hunks (see FR-037).
### Clarification Notes
- FR-003 vs SC-001: SC-001 is an invariant constraint; FR-003 defines enforcement and verification (static analysis + telemetry source field). SC-001 says "must always be sidecar"; FR-003 ensures we can prove it.
- FR-032 vs FR-032a: FR-032 establishes safety classes; FR-032a tightens destructive confirmation reason quality.
- FR-014 enumerates allowed filter categories to prevent silent expansion and maintain predictable UI semantics.
