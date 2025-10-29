# Feature Specification: AI Assistant Safe Tooling Upgrade

**Feature Branch**: `001-ai-assistant-tools`  
**Created**: 2025-10-28  
**Status**: Draft  
**Input**: User description: "refactor and enhance the ai assistant to use the OpenAI Node Sdk for the Azure endpoint to use, expose safe tools (read/write/run pipelines/ open PR ...etc)and let the model call them. use roles like system, user, assitant and mimic as much as possible for ollama endpoint."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operate pipelines safely (Priority: P1)

An internal operator asks the assistant to execute a repository maintenance task (for example, run a validation pipeline) through the Azure provider and expects the model to call only pre-approved tooling with a clear audit trail.

**Why this priority**: Enables the core value of delegating repeatable repository actions to the AI assistant while keeping compliance and safety controls intact.

**Independent Test**: Trigger a single pipeline run request through the assistant and confirm the operation completes end-to-end with logged tool invocations and no access outside the allowlist.

**Acceptance Scenarios**:

1. **Given** a configured Azure provider and an allowlisted pipeline command, **When** the operator instructs the assistant to run that pipeline, **Then** the assistant confirms intent, executes via the tool interface, and records the outcome with timestamps.
2. **Given** the same scenario, **When** the operator requests an action outside the allowlist, **Then** the assistant refuses and explains the safety restriction without attempting the action.

---

### User Story 2 - Capture repository context (Priority: P2)

A contributor uses the assistant to gather context (e.g., read files or summarize spec changes) with either Azure or Ollama and expects consistent conversation roles, traceable references, and no accidental writes until explicitly approved.

**Why this priority**: Ensures day-to-day collaborator workflows remain efficient while adopting the new provider stack, reducing friction when switching between models.

**Independent Test**: Ask the assistant to summarize a file using both providers independently and verify the responses cite the same conversation roles, reference sources, and show no unauthorized edits.

**Acceptance Scenarios**:

1. **Given** a read-only tool invocation, **When** the assistant retrieves content via Azure, **Then** the response follows the system → user → assistant role sequence and returns the requested content with provenance notes.
2. **Given** the same request using Ollama, **When** the assistant answers, **Then** the output mirrors the role handling and formatting used by the Azure provider.

---

### User Story 3 - Prepare change proposals (Priority: P3)

An engineering lead asks the assistant to draft a pull request for a simple change set, expecting the assistant to stage edits via safe write operations, request confirmation before opening the PR, and present a summary that can be reviewed before submission.

**Why this priority**: Provides advanced yet controlled automation that accelerates change management while keeping humans in the approval loop.

**Independent Test**: Direct the assistant to make a small spec edit, review the proposed diff, and confirm that the assistant awaits explicit approval before raising the PR with all actions logged.

**Acceptance Scenarios**:

1. **Given** a scoped write request, **When** the assistant prepares file changes, **Then** it shows the diff, collects approval, and only then applies the update through the safe tool interface.
2. **Given** approval is granted, **When** the assistant is instructed to open a PR, **Then** it uses the dedicated tool, captures metadata (title, summary, branch), and reports success or failure with next steps.

---

### Edge Cases

- Azure credentials are missing or invalid when the assistant initiates a call, so the system must surface a clear remediation message without crashing the session.
- The assistant attempts to call a tool that requires elevated permissions; the request must be blocked with an explanation and recorded for audit.
- Streaming responses between Azure (SDK-based) and Ollama differ in cadence; the assistant should reconcile partial outputs so transcripts remain coherent.
- Network interruptions occur mid-tool execution; the assistant must resume or safely abort without leaving the repository in an indeterminate state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The assistant MUST orchestrate conversations using explicit `system`, `user`, and `assistant` roles for every provider interaction so transcripts remain aligned with governance policies.
- **FR-002**: Azure-backed interactions MUST route through the official vendor SDK, including support for streaming and non-streaming modes, while honoring existing temperature and max token controls.
- **FR-003**: The assistant MUST expose only an audited allowlist of safe tools covering read operations, scoped write edits, pipeline execution, git status, and pull-request preparation, with per-tool guardrails and acknowledgements for state-changing actions.
- **FR-004**: Every tool invocation MUST emit structured telemetry (timestamp, requester, provider, tool name, parameters, outcome) that can be reviewed post-session without inspecting raw logs.
- **FR-005**: When a tool call fails (network, permission, validation), the assistant MUST surface a user-readable error, recommend recovery steps, and avoid partial changes.
- **FR-006**: The Ollama provider MUST mirror the conversation flow, tool availability, and safety checks used by Azure so that switching providers does not alter user expectations.
- **FR-007**: The system MUST provide configuration controls for administrators to enable/disable individual tools per provider without redeploying the application.
- **FR-008**: Regression tests MUST verify that unauthorized tool names are rejected and that each allowlisted tool completes the expected workflow under both providers.

### Key Entities *(include if feature involves data)*

- **Assistant Session**: Represents an end-to-end conversation, capturing provider selection, role-ordered transcripts, telemetry events, and pending approvals.
- **Tool Invocation Record**: Stores each tool call's metadata (tool identifier, intent, parameters, execution status, audit reference) and links back to the originating session.
- **Provider Configuration Profile**: Captures credentials, SDK usage flags, provider capabilities (e.g., streaming, logprob support), and tool availability toggles per provider.

### Assumptions & Dependencies

- Azure OpenAI credentials and endpoint configuration remain managed through existing secure environment variables without exposing secrets in the application UI.
- The current pipeline scripts (validate, build graph, impact, generate) continue to be the single mechanism for mutating the context repository, and all safe tools wrap these scripts rather than bypassing them.
- Git hosting continues on GitHub with authenticated CLI access so pull-request preparation tools can assemble branches and draft summaries without additional integrations.
- Operators are trained to review assistant confirmations before approving state-changing actions, ensuring the human-in-the-loop safeguard remains effective.

### Architecture Impact (C4) *(mandatory when architecture changes)*

- Update `context-repo/c4/context-sync-mvp.md` to show the assistant's safe tool boundary, the SDK-based Azure integration, and parity with the Ollama provider within the Desktop App context.
- Update `context-repo/c4/component-sync.md` to document the new Tool Orchestrator component mediating between the renderer UI, pipeline scripts, and provider SDKs, including telemetry emissions.
- Ensure the generated diagrams highlight that all repository mutations still flow through the existing pipeline scripts so the Git-managed source of truth remains authoritative.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of Azure assistant requests complete without manual retries when using the official SDK across a representative test suite.
- **SC-002**: 100% of tool invocations appear in the telemetry audit log within 5 seconds of execution completion.
- **SC-003**: In usability testing, at least 90% of operators report that provider switching (Azure ↔ Ollama) has no noticeable impact on conversation structure or safety controls.
- **SC-004**: Critical recovery guidance is displayed for 100% of simulated failure cases (missing credentials, denied permissions, network drop) during acceptance testing.
