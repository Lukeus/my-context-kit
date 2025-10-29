# Phase 0 Research

## Azure OpenAI via OpenAI Node SDK
- **Decision**: Adopt the official OpenAI Node SDK to call Azure OpenAI deployments with chat completions and streaming enabled.
- **Rationale**: The SDK provides first-class Azure support (deployment-based URLs, API versioning) and handles retry/backoff plus structured types, reducing custom fetch logic and aligning with vendor guidance.
- **Alternatives considered**:
  - **Continue using manual fetch wrappers**: Rejected because it duplicates SDK logic, complicates maintenance, and lags behind API surface updates.
  - **Switch to Azure REST SDK**: Rejected due to higher integration overhead and lack of parity with Ollama-oriented abstractions.

## Safe Tool Governance Model
- **Decision**: Maintain a curated allowlist of tool capabilities (read, write-with-confirmation, pipeline execution, git operations) exposed through typed IPC contracts and audited telemetry events.
- **Rationale**: Aligns with the specification’s requirement for human-in-the-loop safety, keeps mutations behind existing pipeline scripts, and enables observability across providers.
- **Alternatives considered**:
  - **Open-ended function calling**: Rejected because it bypasses human approval and increases risk of unbounded repository changes.
  - **Static command mapping without telemetry**: Rejected; fails constitutional observability requirements.

## Provider Parity & Conversation Roles
- **Decision**: Normalize conversation payloads so both Azure (SDK-backed) and Ollama interactions use explicit `system`, `user`, and `assistant` roles with shared metadata records.
- **Rationale**: Guarantees consistent behaviour regardless of provider choice, simplifies testing, and satisfies the spec’s parity objective.
- **Alternatives considered**:
  - **Provider-specific role mapping**: Rejected because it introduces divergent behaviours and doubles validation effort.
  - **Minimal role enforcement**: Rejected as it undermines auditability and transcript clarity.
