# Context-Sync: Technical Specification

**Version**: 0.1.0  
**Status**: MVP Development  
**Last Updated**: 2025-10-23

---

## Executive Summary

**Context-Sync** is a desktop application built with Electron Forge, Vue 3, and Tailwind CSS that manages a GitHub-versioned context repository for spec-driven software development. It provides a visual interface for maintaining bidirectional synchronization between features, user stories, specs, tasks, services, and packages while generating agent-ready prompt contexts.

### Core Value Proposition

- **Single source of truth**: All project context lives in a Git-versioned YAML repository with JSON Schema validation
- **Automated consistency**: Changes to any entity trigger impact analysis and validation across related artifacts
- **AI-ready outputs**: Generate structured prompts with full context for AI coding agents
- **Visual dependency graphs**: See relationships between features, specs, services, and packages in real-time
- **CI-enforced contracts**: Schema validation and impact analysis run on every PR

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                   Electron Desktop App                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ Context Tree │  │    Editor    │  │  Impact Panel   │   │
│  │   (Vue 3)    │  │   (Vue 3)    │  │    (Vue 3)      │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │ Pinia Store │                          │
│                    └──────┬──────┘                          │
│                           │ IPC (contextBridge)             │
│  ─────────────────────────┼──────────────────────────────   │
│                    ┌──────▼──────┐                          │
│                    │ Main Process│                          │
│                    │  (Node.js)  │                          │
│                    └──────┬──────┘                          │
└───────────────────────────┼──────────────────────────────────┘
                            │ Child Process (execa)
                    ┌───────▼────────┐
                    │  Context Repo  │
                    │   Pipelines    │
                    │  (Node ESM)    │
                    └────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Git Repo      │
                    │  (YAML files)  │
                    └────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Desktop Framework** | Electron Forge 7+ | Cross-platform desktop app packaging |
| **Frontend** | Vue 3 (Composition API) | Reactive UI components |
| **State Management** | Pinia | Centralized app state |
| **Styling** | Tailwind CSS + PostCSS | Utility-first styling |
| **Build Tool** | Vite 5+ | Fast bundling for main, preload, and renderer |
| **Type Safety** | TypeScript (strict mode) | Static typing across all code |
| **Schema Validation** | AJV (JSON Schema) | YAML entity validation |
| **Templating** | Handlebars | Prompt and document generation |
| **Graph Visualization** | Cytoscape.js | Dependency graph rendering |
| **Git Integration** | isomorphic-git, simple-git | Git operations from Electron |
| **Package Manager** | pnpm (exclusive) | Fast, disk-efficient dependency management |

---

## Module Resolution Strategy

### Unified Bundler Approach

All code (main process, preload, renderer) uses **Vite** for bundling to ensure consistent import resolution.

**Configuration Pattern:**

```typescript
// tsconfig.base.json
{
  "compilerOptions": {
    "moduleResolution": "Bundler",  // Vite-compatible
    "module": "ESNext",
    "target": "ES2022",
    "paths": {
      "@/*": ["src/renderer/*"],
      "~main/*": ["src/main/*"]
    }
  }
}
```

**Import Rules:**
- ✅ Extensionless imports: `import { foo } from './bar'`
- ✅ Alias imports: `import Component from '@/components/Foo.vue'`
- ❌ No `.js` extensions in TypeScript source
- ❌ No mixing of CJS and ESM

**Rationale:** Eliminates Node.js ESM edge cases by bundling everything; ensures identical import behavior across processes.

---

## Entity Model & Relationships

### Core Entities

#### 1. Feature
**Schema**: `feature.schema.json`  
**Storage**: `contexts/features/*.yaml`

```yaml
id: FEAT-001
title: "User Authentication"
domain: "auth"
status: "in-progress"  # proposed | in-progress | done | blocked
owners: ["@dev1", "@dev2"]
requires: ["svc-user-api", "svc-auth"]
produces: ["pkg-auth-ui"]
userStories: ["US-101", "US-102"]
specs: ["SPEC-101"]
tasks: ["T-1001", "T-1002"]
prompts:
  instructions:
    - "Use TypeScript + Vue 3 Composition API"
    - "Follow OAuth 2.0 best practices"
  contextRefs:
    - "SPEC-101-oauth-flow.yaml"
    - "svc-auth-api.yaml"
```

**Relationships:**
- `requires` → services/packages (dependencies)
- `produces` → packages (outputs)
- `userStories` → user stories (what/why)
- `specs` → specifications (how)
- `tasks` → tasks (implementation units)

