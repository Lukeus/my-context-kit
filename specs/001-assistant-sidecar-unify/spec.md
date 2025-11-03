# Feature Specification: Assistant Sidecar Unification

**Feature Branch**: `001-assistant-sidecar-unify`  
**Created**: 2025-11-02  
**Status**: Draft  
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

- Sidecar backend unavailable at startup (network/service down): assistant must degrade to read-only Q&A without tool execution, displaying availability banner.
- Tool execution timeout: user receives clear timeout message and retry option with suggested narrower scope.
- Streaming provider not configured: conversation falls back to non-streaming complete responses without UI jitter.
- Version mismatch between renderer expectations and sidecar capability manifest: assistant flags incompatibility and restricts unsupported tools.
- Concurrent approvals: multiple pending approvals appear; user action on one must not auto-approve others.
- Large tool output (e.g., big graph): result is summarized with expandable detail to prevent UI overwhelm.
- Migration conflict (same message imported twice): system deduplicates based on message id + timestamp.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST provide a single assistant UI component consolidating conversational, tooling, approvals, and edit suggestions. Measurable: Implemented as single Vue component (UnifiedAssistant.vue parent <500 LOC delegating to <=6 subcomponents); edit suggestion workflow completes <500ms after user approval click.
- **FR-002**: System MUST support session-based conversations with persistent transcript including user messages, assistant responses, tool invocations, approvals, and edits. Measurable: Session persists for tab lifetime with 30-minute idle timeout; transcript renders incrementally for sessions up to 10,000 items without UI freeze (>30 FPS).
- **FR-003**: System MUST execute all assistant tools and pipelines via the new language sidecar backend abstraction (no direct legacy IPC for those functions).
- **FR-004**: System MUST capture telemetry for every tool invocation including timestamp, tool id, duration, outcome (success/error), and source (sidecar). Measurable: All fields defined in data-model.md TelemetryEvent entity are populated; telemetry schema documented per T090 completion; validation confirms no missing required fields.
- **FR-005**: System MUST enforce explicit user approval before performing any operation that modifies files or repository state.
- **FR-006**: System MUST migrate legacy `aiStore` conversation history into unified session format on first launch post-upgrade or allow manual import. Measurable: Migration preserves >=95% unique messages (per research.md decision D-001); verified by tests T077-T080; deduplication algorithm (T071) prevents false duplicates.
- **FR-007**: System MUST preserve streaming capability for providers that support it and gracefully fall back when unavailable.
- **FR-008**: System MUST provide edit suggestion workflow (diff preview, apply, cancel) integrated within unified transcript.
- **FR-009**: System MUST display tool execution status (pending, running, completed, failed) inline within transcript.
- **FR-010**: System MUST summarize oversized tool outputs and allow user to expand for full detail.
- **FR-011**: System MUST isolate sidecar failures so conversational responses remain available when tooling is down.
- **FR-012**: System MUST restrict unsupported tools based on sidecar capability manifest version comparison.
- **FR-013**: System MUST deduplicate imported legacy messages to avoid duplicates in transcript.
- **FR-014**: System MUST allow user to filter transcript segments (messages vs tools vs approvals) for navigation.
- **FR-015**: System MUST provide clear error messages for timeouts, capability mismatches, and migration issues.
- **FR-016**: System MUST maintain provider-agnostic configuration (Azure OpenAI and Ollama) without coupling to sidecar implementation details.
- **FR-017**: System MUST log all approval decisions (approved/denied) with reason if provided by user.
- **FR-018**: System MUST support edit suggestion application producing a single consolidated change event.
- **FR-019**: System MUST allow export of unified session transcript to a shareable format (e.g., markdown or text) without implementation leakage.
- **FR-020**: System MUST provide accessibility considerations (keyboard navigation for tool triggers and approval dialogs).
- **FR-021**: System MUST allow configuration of streaming toggle per session.
- **FR-022**: System MUST handle concurrent tool invocations queued and processed independently.
- **FR-023**: System MUST surface legacy feature parity features (modes: improvement, clarification, general) integrated as metadata tags within messages.
- **FR-024**: System MUST provide fallback read-only mode when sidecar unreachable.
- **FR-025**: System MUST mark migrated sessions distinctly for audit referencing.
- **FR-026**: System MUST allow future extension for additional providers without UI overhaul (extensibility requirement).
- **FR-027**: System MUST expose success and error counts summary for tool usage within a session.
- **FR-028**: System MUST provide user notification banner on version incompatibility.
- **FR-029**: System MUST enable manual refresh of sidecar capability manifest.
- **FR-030**: System MUST allow partial retry for only failed tool invocations.
- **FR-031**: System MUST ensure state updates are atomic to prevent partial transcript corruption on failure.
- **FR-032**: System MUST maintain segregation between safe read operations and potentially mutating operations via approval gating.
- **FR-033**: System MUST clearly disclose when legacy functionality is deprecated to users.
- **FR-034**: System MUST indicate provider identity per response (icon or label) without exposing internal technical identifiers.
- **FR-035**: System MUST support session system prompt customization preserving tool safety constraints.

