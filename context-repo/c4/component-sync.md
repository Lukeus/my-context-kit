# Component Diagram: Context-Sync Spec Kit Integration

```mermaid
%% c4: system=Context-Sync, level=C3, feature=FEAT-001, specs=[SPEC-001]
flowchart TB
  subgraph MainProcess["Electron Main Process"]
    IPC[Speckit IPC Handler :: component :: Electron IPC]
    SERVICE[SpeckitService :: component :: Node.js]
    CONTEXT[ContextService :: component :: Node.js]
  end

  subgraph Preload["Preload Bridge"]
    BRIDGE[Speckit Preload Bridge :: component :: Context Bridge]
  end

  subgraph Renderer["Renderer Workflow"]
    CLIENT[Speckit Client :: component :: IPC Client]
    WORKSTORE[Speckit Store :: component :: Pinia]
    LIBSTORE[Speckit Library Store :: component :: Pinia]
    WIZARD[Speckit Wizard :: component :: Vue 3]
    STATUS[Speckit Pipeline Status :: component :: Vue 3]
  end

  subgraph Pipelines["Context Pipelines"]
    FETCH[speckit-fetch.mjs :: container :: Node.js]
    VALIDATE[validate.mjs :: container :: Node.js]
    GRAPH[build-graph.mjs :: container :: Node.js]
    IMPACT[impact.mjs :: container :: Node.js]
    GENERATE[generate.mjs :: container :: Node.js]
  end

  subgraph SpecKit["Spec Kit SaaS"]
    RELEASES[Release Artifacts :: external :: GitHub Releases]
  end

  subgraph Repo["Context Repository"]
    STATE[.context cache :: datastore :: File System]
    ENTITIES[contexts/ YAML :: datastore :: File System]
  end

  CLIENT -->|calls| BRIDGE
  BRIDGE -->|IPC| IPC
  IPC -->|delegates| SERVICE
  SERVICE -->|coordinates repo IO| CONTEXT
  SERVICE -->|triggers| FETCH
  SERVICE -->|triggers| VALIDATE
  SERVICE -->|triggers| GRAPH
  SERVICE -->|triggers| IMPACT
  SERVICE -->|triggers| GENERATE
  FETCH -->|download release| RELEASES
  FETCH -->|hydrate cache| STATE
  CONTEXT -->|reads/writes| STATE
  CONTEXT -->|reads/writes| ENTITIES
  VALIDATE -->|validate entities| ENTITIES
  GRAPH -->|analyze relationships| ENTITIES
  IMPACT -->|compute blast radius| ENTITIES
  GENERATE -->|update prompts| STATE
  GENERATE -->|regenerate YAML| ENTITIES
  CLIENT -->|updates state| WORKSTORE
  CLIENT -->|updates previews| LIBSTORE
  WORKSTORE -->|drive wizard| WIZARD
  WORKSTORE -->|publish status| STATUS
  LIBSTORE -->|supply previews| WIZARD
```

## Main Process Components
- **Speckit IPC Handler** – Routes renderer IPC calls to the Spec Kit orchestration APIs with strict argument validation.
- **SpeckitService** – Coordinates fetches, derives pipeline entity metadata, and enforces the sequential validate → build-graph → impact → generate chain.
- **ContextService** – Provides file-system level helpers for validation, graph, impact, and template generation pipelines, including stale lock cleanup.

## Preload Bridge
- **Speckit Preload Bridge** – Exposes `window.api.speckit` methods inside the isolated renderer, ensuring only typed operations reach the main process.

## Renderer Workflow Components
- **Speckit Client** – IPC convenience wrapper translating renderer options into orchestrator calls and normalizing paths.
- **Speckit Store** – Pinia store orchestrating entity generation, pipeline status, and stale-cache messaging.
- **Speckit Library Store** – Pinia store providing preview filtering/searching sourced from the cached Spec Kit release.
- **Speckit Wizard** – Multi-step workflow integrating fetch, preview selection, and entity generation.
- **Speckit Pipeline Status** – Vue component surfacing per-stage pipeline results, generated file paths, and linked Spec Kit previews.

## Context Pipelines
- **speckit-fetch.mjs** – Fetches release-tagged Spec Kit bundles, writing provenance into `.context/state/speckit-fetch.json` and refreshing cache directories.
- **validate.mjs / build-graph.mjs / impact.mjs / generate.mjs** – Sequential pipelines run after entity generation; failures halt later stages and report errors back through the Pinia store.

## Spec Kit SaaS Integration
- **Release Artifacts** – GitHub releases that host Spec Kit markdown/templates; network failures fall back to the prior cached snapshot while the UI advertises stale status after seven days.

## Context Repository Data Stores
- **.context cache** – Holds cached Spec Kit releases and pipeline telemetry, including freshness timestamps.
- **contexts/ YAML** – Holds generated entities updated by the renderer workflow and validated by downstream pipelines.