#### 2. User Story
**Schema**: `userstory.schema.json`  
**Storage**: `contexts/userstories/*.yaml`

```yaml
id: US-101
feature: FEAT-001
asA: "end user"
iWant: "to log in with my Google account"
soThat: "I can access my personalized dashboard"
acceptanceCriteria:
  - "User can click 'Sign in with Google' button"
  - "OAuth flow redirects to Google consent screen"
  - "User is redirected back with valid JWT token"
  - "Dashboard loads with user profile data"
impacts:
  services: ["svc-auth"]
  packages: ["pkg-auth-ui"]
```

**Relationships:**
- `feature` → parent feature (1:N)
- `impacts` → services/packages affected by story

#### 3. Spec
**Schema**: `spec.schema.json`  
**Storage**: `contexts/specs/*.yaml`

```yaml
id: SPEC-101
title: "OAuth 2.0 Flow Implementation"
type: "technical"  # technical | api | ui | data
related:
  features: ["FEAT-001"]
  services: ["svc-auth"]
  packages: ["pkg-auth-ui"]
content: |
  ## Flow
  1. User clicks "Sign in with Google"
  2. Frontend redirects to /auth/google
  3. Backend redirects to Google OAuth consent
  4. Google redirects to /auth/google/callback
  5. Backend exchanges code for tokens
  6. Backend returns JWT to frontend
```

**Relationships:**
- `related` → features, services, packages (N:N)

#### 4. Task
**Schema**: `task.schema.json`  
**Storage**: `contexts/tasks/*.yaml`

```yaml
id: T-1001
title: "Implement Google OAuth backend route"
status: "doing"  # todo | doing | done | blocked | needs-review
related:
  feature: FEAT-001
  spec: SPEC-101
  service: svc-auth
owner: "@dev1"
steps:
  - "Install passport-google-oauth20"
  - "Configure OAuth strategy"
  - "Add /auth/google route"
  - "Add /auth/google/callback route"
doneCriteria:
  - "Routes return correct status codes"
  - "JWT token generated on success"
  - "Unit tests pass"
```

**Relationships:**
- `related` → feature, spec, service (context)
- `owner` → team member (responsibility)

#### 5. Service
**Schema**: `service.schema.json`  
**Storage**: `contexts/services/*.yaml`

```yaml
id: svc-auth
name: "Authentication Service"
type: "backend"  # backend | frontend | infrastructure
repository: "https://github.com/org/auth-service"
api:
  spec: "openapi/auth-v1.yaml"
  version: "1.2.0"
dependencies:
  - "svc-user-api@^2.0.0"
consumers:
  - "pkg-auth-ui"
  - "pkg-dashboard"
```

**Relationships:**
- `dependencies` → other services (semver ranges)
- `consumers` → packages/services that use this service
- `api.spec` → OpenAPI spec file for contract

#### 6. Package
**Schema**: `package.schema.json`  
**Storage**: `contexts/packages/*.yaml`

```yaml
id: pkg-auth-ui
name: "@myorg/auth-ui"
version: "1.0.0"
type: "npm"  # npm | maven | pypi | gem
repository: "https://github.com/org/auth-ui"
dependencies:
  - "vue@^3.4.0"
  - "pinia@^2.1.0"
uses:
  services: ["svc-auth", "svc-user-api"]
```

**Relationships:**
- `dependencies` → external packages (semver)
- `uses` → services this package consumes

---

## Dependency Graph

### Graph Structure

**Nodes:**
```typescript
interface Node {
  id: string;              // FEAT-001, US-101, etc.
  kind: 'feature' | 'userstory' | 'spec' | 'task' | 'service' | 'package';
  data: Record<string, any>;  // Full YAML object
}
```

**Edges:**
```typescript
interface Edge {
  from: string;            // Source node ID
  to: string;              // Target node ID
  rel: 'has-story' | 'has-spec' | 'has-task' | 'requires' | 'produces' | 'impacts' | 'uses';
}
```

### Graph Operations

1. **Build**: `build-graph.mjs` scans all YAML files and constructs nodes/edges
2. **Query**: Find all tasks for a feature, all services impacted by a story
3. **Impact**: Given changed node IDs, find all neighbors that need review
4. **Validate**: Ensure all referenced IDs exist (no dangling references)

---

## Validation Pipeline

### Schema Validation (`validate.mjs`)

