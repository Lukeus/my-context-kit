# Context-Sync MVP Architecture

This diagram shows the container-level architecture (C2) of the Context-Sync desktop application.

<!-- Change Log: Updated 2025-11-03 (T081) to include UnifiedAssistant component, Python Sidecar (FastAPI) replacing LangChain label, deterministic embeddings pipeline (FR-039), gating artifact (FR-040), checksum telemetry flow, and future RAG enablement TODO. -->

```mermaid
%% c4: system=Context-Sync, level=C2, feature=FEAT-001, specs=[SPEC-001, LANGCHAIN-US1, LANGCHAIN-US2, LANGCHAIN-US3, FR-039, FR-040]
%% NOTE: FR-039 deterministic embeddings & FR-040 gating artifact integrated; TODO:RAG_ENABLE pending checksumMatch=true via two consecutive CI runs.
flowchart TB
  subgraph Desktop["Context-Sync Desktop App"]
    UI[Electron Main Process :: container :: Node.js + Electron]
    SERVICE[Speckit Service :: component :: Node.js]
    RENDERER[Vue Renderer :: container :: Vue 3 + Tailwind]
    STORE[Pinia State (assistantStore, contextStore) :: component :: Pinia]
    EDITOR[YAML Editor :: component :: CodeMirror]
    BRIDGE[Assistant Bridge :: component :: Preload IPC]
    UNIFIED[UnifiedAssistant :: component :: Vue 3]
  end
  
  subgraph External["External Systems"]
    GIT[Git VCS :: external :: Git CLI]
    REPO[(Context Repository :: datastore :: File System)]
    GITHUB[GitHub :: external :: GitHub API]
  end

  subgraph SpecKitSaaS["Spec Kit SaaS"]
    SPECKIT[Spec Kit Releases :: external :: GitHub Releases API]
  end

  subgraph Sidecar["Python Sidecar Orchestration Service (FastAPI)"]
    LC_SESS[/assistant/sessions :: endpoint/]
    LC_MSG[/assistant/sessions/{id}/messages :: endpoint/]
    LC_STREAM[/assistant/sessions/{id}/tasks/{taskId}/stream :: SSE/]
    LC_HEALTH[/assistant/health :: endpoint/]
    LC_CAP[/assistant/capabilities :: endpoint/]
  end
  
  subgraph Pipelines["Context Pipelines"]
    FETCH[speckit-fetch.mjs :: container :: Node.js]
    VALIDATE[validate.mjs :: container :: Node.js]
    GRAPH[build-graph.mjs :: container :: Node.js]
    IMPACT[impact.mjs :: container :: Node.js]
    GENERATE[generate.mjs :: container :: Node.js]
    EMBED[build-embeddings.mjs :: script :: Deterministic Embeddings]
  end

  subgraph Gating["Release & Safety Gates"]
    GATE[gate-status.json :: artifact :: Gating Status]
    CHECKSUM[checksum telemetry :: event :: SHA-256]
  end

  RENDERER -->|IPC| UI
  RENDERER -->|uses| BRIDGE
  RENDERER -->|renders| UNIFIED
  BRIDGE -->|session bootstrap| LC_SESS
  BRIDGE -->|messages| LC_MSG
  BRIDGE -->|stream events| LC_STREAM
  BRIDGE -->|health polling| LC_HEALTH
  BRIDGE -->|capability profile| LC_CAP
  RENDERER -->|manages| STORE
  STORE -->|provides data| EDITOR
  STORE -->|reads gating| GATE
  RENDERER -->|orchestrates workflows| SERVICE
  UI -->|hosts| SERVICE
  SERVICE -->|reads/writes| REPO
  SERVICE -->|coordinates| FETCH
  SERVICE -->|runs| VALIDATE
  SERVICE -->|runs| GRAPH
  SERVICE -->|runs| IMPACT
  SERVICE -->|runs| GENERATE
  SERVICE -->|runs| EMBED
  EMBED -->|produces vectors| REPO
  EMBED -->|emits checksum| CHECKSUM
  CHECKSUM -->|updates| GATE
  FETCH -->|hydrates cache| REPO
  FETCH -->|requests release assets| SPECKIT
  VALIDATE -->|validates| REPO
  GRAPH -->|analyzes| REPO
  IMPACT -->|calculates| REPO
  GENERATE -->|produces prompts| REPO
  GATE -->|mode decision| UNIFIED
  UNIFIED -->|tool invocations| BRIDGE
  UI -->|git commands| GIT
  GIT -->|tracks| REPO
  UI -->|PR creation| GITHUB
```

