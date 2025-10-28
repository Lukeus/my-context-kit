# Research: Spec Kit Context Integration

## Decision: Pin Spec Kit fetches to release tags
- **Outcome**: Default to the latest GitHub release tag (e.g., `v0.0.79`) and resolve to its commit SHA before caching.
- **Rationale**: Pinning guarantees deterministic cache contents even if the default branch updates mid-fetch and supports offline replays while preserving provenance in `.context/state/speckit-fetch.json`.
- **Alternatives considered**:
  - **Track `main` branch HEAD**: Rejected due to non-deterministic snapshots and higher drift risk.
  - **Archive downloads**: Skipped because `git clone --depth 1 --branch <tag>` keeps history metadata we need for provenance without larger payloads.

## Decision: Handle concurrency via fetch mutex
- **Outcome**: `speckit-fetch.mjs` acquires a file-based lock in `.context/state/speckit-fetch.lock` to serialize fetches; UI shows "Fetch in progress" when lock exists.
- **Rationale**: Prevents overlapping clones from corrupting the cache and avoids race conditions when the renderer triggers rapid successive fetches.
- **Alternatives considered**:
  - **Allow concurrent runs**: Would produce partial or conflicting caches.
  - **Process-level singleton only**: Insufficient because multiple app windows or CLI invocations could spawn separate processes.

## Decision: Offline fallback strategy
- **Outcome**: When GitHub is unreachable, the pipeline surfaces a structured error with the timestamp of the last successful fetch and leaves the prior cache intact.
- **Rationale**: Aligns with Edge Case requirements for unreachable remotes while keeping Context-Sync usable offline.
- **Alternatives considered**:
  - **Purge stale cache on failure**: Rejected; would remove usable context and violate Git-versioned source of truth guarantees.

## Decision: Observability sinks
- **Outcome**: Log every fetch via `logger` (`service: 'SpeckitService', method: 'fetchSpecKit'`) and persist summary JSON (`.context/state/speckit-fetch.json`) consumed by the renderer.
- **Rationale**: Satisfies Constitution Article V and success criteria by giving release managers auditable telemetry and UI-friendly metadata.
- **Alternatives considered**:
  - **Console logging only**: Not durable and fails to meet observability requirements.

## Decision: Markdown rendering approach
- **Outcome**: Use existing markdown renderer pipeline (marked + Tailwind typography) with light theme adjustments; no additional runtime dependency required.
- **Rationale**: Keeps bundle size controlled and reuses established rendering path, ensuring consistent styling with existing entity previews.
- **Alternatives considered**:
  - **Integrate new renderer library**: Unnecessary complexity and potential styling divergence.

## Decision: Pipeline regression coverage
- **Outcome**: Add Vitest unit tests for `SpeckitService.fetch` mocking child process execution, and Playwright E2E scenarios covering fetch success, fetch failure, and stale-cache blocking.
- **Rationale**: Aligns with constitutional validation gates and guarantees pipeline regressions surface before release.
- **Alternatives considered**:
  - **Manual QA only**: Inadequate to guard deterministic behavior mandates.