**Inputs:**
- All YAML files in `contexts/{features,userstories,specs,tasks,services,packages}/`
- JSON Schema files in `.context/schemas/`

**Process:**
1. Load all schemas into AJV compiler
2. For each YAML file:
   - Parse YAML to JSON object
   - Validate against corresponding schema
   - Collect errors with file path + line number
3. Check cross-references:
   - All IDs in `requires`, `userStories`, etc. must exist
   - No circular dependencies in `requires`

**Outputs:**
- `{ ok: true }` if all valid
- `{ ok: false, errors: [...] }` with structured error details

**Exit code:** 0 on success, 1 on failure (CI-friendly)

### Consistency Rules (`consistency.rules.yaml`)

**Example Rules:**

```yaml
- id: US-acceptance-change-flags-tasks
  when:
    entity: userstory
    fieldChanged: acceptanceCriteria
  then:
    markRelated:
      types: [task, spec]
      status: needs-review
      reason: "User story acceptance changed"

- id: service-version-bump-needs-consumer-review
  when:
    entity: service
    fieldChanged: api.version
    changeType: major
  then:
    markRelated:
      types: [package, service]
      rel: consumers
      status: needs-review
      reason: "Breaking API change"
```

**Implementation:** Rules engine compares current commit to `HEAD~1`, triggers actions.

---

## Impact Analysis Pipeline

### Impact Detection (`impact.mjs`)

**Inputs:**
- List of changed entity IDs (from git diff or UI selection)
- Full dependency graph

**Algorithm:**
1. Load graph from `build-graph.mjs`
2. For each changed ID:
   - Find all neighbors via edges
   - Mark neighbors as "stale"
   - Apply consistency rules (if acceptance criteria changed → flag tasks)
3. Generate impact report:
   ```json
   {
     "issues": [
       { "id": "T-1001", "type": "needs-review", "message": "Related story US-101 changed" }
     ],
     "stale": ["T-1001", "T-1002", "SPEC-101"]
   }
   ```

**Use Cases:**
- **Pre-commit**: Warn developer about impact before committing
- **PR review**: Show reviewers what else needs attention
- **Dashboard**: Highlight stale items in UI

---

## Prompt Generation Pipeline

### Template System (`generate.mjs`)

**Templates:** Handlebars files in `.context/templates/prompts/`

**Example: `feature.hbs`**

```handlebars
# Feature Context: {{title}} ({{id}})

**Domain**: {{domain}}  
**Status**: {{status}}  
**Owners**: {{#each owners}}{{this}} {{/each}}

## Objective
{{{objective}}}

## Acceptance Criteria
{{#each acceptance}}
- {{this}}
{{/each}}

## Dependencies
**Requires**: {{#each requires}}{{this}} {{/each}}  
**Produces**: {{#each produces}}{{this}} {{/each}}

## Linked Artifacts
- **Stories**: {{#each userStories}}{{this}} {{/each}}
- **Specs**: {{#each specs}}{{this}} {{/each}}
- **Tasks**: {{#each tasks}}{{this}} {{/each}}

## Coding Constraints
{{#each prompts.instructions}}
- {{this}}
{{/each}}

## Attached References
{{#each prompts.contextRefs}}
- {{this}}
{{/each}}
```

**Output:** Markdown files in `generated/prompts/FEAT-001.md`

**Usage:**
- Copy/paste into AI agent (Warp, Cursor, GitHub Copilot)
- Attach as context to LLM API calls
- Include in PR descriptions for AI-assisted code review

---

## IPC Architecture (Electron)

### Communication Flow

```
Renderer (Vue)  →  Preload (contextBridge)  →  Main (IPC handlers)  →  Pipelines (child process)
```

### API Surface

**Preload exposes** (`src/main/preload.ts`):

```typescript
window.api = {
  context: {
    validate: (dir: string) => Promise<ValidationResult>,
    buildGraph: (dir: string) => Promise<Graph>,
    impact: (dir: string, changedIds: string[]) => Promise<ImpactReport>,
    generate: (dir: string, ids: string[]) => Promise<void>
  }
}
```

**Main handlers** (`src/main/index.ts`):