## Components (Updated for Unified Assistant & Sidecar Integration)

### Desktop Application (Context-Sync)
- **Electron Main Process** - Node.js backend handling file I/O, Git operations, path resolution (repo root, branch, spec paths), and child-process pipelines
- **Speckit Service** - Orchestrates Spec Kit fetches and post-generation validation pipelines through IPC
- **Vue Renderer** - Frontend UI built with Vue 3, Tailwind CSS, shows assistant Chat, Tools, and Approvals tabs
- **Assistant Bridge (Preload)** - Context-isolated IPC facade exposing session bootstrap, message dispatch, stream subscription, health polling, capability profile retrieval, plus gating artifact read operations (read-only)
- **UnifiedAssistant** - Consolidated chat + tools + approvals interface replacing legacy modal/panel divergence; renders gating status and classification indicators
- **Pinia State** - `assistantStore` (sessions, messages, tasks, health, capabilities, gating), `contextStore` for repository entities
- **YAML Editor** - CodeMirror-based editor with live schema validation

### External Systems
- **Git VCS** - Version control system (svc-git)
- **Context Repository** - File system-based YAML entity storage
- **GitHub** - Remote repository hosting and PR management
- **Spec Kit SaaS** - GitHub releases backing Spec Kit templates and markdown previews

### Context Pipelines
- **speckit-fetch.mjs** - Fetches and caches Spec Kit releases with provenance metadata
- **validate.mjs** - AJV-based schema validation (SPEC-001)
- **build-graph.mjs** - Dependency graph construction
- **impact.mjs** - Impact analysis for changed entities
- **generate.mjs** - Regenerates prompt artifacts after entity changes
- **build-embeddings.mjs** - Deterministically builds sorted embeddings vector files and emits SHA-256 checksum telemetry (FR-039); updates gating artifact with checksumMatch field (FR-040)

## Features Implemented

This architecture supports (additions marked with ✨):
- **US-001**: Validate context repository against defined schemas
- **US-002**: Visualize dependency graph of context entities
- **US-003**: Automate Spec Kit-driven entity creation with pipeline verification
- **LangChain US1 ✨**: Route assistant sessions, prompts, and tool executions via Python Sidecar orchestration service
- **LangChain US2 ✨**: Surface sidecar health and provide fallback guidance for degraded/unavailable states
- **LangChain US3 ✨**: Manage capability toggles (enabled/disabled/preview) with UI reflection and safe suppression of disallowed actions
- **FR-039 ✨**: Deterministic embeddings pipeline with checksum emission
- **FR-040 ✨**: Gating artifact controlling activation and classification enforcement flags
- **FEAT-001**: Context-Sync MVP with automated consistency checking

## Technology Stack

- **Desktop**: Electron 38, Node.js 22
- **Frontend**: Vue 3, Pinia, Tailwind CSS 4, CodeMirror
- **Assistant Integration**: Server-Sent Events (SSE) via preload bridge; capability, health, gating endpoints consumed through main-process mediated HTTP client
- **Validation**: AJV, YAML parser
- **VCS**: simple-git, GitHub CLI

## Health, Capability & Gating Flow (Summary)
- Renderer requests session → preload bridge calls `/assistant/sessions` → returns `sessionId`, capability profile, telemetry context.
- Periodic health polling (`/assistant/health`) updates `assistantStore.status` enabling outage banners and disabling risky actions.
- Capability profile + gating snapshot cached in store; UI annotates pipeline options and prevents disabled or blocked executions (classification/gating).
- Streaming responses (`/assistant/sessions/{id}/tasks/{taskId}/stream`) forwarded from main through bridge to renderer; partial failures annotated.
- Embeddings pipeline emits checksum telemetry; gating artifact updated with `checksumMatch` enabling retrieval features only when deterministic.

## Pending Enhancements
- IPC test harness for deterministic capability mocking in Playwright (current tests validate UI structure only).
- Telemetry ingestion tests for coverage across session, message, stream, tool, health, capability, and checksum events.
- RAG Index Enablement (TODO:RAG_ENABLE) pending consistent checksumMatch=true (two consecutive CI runs) before activating retrieval augmentation.
