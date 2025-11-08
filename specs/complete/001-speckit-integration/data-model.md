# Data Model: Spec Kit Context Integration

## 1. Spec Kit Cache Snapshot
- **Location**: `context-repo/.context/speckit-cache/<releaseTag>/`
- **Fields**:
  - `releaseTag` (string, required): GitHub release tag fetched.
  - `commit` (string, required): Full commit SHA resolved for the tag.
  - `fetchedAt` (ISO datetime, required): Timestamp of completion.
  - `durationMs` (integer, ≥0): Execution time.
  - `artifacts.docs/templates/memory` (array<string>): Relative paths of cached markdown and templates.
- **Relationships**: Linked to `speckit-fetch.json` summary and drives entity previews.
- **State transitions**: `pending` → `complete`; stale when `now - fetchedAt > 7 days`.

## 2. Spec Kit Fetch Summary (`.context/state/speckit-fetch.json`)
- **Schema**:
  ```json
  {
    "source": {
      "repository": "github/spec-kit",
      "releaseTag": "v0.0.79",
      "commit": "abc123"
    },
    "timing": {
      "startedAt": "ISO",
      "finishedAt": "ISO",
      "durationMs": 54321
    },
    "artifacts": {
      "docs": ["docs/spec-driven.md"],
      "templates": ["templates/feature-spec-template.md"],
      "memory": ["memory/constitution.md"]
    },
    "status": {
      "ok": true,
      "error": null
    }
  }
  ```
- **Validation rules**: `status.ok === true` requires `error` null; arrays must contain at least one entry per category fetched.

## 3. Entity Preview Document
- **Purpose**: View-layer representation of any cached markdown file mapped by entity type (feature, user story, spec, governance).
- **Fields**:
  - `id` (string): Derived from file path, e.g., `docs/spec-driven.md`.
  - `displayName` (string): Title extracted from first heading.
  - `entityType` (enum): `feature`, `userstory`, `spec`, `governance`, `template`.
  - `content` (string): Markdown payload used for render.
  - `source` (object): `releaseTag`, `commit`, `path`.
- **Relationships**: Selected preview can seed Feature/UserStory/Spec YAML through `spec-entity.mjs`.

## 4. Pipeline Verification Report
- **Location**: Generated in memory, surfaced via UI after pipeline runs.
- **Fields**:
  - `batchId` (uuid): Correlates entities processed together.
  - `entities` (array): Each entry -> `{ id, type, status, errors[] }`.
  - `pipelines` (object): { `validate`, `buildGraph`, `impact`, `generate` } with `status` and `logPath`.
- **Lifecycle**: Created after entity generation; persisted in UI state and optional JSON export for audits.

## 5. Lock File (`.context/state/speckit-fetch.lock`)
- **Fields**:
  - `ownerPid` (integer): Process holding the lock.
  - `acquiredAt` (ISO datetime): When fetch started.
- **Rules**: Pipeline must refuse to start if lock exists and `acquiredAt` younger than `5 minutes`; stale locks trigger warning and are removed.

## 6. Renderer State (Pinia store additions)
- **Properties**:
  - `fetchStatus` (enum): `idle`, `running`, `succeeded`, `failed`, `stale`.
  - `lastSummary` (Spec Kit Fetch Summary object).
  - `previewFilters` (set<string>): Active entity-type filters.
- **Persistence**: Stored in memory; optionally synced to local storage for UX continuity.
