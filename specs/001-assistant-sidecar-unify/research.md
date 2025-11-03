# Research: Assistant Sidecar Unification

**Branch**: 001-assistant-sidecar-unify  
**Date**: 2025-11-02  
**Source Spec**: ./spec.md

## Overview
Research resolves outstanding technical unknowns and codifies design decisions with rationale and considered alternatives.

## Decisions

### D-001 Migration Test Coverage Scope
- **Decision**: Implement unit tests for transformation mapping + integration test for end-to-end auto migration; snapshot test for representative legacy conversation formats; target >95% unique message preservation.
- **Rationale**: Balanced confidence and effort; full exhaustive migration scenarios unnecessary given deterministic mapping.
- **Alternatives Considered**:
  - Full replay of all legacy sessions (high effort, marginal return)
  - Pure unit tests only (risk missing interaction issues)

### D-002 Tool Invocation Duration Thresholds
- **Decision**: Set p95 goals: validate <3s, build-graph <5s, impact <7s, generate (prompt) <4s on reference machine; show progress indicator if exceeding 2s.
- **Rationale**: Aligns with typical user patience; differentiates heavier analysis (impact) from simpler pipelines.
- **Alternatives**:
  - Uniform <3s for all (unrealistic for impact)
  - No thresholds (reduces accountability)

### D-003 Concurrency Limit for Tool Invocations
- **Decision**: Limit concurrent active tool executions to 3; queue additional requests FIFO; allow user to cancel queued items.
- **Rationale**: Prevent resource contention & UI overload while supporting parallelism benefit.
- **Alternatives**:
  - Unlimited concurrency (risk sidecar saturation and confusing UI)
  - Single execution only (slows workflow unnecessarily)

### D-004 Embeddings Pipeline Determinism
- **Decision**: Add Python pipeline script `context-repo/.context/pipelines/build-embeddings.mjs` (wrapper invoking sidecar embedding job) producing versioned JSON index referencing source commit hash.
- **Rationale**: Maintains Principle II by making RAG artifacts reproducible.
- **Alternatives**:
  - Sidecar-only ephemeral build (non-reproducible)
  - Client-side build in renderer (violates security boundary)

### D-005 Diff Summarization Strategy for Large Files
- **Decision**: Summarize files >2000 LOC or >400 changed LOC: show high-level stats + first 2 and last 2 hunks; user expands to full diff.
- **Rationale**: Preserves transparency while preventing performance issues.
- **Alternatives**:
  - Always full diff (performance risk)
  - Always summarized (reduces clarity)

### D-006 Telemetry Schema Extension
- **Decision**: Extend telemetry event schema with fields: `provider`, `streaming:Boolean`, `tokensConsumed`, `capabilityVersion`, `queuedAt`, `startedAt`, `finishedAt`.
- **Rationale**: Enables performance analysis & compliance with observability principle.
- **Alternatives**:
  - Minimal events (insufficient diagnostics)

### D-007 Capability Manifest Refresh Interval
- **Decision**: Manual refresh plus auto refresh every 15 minutes if assistant pane open.
- **Rationale**: Balances staleness risk with reduced unnecessary calls.
- **Alternatives**:
  - Refresh every session open only (stale capabilities)
  - Aggressive polling (resource waste)

## Resolved Unknowns Mapping
- Migration coverage (D-001)
- Tool duration thresholds (D-002)
- Concurrency limit (D-003)

## Remaining Questions
None.

## Impact on Plan
Update plan technical context to replace NEEDS CLARIFICATION markers with decisions D-001..D-003.

## Next
Proceed to Phase 1: data-model, contracts, quickstart.