```typescript
ipcMain.handle('context:validate', async (_e, { dir }) => {
  const result = await execa('node', [join(dir, '.context/pipelines/validate.mjs')], { cwd: dir });
  return JSON.parse(result.stdout);
});

ipcMain.handle('context:buildGraph', async (_e, { dir }) => {
  const result = await execa('node', [join(dir, '.context/pipelines/build-graph.mjs')], { cwd: dir });
  return JSON.parse(result.stdout);
});

ipcMain.handle('context:impact', async (_e, { dir, changedIds }) => {
  const result = await execa('node', [join(dir, '.context/pipelines/impact.mjs'), ...changedIds], { cwd: dir });
  return JSON.parse(result.stdout);
});

ipcMain.handle('context:generate', async (_e, { dir, ids }) => {
  await execa('node', [join(dir, '.context/pipelines/generate.mjs'), ...ids], { cwd: dir });
});
```

**Renderer calls** (from Vue components):

```typescript
const graph = await window.api.context.buildGraph('/path/to/context-repo');
```

---

## UI Components (Vue 3)

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Header: Project Name | Status Indicator            │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Context  │     Editor               │   Impact      │
│  Tree    │   (YAML editor)          │   Panel       │
│          │                          │               │
│ [expand] │  id: FEAT-001            │ ⚠ 3 items    │
│ Features │  title: "Auth"           │   need review │
│  ├ FEAT1 │  status: in-progress     │               │
│  └ FEAT2 │  ...                     │ - T-1001      │
│ Stories  │                          │ - T-1002      │
│  ├ US101 │                          │ - SPEC-101    │
│          │                          │               │
└──────────┴──────────────────────────┴───────────────┘
```

### Key Components

#### 1. ContextTree (sidebar)
- **Purpose**: Navigate entity hierarchy
- **Features**:
  - Collapsible folders (Features, Stories, Specs, Tasks, Services, Packages)
  - Search/filter by ID or title
  - Status indicators (colored dots)
  - Click to open in editor

#### 2. YamlEditor (center)
- **Purpose**: Edit YAML files with live validation
- **Features**:
  - Syntax highlighting (CodeMirror or Monaco Editor)
  - Schema-aware autocomplete (entity IDs, status enums)
  - Inline error messages from AJV
  - Save button triggers validation + impact analysis

#### 3. ImpactPanel (right)
- **Purpose**: Show consequences of changes
- **Features**:
  - List of stale/needs-review items
  - Link to affected entities (click to open)
  - Diff view (before/after for acceptance criteria changes)
  - Generate prompt button

#### 4. GraphView (modal/tab)
- **Purpose**: Visualize dependency graph
- **Features**:
  - Cytoscape.js rendering
  - Node colors by entity type
  - Edge labels show relationship type
  - Zoom, pan, search
  - Highlight path between two nodes

### State Management (Pinia)

**Stores:**

1. **contextStore**
   - Current repo path
   - Loaded entities (features, stories, etc.)
   - Dependency graph (cached)
   - Active entity (selected in tree)

2. **editorStore**
   - Current file path
   - Dirty state (unsaved changes)
   - Validation errors

3. **impactStore**
   - Changed entity IDs (since last commit)
   - Impact report (stale items)
   - Rules violations

---

## Git Integration

### Operations

1. **Status**: Show uncommitted changes (modified YAML files)
2. **Diff**: Compare current entity to HEAD
3. **Commit**: Structured commit messages:
   ```
   feat(FEAT-001): Add Google OAuth support
   
   - Added US-101, US-102
   - Created SPEC-101
   - Updated svc-auth dependencies
   
   Impact: T-1001, T-1002 need review
   ```
4. **Branch**: Create feature branch from UI (`feature/FEAT-001-auth`)
5. **PR**: Generate PR body with impact report (via GitHub CLI or Octokit)

### Workflow

```mermaid
graph LR
A[Edit YAML] --> B[Validate]
B --> C[Impact Analysis]
C --> D[Commit]
D --> E[Create PR]
E --> F[CI Validates]
F --> G[Merge]
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**Trigger:** PR to `main` that touches `.context/` or `contexts/`

**Jobs:**

1. **Validate Schemas**
   ```yaml
   - run: node .context/pipelines/validate.mjs
   ```
   Fails if any YAML invalid

2. **Build Graph**
   ```yaml
   - run: node .context/pipelines/build-graph.mjs > graph.json
   - run: test -s graph.json  # ensure non-empty
   ```

3. **Impact Analysis**
   ```yaml
   - run: git diff --name-only HEAD~1 | grep 'contexts/' | xargs node .context/pipelines/impact.mjs
   - run: cat impact.json  # log for reviewers
   ```

