# Data Model

## Assistant Session
- **Description**: Captures a single conversational session regardless of provider.
- **Fields**:
  - `id`: UUID generated client-side to correlate UI and telemetry.
  - `provider`: Enum (`azure-openai`, `ollama`).
  - `systemPrompt`: String (immutable once session starts).
  - `messages`: Ordered array of `ConversationTurn`.
  - `activeTools`: Array of `ToolDescriptor` reflecting allowlisted capabilities for the session.
  - `pendingApprovals`: Array of `PendingAction` references awaiting human confirmation.
  - `telemetryId`: Identifier linking to structured log stream.
- **Relationships**: One-to-many with `ToolInvocationRecord`; one-to-many with `PendingAction`.
- **Validation Rules**: `messages` must alternate roles starting with `system`; `pendingApprovals` must reference valid tool identifiers.

## ConversationTurn
- **Description**: Stores a single message in role order.
- **Fields**:
  - `role`: Enum (`system`, `user`, `assistant`).
  - `content`: Markdown-formatted string.
  - `timestamp`: ISO 8601 string.
  - `metadata`: Optional object (token counts, provider id, streaming chunk info).
- **Relationships**: Belongs to `Assistant Session`.
- **Validation Rules**: `role` must follow session sequencing rules; `content` cannot be empty.

## ToolDescriptor
- **Description**: Defines a safe tool the assistant may call.
- **Fields**:
  - `id`: String identifier (`context.read`, `pipeline.run`, `git.preparePr`).
  - `capability`: Enum (`read`, `write`, `execute`, `git`).
  - `requiresApproval`: Boolean.
  - `allowedProviders`: Array of provider enums.
  - `inputSchema`: JSON schema describing required parameters.
  - `outputSchema`: JSON schema for deterministic results.
- **Relationships**: Referenced by `AssistantSession.activeTools`.
- **Validation Rules**: `allowedProviders` cannot be empty; `inputSchema` must validate via AJV before tool registration.

## ToolInvocationRecord
- **Description**: Telemetry entry for each tool action.
- **Fields**:
  - `id`: UUID.
  - `sessionId`: Reference to `AssistantSession`.
  - `toolId`: Reference to `ToolDescriptor`.
  - `status`: Enum (`pending`, `succeeded`, `failed`, `aborted`).
  - `parameters`: JSON object recorded pre-execution (scrubbed of secrets).
  - `resultSummary`: Short string describing outcome.
  - `startedAt` / `finishedAt`: ISO timestamps for SLA tracking.
- **Relationships**: Belongs to `AssistantSession`; references `ToolDescriptor`.
- **Validation Rules**: `finishedAt` >= `startedAt`; `parameters` validated against `inputSchema`.

## PendingAction
- **Description**: Represents a tool request awaiting human approval.
- **Fields**:
  - `id`: UUID.
  - `sessionId`: Reference to `AssistantSession`.
  - `toolId`: Reference to `ToolDescriptor`.
  - `diffPreview`: Optional string summarising proposed changes.
  - `createdAt`: ISO timestamp.
  - `expiresAt`: ISO timestamp (auto-cancel timeline).
- **Relationships**: Many-to-one with `AssistantSession` and `ToolDescriptor`.
- **Validation Rules**: `expiresAt` must be within configured window (default 15 minutes) of `createdAt`.
