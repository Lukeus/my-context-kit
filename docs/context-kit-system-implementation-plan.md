# Context Kit System Implementation Plan

## Objective
Deliver the Context Kit pipeline described in the system specification by layering a Python orchestration service and a new `.context-kit/` repository contract onto the existing Electron + Vue desktop client. The plan focuses on incremental integration with the current TypeScript codebase while preserving released functionality.

## Current-State Assessment
- **Context repository contract** – The app currently reads `.context/` assets (pipelines, schemas, AI config) via `ContextService` and related helpers. 【F:app/src/main/services/ContextService.ts†L1-L120】
- **AI orchestration** – AI sessions are mediated through `assistantSessionManager.ts`, `assistantStore.ts`, and the tool orchestration services under `app/src/main/services`. Conversations are in-memory and depend on provider-specific tool descriptors. 【F:app/src/main/services/assistantSessionManager.ts†L1-L112】
- **Python dependencies** – No FastAPI or Python sidecar exists today; all orchestration happens in Node/Electron.
- **Spec persistence** – Generated assets live in `context-repo/` (YAML specs, prompts). There is no `.context-kit/spec-log/` lifecycle or user story/task scaffolding.

These gaps frame the core implementation tracks: repository schema migration, Python service development, and Electron integration.

## Workstream Overview
1. **Repository Contract & Migration** – Define `.context-kit/` schema, migrate loaders, and provide compatibility tooling.
2. **Python Context Kit Service** – Build the FastAPI + LangChain runtime that consumes `.context-kit/` and exposes the four REST endpoints.
3. **Electron Bridge & IPC** – Extend the preload bridge, main-process services, and renderer stores/components to call the Python service and display outputs.
4. **RAG & Spec Lifecycle** – Persist spec logs, implement promptification, and wire generated artifacts back into the context repo UX.
5. **Multi-Repo Switching & UX Enhancements** – Allow users to register repos, switch contexts, and review historic specs within the app.
6. **Testing, Packaging, and Observability** – Ensure coverage, end-to-end testing, logging, and release automation are in place.

## Detailed Plan

### 1. Repository Contract & Migration
- Create a schema description for `.context-kit/` (YAML + JSON schemas) and ship migration scripts to scaffold from the existing `.context/` directory.
- Update `ContextService`, `ContextBuilderService`, and pipeline executors to read new file locations while retaining backward compatibility via feature flag.
- Add validation utilities to confirm presence of `project.yml`, `stack.yml`, `domains.yml`, `prompts.yml`, `rag.jsonl`, and `spec-log/` at repo load time.
- Document schema in `docs/` and provide CLI helper under `scripts/` to initialize or migrate repos.

### 2. Python Context Kit Service
- Scaffold a `context-kit-service/` package (Poetry or pdm) with FastAPI, LangChain, and storage adapters for `.context-kit/`.
- Implement `/context/inspect`, `/spec/generate`, `/spec/promptify`, and `/codegen/from-spec` endpoints with request validation, streaming support, and error surfaces aligned with Electron expectations.
- Introduce `.context-kit/spec-log/` writers that persist generated specs and prompts as JSON, matching the spec format.
- Containerize (uvicorn + packaging) and expose service bootstrap commands for Electron to spawn/monitor.

### 3. Electron Bridge & IPC Integration
- Extend `app/src/main/services/` with a `ContextKitServiceClient` that manages the Python process lifecycle (spawn, health checks, shutdown).
- Add IPC handlers under `app/src/main/ipc/` to forward renderer requests to the Python service, handling streaming responses and error propagation.
- Update preload bridge (`app/src/preload/`) with type-safe APIs for inspecting context, triggering spec generation, and retrieving prompt sets.
- Enhance Pinia stores (`assistantStore`, new `specStore`) to orchestrate multi-step workflows, manage session IDs, and track service state.

### 4. RAG & Spec Lifecycle Integration
- Replace current prompt generation pipeline with service-backed promptify flows; map Python responses into existing Vue components.
- Surface `.context-kit/rag.jsonl` entries in the UI, providing inspection and refresh tooling.
- Add UX to browse `spec-log/`, open individual specs, and launch code generation targets that feed downstream Git workflows.
- Ensure generated files are written into the repo via existing Git service utilities, with diffs displayed in the Git panel.

### 5. Multi-Repo Switching & UX Enhancements
- Implement a repository registry (persisted under app config) allowing users to select active repos and store `.context-kit/` metadata.
- Update onboarding flow to validate `.context-kit/` presence and optionally bootstrap from templates.
- Introduce dashboards summarizing stack/domain info pulled from the new schema, and integrate assistant tooling with repo-scoped context.
- Add guardrails for agent/tool execution when the Python service is unavailable, including retry and graceful degradation messages.

### 6. Testing, Packaging, and Observability
- Write unit tests for schema loaders, IPC handlers, and Pinia stores; add integration tests that mock the Python endpoints.
- Create service-level tests (pytest) covering FastAPI routes, LangChain flows, and spec-log persistence.
- Extend existing Playwright/E2E suites to cover prompt→spec→code workflows end-to-end.
- Provide telemetry hooks for tool invocations and service calls, wiring into `telemetryWriter.ts` for central logging.
- Update release scripts to bundle the Python service (embedded interpreter or managed dependency) for all platforms.

## Milestones & Dependencies
1. **Milestone A – Contract Ready**: `.context-kit/` schema published, Electron loaders support new layout.
2. **Milestone B – Python Service MVP**: FastAPI app serving inspect + spec generation, integrated smoke tests.
3. **Milestone C – Electron Integration**: IPC + renderer flows wired to the service with end-to-end validation.
4. **Milestone D – RAG & Spec UX**: Spec logs surfaced in UI, promptify + codegen operational.
5. **Milestone E – Multi-Repo + Release**: Repo registry shipped, packaging updated, observability in place.

Each milestone should be merged behind feature flags where feasible to enable incremental testing without disrupting existing `.context/` users.

## Risk Mitigation
- **Process Orchestration**: Wrap Python service lifecycle in a watchdog to restart on crash and provide status indicators in the UI.
- **Schema Drift**: Enforce versioning in `project.yml` and require migrations when the schema changes.
- **Provider Limits**: Implement configurable retry/backoff in both Python and Electron layers to handle Azure OpenAI quota issues.
- **Security & Credentials**: Reuse existing secure credential storage and avoid logging sensitive tokens in service telemetry.

## Success Criteria
- Users can register a repo containing `.context-kit/` assets, inspect metadata, generate specs, promptify them, and optionally create code stubs without leaving the desktop app.
- Specs and prompts are versioned under `.context-kit/spec-log/` and surfaced in-app for review, regeneration, and downstream editing.
- Multi-repo workflows are reliable, with context switching taking <2 seconds and no data leakage between repositories.
- Packaging includes the Python sidecar for Windows/macOS/Linux with automated smoke tests verifying service availability post-install.
