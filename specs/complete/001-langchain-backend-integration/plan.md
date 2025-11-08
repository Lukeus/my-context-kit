# Implementation Plan: Frontend LangChain Integration

**Branch**: `001-langchain-backend-integration` | **Date**: 2025-11-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-langchain-backend-integration/spec.md`

## Summary

Route assistant prompts, tool runs, and telemetry in the Electron renderer through the LangChain orchestration service while preserving health visibility, configuration-driven capability toggles, streaming UX, and compliant fallbacks described in the feature spec. Electron main process handles workspace path discovery using existing PowerShell/IPC logic and passes resolved paths to the stateless LangChain service.

## Technical Context

**Language/Version**: TypeScript 5.x targeting Node.js 20 LTS within Electron renderer  
**Primary Dependencies**: Vue 3 Composition API, Pinia (`assistantStore`), `assistantBridge` IPC contract, LangChain orchestration service HTTP/stream endpoints, shared telemetry client  
**Storage**: N/A (state remains in-memory Pinia stores; persistent artifacts flow through context-repo pipelines)  
**Testing**: Vitest unit suites (`pnpm test`), renderer Playwright flow (`pnpm test:e2e`), lint (`pnpm lint`), typecheck (`pnpm typecheck`)  
**Target Platform**: Electron desktop app (Windows/macOS/Linux) with context isolation enforced  
**Project Type**: Desktop application with renderer / preload / main separation  
**Performance Goals**: 95% of assistant prompts complete within 10s, streaming updates begin within 1s of backend emission  
**Constraints**: Preserve context isolation, avoid direct provider calls, support graceful fallback when service unavailable, emit structured telemetry for every lifecycle stage  
**Scale/Scope**: Internal beta cohort (dozens of concurrent sessions) with headroom for wider rollout

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **I. Git-Versioned Source of Truth**: Update `context-repo/c4/context-sync-mvp.md` and `context-repo/c4/component-sync.md` via pipelines, and revise assistant capability docs under `context-repo/contexts/` so architecture drift is captured in Git.
2. **II. Deterministic Pipelines Before AI**: Schedule `pnpm validate`, `pnpm build-graph`, and `pnpm impact` after updating capability metadata to maintain deterministic baseline before invoking LangChain-powered tooling.
3. **III. Unified TypeScript & Build Discipline**: All renderer changes keep strict TS configuration, reuse Vite bundling, and rely solely on pnpm-managed dependencies with no alternate package tooling introduced.
4. **IV. Validation & Impact Gatekeeping**: Plan mandates lint, typecheck, Vitest, Playwright smoke run, and pipeline impact reports before review sign-off, with results stored alongside the feature artifacts.
5. **V. Secure Desktop Boundary & Observability**: Implementation uses preload bridge APIs only, keeps secrets sourced from env-managed config, and expands telemetry payloads to capture LangChain identifiers and outcomes.

Re-evaluation after Phase 1 design confirms all gates remain satisfied; no mitigations required.

## Project Structure

### Documentation (this feature)

```text
specs/001-langchain-backend-integration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md            # Generated later via /speckit.tasks
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── main/
│   │   └── services/assistantSessionManager.ts
│   ├── preload/
│   │   └── assistantBridge.ts
│   └── renderer/
│       ├── components/assistant/
│       ├── stores/assistantStore.ts
│       ├── stores/contextStore.ts
│       └── services/langchain/
├── tests/
│   ├── assistant/
│   └── e2e/
└── package.json

context-kit-service/
└── src/
    ├── api/
    ├── orchestration/
    └── telemetry/
```

**Structure Decision**: Extend the existing Electron renderer modules (`assistantStore`, assistant UI components, telemetry utilities) alongside preload and main services while coordinating API contracts with the `context-kit-service` sidecar directories.

## Complexity Tracking

No constitutional violations identified; complexity table not required.
