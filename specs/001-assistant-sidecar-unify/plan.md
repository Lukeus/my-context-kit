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
**Testing**: Vitest (TypeScript unit tests), Playwright (future E2E), pytest (sidecar service tests) – NEEDS CLARIFICATION: breadth of new test coverage for migration logic (define % or scenarios). 
**Target Platform**: Desktop (Windows/macOS/Linux Electron app) + local/remote Python sidecar.
**Project Type**: Electron desktop application with external Python service.
**Performance Goals**: Initial streaming token latency <300ms (SC-005); tool invocation median completion <5s for validation/graph; migration completes <5s for typical history (<500 messages). NEEDS CLARIFICATION: define p95 tool duration thresholds.
**Constraints**: Maintain context isolation (no nodeIntegration), memory overhead minimal (avoid loading entire large diffs fully – summarization), sidecar unreachable fallback enabled.
**Scale/Scope**: Single-user sessions per desktop instance; up to several thousand messages per session; simultaneous tool invocations limited to practical concurrency (likely <=5).

**Unknowns / NEEDS CLARIFICATION**:
1. Test coverage scope for migration (unit vs integration vs snapshot) – define acceptance target.
2. p95 duration thresholds for heavy tools (graph build, impact analysis).
3. Concurrency limit for simultaneous tool invocations (queue strategy).

These will be resolved in Phase 0 research.

## Constitution Check (Initial)

1. **I. Git-Versioned Source of Truth**: Updating C4 diagrams (`context-repo/c4/context-sync-mvp.md`, `component-sync.md`) plus any spec updates; telemetry schema changes documented in spec/data-model. All migration logic in code references Git-managed legacy data; no hidden state. PASS.
2. **II. Deterministic Pipelines Before AI**: Existing pipelines (validate, build-graph, impact, generate) remain deterministic; sidecar routes tool execution but does not alter pipeline determinism. Any new retrieval index build (embeddings) must be added as deterministic Python pipeline script. PASS (embedding pipeline script addition TODO). 
3. **III. Unified TypeScript & Build Discipline**: No deviation from TypeScript strict config; removal/deprecation of direct JS LangChain usage; pnpm only. PASS.
4. **IV. Validation & Impact Gatekeeping**: Plan includes gating: run `pnpm typecheck`, `pnpm lint`, pipeline validate & impact before merge; migration tests added. PASS (tool duration thresholds NEEDS CLARIFICATION but not blocking gate definition).
5. **V. Secure Desktop Boundary & Observability**: Context isolation preserved; approvals enforced; telemetry events (tool invocation, approval decision, migration result) logged. Secrets remain env variables for providers. PASS.

No violations identified; unknowns to be resolved in research phase.

## Constitution Check (Post-Design)

Re-evaluated after research & Phase 1 artifacts:

- **I. Git-Versioned Source of Truth**: Data model, contracts, research, quickstart committed; embedding pipeline script planned (D-004) – remains compliant. PASS.
- **II. Deterministic Pipelines Before AI**: Embeddings pipeline decision ensures determinism; no AI orchestration bypass introduced. PASS.
- **III. Unified TypeScript & Build Discipline**: No changes weakening TypeScript strictness; sidecar integration via typed client. PASS.
- **IV. Validation & Impact Gatekeeping**: Tool duration thresholds define performance gates; test coverage plan (migration mapping + tool invocation telemetry) documented. PASS.
- **V. Secure Desktop Boundary & Observability**: Telemetry schema extended; approvals persisted; fallback modes defined. PASS.

Overall status: All gates satisfied. No complexity tracking entries needed.

## Phase 2 Planning (Preview)

Phase 2 (to be formalized in tasks.md):
- Implement sidecar client abstraction (`services/sidecar/client.ts`).
- Extend `assistantStore` with migration service & concurrency queue.
- Deprecation warnings in `aiStore` usage points.
- UI unification: create `UnifiedAssistant.vue` (replace legacy modal & panel) referencing design tokens.
- Telemetry event emission wrapper.
- Tool invocation queue + cancellation UI.
- Diff rendering component with summarization threshold logic.
- Capability manifest refresh scheduler.
- Tests: migration mapping, diff summarization, concurrency limits, telemetry fields, fallback mode.
- Documentation updates to C4 diagrams.

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
