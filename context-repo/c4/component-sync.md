# Component Diagram: Context-Sync Spec Kit Integration

<!-- Change Log: Updated 2025-11-03 (T081) adding UnifiedAssistant, SidecarClientAdapter, ToolClassification module, GatingArtifactReader, EmbeddingsPipelineScript, and FR-039 & FR-040 references. -->

```mermaid
%% c4: system=Context-Sync, level=C3, feature=FEAT-001, specs=[SPEC-001, LANGCHAIN-US1, LANGCHAIN-US2, LANGCHAIN-US3, FR-039, FR-040]
flowchart TB
  subgraph MainProcess["Electron Main Process"]
    IPC[Speckit IPC Handler :: component :: Electron IPC]
    SERVICE[SpeckitService :: component :: Node.js]
    CONTEXT[ContextService :: component :: Node.js]
    ASSIST_SESS[Assistant Session Manager / SidecarClientAdapter :: component :: Node.js]
    PATHS[Path Resolution Handler :: component :: IPC]
    TELEMETRY[Telemetry Emitter :: component :: Node.js]
    GATE_READ[GatingArtifactReader :: component :: Node.js]
    EMBED_SCRIPT[EmbeddingsPipelineScript :: component :: Node.js]
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
    ASSIST_UI[UnifiedAssistant (Chat/Tools/Approvals) :: component :: Vue 3]
    ASSIST_STORE[assistantStore :: component :: Pinia]
    TOOL_PANEL[ToolPanel :: component :: Vue 3]
    TRANSCRIPT[TranscriptView :: component :: Vue 3]
    RESPONSE[ResponsePane :: component :: Vue 3]
    CLASSIFICATION[ToolClassification Module :: component :: TS]
    GATE_VIEW[Gating Status Badge :: component :: Vue 3]
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

  subgraph Sidecar["Python Sidecar Orchestration Service"]
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
  TELEMETRY -->|write gating fields| GATE_READ
  EMBED_SCRIPT -->|checksum emit| TELEMETRY
  EMBED_SCRIPT -->|vector artifact| STATE
  PATHS -->|resolve workspace| STATE
  ASSIST_STORE -->|renders| TRANSCRIPT
  ASSIST_STORE -->|renders| RESPONSE
  ASSIST_STORE -->|controls| TOOL_PANEL
  ASSIST_STORE -->|classification| CLASSIFICATION
  ASSIST_STORE -->|gating status| GATE_VIEW
  ASSIST_STORE -->|persists session| STATE
  GATE_READ -->|mode decision| ASSIST_STORE
  CLASSIFICATION -->|approval policy| ASSIST_UI
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

## Main Process Components (Updated)
- **Speckit IPC Handler** – Routes renderer IPC calls to the Spec Kit orchestration APIs with strict argument validation.
- **SpeckitService** – Coordinates fetches, derives pipeline entity metadata, and enforces the sequential validate → build-graph → impact → generate chain.
- **ContextService** – Provides file-system helpers for validation, graph, impact, and template generation pipelines, including stale lock cleanup.
- **Assistant Session Manager / SidecarClientAdapter** – Manages Python Sidecar session lifecycle (bootstrap, message dispatch, streaming subscription, capability & health queries), enforces capability suppression rules, injects classification metadata (FR-032a), and relays checksum and gating telemetry.
- **Path Resolution Handler** – Supplies repo root, feature branch, and specification path to session bootstrap ensuring stateless orchestration service receives deterministic context.
- **Telemetry Emitter** – Emits structured events (session.created, message.sent, stream.chunk, health.status, capability.profile.loaded, tool.executed, checksum.emitted) used for analytics and fallback auditing.
- **GatingArtifactReader** – Reads `gate-status.json` to determine classificationEnforced, sidecarOnly, checksumMatch, and retrieval activation flags; exposes read-only gating snapshot to renderer.
- **EmbeddingsPipelineScript** – Deterministic vector builder emitting sorted embeddings + SHA-256 checksum telemetry (FR-039) and updating gating artifact (FR-040).

## Preload Bridge
- **Speckit Preload Bridge** – Exposes `window.api.speckit` methods inside the isolated renderer, ensuring only typed operations reach the main process.
- **Assistant Bridge** – Exposes `window.api.assistant` surface for sessions, messages, streaming, health polling, capability retrieval, gating snapshot; converts SSE events into structured render-safe payloads.

## Renderer Workflow Components (Updated)
- **Speckit Client** – IPC convenience wrapper translating renderer options into orchestrator calls and normalizing paths.
- **Speckit Store** – Pinia store orchestrating entity generation, pipeline status, and stale-cache messaging.
- **Speckit Library Store** – Pinia store providing preview filtering/searching sourced from the cached Spec Kit release.
- **Speckit Wizard** – Multi-step workflow integrating fetch, preview selection, and entity generation.
- **Speckit Pipeline Status** – Vue component surfacing per-stage pipeline results, generated file paths, and linked Spec Kit previews.
- **UnifiedAssistant** – Consolidated chat, tool execution, approvals, and gating/status surfaces replacing legacy panel; renders classification badges and gated action tooltips.
- **assistantStore** – Central Pinia state for sessions, messages, streaming task envelopes, health status, capability flags, gating fields, and telemetry correlation IDs.
- **ToolPanel** – Pipeline execution UI reflecting capability availability and surfacing input fields required for tasks while guarding disabled operations.
- **TranscriptView** – Renders ordered conversation turns including partial streaming states and fallback markers.
- **ResponsePane** – Shows provenance metadata, cost summaries, and structured tool outputs associated with the active task.
- **ToolClassification Module** – Applies safety class (readOnly/mutating/destructive) policy checks prior to enqueue; enforces destructive reason length (FR-032a) and approval workflows.
- **Gating Status Badge** – Displays current gating state (classification enforced, sidecar only mode, retrieval enabled, checksumMatch) with tooltip explanations.

## Context Pipelines
- **speckit-fetch.mjs** – Fetches release-tagged Spec Kit bundles, writing provenance into `.context/state/speckit-fetch.json` and refreshing cache directories.
- **validate.mjs / build-graph.mjs / impact.mjs / generate.mjs** – Sequential pipelines run after entity generation; failures halt later stages and report errors back through the Pinia store.
- **build-embeddings.mjs** – Deterministically generates embeddings with stable ordering producing checksum used to gate retrieval activation.

## Spec Kit SaaS Integration
- **Release Artifacts** – GitHub releases that host Spec Kit markdown/templates; network failures fall back to the prior cached snapshot while the UI advertises stale status after seven days.

## Context Repository Data Stores
- **.context cache** – Holds cached Spec Kit releases and pipeline telemetry, including freshness timestamps and gating snapshot.
- **contexts/ YAML** – Holds generated entities updated by the renderer workflow and validated by downstream pipelines.

## Pending Enhancements
- Telemetry ingestion tests for coverage across session, message, stream, tool, health, capability, checksum, and gating state transitions.
- Add performance harness for embeddings build duration and gating artifact refresh latency (T028L/T087) – TODO.
