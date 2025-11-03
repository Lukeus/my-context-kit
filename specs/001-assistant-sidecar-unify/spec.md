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

User with existing conversations in legacy `aiStore` can continue working seamlessly; the system migrates or references prior messages without duplicate UI components, and legacy modal is retired without data loss for active sessions.

**Why this priority**: Prevents disruption, maintains trust, and avoids forcing users to manually export/import previous work.

**Independent Test**: On upgrade build containing unified assistant, open previous version, create a conversation, then upgrade and verify unified assistant displays prior history or exposes migration notice with action to import.

**Acceptance Scenarios**:

1. **Given** legacy conversation history exists, **When** unified assistant loads first time, **Then** migration routine indexes legacy data and makes it accessible (either auto-import or explicit prompt) without errors.
2. **Given** user dismisses migration prompt, **When** they later choose "Import Legacy History", **Then** the history is imported once and flagged as migrated.
3. **Given** migrated content includes edit suggestions, **When** displayed, **Then** suggestions are converted into unified format with apply workflow available.

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
| FR-001 | System MUST enforce prompt complexity limits: system prompt length ≤ 10,000 chars AND total embedded component count (references, inline code blocks) ≤ 50 to prevent runaway context inflation. | Static prompt audit script (T052G) reports length & component counts; CI fails if exceeded; sample oversized prompt triggers violation. | Guards performance & token usage; complements data-model constraint. |
| FR-002 | Transcript rendering performance MUST achieve p95 frame render time <33ms under load of 500 messages (standard reference machine: 4c/16GB RAM) ensuring smooth scrolling & interaction. | Performance harness (T049A, T052H) measures render loop over 30 runs; p95 <33ms; telemetry snapshot stored. | Supports UX responsiveness (ties to SC-002 multi-step speed). |
| FR-009 | UI MUST display real-time tool invocation status transitions (queued→running→succeeded/failed/canceled) with provider identity badge and safety class indicator. | Status rendering test (T052F) simulates lifecycle; asserts DOM updates & final state; all transitions visible. | Improves transparency; leverages telemetry. |
| FR-010 | Large tool output (non-diff) summarization MUST trigger when raw size >100KB OR line count >800, showing high-level stats + first 2 and last 2 segments with expand control. | Summarization threshold test (T059A) asserts triggering on each condition separately; expansion reveals full content. | Distinct from file diff summarization (FR-037). |
| FR-031 | Atomic session state updates MUST ensure operations either fully apply (all related messages/tools/approvals committed) or roll back on error (no partial arrays). | Atomic invariants test (T051B) induces simulated failure mid-update; asserts pre-update counts unchanged; success path increments all. | Prevents inconsistent UI/telemetry states. |

