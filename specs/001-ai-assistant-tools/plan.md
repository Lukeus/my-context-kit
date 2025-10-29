# Implementation Plan: AI Assistant Safe Tooling Upgrade

**Branch**: `001-ai-assistant-tools` | **Date**: 2025-10-28 | **Spec**: specs/001-ai-assistant-tools/spec.md
**Input**: Feature specification from `/specs/001-ai-assistant-tools/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Deliver a unified assistant workflow that (1) routes Azure requests through the official OpenAI Node SDK, (2) exposes a curated set of safe read/write/pipeline/PR tools with audit telemetry, and (3) keeps Azure and Ollama providers aligned on role handling and safety behaviour.

## Technical Context

**Language/Version**: TypeScript (strict) on Node.js 20 LTS, Vue 3 Composition API, Electron Forge runtime.
**Primary Dependencies**: OpenAI Node SDK (Azure-compatible), node-fetch streaming utilities, simple-git for PR scaffolding, existing pipeline scripts under `context-repo/.context/pipelines/*`.
**Storage**: Git repositories (app + context-repo) and telemetry logs persisted via existing structured logging; no new databases.
**Testing**: Vitest unit suites, Playwright smoke tests, context-repo pipeline validation commands, plus targeted integration tests for tool guards.
**Target Platform**: Desktop Electron application (Windows/macOS/Linux) with renderer running in Chromium sandbox.
**Project Type**: Multi-process desktop app (Electron main + preload + renderer) backed by Node-driven pipelines.
**Performance Goals**: Assistant responses begin within 2 seconds for deterministic tool lookups; streaming output parity maintained between providers with <500ms drift.
**Constraints**: Context isolation remains enabled; no Node APIs exposed directly to renderer; pnpm-only dependency management; environment secrets stay outside source.
**Scale/Scope**: Internal operator workflows (~25 concurrent sessions) with burst pipeline executions capped by existing CI resources.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **I. Git-Versioned Source of Truth**: Plan updates C4 diagrams `context-repo/c4/context-sync-mvp.md` and `context-repo/c4/component-sync.md`, modifies `context-repo/.context/pipelines/ai-common.mjs`, and adds audit schema docs under `specs/001-ai-assistant-tools`. All edits live in Git and flow through pipeline scripts.
2. **II. Deterministic Pipelines Before AI**: Pipeline commands (`pnpm validate`, `pnpm build-graph`, `pnpm impact`, `pnpm generate`) remain unchanged; the assistant only triggers them through existing scripts, preserving deterministic outputs before AI summarises results.
3. **III. Unified TypeScript & Build Discipline**: Work stays within existing TypeScript configuration (`moduleResolution: "Bundler"`), uses pnpm for any dependency updates, and retains Vite bundling for all Electron processes.
4. **IV. Validation & Impact Gatekeeping**: Implementation will queue schema validation and impact analysis in CI, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and capture outcomes; tasks.md will document who executes each gate before merge.
5. **V. Secure Desktop Boundary & Observability**: Safe tool boundary enforced through preload IPC contracts, secrets remain in env vars, telemetry for tool invocations captured with timestamps and outcomes, and CSP/context isolation stay intact.

All gates satisfied; no violations recorded.

**Post-Design Review (Phase 1)**: Research, data model, contracts, and quickstart outputs confirm no new risks. Azure SDK adoption keeps deterministic pipelines untouched, and telemetry coverage satisfies the observability gate. Constitution remains fully satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/001-ai-assistant-tools/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── checklists/
```

### Source Code (repository root)

```text
app/
├── src/
│   ├── main/            # Electron main process orchestration, IPC registration
│   ├── preload/         # Typed bridges exposing safe assistant tooling APIs
│   ├── renderer/        # Vue 3 UI, Pinia stores, assistant interaction surfaces
│   └── shared/          # TypeScript models shared across processes
├── tests/
│   ├── services/        # Assistant service integration tests (Vitest)
│   └── e2e/             # Playwright assistant workflow smoke tests
context-repo/
└── .context/pipelines/  # Deterministic Node scripts invoked by safe tools
```

**Structure Decision**: Leverage existing Electron Forge mono-repo layout: assistant orchestration spans `app/src/main`, `app/src/preload`, and `app/src/renderer`, while Azure/Ollama provider plumbing and tool adapters live under `context-repo/.context/pipelines` and shared TypeScript models.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)*  | —          | —                                   |
