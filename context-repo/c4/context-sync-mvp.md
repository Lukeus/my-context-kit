# Context-Sync MVP Architecture

This diagram shows the container-level architecture (C2) of the Context-Sync desktop application.

```mermaid
%% c4: system=Context-Sync, level=C2, feature=FEAT-001, specs=[SPEC-001, LANGCHAIN-US1, LANGCHAIN-US2, LANGCHAIN-US3]
flowchart TB
  subgraph Desktop["Context-Sync Desktop App"]
    UI[Electron Main Process :: container :: Node.js + Electron]
    SERVICE[Speckit Service :: component :: Node.js]
    RENDERER[Vue Renderer :: container :: Vue 3 + Tailwind]
    STORE[Pinia State (assistantStore, contextStore) :: component :: Pinia]
    EDITOR[YAML Editor :: component :: CodeMirror]
    BRIDGE[Assistant Bridge :: component :: Preload IPC]
  end
  
  subgraph External["External Systems"]
    GIT[Git VCS :: external :: Git CLI]
    REPO[(Context Repository :: datastore :: File System)]
    GITHUB[GitHub :: external :: GitHub API]
  end

  subgraph SpecKitSaaS["Spec Kit SaaS"]
    SPECKIT[Spec Kit Releases :: external :: GitHub Releases API]
  end

  subgraph LangChain["LangChain Orchestration Service"]
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
  end

  RENDERER -->|IPC| UI
  RENDERER -->|uses| BRIDGE
  BRIDGE -->|session bootstrap| LC_SESS
  BRIDGE -->|messages| LC_MSG
  BRIDGE -->|stream events| LC_STREAM
  BRIDGE -->|health polling| LC_HEALTH
  BRIDGE -->|capability profile| LC_CAP
  RENDERER -->|manages| STORE
  STORE -->|provides data| EDITOR
  RENDERER -->|orchestrates workflows| SERVICE
  UI -->|hosts| SERVICE
  SERVICE -->|reads/writes| REPO
  SERVICE -->|coordinates| FETCH
  SERVICE -->|runs| VALIDATE
  SERVICE -->|runs| GRAPH
  SERVICE -->|runs| IMPACT
  SERVICE -->|runs| GENERATE
  FETCH -->|hydrates cache| REPO
  FETCH -->|requests release assets| SPECKIT
  VALIDATE -->|validates| REPO
  GRAPH -->|analyzes| REPO
  IMPACT -->|calculates| REPO
  GENERATE -->|produces prompts| REPO
  UI -->|git commands| GIT
  GIT -->|tracks| REPO
  UI -->|PR creation| GITHUB
```

## Components (Updated for LangChain Integration)

### Desktop Application (Context-Sync)
- **Electron Main Process** - Node.js backend handling file I/O, Git operations, path resolution (repo root, branch, spec paths), and child-process pipelines
- **Speckit Service** - Orchestrates Spec Kit fetches and post-generation validation pipelines through IPC
- **Vue Renderer** - Frontend UI built with Vue 3, Tailwind CSS, shows assistant Chat and Tools Console tabs
- **Assistant Bridge (Preload)** - Context-isolated IPC facade exposing session bootstrap, message dispatch, stream subscription, health polling, and capability profile retrieval
- **Pinia State** - `assistantStore` (sessions, messages, tasks, health, capabilities), `contextStore` for repository entities
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

## Features Implemented

This architecture supports (additions marked with ✨):
- **US-001**: Validate context repository against defined schemas
- **US-002**: Visualize dependency graph of context entities
- **US-003**: Automate Spec Kit-driven entity creation with pipeline verification
- **LangChain US1 ✨**: Route assistant sessions, prompts, and tool executions via orchestration service
- **LangChain US2 ✨**: Surface service health and provide fallback guidance for degraded/unavailable states
- **LangChain US3 ✨**: Manage capability toggles (enabled/disabled/preview) with UI reflection and safe suppression of disallowed actions
- **FEAT-001**: Context-Sync MVP with automated consistency checking

## Technology Stack

- **Desktop**: Electron 38, Node.js 22
- **Frontend**: Vue 3, Pinia, Tailwind CSS 4, CodeMirror
- **Assistant Integration**: Server-Sent Events (SSE) via preload bridge; capability & health endpoints consumed through main-process mediated HTTP client
- **Validation**: AJV, YAML parser
- **VCS**: simple-git, GitHub CLI

## Health & Capability Flow (Summary)
- Renderer requests session → preload bridge calls `/assistant/sessions` → returns `sessionId`, capability profile, telemetry context.
- Periodic health polling (`/assistant/health`) updates `assistantStore.status` enabling outage banners and disabling risky actions.
- Capability profile cached in store; UI (ToolPanel) annotates pipeline options and prevents disabled executions.
- Streaming responses (`/assistant/sessions/{id}/tasks/{taskId}/stream`) forwarded from main through bridge to renderer; partial failures annotated.

## Pending Enhancements
- IPC test harness for deterministic capability mocking in Playwright (current tests validate UI structure only).
- Telemetry ingestion tests for coverage across session, message, stream, tool, health, and capability events.
