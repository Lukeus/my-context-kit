# Implementation Plan: Assistant Sidecar Unification

**Branch**: `001-assistant-sidecar-unify` | **Date**: 2025-11-02 | **Spec**: `./spec.md`
**Input**: Feature specification from `/specs/001-assistant-sidecar-unify/spec.md`

**Note**: Generated via `/speckit.plan` workflow.

## Summary

Unify legacy and safe tooling AI assistants into a single session-based assistant UI backed exclusively by the Python LangChain sidecar (`context-kit-service`). All tool executions (validate, graph build, impact, prompt generation) route through sidecar HTTP APIs; conversation, streaming, edit suggestions, approvals, telemetry consolidated in `assistantStore`. Automatic migration of legacy `aiStore` conversations occurs on first launch. Full file diffs shown for edit suggestions (large file summarization optimization). Provider baseline requires streaming, tool invocation, telemetry metadata (token counts), embeddings for RAG. Emphasis on enterprise patterns: strict TypeScript, preload isolation, deterministic pipelines, Material 3 tokens, constitutional gates for validation & impact before merge.

## Technical Context

**Language/Version**: TypeScript (strict) for Electron main/preload/renderer; Python 3.11 (FastAPI + LangChain) for sidecar.
**Primary Dependencies**: Electron Forge + Vite, Vue 3 Composition API, Pinia, Tailwind (Material 3 tokens), Azure OpenAI SDK (via sidecar), Ollama (via sidecar), FastAPI, LangChain Python, simple-git/isomorphic-git.
**Storage**: Git-versioned filesystem (context-repo YAML/specs); transient in-memory session state; no new persistent DB.
**Testing**: Vitest (TypeScript unit tests), Playwright (future E2E), pytest (sidecar service tests). Migration coverage matrix: mapping, deduplication, rollback (≥95% unique messages preserved; 0 critical failures). Performance harness tasks link: first-token latency (T028L), transcript perf (T052H), tool durations (T083), embeddings checksum reproducibility (T090A).
**Target Platform**: Desktop (Windows/macOS/Linux Electron app) + local/remote Python sidecar.
**Project Type**: Electron desktop application with external Python service.
**Performance Goals**: Initial streaming token latency p95 <300ms (SC-005); tool invocation SLOs defined; migration completes p95 <5s for typical history (<500 messages); embeddings determinism (FR-039) validated before enabling RAG-dependent features.
**Performance SLOs**:
| Operation | p50 | p95 |
|-----------|-----|-----|
| Validation pipeline | <3s | <5s |
| Graph build pipeline | <4s | <8s |
| Impact analysis | <5s | <10s |
| Embeddings build | <6s | <12s |
| First streaming token | <200ms | <300ms |
| Migration (typical history) | <3s | <5s |
| Multi-step interaction (ask+tool+approval) | <120s | <180s |

All durations are in seconds (ms where specified). Harness metrics discard top/bottom 5% outliers before computing p50/p95.

**Constraints**: Maintain context isolation (no nodeIntegration); summarize diffs when (total lines >800 OR raw size >100KB) – trigger if either threshold exceeded; sidecar unreachable triggers Limited Read-Only Mode (conversation only, tools disabled); concurrency capped at 3 active tool executions.
**Concurrency Rationale**: Initial cap=3; increase only if p95 tool duration <5s and average per-invocation memory <500MB.
**RAG Gating**: Retrieval features remain disabled until embeddings determinism (FR-039) passes checksum reproducibility and gating artifact reports `checksumMatch=true`.
**Scale/Scope**: Single-user sessions per desktop instance; thousands of messages per session; concurrency limited by `MAX_CONCURRENT_TOOLS = 3`.

**Unknowns Resolved**:
1. Migration coverage: unit (mapping), integration (auto-import), rollback (<500ms) test; acceptance target ≥95% preservation; dedup integrated into FR-006.
2. p95 thresholds established above; tracked in performance harness with artifact outputs (`generated/perf/*.json`).
3. Concurrency limit fixed to 3 for stability & predictable resource usage; escalation criteria documented.
4. Summarization thresholds centralized via shared constant (`SUMMARY_TRIGGER`); prevents divergence across FR-010 & FR-037.

## Constitution Check (Progressive Assessment)

### Initial Evaluation (Pre-Implementation)

