# Data Model

## Assistant Session
- **Purpose**: Represents a user-facing conversation context that aligns renderer state with the LangChain orchestration session.
- **Fields**:
  - `sessionId` (string): Stable identifier shared across renderer, preload, and service.
  - `messages` (ordered collection): Transcript turns with role, timestamp, and content metadata.
  - `capabilityFlags` (map<string, CapabilityState>): Availability and rollout status loaded from configuration.
  - `telemetryContext` (object): Correlation identifiers for logging and analytics.
- **Relationships**:
  - Aggregates many `LangChain Task Envelope` records capturing tool executions for the session.
  - References the active `Capability Configuration Profile` used at session bootstrap.
- **State Transitions**:
  - `initializing → active → idle/closed` with reconnect path that reuses the same `sessionId` and restores capability flags.

## LangChain Task Envelope
- **Purpose**: Captures a single backend-executed action initiated by the assistant.
- **Fields**:
  - `taskId` (string): Unique identifier provided by the orchestration service.
  - `actionType` (enum): Prompt, tool-execution, approval, fallback.
  - `status` (enum): Pending, streaming, succeeded, failed, reverted.
  - `provenance` (object): Source references, cost summaries, and approval metadata.
  - `outputs` (list): Streamed content chunks or structured tool results.
  - `timestamps` (object): Created, firstResponse, completed.
- **Relationships**:
  - Belongs to exactly one `Assistant Session`.
  - May reference capability requirements defined in the `Capability Configuration Profile`.
- **Validation Rules**:
  - `outputs` must be empty when `status` is Pending or Failed before firstResponse.
  - `provenance` is mandatory when `status` is Succeeded.

## Capability Configuration Profile
- **Purpose**: Defines which assistant capabilities are enabled and how fallbacks operate.
- **Fields**:
  - `profileId` (string): Identifier for auditing configuration changes.
  - `capabilities` (map<string, CapabilityEntry>): Toggle state, rollout phases, fallback mapping.
  - `lastUpdated` (timestamp): Git commit timestamp from configuration pipeline output.
  - `owner` (string): Responsible team or individual for the configuration set.
- **Relationships**:
  - Associated to each `Assistant Session` at creation time.
  - Drives validation rules for `LangChain Task Envelope` actions.
- **Validation Rules**:
  - A capability flagged as disabled must map to a documented fallback before the profile is considered valid.