4. **Check Dangling References**
   - Ensure all IDs in `requires`, `userStories`, etc. exist
   - Fail if any entity references non-existent ID

5. **Comment on PR** (optional)
   - Post impact report as PR comment via GitHub API

### Merge Protection

- Require status checks to pass
- Require 1 reviewer approval
- No direct pushes to `main`

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- ✅ Initialize Electron Forge app with TypeScript
- ✅ Set up Vite for main, preload, renderer
- ✅ Configure Tailwind CSS
- ✅ Create JSON Schemas for all 6 entity types
- ✅ Implement `validate.mjs` pipeline
- ✅ Implement `build-graph.mjs` pipeline
- ✅ Seed repo with 2-3 sample entities

**Deliverable:** App launches, loads repo, validates YAML

### Phase 2: Core UI (Weeks 3-4)
- Build ContextTree component (collapsible, filterable)
- Build YamlEditor with CodeMirror
- Wire IPC: renderer → main → pipelines
- Display validation errors in editor
- Save file triggers validation

**Deliverable:** Can browse and edit YAML files in UI

### Phase 3: Impact Analysis (Week 5)
- Implement `impact.mjs` pipeline
- Build ImpactPanel component
- Highlight stale items in ContextTree
- Show diff view for changed entities
- Implement consistency rules engine

**Deliverable:** See impact of changes before commit

### Phase 4: Prompt Generation (Week 6)
- Implement `generate.mjs` pipeline
- Create Handlebars templates (feature, story, spec)
- Add "Generate Prompt" button to ImpactPanel
- Copy prompt to clipboard
- Show preview in modal

**Deliverable:** Generate agent-ready prompts for any feature

### Phase 5: Graph Visualization (Week 7)
- Integrate Cytoscape.js
- Render graph in modal/tab
- Node colors by entity type
- Click node → open in editor
- Highlight path between two selected nodes

**Deliverable:** Visual dependency graph

### Phase 6: Git Integration (Week 8)
- Show uncommitted changes (via simple-git)
- Display diff for selected entity
- Commit UI with message template
- Branch creation from UI
- PR creation via GitHub CLI

**Deliverable:** Full git workflow in app

### Phase 7: CI/CD (Week 9)
- GitHub Actions workflow for validation
- Impact analysis on PRs
- PR comment bot with report
- Merge protection rules
- Documentation

**Deliverable:** CI enforces schema contracts

### Phase 8: Polish & Docs (Week 10)
- Error handling (network, file I/O)
- Loading states, spinners
- Keyboard shortcuts
- User guide (README)
- Developer guide (CONTRIBUTING.md)
- Demo video

**Deliverable:** Production-ready MVP

---

## Testing Strategy

### Unit Tests

**Pipelines** (`.context/pipelines/*.test.mjs`):
- Test schema validation with valid/invalid YAML
- Test graph building with sample entities
- Test impact analysis with mock graph
- Test prompt generation with templates

**Framework:** Node.js native test runner or Vitest

### Integration Tests

**IPC** (`app/src/main/__tests__/ipc.test.ts`):
- Mock execa calls
- Test handler responses
- Test error handling

**Framework:** Vitest with happy-dom

### E2E Tests

**App** (`.e2e/*.spec.ts`):
- Launch app, load repo
- Navigate tree, select entity
- Edit YAML, save, validate
- Generate prompt, copy to clipboard

**Framework:** Playwright or Spectron

### CI

Run all tests on PR:
```yaml
- run: pnpm test:unit
- run: pnpm test:integration
- run: pnpm test:e2e
```

---

## Security & Best Practices

### Secrets Management
- No hardcoded tokens in code
- Use environment variables for GitHub tokens
- Electron secure storage for user credentials

### Content Security Policy (CSP)
```
default-src 'self';
script-src 'self' 'unsafe-eval';  # Vite dev mode
style-src 'self' 'unsafe-inline';  # Tailwind
img-src 'self' data:;
```

### Context Isolation
- `contextIsolation: true` in webPreferences
- `nodeIntegration: false`
- All Node APIs accessed via IPC

### File System Access
- Validate repo path before operations
- Prevent directory traversal attacks
- Sandbox child process execution

---

## Performance Considerations

