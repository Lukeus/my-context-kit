# Phase 0 Research Summary

## Decision 1: Streaming Transport Strategy
- **Decision**: Use the existing `assistantBridge` IPC channel to forward Server-Sent Events from the LangChain orchestration service to the renderer as incremental payloads.
- **Rationale**: Reuses hardened preload plumbing with context isolation, keeps renderer free of direct networking, and matches current streaming semantics expected by assistant UI components.
- **Alternatives Considered**:
  - WebSocket bridge from renderer → service (rejected: adds new socket management surface and CSP exceptions).
  - Polling the service for response chunks (rejected: violates 1s streaming requirement and increases latency).

## Decision 2: Health and Fallback Signaling
- **Decision**: Introduce a dedicated `assistantStore` status state sourced from a lightweight `/health` probe exposed by the LangChain service and map failures to guardrails that show fallback guidance.
- **Rationale**: Keeps service health observable in Pinia, allows UI to bind to a single source of truth, and aligns with Constitution requirements for deterministic pipelines before invoking AI.
- **Alternatives Considered**:
  - Derive health solely from failed prompt attempts (rejected: slow detection and noisy user experience).
  - Embed health checks inside each IPC call (rejected: duplicates network load and complicates telemetry correlation).

## Decision 3: Capability Toggle Management
- **Decision**: Load capability flags from the Git-versioned configuration exposed through the assistant session bootstrap call and cache them in `assistantStore` with timestamps.
- **Rationale**: Supports runtime flag adjustments without redeploys, keeps configuration changes auditable, and satisfies success criteria for 1-minute updates.
- **Alternatives Considered**:
  - Hardcode flags in renderer constants (rejected: violates configurability requirement).
  - Store flags in local storage (rejected: creates drift from Git-versioned source of truth).

## Decision 4: Path Resolution Strategy
- **Decision**: Electron main process uses existing PowerShell script logic (`common.ps1` patterns via IPC) to resolve repository root, active feature branch, and specification paths before passing them to the stateless LangChain service.
- **Rationale**: Maintains separation of concerns (Electron manages workspace state, service provides AI orchestration), avoids duplicating robust fallback logic in Python, preserves service statelessness for horizontal scaling, and aligns with existing IPC patterns.
- **Alternatives Considered**:
  - Service discovers paths using environment variables (rejected: makes service session-aware and complicates deployment).
  - Duplicate path discovery logic in Python service (rejected: maintenance overhead and potential behavior drift).

