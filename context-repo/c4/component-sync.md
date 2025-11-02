# Component Diagram: Context-Sync Spec Kit Integration

```mermaid
%% c4: system=Context-Sync, level=C3, feature=FEAT-001, specs=[SPEC-001, LANGCHAIN-US1, LANGCHAIN-US2, LANGCHAIN-US3]
flowchart TB
  subgraph MainProcess["Electron Main Process"]
    IPC[Speckit IPC Handler :: component :: Electron IPC]
    SERVICE[SpeckitService :: component :: Node.js]
    CONTEXT[ContextService :: component :: Node.js]
    ASSIST_SESS[Assistant Session Manager :: component :: Node.js]
    PATHS[Path Resolution Handler :: component :: IPC]
    TELEMETRY[Telemetry Emitter :: component :: Node.js]
  end

  subgraph Preload["Preload Bridge"]
    BRIDGE[Speckit Preload Bridge :: component :: Context Bridge]
    ASSIST_BRIDGE[Assistant Bridge :: component :: Context Bridge]
  end

  subgraph Renderer["Renderer Workflow"]
    CLIENT[Speckit Client :: component :: IPC Client]
    WORKSTORE[Speckit Store :: component :: Pinia]
    LIBSTORE[Speckit Library Store :: component :: Pinia]
    WIZARD[Speckit Wizard :: component :: Vue 3]
    STATUS[Speckit Pipeline Status :: component :: Vue 3]
    ASSIST_UI[AIAssistantPanel (Chat/Tools) :: component :: Vue 3]
    ASSIST_STORE[assistantStore :: component :: Pinia]
    TOOL_PANEL[ToolPanel :: component :: Vue 3]
    TRANSCRIPT[TranscriptView :: component :: Vue 3]
    RESPONSE[ResponsePane :: component :: Vue 3]
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

  subgraph LangChain["LangChain Orchestration Service"]
    LC_SESS[/assistant/sessions :: endpoint/]
    LC_MSG[/assistant/sessions/{id}/messages :: endpoint/]
    LC_STREAM[/assistant/sessions/{id}/tasks/{taskId}/stream :: SSE/]
    LC_HEALTH[/assistant/health :: endpoint/]
    LC_CAP[/assistant/capabilities :: endpoint/]
  end

  subgraph Repo["Context Repository"]
    STATE[.context cache :: datastore :: File System]
    ENTITIES[contexts/ YAML :: datastore :: File System]
  end

  CLIENT -->|calls| BRIDGE
  ASSIST_UI -->|IPC| ASSIST_BRIDGE
  ASSIST_BRIDGE -->|bootstrap| ASSIST_SESS
  ASSIST_BRIDGE -->|paths| PATHS
  ASSIST_BRIDGE -->|messages| ASSIST_SESS
  ASSIST_BRIDGE -->|stream events| ASSIST_SESS
  ASSIST_BRIDGE -->|health polling| ASSIST_SESS
  ASSIST_BRIDGE -->|capabilities| ASSIST_SESS
  ASSIST_SESS -->|HTTP| LC_SESS
  ASSIST_SESS -->|HTTP| LC_MSG
  ASSIST_SESS -->|SSE| LC_STREAM
  ASSIST_SESS -->|HTTP| LC_HEALTH
  ASSIST_SESS -->|HTTP| LC_CAP
  ASSIST_SESS -->|emit telemetry| TELEMETRY
  PATHS -->|resolve workspace| STATE
  ASSIST_STORE -->|renders| TRANSCRIPT
  ASSIST_STORE -->|renders| RESPONSE
  ASSIST_STORE -->|controls| TOOL_PANEL
  ASSIST_STORE -->|persists session| STATE
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
  ASSIST_UI -->|binds state| ASSIST_STORE
  CLIENT -->|updates previews| LIBSTORE
  WORKSTORE -->|drive wizard| WIZARD
  ASSIST_STORE -->|surface health| ASSIST_UI
  ASSIST_STORE -->|capability flags| TOOL_PANEL
  WORKSTORE -->|publish status| STATUS
  LIBSTORE -->|supply previews| WIZARD
```

## Main Process Components
- **Speckit IPC Handler** – Routes renderer IPC calls to the Spec Kit orchestration APIs with strict argument validation.
- **SpeckitService** – Coordinates fetches, derives pipeline entity metadata, and enforces the sequential validate → build-graph → impact → generate chain.
- **ContextService** – Provides file-system level helpers for validation, graph, impact, and template generation pipelines, including stale lock cleanup.
- **Assistant Session Manager** – Manages LangChain session lifecycle (bootstrap, message dispatch, streaming subscription, capability and health queries) and enforces capability suppression rules.
- **Path Resolution Handler** – Supplies repo root, feature branch, and specification path to session bootstrap ensuring stateless orchestration service receives deterministic context.
- **Telemetry Emitter** – Emits structured events (session.created, message.sent, stream.chunk, health.status, capability.profile.loaded, tool.executed) used for analytics and fallback auditing.

## Preload Bridge
- **Speckit Preload Bridge** – Exposes `window.api.speckit` methods inside the isolated renderer, ensuring only typed operations reach the main process.
- **Assistant Bridge** – Exposes `window.api.assistant` surface for sessions, messages, streaming, health polling, and capability retrieval; converts SSE events into structured render-safe payloads.

## Renderer Workflow Components
- **Speckit Client** – IPC convenience wrapper translating renderer options into orchestrator calls and normalizing paths.
- **Speckit Store** – Pinia store orchestrating entity generation, pipeline status, and stale-cache messaging.
- **Speckit Library Store** – Pinia store providing preview filtering/searching sourced from the cached Spec Kit release.
- **Speckit Wizard** – Multi-step workflow integrating fetch, preview selection, and entity generation.
- **Speckit Pipeline Status** – Vue component surfacing per-stage pipeline results, generated file paths, and linked Spec Kit previews.
- **AIAssistantPanel** – Unified assistant UI with Chat and Tools tabs integrating transcript, response rendering, and tool execution controls.
- **assistantStore** – Central Pinia state for sessions, messages, streaming task envelopes, health status, capability flags, and telemetry correlation IDs.
- **ToolPanel** – Pipeline execution UI reflecting capability availability and surfacing input fields required for tasks (e.g., entity IDs) while guarding disabled operations.
- **TranscriptView** – Renders ordered conversation turns including partial streaming states and fallback markers.
- **ResponsePane** – Shows provenance metadata, cost summaries, and structured tool outputs associated with the active task.

## Context Pipelines
- **speckit-fetch.mjs** – Fetches release-tagged Spec Kit bundles, writing provenance into `.context/state/speckit-fetch.json` and refreshing cache directories.
- **validate.mjs / build-graph.mjs / impact.mjs / generate.mjs** – Sequential pipelines run after entity generation; failures halt later stages and report errors back through the Pinia store.

## Spec Kit SaaS Integration
- **Release Artifacts** – GitHub releases that host Spec Kit markdown/templates; network failures fall back to the prior cached snapshot while the UI advertises stale status after seven days.

## Context Repository Data Stores
- **.context cache** – Holds cached Spec Kit releases and pipeline telemetry, including freshness timestamps.
- **contexts/ YAML** – Holds generated entities updated by the renderer workflow and validated by downstream pipelines.