### Lazy Loading
- Load entities on-demand (don't parse all YAML upfront)
- Virtualize ContextTree for large repos (1000+ entities)

### Caching
- Cache dependency graph in memory
- Invalidate on file changes (via chokidar watcher)

### Debouncing
- Debounce validation on editor input (500ms)
- Batch IPC calls where possible

---

## Future Enhancements

1. **Multi-repo support**: Manage multiple context repos in tabs
2. **OpenAPI change detection**: Flag breaking changes to service APIs
3. **Semver coupling rules**: Enforce version constraints between services/packages
4. **Rich editor**: WYSIWYG for YAML with schema-aware forms
5. **Agent plugins**: Direct integration with Warp/Cursor/Copilot
6. **Team collaboration**: Real-time co-editing via WebSockets
7. **Analytics**: Dashboard for feature velocity, task completion rates
8. **Export**: Generate static site from context repo for documentation

---

## Glossary

- **Context Repo**: Git repository containing YAML entity files + schemas + pipelines
- **Entity**: Core data model (feature, user story, spec, task, service, package)
- **Pipeline**: Node.js script that validates, analyzes, or generates artifacts
- **Impact Analysis**: Process of finding entities affected by a change
- **Consistency Rule**: Declarative constraint that triggers actions on changes
- **Prompt Context**: Markdown document with full context for an AI agent
- **Dependency Graph**: Directed graph of relationships between entities

---

## References

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [Pinia State Management](https://pinia.vuejs.org/)
- [JSON Schema Specification](https://json-schema.org/)
- [AJV Validator](https://ajv.js.org/)
- [Handlebars Templating](https://handlebarsjs.com/)
- [Cytoscape.js](https://js.cytoscape.org/)
- [Vite Module Resolution](https://vitejs.dev/guide/dep-pre-bundling.html)

---

## Appendix: File Structure Reference

```
my-context-kit/
├─ docs/
│  └─ spec.md                      # This document
├─ app/
│  ├─ src/
│  │  ├─ main/
│  │  │  ├─ index.ts               # Electron main entry
│  │  │  ├─ preload.ts             # IPC bridge
│  │  │  └─ pipelines.ts           # Pipeline executor
│  │  └─ renderer/
│  │     ├─ main.ts                # Vue app entry
│  │     ├─ App.vue                # Root component
│  │     ├─ components/
│  │     │  ├─ ContextTree.vue
│  │     │  ├─ YamlEditor.vue
│  │     │  ├─ ImpactPanel.vue
│  │     │  └─ GraphView.vue
│  │     ├─ stores/
│  │     │  ├─ contextStore.ts
│  │     │  ├─ editorStore.ts
│  │     │  └─ impactStore.ts
│  │     └─ styles/
│  │        └─ tailwind.css
│  ├─ forge.config.ts
│  ├─ vite.main.config.ts
│  ├─ vite.preload.config.ts
│  ├─ vite.renderer.config.ts
│  ├─ vite.shared.alias.ts
│  ├─ tsconfig.base.json
│  ├─ tsconfig.main.json
│  ├─ tsconfig.renderer.json
│  ├─ tailwind.config.cjs
│  ├─ postcss.config.cjs
│  └─ package.json
└─ context-repo/
   ├─ .context/
   │  ├─ schemas/
   │  │  ├─ feature.schema.json
   │  │  ├─ userstory.schema.json
   │  │  ├─ spec.schema.json
   │  │  ├─ task.schema.json
   │  │  ├─ service.schema.json
   │  │  └─ package.schema.json
   │  ├─ rules/
   │  │  └─ consistency.rules.yaml
   │  ├─ templates/
   │  │  ├─ prompts/
   │  │  │  ├─ feature.hbs
   │  │  │  ├─ userstory.hbs
   │  │  │  └─ spec.hbs
   │  │  └─ docs/
   │  │     └─ impact-report.hbs
   │  └─ pipelines/
   │     ├─ validate.mjs
   │     ├─ build-graph.mjs
   │     ├─ impact.mjs
   │     └─ generate.mjs
   ├─ contexts/
   │  ├─ features/
   │  │  └─ FEAT-001-auth.yaml
   │  ├─ userstories/
   │  │  └─ US-101-google-login.yaml
   │  ├─ specs/
   │  │  └─ SPEC-101-oauth-flow.yaml
   │  ├─ tasks/
   │  │  └─ T-1001-oauth-backend.yaml
   │  ├─ services/
   │  │  └─ svc-auth.yaml
   │  └─ packages/
   │     └─ pkg-auth-ui.yaml
   └─ generated/
      ├─ prompts/
      │  └─ FEAT-001.md
      └─ docs/impact/
         └─ PR-123-impact.md
```

---

**End of Specification**
