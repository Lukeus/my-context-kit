# Implementation Plan: Spec Kit Context Generator Integration

**Branch**: `feature/spec-kit` | **Date**: 2025-10-28 | **Spec**: NEEDS CLARIFICATION (`/specs/main/spec.md` missing)
**Input**: Feature specification from `/specs/main/spec.md` once authored for this initiative.

## Summary

Extend Context-Sync so the Speckit workflow can pull authoritative documentation and templates from `github/spec-kit` via the `#fetch` command pipeline, persist the fetched assets inside `context-repo`, and expose a guided UI flow that translates the remote content into YAML entities. The work spans a deterministic fetch-and-cache pipeline, main-process IPC services for repository hydration, renderer updates to drive the new generator, and validation coverage that guarantees generated entities still pass schema, impact, and prompt pipelines.

## Technical Context

**Language/Version**: TypeScript 5.3.x (Electron Forge bundle), Node.js 22 LTS (per `app/package.json`)  
**Primary Dependencies**: Electron Forge 7, Vue 3 (Composition API), Pinia, TailwindCSS, `simple-git`, `execa`, Spec Kit CLI templates (`github/spec-kit`)  
**Storage**: Git-versioned context repository at `context-repo/` (YAML entities + generated prompts)  
**Testing**: `vitest` unit suites, `playwright` E2E flows, pipeline smoke scripts under `.context/pipelines` (validate, build-graph, impact, generate)  
**Target Platform**: Cross-platform desktop (Windows/macOS/Linux) packaged by Electron Forge  
**Project Type**: Desktop (Electron main + preload + Vue renderer) with context-repo automation  
**Performance Goals**: NEEDS CLARIFICATION (target fetch latency + UI feedback thresholds not yet captured)  
**Constraints**: pnpm-only workflows, strict TypeScript with `moduleResolution: "Bundler"`, context isolation enforced, pipelines must remain idempotent, offline-ready operation after initial fetch  
**Scale/Scope**: Single context repository per workspace; must support multi-feature entity generation without manual YAML editing

## Constitution Check

1. **I. Git-Versioned Source of Truth**: New fetch-derived assets (Spec Kit docs, templates, pipeline snapshots) will land under `context-repo/.context/speckit-cache/` with commits authored by the app’s git integration. Entity generation remains mediated through existing `spec-entity.mjs`, so all derived YAML files stay within `contexts/` and are diffable. C4 updates are anticipated if Spec Kit introduces new architectural viewpoints—flagged as NEEDS CLARIFICATION pending spec authoring. ✅ Planned compliance, awaiting confirmation on C4 deltas.
2. **II. Deterministic Pipelines Before AI**: Introduce a `speckit-fetch.mjs` pipeline that clones or updates a pinned Spec Kit release tag, normalises outputs, and exposes JSON summaries for UI consumption. Pipeline runs before any AI-driven generation, feeds cached files into existing `speckit.mjs`, and is covered by CLI smoke tests. ✅ Deterministic plan with git-sha pinning to remove network variance.
3. **III. Unified TypeScript & Build Discipline**: Renderer additions live in Vue SFCs with `<script setup lang="ts">`, main-process updates extend `SpeckitService`, and all bundling stays under Vite alias rules (`@/*`, `~main/*`). No new runtime dependencies without pnpm lockfile updates. Strict lint/typecheck will gate the merge. ✅ Compliant.
4. **IV. Validation & Impact Gatekeeping**: Entity generation automatically re-triggers `validate.mjs`, `build-graph.mjs`, `impact.mjs`, and `generate.mjs`. Plan adds Playwright coverage for the wizard flow and Vitest for the IPC surface. Impact reports for generated entities will be surfaced in the UI prior to commit. ✅ Controls defined.
5. **V. Secure Desktop Boundary & Observability**: Fetch pipeline executes in a child process with controlled env vars, no secrets baked in. Preload exposes only typed IPC methods; no nodeIntegration changes. Structured logs from fetch pipeline will route through existing telemetry writer (NEEDS CLARIFICATION on log sink location). ⚠ NEEDS CLARIFICATION: confirm observability target for fetch metrics and retries.

Gate status: ✅ Proceed, with observability target + C4 deltas captured as Phase 0 research items.

## Project Structure

### Documentation (this feature)

```text
specs/main/
├── plan.md              # Implementation blueprint (this file)
├── research.md          # Phase 0 decisions for Spec Kit integration
├── data-model.md        # Phase 1 entity contracts derived from spec-kit content
├── quickstart.md        # Operator instructions for running the new generator
└── contracts/
	└── speckit-fetch.openapi.yaml   # Renderer ↔ main ↔ pipeline contract (planned)
```

### Source Code Touch Points

```text
app/
├── src/main/
│   ├── ipc/handlers/speckit.handlers.ts       # Register fetch + entity hydration IPC
│   ├── services/SpeckitService.ts             # Execute fetch pipeline, expose status
│   └── utils/observability/                   # NEEDS CLARIFICATION: log routing hook
├── src/preload/index.d.ts                     # Extend typed API bridge
└── src/renderer/
	├── components/SpeckitWizard.vue           # New "Fetch & Populate" step + progress UI
	└── stores/speckitStore.ts                 # Workflow state, fetch status, error handling

context-repo/
├── .context/pipelines/
│   ├── speckit-fetch.mjs                      # New deterministic fetch/cache pipeline
│   └── speckit.mjs                            # Leverage cached templates for generation
└── generated/prompts/                         # Existing prompt artifacts remain unchanged

tests/
├── speckit/
│   ├── speckitFetch.spec.ts                   # Vitest coverage for service contract
│   └── speckit-wizard.e2e.spec.ts             # Playwright flow validation
└── setup.ts                                   # Extend mocks for fetch pipeline
```

**Structure Decision**: Reuse the existing Electron/Vue monorepo while adding a dedicated `speckit-fetch` pipeline and corresponding UI workflow. No new projects introduced; all changes stay within current main/preload/renderer separation and the shared context-repo.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| _None_    | —          | —                                     |
ios/ or android/
