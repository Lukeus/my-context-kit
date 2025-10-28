# Context-Sync MVP Architecture

This diagram shows the container-level architecture (C2) of the Context-Sync desktop application.

```mermaid
%% c4: system=Context-Sync, level=C2, feature=FEAT-001, specs=[SPEC-001]
flowchart TB
  subgraph Desktop["Context-Sync Desktop App"]
    UI[Electron Main Process :: container :: Node.js + Electron]
    SERVICE[Speckit Service :: component :: Node.js]
    RENDERER[Vue Renderer :: container :: Vue 3 + Tailwind]
    STORE[Pinia State :: component :: Pinia]
    EDITOR[YAML Editor :: component :: CodeMirror]
  end
  
  subgraph External["External Systems"]
    GIT[Git VCS :: external :: Git CLI]
    REPO[(Context Repository :: datastore :: File System)]
    GITHUB[GitHub :: external :: GitHub API]
  end

  subgraph SpecKitSaaS["Spec Kit SaaS"]
    SPECKIT[Spec Kit Releases :: external :: GitHub Releases API]
  end
  
  subgraph Pipelines["Context Pipelines"]
    FETCH[speckit-fetch.mjs :: container :: Node.js]
    VALIDATE[validate.mjs :: container :: Node.js]
    GRAPH[build-graph.mjs :: container :: Node.js]
    IMPACT[impact.mjs :: container :: Node.js]
    GENERATE[generate.mjs :: container :: Node.js]
  end

  RENDERER -->|IPC| UI
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

## Components

### Desktop Application (Context-Sync)
- **Electron Main Process** - Node.js backend handling file I/O, Git operations, and child-process pipelines
- **Speckit Service** - Orchestrates Spec Kit fetches and post-generation validation pipelines through the IPC layer
- **Vue Renderer** - Frontend UI built with Vue 3 and Tailwind CSS
- **Pinia State** - Centralized state management for entities, pipeline status, and Spec Kit previews
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

This architecture supports:
- **US-001**: Validate context repository against defined schemas
- **US-002**: Visualize dependency graph of context entities
- **US-003**: Automate Spec Kit-driven entity creation with pipeline verification
- **FEAT-001**: Context-Sync MVP with automated consistency checking

## Technology Stack

- **Desktop**: Electron 38, Node.js 22
- **Frontend**: Vue 3, Pinia, Tailwind CSS 4, CodeMirror
- **Validation**: AJV, YAML parser
- **VCS**: simple-git, GitHub CLI
