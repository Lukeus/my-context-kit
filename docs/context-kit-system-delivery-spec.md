# Context Kit System Delivery Specification

## Purpose
Translate the implementation plan into an actionable specification that engineering, product, and QA teams can execute against while shipping the Context Kit pipeline across desktop, service, and repository layers.

## Scope
- Desktop Electron client (main, preload, renderer) – extend IPC, stores, and UI for Context Kit flows using Material 3 design patterns across all components.
- Python sidecar service – FastAPI + LangChain orchestration for inspect, spec, promptify, and codegen endpoints provisioned within a `uv`-managed virtual environment.
- Repository contract – `.context-kit/` schema, migration tooling, and validation utilities.
- CI/CD & packaging – distribution of the Python sidecar, automated verification, and telemetry coverage.

## Work Breakdown
1. **Schema & Migration Track**
   - Publish `.context-kit/` schema definitions (YAML + JSON Schema) and migration guides from legacy `.context/` assets.
   - Implement loaders/validators in `ContextService` with compatibility flags and automated smoke checks.
   - Deliver CLI (`scripts/context-kit-migrate.ts`) to scaffold and upgrade repositories.
2. **Python Service Track**
   - Scaffold `context-kit-service` package with FastAPI application, LangChain integrations, and configuration model using `uv` for environment creation and dependency management.
   - Implement endpoints: `/context/inspect`, `/spec/generate`, `/spec/promptify`, `/codegen/from-spec`, persisting results to `.context-kit/spec-log/`.
   - Provide packaged runtime (embedded Python or managed interpreter) with health probes and logging hooks, including `uv` bootstrap scripts.
3. **Electron Integration Track**
   - Add `ContextKitServiceClient` to manage Python lifecycle, IPC handlers for service calls, and preload bridge typings, including teardown that deletes the `uv` virtual environment when Electron closes.
   - Document lifecycle hooks so that `before-quit` stops the FastAPI subprocess, runs optional `uv pip freeze` diagnostics, and executes `uv venv remove` (or directory deletion) to prevent lingering resources.
   - Update Pinia stores (`assistantStore`, `specStore`) and Vue components to orchestrate inspect → spec → promptify → codegen flows using Material 3 components (navigation rails, cards, top app bars, banners).
   - Introduce repo registry UX for multi-repo switching, spec browsing, and service status messaging with Material 3 compliant surfaces and motion.
4. **RAG & UX Track**
   - Surface `.context-kit/rag.jsonl` entries, enable refresh/upload workflows, and integrate retrieved context into prompts using Material 3 list, table, and chip patterns.
   - Implement spec log browsing, diff viewing, and generated artifact review within existing Git panel using Material 3 theming.
   - Add guardrails for degraded service mode (retry queue, notifications, offline messaging) surfaced through Material 3 snackbars and banners.
5. **Quality, Observability & Release Track**
   - Expand unit/integration coverage (TypeScript + Python), add Playwright end-to-end path for prompt → code.
   - Instrument telemetry via `telemetryWriter.ts`, capturing endpoint latency, retries, and failures.
   - Update packaging scripts to bundle sidecar, execute smoke tests, and publish artifacts across platforms.

## Milestones & Deliverables
| Milestone | Deliverable | Exit Criteria |
|-----------|-------------|---------------|
| A | Schema baseline | `.context-kit/` schema committed, migration CLI runs on sample repo, loaders pass validation tests. |
| B | Service MVP | FastAPI service responds to inspect + spec endpoints, persisted spec-log artifacts verified via tests. |
| C | Electron integration | IPC bridge operational, renderer flows trigger service calls end-to-end behind feature flag. |
| D | RAG & UX | Spec-log UI, promptify/codegen UX wired, RAG refresh tooling available. |
| E | Release readiness | Cross-platform packages include sidecar, telemetry dashboards configured, regression suite green. |

## Acceptance Criteria
- Repositories containing `.context-kit/` assets load without errors, with migration guidance for legacy layouts.
- Users can generate specs, prompt sets, and code artifacts end-to-end; artifacts persist under `.context-kit/spec-log/` and surface in the UI.
- Multi-repo switching is reliable (<2s load) with clear status when the Python service is offline or restarting.
- CI gates cover TypeScript, Python, and Playwright suites; packaging artifacts pass smoke tests prior to release.

## Dependencies & Assumptions
- Access to Azure OpenAI and LangChain-compatible models remains stable during implementation.
- Desktop app retains existing Git service utilities for writing generated files and displaying diffs.
- Telemetry infrastructure (`telemetryWriter.ts`) is available for reuse and extension.
- `uv` remains available on supported platforms, or installers bundle it alongside the Electron runtime.

## Open Questions
- Final decision on embedded Python vs. managed interpreter distribution approach.
- Required UX copy and localization for new Context Kit flows.
- Long-term storage strategy for large `spec-log/` histories (archival, pruning, or sync options).
- Additional validation confirming `uv` environment teardown hooks cover crash recovery scenarios.

