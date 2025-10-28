ios/ or android/
# Implementation Plan: Spec Kit Context Integration

**Branch**: `001-speckit-integration` | **Date**: 2025-10-28 | **Spec**: specs/001-speckit-integration/spec.md
**Input**: Feature specification from `/specs/001-speckit-integration/spec.md`

## Summary

Integrate Spec Kit (`github/spec-kit`) as the canonical context engine inside Context-Sync. Deliver a deterministic fetch pipeline that caches Spec Kit releases under `context-repo/.context`, render markdown artifacts in the UI as entity previews, and drive entity generation through existing pipelines so validation, graph, impact, and prompt checks remain reliable. Work spans Electron IPC services, renderer UX, and pipeline automation.

## Technical Context

**Language/Version**: TypeScript 5.3.x (Electron Forge bundle), Node.js 22 LTS  
**Primary Dependencies**: Electron Forge 7, Vue 3 (Composition API), Pinia, TailwindCSS, simple-git, execa, AJV, Handlebars, Cytoscape  
**Storage**: Git-versioned workspace (`context-repo/` YAML + `.context` cache on filesystem)  
**Testing**: Vitest unit suites, Playwright E2E workflows, context pipelines (`validate.mjs`, `build-graph.mjs`, `impact.mjs`, `generate.mjs`)  
**Target Platform**: Cross-platform desktop (Electron main/preload/renderer)  
**Project Type**: Desktop monorepo integrating Electron app with context-repo pipelines  
**Performance Goals**: 95% of fetches complete ≤90s; renderer loads selected markdown ≤1s; pipeline run time stays ≤30s per batch  
**Constraints**: pnpm-only installs, Vite bundling with `moduleResolution: "Bundler"`, context isolation enforced, cache refresh required if older than 7 days, offline-ready after initial fetch  
**Scale/Scope**: Single context repo per workspace with dozens of Spec Kit documents per release, supporting multiple concurrent feature generations

## Constitution Check

1. **I. Git-Versioned Source of Truth**: Spec Kit cache lives in `context-repo/.context/speckit-cache/<tag>` with fetch summaries committed. Generated YAML still flows through pipelines, and C4 diagrams (`context-sync-mvp.md`, component views) will reflect the new SaaS dependency.
2. **II. Deterministic Pipelines Before AI**: Implement `speckit-fetch.mjs` with pinned release tags or commits, normalized output directories, and JSON results. UI only invokes AI/automation after pipelines confirm success.
3. **III. Unified TypeScript & Build Discipline**: All changes stay within the existing TypeScript + Vite setup; no deviation from pnpm, aliases, or context isolation boundaries.
4. **IV. Validation & Impact Gatekeeping**: Post-generation workflow re-runs validation, graph, impact, and prompt pipelines automatically, with UI surfacing statuses. Vitest and Playwright suites expanded to cover critical flows.
5. **V. Secure Desktop Boundary & Observability**: Fetch runs in main-process child processes; structured logs written through `logger` and mirrored to `.context/state/speckit-fetch.json`. Renderer only consumes typed preload APIs; no secrets or nodeIntegration.

All gates satisfied; proceed with research/design phases without mitigations.

## Project Structure

### Documentation (this feature)

```text
specs/001-speckit-integration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── speckit-fetch.openapi.yaml
└── tasks.md  # generated via /speckit.tasks
```

### Source Code (repository root)

```text
app/
├── src/main/
│   ├── ipc/handlers/speckit.handlers.ts
│   ├── services/SpeckitService.ts
│   └── utils/logger.ts
├── src/preload/index.d.ts
└── src/renderer/
    ├── components/SpeckitWizard.vue
    └── stores/speckitStore.ts

context-repo/
├── .context/pipelines/
│   ├── speckit-fetch.mjs
│   ├── speckit.mjs
│   └── validate.mjs
├── .context/state/speckit-fetch.json
├── c4/context-sync-mvp.md
└── generated/prompts/

tests/
├── speckit/speckitFetch.spec.ts
├── speckit/speckit-wizard.e2e.spec.ts
└── setup.ts
```

**Structure Decision**: Extend existing Electron app, preload bridge, renderer UI, and context-repo pipelines; no new packages or services outside current architecture.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| _None_    | —          | —                                     |