| ID | Statement | Measurability / Acceptance | Notes |
|----|-----------|-----------------------------|-------|
| (Existing FRs below extended with clarified wording) ||||
| FR-003 | System MUST execute all assistant tools and pipelines exclusively via the language sidecar backend (no direct provider SDK or legacy IPC usage in renderer/main). | Static analysis script (T028I) reports 0 disallowed import matches; runtime telemetry: 100% toolInvocation.source === "sidecar" during verification window. | Constitution Principle: AI Orchestration boundary. |
| FR-004 | System MUST capture telemetry for every tool invocation (timestamp, toolId, durationMs, outcome, source, safetyClass). | Telemetry validation test asserts required keys non-null for ≥99% of invocations across test suite. | Supports observability & Principle V. |
| FR-005 | System MUST enforce explicit user approval before any file or repository mutation. Approval dialog must be fully keyboard-accessible (Tab order, Esc cancel, Enter confirm). | Vitest: approval flow test; accessibility audit ensures focus trap + ARIA role=dialog present. | Risk mitigation for destructive actions. |
| FR-006 | System MUST migrate legacy `aiStore` conversation history on first unified assistant launch (<5s p95 for typical history ≤500 messages) with fallback manual import. | Migration perf harness logs p50/p95; migration mapping test verifies ≥95% unique messages preserved. | User trust continuity. |
| FR-006a | Migration MUST deduplicate legacy messages by (legacyId, timestamp) pair to prevent transcript duplication. | Deduplication test asserts no duplicate composite keys after import. | Former FR-013 (sub) consolidated. |
| FR-011 | System MUST enter Limited Read-Only Mode within 2s when (a) sidecar unreachable >3 consecutive health probes OR (b) manifest schema invalid OR (c) gating artifact classificationEnforced=false; modeExit telemetry emitted within 2s of recovery. | Simulated outage test (T052A) forces health failures; asserts modeEnter timestamp difference <2000ms and subsequent modeExit after recovery; invalid manifest test (T052B/T052L) triggers same path; gating artifact mismatch test (T052J) triggers mode. | Formalizes fallback behavior previously implicit; unifies triggers. |
| FR-017 | Approval logging MUST capture 100% of decisions with structure { approvalId:UUID, toolId, safetyClass, decision:'approved'|'rejected', decidedAt:ISO8601, approverInput? }; no duplicate approvalId values in a single session. | Approval logging integrity test (T051A) asserts required keys and uniqueness; telemetry completeness test (T051D) verifies coverage >=99%. | Strengthens audit trail, supports observability principle. |
| FR-030 | Partial retry selection MUST allow user to select failed substeps when a multi-step tool invocation returns >1 failed segments; retry executes only selected subset and records telemetry { retryId, originalInvocationId, selectedCount }. | Partial retry UI test (T066A) simulates multi-step failure and asserts only selected substeps rerun; telemetry retry event present. | Enhances efficiency for large pipeline recoveries. |
| FR-014 | System MUST allow transcript filtering across EXACT category set {messages, tools, approvals}; selection persists for session lifetime only (not written to disk) and MUST reset on new session creation. No additional categories may appear. | Filter persistence test (T050A) validates reset; category enumeration test asserts only allowed set present; attempting to add custom category rejected. | Prevents hidden persisted or arbitrary filter state expansion. |
| FR-019 | System MUST support transcript export (Markdown + JSON) with deterministic JSON schema and stable ordering (chronological) plus stable Markdown formatting. | JSON validation test (T028J) validates schema: message { id:UUID, role ∈ [user,assistant,tool], content:string, createdAt:ISO8601, safetyClass?, toolMeta?, approvals: ApprovalEntry[] }. Field order canonical: [id, role, content, createdAt, safetyClass, toolMeta, approvals]. Markdown export includes header (Session ID, Created), each message as `### [role] (timestamp)` followed by content block. | Enables reproducible audits & diff stability (canonical ordering rationale). |
| FR-022 | Concurrency of running tool executions MUST be capped at 3; additional invocations queue FIFO. | Concurrency test asserts >3 submissions keep exactly 3 active; queue length decrements as tasks finish. | Performance predictability. |
| FR-023 | Legacy assistant mode tags (improvement/clarification/general) MUST map to unified metadata and be preserved in migrated sessions. | Migration + tag persistence tests verify mapping and display. | Backwards compatibility. |
| FR-028 | On capability manifest version incompatibility the system MUST display a banner and disable unsupported tools until resolved. | Version mismatch test triggers synthetic manifest; UI banner visible; disallowed tools disabled. | Prevents undefined behavior. |
| FR-032 | System MUST segregate tools by safety class: readOnly (no approval), mutating (single approval), destructive (double-confirm + reason). | Classification enforcement test ensures policy; telemetry includes safetyClass for 100% tool events. | User safety & audit. |
| (FR-032a) | Destructive tool confirmation reason MUST be >=8 non-whitespace characters and stored with approval event; empty or short reasons rejected with validation message. | Destructive flow test (T066E) attempts <8 char or whitespace-only reason; asserts rejection; valid reason accepted and logged. | Clarifies ambiguity in destructive reason content requirements. |
| FR-035 | System MUST sanitize system prompts removing disallowed patterns (e.g., credentials, tokens, >5 consecutive blank lines) before dispatch. | Prompt sanitizer test feeds patterns; output redacts tokens and collapses whitespace. | Prevents data leakage. |
| FR-037 | Diff summarization MUST collapse large diffs when either (a) total lines > 800 OR (b) raw size > 100KB; summary shows: file path, total lines, added/removed counts, top 10 largest contiguous change hunks sorted by changed lines (descending) with line ranges (show all if <10). | Summarization test asserts triggering on each threshold individually and correct hunk selection count (≤10). | Unified threshold across all docs; UI performance & clarity. |
| FR-038 | Capability manifest MUST be schema-validated (version semver, tools[].id, tools[].safetyClass, unsupportedReasonMap keyed by tool id) before enabling tools; invalid manifest enters Limited Read-Only Mode. | Manifest validation test injects malformed manifest → mode fallback asserted. | Defensive robustness. |
| FR-039 | Embeddings pipeline MUST run deterministically producing checksum (SHA-256) of sorted vector entries; checksum recorded in telemetry & gating artifact. | Checksum reproducibility test matches recomputed value across two runs with identical input. | Deterministic RAG basis. |
| FR-040 | Gating artifact generator MUST emit `generated/gate-status.json` with structure { version, timestamp, gates: { sidecarOnly:boolean, checksumMatch:boolean, classificationEnforced:boolean } }. | Gating schema test validates presence + boolean types; all true required for release. | Release gate transparency. |
| FR-041 | Timeout handling MUST format errors uniformly: { code:'TIMEOUT', operation, suggestedAction } where suggestedAction ∈ ['retry','narrow-scope','check-sidecar','contact-support']. Retry option shown if operation is idempotent. | Timeout tests assert error shape + allowed suggestedAction value + retry presence. | Consistent UX & recovery. |