1. **I. Git-Versioned Source of Truth**: C4 diagram updates (T081) are REQUIRED GATE before merging additional assistant UI changes; current status: PENDING (must reflect sidecar boundary + embeddings + gating artifact). 
2. **II. Deterministic Pipelines Before AI**: Embeddings pipeline (FR-039, tasks T028A/T087) MUST land before enabling any RAG-dependent or embeddings-based retrieval features; current status: PENDING.
3. **III. Unified TypeScript & Build Discipline**: No deviation; enforce sidecar-only provider usage (FR-003) via static script (T028I). PASS (enforcement pending implementation of script).
4. **IV. Validation & Impact Gatekeeping**: Gates defined; add explicit harness references (T028L, T052H, T083) to quantify performance. PARTIAL until harness tasks complete.
5. **V. Secure Desktop Boundary & Observability**: Approval + telemetry design defined; telemetry completeness threshold (≥99%) for FR-004 set. PASS (implementation pending tests).

**Action Items**: Principles I & II are merge blockers (C4 diagrams early + deterministic embeddings). Principles III–V monitored via gating artifact (FR-040) and early telemetry completeness (≥99.5%).

### Post-Design Validation (After Phase 1 Artifacts)

Delta assessment after research, data-model, contracts, quickstart committed:

- **I. Git-Versioned Source of Truth**: ✓ Planning artifacts committed; C4 update task scheduled early (T081 in Phase 2).
- **II. Deterministic Pipelines Before AI**: ✓ Embeddings pipeline planned with checksum validation (T028A/B); defers RAG until determinism proven.
- **III. Unified TypeScript & Build Discipline**: ✓ Typed sidecar client architecture; no TypeScript strictness relaxation.
- **IV. Validation & Impact Gatekeeping**: ✓ Test matrix expanded (mapping, dedup, rollback); harness tasks linked to SLOs.
- **V. Secure Desktop Boundary & Observability**: ✓ Classification enforcement (FR-032), telemetry schema extended, approval workflows defined.

**Overall Status**: All principles satisfied pending task execution. No constitutional violations or complexity exceptions required.

## Phase 2 Planning (Preview)

Phase 2 (Foundational – updated scope, ARCHITECTURE GATED):
1. C4 diagram updates (context & component) reflecting unified assistant + sidecar + embeddings pipeline + gating artifact (MERGE BLOCKER prior to other Phase 2 tasks).
2. Implement sidecar client abstraction (`services/sidecar/client.ts`).
3. Extend `assistantStore` with migration service & concurrency queue (cap=3).
4. Deterministic embeddings pipeline script (`.context/pipelines/build-embeddings.mjs`) + checksum logging (RAG disabled until checksumMatch=true).
5. Deprecation warnings in `aiStore` usage points.
6. Tool invocation queue + cancellation UI.
7. Diff rendering component using shared summarization constants (>800 lines OR >100KB).
8. Capability manifest refresh scheduler + manual refresh action.
9. Gating artifact generator (`scripts/ci/run-gates.ts`) producing `generated/gate-status.json`.
10. Telemetry event emission wrapper & completeness test (≥99.5%) early.
11. Performance harness tasks (first token latency, interaction latency) before UI merge.
12. Tests: migration mapping, dedup accuracy, rollback latency, summarization thresholds, concurrency limits, telemetry completeness, Limited Mode behavior, embeddings checksum.
13. Documentation updates (C4 diagrams) captured before assistant UI merges.

Dependencies:
- Sidecar running (FastAPI) with endpoints matching contracts.
- Embeddings pipeline script addition.

Risks & Mitigations carried forward from spec.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
  src/
    renderer/
      components/assistant/        # Unified assistant UI (extend existing)
      stores/assistantStore.ts     # Enhanced with migration + streaming
      stores/aiStore.ts            # Legacy (add deprecation warnings)
      services/sidecar/            # New TS client for Python sidecar (HTTP)
    main/
      services/assistantSessionManager.ts  # Updated to route via sidecar client
      ipc/handlers/assistant/*.ts          # IPC handlers updated
    preload/
      bridges/assistantBridge.ts           # Extended API surface
context-kit-service/
  src/                                   # Python sidecar (existing)
  tests/                                 # Add provider contract & embeddings pipeline tests
specs/001-assistant-sidecar-unify/       # Planning & design artifacts
```

**Structure Decision**: Extend existing Electron app structure; introduce `services/sidecar` client layer; avoid restructuring other domains. Modify `assistantStore` only; keep `aiStore` transitional with warnings until removal.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (None) | N/A | All constitutional gates satisfied without exception |