*Clarifications required (limited to critical aspects)*

- **FR-036**: System MUST automatically migrate legacy conversation history on first launch (auto-import with graceful fallback to manual import if failure occurs) to ensure seamless user experience.
- **FR-037**: System MUST present full file diffs for edit suggestions to maximize transparency, while summarizing very large files with expandable hunk sections to mitigate overwhelm.
- **FR-038**: System MUST require new providers to support: streaming responses, tool invocation, telemetry metadata (token counts), and embeddings (for RAG); providers lacking any of these enter limited capability mode and are not enabled by default.

### Key Entities *(include if feature involves data)*

- **AssistantSession**: Represents a unified conversational + tooling context; attributes: id, provider identity, system prompt, messages[], active tools[], approvals[], telemetry[]. Relationships: contains ToolInvocation and PendingApproval.
- **ConversationMessage**: A user or assistant message including content, role, mode tag (improvement/clarification/general), optional references, streaming flag, suggestions[].
- **ToolInvocation**: A record of a tool run with toolId, parameters summary (non-sensitive), start/end timestamps, status, result summary, error detail (if any), source = sidecar.
- **PendingApproval**: Represents a user decision required; attributes: id, type (edit-apply, file-write, destructive-action), diff summary, status.
- **MigrationRecord**: Tracks legacy import operations: sourceStore, importedAt, totalMessages, deduplicatedCount, status.
- **TelemetryEvent**: Captures discrete events (tool invoked, approval granted/denied, migration executed); attributes: eventId, eventType, timestamp, sessionId, outcome, duration.
- **CapabilityManifest**: Versioned description of sidecar tool capabilities: version, supportedTools[], unsupportedReasonMap.

### Architecture Impact (C4) *(mandatory when architecture changes)*

- Diagrams to update:
  - Context Diagram: add Language Sidecar component as intermediary between UI assistant and AI providers (path: `context-repo/c4/context-sync-mvp.md`).
  - Component Diagram: merge legacy assistant components into UnifiedAssistant component; add CapabilityManifest fetch flow (path: `context-repo/c4/component-sync.md`).
  - Any container-level description referencing separate `aiStore` and `assistantStore` must be revised to single `assistantStore` with migration service.
- Intended changes:
  - Replace dual assistant modules with unified module exposing session manager and migration adapter.
  - Introduce sidecar boundary illustrating indirection for tool execution and provider abstraction.
- Consistency with pipelines:
  - Tool execution nodes in diagrams align with pipeline scripts already versioned; CapabilityManifest ensures diagram and actual runnable tool set remain synchronized.
  - Migration path documented ensures repository remains single source of truth for assistant behavior.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of AI tooling invocations route through sidecar (no legacy direct calls) within 1 week of release verification.
- **SC-002**: Users successfully complete a unified assistant multi-step interaction (ask + tool + approval) in under 3 minutes (median) during usability test.
- **SC-003**: Reduction of assistant-related user confusion tickets by 50% compared to pre-unification baseline (30-day window).
- **SC-004**: Legacy modal usage drops to 0% within 2 weeks (tracked by telemetry events) indicating full adoption of unified interface.
- **SC-005**: Streaming responses render with <300ms initial token latency for supported providers in 90% of sampled sessions (user-perceived responsiveness metric).
- **SC-006**: Tool failure rate (excluding user cancellations) remains <=5% post-migration, showing stability of sidecar path.
- **SC-007**: Migration process achieves >95% message preservation accuracy (deduplication does not lose unique content) in test scenarios.
- **SC-008**: At least 80% of participants rate unified assistant clarity >=4/5 in post-release survey.

## Assumptions *(optional)*

- Legacy data structure is accessible for migration without requiring external export.
- Automatic migration will complete within acceptable startup window (<5s median) for typical history sizes; large histories trigger background completion notice.
- Sidecar exposes a stable capability manifest endpoint before release.
- Providers (Azure OpenAI, Ollama) continue to offer consistent streaming behavior; fallback path needed only when manifest indicates unsupported.
- No additional provider integrations are required for initial release beyond current two.
- Security approval workflow patterns remain consistent with existing file modification guard logic.
- Full file diff generation performance is acceptable for typical file sizes; mitigation (summarization) handles extreme cases.

## Out of Scope *(optional)*

- Introducing new AI providers beyond existing two.
- Real-time collaborative multi-user sessions.
- Full transcript semantic search enhancements.
- Automatic speculative tool pre-execution.

## Risks *(optional)*

- Sidecar instability could degrade tooling reliability (mitigation: fallback read-only mode).
- Migration errors could cause user frustration (mitigation: dry-run validation & rollback on failure).
- Increased UI complexity may impact performance (mitigation: lazy rendering for large transcripts).

## Resolved Decisions

- Legacy migration executes automatically on first launch with fallback manual option (FR-036).
- Full file diff is default; large files summarized with expandable hunks (FR-037).
- Baseline provider capability includes streaming, tool invocation, telemetry metadata, embeddings (RAG); providers missing any enter limited mode (FR-038).