### Supporting Constraints (selected)

| ID | Constraint | Verification |
|----|-----------|--------------|
| SC-001 | 100% of AI tooling invocations must traverse sidecar boundary (no direct SDK usage). | Static analysis (T028I) + telemetry ratio check. |
| SC-002 | Multi-step interaction median <3 minutes (ask+tool+approval sequence) on reference desktop (4c CPU / 16GB RAM). | Interaction harness test measures 30 user flows; median computed; CI fails if ≥180s. |
| SC-005 | First token latency p95 <300ms. | First-token harness (T028L) aggregated results. |

### Data Structures

`MigrationRecord`: { sourceStore:string, importedAt:ISO8601, totalMessages:number, deduplicatedCount:number, status:'success'|'partial'|'failed' }

`TelemetryEvent`: { eventId:UUID, eventType:string, timestamp:ISO8601, sessionId:UUID, outcome:'success'|'error', durationMs:number, toolId?, safetyClass? }

`CapabilityManifest`: { version:semver, tools: { id:string, safetyClass:'readOnly'|'mutating'|'destructive' }[], unsupportedReasonMap?: Record<string,string> }

### Architectural Intent (Traceability)

These FRs drive: unified assistant module (UI + store), sidecar boundary (network indirection), deterministic pipelines (embeddings + gating), auditability (telemetry & export schema), safety (classification & approvals), performance (latency harness + diff summarization), and resiliency (Limited Read-Only Mode fallback on manifest invalidity or sidecar outage).

All diagram updates (C4 context + component) MUST reflect: single assistant UI, sidecar boundary, embeddings pipeline, gating artifact generation. (Linked to task T081 – gating before feature merge.)

### Limited Read-Only Mode Definition

Triggered by: sidecar unreachable, invalid capability manifest, or gating artifact `classificationEnforced=false`. In this mode: tool palette disabled, message composer limited to plain Q&A (no tool triggers), banner displayed, export still enabled, telemetry continues (modeEnter/modeExit events). Recovery auto-attempted every 30s or manual refresh. Limited mode semantics: no tool invocations, safety class indicators hidden, capability refresh allowed, export & migration allowed.


### Measurable Outcomes

- **SC-001**: 100% of AI tooling invocations route through sidecar (no legacy direct calls) within 1 week of release verification.
- **SC-002**: Users successfully complete a unified assistant multi-step interaction (ask + tool + approval) in under 3 minutes (median) during usability test.

-- Legacy data structure is accessible for migration without requiring external export.
-- Automatic migration will complete within acceptable startup window (<5s median) for typical history sizes; large histories trigger background completion notice.
-- RAG features remain disabled (`RAG_DISABLED=true`) until embeddings determinism (FR-039) passes checksum reproducibility test (T090A).

- Introducing new AI providers beyond existing two.
- Real-time collaborative multi-user sessions.

- Sidecar instability could degrade tooling reliability (mitigation: fallback read-only mode).
- Migration errors could cause user frustration (mitigation: dry-run validation & rollback on failure).

- Legacy migration executes automatically on first launch with fallback manual option (see FR-006).
- Full file diff is default; large files summarized with expandable hunks (see FR-037).
### Clarification Notes
- FR-003 vs SC-001: SC-001 is an invariant constraint; FR-003 defines enforcement and verification (static analysis + telemetry source field). SC-001 says "must always be sidecar"; FR-003 ensures we can prove it.
- FR-032 vs FR-032a: FR-032 establishes safety classes; FR-032a tightens destructive confirmation reason quality.
- FR-014 enumerates allowed filter categories to prevent silent expansion and maintain predictable UI semantics.
