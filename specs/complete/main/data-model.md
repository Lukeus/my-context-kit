# Data Model: Spec Kit Context Generator Integration

## 1. Speckit Fetch State (JSON document)
- **Location**: `context-repo/.context/state/speckit-fetch.json`
- **Purpose**: Persist metadata about the most recent Spec Kit sync so the UI can render status without re-querying the remote repository.
- **Shape**:
  ```json
  {
    "source": {
      "repository": "github/spec-kit",
      "releaseTag": "v0.0.79",
      "commit": "<sha>"
    },
    "timing": {
      "startedAt": "ISO-8601",
      "finishedAt": "ISO-8601",
      "durationMs": 12345
    },
    "artifacts": {
      "docs": ["docs/spec-driven.md", "docs/README.md"],
      "templates": ["templates/feature-spec-template.md", "templates/implementation-plan-template.md"],
      "memory": ["memory/constitution.md"]
    },
    "status": {
      "ok": true,
      "error": null
    }
  }
  ```
- **Validation**: JSON schema (to be added) enforces string formats and required keys.

## 2. Cached Spec Kit Asset (filesystem)
- **Location**: `context-repo/.context/speckit-cache/<release>/...`
- **Purpose**: Holds the fetched repository content used to seed entity generation and pipelines.
- **Key directories**:
  - `docs/`: Markdown sources surfaced in the UI for browsing.
  - `templates/`: Handlebars templates referenced by `speckit.mjs`.
  - `memory/`: Constitutional guidance imported into wizard context.
- **Lifecycle**: Pipeline prunes old releases when a new tag is fetched to maintain determinism.

## 3. Generated Feature Entities (`contexts/features/*.yaml`)
- **Additions**: Feature YAML emitted by `spec-entity.mjs` now include a `source` block documenting the Spec Kit fetch.
  ```yaml
  source:
    type: speckit
    repository: github/spec-kit
    releaseTag: v0.0.79
    specFile: docs/spec-driven.md
  ```
- **Relationships**: `requires` may reference new services (e.g., `svc-speckit-cli`) that must be created if absent.

## 4. Generated User Story Entities (`contexts/userstories/*.yaml`)
- **Augmentation**: When Spec Kit provides user story seeds, the pipeline populates `origin` metadata.
  ```yaml
  origin:
    extractor: speckit-fetch
    templateId: "docs/spec-driven.md#user-stories"
  ```
- **Validation**: Existing `userstory.schema.json` accepts arbitrary metadata; confirm before implementation.

## 5. Service / Package Entities
- **Service**: Introduce `svc-speckit-sync.yaml` under `contexts/services/` representing the fetch pipeline as a service.
  - Fields: `id`, `name`, `owner`, `interfaces` (CLI command), `dependencies` (git, node).
- **Package**: If the UI delivers a reusable package, add `pkg-speckit-templates.yaml` capturing template assets.

## 6. Prompt Generation Impacts
- **Templates**: `generate.mjs` consumes the enriched metadata to inject provenance notes into prompts, ensuring AI runs know the source of truth.
- **Fields added**: `prompts.contextRefs` extends to include cached Spec Kit doc paths.

## 7. Tests & Mocks
- **Mock state file**: Add `tests/mocks/spec-kit/speckit-fetch.json` mirroring the state schema for deterministic tests.
- **Pipeline fixtures**: Store trimmed Spec Kit excerpts under `tests/services/speckit/fixtures/` to avoid hitting GitHub during tests.
