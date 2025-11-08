# Implementation Plan: Code Quality & Design System Cleanup

**Branch**: `001-code-cleanup` | **Date**: 2025-11-08 | **Spec**: `specs/001-code-cleanup/spec.md`
**Input**: Feature specification from `specs/001-code-cleanup/spec.md`

## Summary
Centralize duplicated time utilities, enforce Material 3 semantic tokens, archive stale docs with manifest + CHANGELOG consolidation, unify error handling & telemetry error codes, and remove obsolete Tailwind backup config. Non-functional additions: performance (<2s scripts), accessibility (contrast audit), observability (`errorCode`, violation counts). Design-system packaging explicitly deferred.

## Technical Context
**Language/Version**: TypeScript 5.x strict, Node.js 20 LTS, Electron Forge + Vite  
**Primary Dependencies**: Vue 3 (Composition API), Pinia, Tailwind v4 (Material 3 tokens), Zod, simple-git, Vitest, Playwright, pnpm  
**Storage**: Git + filesystem (context-repo); no DB changes  
**Testing**: Vitest (unit), Playwright (e2e), custom verification scripts (token & duplicate scan), snapshot API stability for stores  
**Target Platform**: Desktop (Win/macOS/Linux)  
**Project Type**: Electron multi-process w/ clean architecture layers  
**Performance Goals**: Verification scripts cold <2000ms; warm <1000ms; render p95 unchanged (<16ms baseline panel render)  
**Constraints**: Maintain context isolation; no new global state; semantic token compliance ≥95%; errorCode coverage 100% of changed scope; build time impact <1%  
**Scale/Scope**: Refactor ~65 color occurrences; remove ~2 duplicate time functions; archive ≥30 docs; add ≤4 scripts; adjust telemetry; add snapshot diff artifact.

**Note on Time Helpers**: Canonical time formatting helper is located at `app/src/renderer/services/assistant/timeHelpers.ts`. All duration/timestamp formatting should use functions exported from this module to ensure consistency and maintainability.

## Constitution Check (Initial)
1. Git-Versioned Source of Truth: Manifest + C4 updates committed; scripts versioned.  
2. Deterministic Pipelines Before AI: All scripts pure regex/timing; no AI.  
3. Unified TypeScript & Build Discipline: Strict TS unchanged; pnpm only; extensionless imports.  
4. Validation & Impact Gatekeeping: New CI jobs (quality.yml) running scripts + snapshot tests; impact minimal (internal).  
5. Secure Desktop Boundary & Observability: No new IPC boundaries; telemetry enriched safely.  
Clean Architecture: Adapter stays in renderer utils; IPC handlers remain delegation-only.

## Project Structure
### Documentation
```text
specs/001-code-cleanup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── tasks.md
└── checklists/
```
### Source Code (targeted)
```text
app/src/renderer/services/assistant/timeHelpers.ts
app/src/renderer/utils/errorNormalizationAdapter.ts (NEW)
app/src/shared/designTokens.ts (NEW schemas)
app/src/shared/errorNormalization.ts (NEW schemas)
scripts/verify-design-tokens.ts (NEW)
scripts/scan-duplicate-time-helpers.ts (NEW)
scripts/measure-verification-scripts.ts (NEW)
scripts/contrast-audit.ts (NEW placeholder)
scripts/check-store-api-stability.ts (NEW)
tailwind.config.ts (active)
docs/archive/ (NEW)
context-repo/c4/component.mmd (update)
```
**Structure Decision**: Minimal additive scripts & shared types; no new package introduced; design-system packaging deferred to separate future feature.

## Complexity Tracking
| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (none) | N/A | N/A |

## Post-Design Constitution Re-Check
All gates reaffirmed after adding NFR + tasks:
- Principle I: Archive manifest + C4 diagram update planned via T055; all artifacts Git-versioned.
- Principle II: Scripts deterministic; performance harness ensures reproducible timing.
- Principle III: No layering violations; adapter in renderer; IPC tasks (T073) enforce delegation-only.
- Principle IV: New snapshot stability (T063, T074) & verification scripts integrated into quality.yml before merge.
- Principle V: No secrets added; contrast audit offline; telemetry fields additive.
Deferred packaging explicitly documented—avoids expanding layering this feature.

## Outstanding TODOs
// TODO(ci-integration): Implement `.github/workflows/quality.yml` jobs (scripts + snapshot + contrast).
// TODO(accessibility): Implement contrast-audit logic & record results.
// TODO(performance): Add timing harness output to `research.md` baseline section.
// TODO(baseline-hash): Populate baseline commit hash + raw color count in `research.md`.

