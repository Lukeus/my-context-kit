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

### Phase 9: Context Building & Generation (Weeks 11-15)

Intelligent entity creation with AI assistance and smart suggestions.

#### Phase 9.1: Core Builder (Week 11)
- ✅ Multi-step wizard modal component (ContextBuilderModal.vue)
- ✅ Basic field entry (ID, title, status, domain)
- ✅ Simple next-ID generation (FEAT-003, US-105, etc.)
- ✅ YAML preview with syntax highlighting
- ✅ Schema validation during creation
- ✅ File creation and saving via IPC handlers
- ✅ builderStore for wizard state management

**Deliverable:** Create entities through guided wizard

#### Phase 9.2: Smart Suggestions (Week 12)
- ✅ Implement `context-builder.mjs` pipeline
- ✅ Domain suggestion based on existing entity patterns and keywords
- ✅ Next ID generation with conflict detection
- ✅ Related entity suggestions from dependency graph
- ✅ Relationship inference (e.g., tasks → recent in-progress features)
- ✅ Domain clustering analysis with confidence levels
- ✅ Real-time validation with hints and warnings
- ✅ Confidence-based suggestion display (✨ high, medium, low)

**Deliverable:** Smart autocomplete and relationship suggestions

#### Phase 9.3: Templates (Week 13)
- ✅ Template storage in `.context/templates/builder/`
- ✅ Template library (feature, user story, task, spec patterns) with 7 templates
- ✅ Template picker UI in wizard Step 1 with clickable cards
- ✅ Variable substitution engine with placeholder replacement
- ✅ Common patterns: CRUD operations, API endpoints, UI components, microservices, bugfix
- ✅ Template preview and customization in wizard

**Deliverable:** Quick-start templates for common entity types

#### Phase 9.4: AI Integration (Week 14)
- ✅ Implement `ai-generator.mjs` pipeline with Ollama and Azure OpenAI support
- ✅ Natural language → structured entity generation with system prompts per type
- ✅ Description parsing and field extraction from AI responses
- ✅ AI-powered acceptance criteria generation based on entity requirements
- ✅ Relationship detection from description keywords
- ✅ AI assist panel in ContextBuilderModal with natural language input
- ✅ Token usage tracking and display in UI
- ✅ Secure credential storage using Electron safeStorage API (OS-level encryption)
- ✅ AISettingsModal.vue for provider configuration (Ollama/Azure OpenAI)
- ✅ API key encryption and secure retrieval (never logged or exposed to renderer)
- ✅ Test connection functionality before saving configuration

**Deliverable:** AI-assisted entity creation from plain English with secure credential storage

#### Phase 9.5: Advanced Features & Polish (Week 15)
- ✅ Bulk creation mode (feature + stories + tasks in sequence)
- ✅ Auto-linking between newly created entities
- ✅ Auto-commit option after creation
- ✅ Feature branch creation during entity setup
- ✅ Keyboard shortcuts (Ctrl+N for quick create)
- ✅ Entry points from ContextTree with + buttons
- ✅ Comprehensive error handling with user-friendly messages
- ✅ Loading states and animations for async operations
- ✅ Error message display with warnings
- ✅ Git integration options in review step
- Graph integration (create from node context menu) - Deferred
- RelationshipPicker component with visual graph preview - Deferred
- Create missing entity from broken reference - Deferred

**Deliverable:** Complete context building/generation system with polish

#### New Components

**Vue Components:**
- `ContextBuilderModal.vue` - Multi-step entity creation wizard with AI Assist panel integrated
- `AISettingsModal.vue` - AI provider configuration (Ollama/Azure OpenAI)
- `RelationshipPicker.vue` - Visual entity relationship selector (Deferred)

**Pinia Store:**
- `builderStore.ts` - Wizard state, validation, suggestions, templates, AI generation management

**Pipelines:**
- `context-builder.mjs` - Smart suggestions and ID generation with domain clustering
- `ai-generator.mjs` - AI-powered entity generation from natural language (Ollama/Azure OpenAI)

**Templates:**
- `.context/templates/builder/feature-crud.yaml`
- `.context/templates/builder/feature-api-integration.yaml`
- `.context/templates/builder/userstory-basic.yaml`
- `.context/templates/builder/task-implementation.yaml`
- `.context/templates/builder/task-bugfix.yaml`
- `.context/templates/builder/spec-api.yaml`
- `.context/templates/builder/spec-ui-component.yaml`

#### IPC Handlers

```typescript
ipcMain.handle('context:nextId', async (_e, { repoPath, entityType }) => {
  // Generate next available ID for entity type
});

ipcMain.handle('context:createEntity', async (_e, { repoPath, entity, entityType, autoCommit, createBranch }) => {
  // Create and validate new entity file with optional git operations
});

ipcMain.handle('context:getSuggestions', async (_e, { repoPath, entityType, partialEntity }) => {
  // Smart suggestions for domains, IDs, relationships
});

ipcMain.handle('context:getTemplates', async (_e, { repoPath, entityType }) => {
  // Load available templates for entity type
});

ipcMain.handle('ai:getConfig', async (_e, { repoPath }) => {
  // Load AI configuration from .context/ai-config.json
});

ipcMain.handle('ai:saveConfig', async (_e, { repoPath, config }) => {
  // Save AI configuration (without API keys)
});

ipcMain.handle('ai:saveCredentials', async (_e, { provider, credentials }) => {
  // Encrypt and save API keys using safeStorage
});

ipcMain.handle('ai:getCredentials', async (_e, { provider }) => {
  // Check if credentials exist (returns boolean, never the actual key)
});

ipcMain.handle('ai:testConnection', async (_e, { repoPath, provider }) => {
  // Test AI provider connection
});

ipcMain.handle('ai:generate', async (_e, { repoPath, entityType, userPrompt }) => {
  // AI generation from natural language with secure credential decryption
});
```

#### User Flow

1. **Initiate Creation**
   - Click "New" button in ContextTree
   - Press Ctrl+N keyboard shortcut
   - Right-click in GraphView → "Create Related Entity"
   - Click broken reference → "Create Missing Entity"

2. **Wizard Steps**
   - **Step 1**: Basic info (ID, title, domain, status)
   - **Step 2**: Relationships (link to stories, specs, tasks, services)
   - **Step 3**: Details (entity-specific fields, acceptance criteria)
   - **Step 4**: Review (YAML preview, validation, impact analysis)

3. **AI Assistance** (optional)
   - Enter plain English description
   - AI generates structured fields
   - Review and refine suggestions
   - Apply to wizard form

4. **Save & Link**
   - Create YAML file
   - Update dependency graph
   - Optional: commit with smart message
   - Optional: create feature branch
   - Highlight new entity in graph

#### Smart Features

- **ID Conflict Detection**: Check existing IDs before suggesting
- **Domain Clustering**: Suggest domain based on description keywords
- **Relationship Inference**: Auto-suggest related entities from graph
- **Template Matching**: Detect patterns ("API", "CRUD") → suggest template
- **Validation Hints**: Real-time feedback (✅ valid, ⚠️ warnings, ❌ errors)
- **Bulk Creation**: Create interconnected entities in one flow

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

## Purpose

Context-Sync is a desktop workspace for spec-driven development. It manages a Git-versioned repository of project context (features, stories, specs, tasks, services, packages) and turns it into actionable workflows for developers:
- Edit validated YAML entities with schema-aware tooling
- See dependency graphs and impact of changes before committing
- Generate AI-ready prompts and apply AI-proposed edits safely
- Drive a complete Git/PR workflow anchored on contracts and consistency rules

---

## UX Streamlining Roadmap

### Current State Assessment

**What's Working:**
- Clear information architecture: left Context Tree, center YAML editor, right Impact/AI panels
- Helpful Quick Actions and repository manager with multi-repo support
- Strong Pinia stores with well-separated concerns
- Tailwind tokens emulate Material 3 (surface, elevation, rounded-m3) consistently
- Wizard-based entity builder with AI assistance
- Cytoscape graph visualization with path finding
- Git flows integrated with PR creation
- AI panel grounded on repository state

**Key Issues & Opportunities:**
- **Visual consistency**: GraphView and Git areas use gray utility classes instead of M3 tokens; modals vary in density
- **Discoverability**: Many header buttons with similar visual weight; right panel toggle affordance non-obvious; no global search/command palette
- **Flows**: Builder lacks constitution guardrail infusion; relationship selection could use faceted pickers; PR/diff lacks inline experience
- **Multi-app lens**: No "app" metadata to organize features/stories/specs/tasks per application across portfolio
- **Feedback**: Missing toasts/snackbars for operations; AI panel Ctrl+Enter not bound to textarea

### Phase P0: Quick Wins (1–2 weeks)

#### 1. Unify Material 3 Look & Feel
- **Goal**: Replace gray utility colors with M3 tokens throughout
- **Components**: GraphView.vue, GitPanel.vue, headers
- **Tasks**:
  - Standardize to `surface-1/2/3/4`, `rounded-m3-*`, `shadow-elevation-*`
  - Header actions: primary emphasis for "New Entity" and "Assistant"; outlined/tonal for toggles
  - Add tooltips to all icon buttons

#### 2. Global Search & Command Palette
- **Goal**: Quick navigation and action discovery
- **Components**: New `CommandPalette.vue`
- **Tasks**:
  - Implement Ctrl+K command palette
  - Actions: "Open entity...", "Create feature/story/spec/task...", "Analyze impact", "Open Git/Graph", "Switch repo"
  - Global entity search with fuzzy match across id/title/type
  - Keyboard navigation (up/down, Enter to execute)

#### 3. Right Panel Clarity
- **Goal**: Make panel switching more obvious
- **Components**: App.vue, ImpactPanel.vue, AIAssistantPanel.vue
- **Tasks**:
  - Convert to proper M3 segmented buttons
  - Add keyboard shortcuts: Ctrl+I (Impact), Ctrl+Shift+A (Assistant)
  - Persist last-opened tab per repository in contextStore

#### 4. Feedback & Shortcuts
- **Goal**: Better user feedback and keyboard accessibility
- **Components**: New `Snackbar.vue`, AIAssistantPanel.vue
- **Tasks**:
  - Add M3 snackbar/toast component for saves, validation, repo actions
  - Bind Ctrl+Enter in AI textarea
  - Enter-to-apply in builder suggestion chips
  - Escape to close modals

#### 5. Graph Usability
- **Goal**: Improve graph interaction patterns
- **Components**: GraphView.vue
- **Tasks**:
  - Replace `alert()` with inline banner for "no path found"
  - Add "Select start/end" chips for path finding
  - Improve node label density toggle
  - Replace `dbltap` with standard double-click handling

#### 6. Git Affordances
- **Goal**: Better diff viewing and staging
- **Components**: GitPanel.vue, new `DiffViewer.vue`
- **Tasks**:
  - Inline diff viewer component (side-by-side, M3 cards)
  - One-click "stage selected" and "commit selected"
  - Fix changedFiles filter to not hardcode "context-repo/"

### Phase P0.5: Workspace Hub and Center Tabs (1–2 weeks)

Goal: Make the center panel first-class for everyday use, even when not editing YAML.

Deliverables:
- Workspace Hub view (when no entity selected)
  - Recent entities (last 10), Pinned entities
  - My queue (assigned tasks/owner == @me when available), Stale/Needs-review summary
  - Quick actions (New, Validate, Impact, Generate Prompt), mini graph preview
- Center tabs when an entity is selected: YAML | Preview | Diff | Docs
  - Preview: rendered summary of the entity (title, status, relationships)
  - Diff: inline git diff for the entity file (side-by-side later)
  - Docs: in-app docs page (moved from Welcome)
- Breadcrumbs with chips (type, status, domain) over the tabs
- Keyboard focus management and shortcuts (1/2/3/4 to switch tabs)

Components to touch:
- app/src/renderer/App.vue (tab bar, hub routing)
- app/src/renderer/components/WorkspaceHub.vue (new)
- app/src/renderer/components/EntityPreview.vue (new)
- app/src/renderer/components/EntityDiff.vue (new)
- app/src/renderer/components/WelcomeDocumentation.vue (used as Docs tab)
- app/src/renderer/stores/contextStore.ts (recent tracking via settings)

Success metrics:
- 2× faster navigation to relevant work (recent/pinned)
- >50% reduction in “empty center” time
- Daily-driver parity: developers can stay in center panel for most tasks

---

### Phase P1: Core Workflows (3–5 weeks)

#### 1. Constitution-First Experience
- **Goal**: Surface governance rules in workflows
- **Components**: New `GovernancePanel.vue`, ContextBuilderModal.vue
- **Tasks**:
  - Governance view to read/edit `contexts/governance/constitution.yaml`
  - Schema-backed form with non-negotiable chips and rule badges
  - Surface constitution guardrails in Builder (Step 1 and Review)
  - Inline rule reminders, status chips, warnings prior to save

#### 2. Multi-App Lens (Non-Breaking)
- **Goal**: Organize entities by application
- **Components**: ContextTree.vue, ContextBuilderModal.vue, App.vue
- **Tasks**:
  - Introduce optional `appId`/`appName` metadata in entities
  - Add App filter chip row atop Context Tree
  - "Portfolio" overview in header: cards per app with entity counts, validation status
  - Impact/Graph filters by app

#### 3. Relationship Pickers
- **Goal**: Better entity linking UX
- **Components**: New `RelationshipPicker.vue`, ContextBuilderModal.vue
- **Tasks**:
  - Faceted pickers: search + filter by domain/app/status
  - Confidence badges on suggestions
  - Batch link/unlink operations

#### 4. Builder Enhancements
- **Goal**: Streamline entity creation
- **Components**: ContextBuilderModal.vue, builderStore.ts
- **Tasks**:
  - Template browser sheet with preview
  - "Diff against current inputs" for templates
  - Reusable field presets
  - "Continue to related entities" sequencer

#### 5. Impact to Action
- **Goal**: Make impact analysis actionable
- **Components**: ImpactPanel.vue
- **Tasks**:
  - Per-issue CTA buttons: "Open file", "Generate prompt", "Create task" with prefilled relationships
  - Bulk "mark resolved" (undoable)
  - Impact-driven PR body composer

#### 6. PR Authoring
- **Goal**: Better PR creation flow
- **Components**: GitPanel.vue
- **Tasks**:
  - Pre-built PR template composer
  - Inject impact summary, changed entities, rule notes
  - Save as default PR body template

### Phase P2: Advanced UX (4–6 weeks)

#### 1. Story Map & Planning Views
- **Goal**: Visual planning and tracking
- **Components**: New `StoryMapView.vue`, `FeatureKanban.vue`, `SpecMatrix.vue`
- **Tasks**:
  - User story map with release swimlanes
  - Feature Kanban by status
  - Spec coverage matrix
  - Read-only first, navigate to editor

#### 2. Command Palette Power Actions
- **Goal**: Advanced batch operations
- **Components**: CommandPalette.vue
- **Tasks**:
  - "Create from template <X> in app <Y>"
  - "Refactor id <A>→<B>" with file rename preview
  - "Bulk set status to needs-review" for stale items

#### 3. AI-Assisted Edits Pipeline
- **Goal**: Complete the AI edit workflow
- **Components**: AIAssistantPanel.vue
- **Tasks**:
  - "Apply edit" shows proper diff
  - Staged writes with validation
  - One-click commit+branch
  - Safe-guard with validation pre-commit

#### 4. Accessibility & Performance
- **Goal**: Production-grade quality
- **Components**: All
- **Tasks**:
  - Focus rings, roles, keyboard traversal
  - Virtualize long lists (ContextTree, ImpactPanel)
  - Cache graphs per repo
  - Lazy-load heavy components

### Implementation Guide

**Components to Touch:**
- **App shell**: `app/src/renderer/App.vue`
- **Command palette**: `app/src/renderer/components/CommandPalette.vue` (new)
- **Constitution editor**: `app/src/renderer/components/GovernancePanel.vue` (new)
- **Graph M3 pass**: `app/src/renderer/components/GraphView.vue`
- **Git diff viewer**: `app/src/renderer/components/GitPanel.vue` + `DiffViewer.vue` (new)
- **Builder**: `app/src/renderer/components/ContextBuilderModal.vue`
- **Toast/snackbar**: `app/src/renderer/components/Snackbar.vue` (new)
- **AI panel**: `app/src/renderer/components/AIAssistantPanel.vue`

**Stores:**
- `contextStore`: Add app metadata handling, cached filters, UI prefs per repo
- `builderStore`: Accept app metadata, inject constitution guardrails, expose `canProceed` reasons
- `impactStore`: Surface rule IDs and quick actions
- `gitStore`: Expose stage/unstage selected, remove path hardcode, provide diff hunks

### Success Metrics

- Time-to-create entity reduced by 30–50%
- Fewer invalid saves (validation caught earlier)
- Higher use of Impact panel (actionable insights)
- More apply-edit through AI (streamlined workflow)
- Fewer modals closed without action
- Improved repo switching clarity

### Risks & Dependencies

- Constitution schema drift: ensure forms derive from JSON schema
- Diff viewer complexity: start with unified view, expand later
- Multi-app metadata backfill: keep optional to avoid breaking existing repos

### Estimated Effort

- **P0 (Quick Wins)**: 1–2 weeks
- **P1 (Core Workflows)**: 3–5 weeks
- **P2 (Advanced UX)**: 4–6 weeks

**Total**: 8–13 weeks for complete UX overhaul

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

## AI Integration Enhancements

### Current AI Integration Analysis

**What's Working:**
1. ✅ AI configuration with multiple providers (Ollama, Azure OpenAI)
2. ✅ Secure credential storage using Electron's safeStorage
3. ✅ Conversation history with modes (improvement, clarification, general)
4. ✅ Context-aware assistance with focus on specific entities
5. ✅ Edit proposal and application workflow
6. ✅ Token usage tracking
7. ✅ Robust JSON parsing with fallback for non-compliant responses

**Potential Improvements:**

#### 1. Streaming Responses (High Impact)
**Status**: Planned  
**Priority**: P1

**Goal**: Provide better UX for long AI responses by streaming tokens as they're generated.

**Implementation:**
- Modify `ai-common.mjs` to support streaming mode for both Ollama and Azure OpenAI
- Add `stream: true` flag to provider calls
- Update `callOllama` to handle Server-Sent Events (SSE)
- Update `callAzureOpenAI` to handle SSE streams
- Modify `AIAssistantPanel.vue` to display partial responses
- Add streaming state indicator in UI

**Components:**
- `context-repo/.context/pipelines/ai-common.mjs`
- `context-repo/.context/pipelines/ai-assistant.mjs`
- `app/src/main/index.ts` (IPC handler modifications)
- `app/src/renderer/components/AIAssistantPanel.vue`
- `app/src/renderer/stores/aiStore.ts`

**Technical Details:**
```typescript
// Ollama streaming
const response = await fetch(`${endpoint}/api/generate`, {
  method: 'POST',
  body: JSON.stringify({ model, prompt, stream: true })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = JSON.parse(new TextDecoder().decode(value));
  yield chunk.response; // Stream to renderer
}
```

#### 2. Conversation Context Management (Medium Impact)
**Status**: Planned  
**Priority**: P1

**Goal**: Send conversation history to LLM for multi-turn context-aware interactions.

**Implementation:**
- Modify `ai-assistant.mjs` to accept conversation history array
- Build messages array from `aiStore.conversation`
- Add sliding window to limit context (last N messages or token limit)
- Add "Clear context" button to force fresh start
- Display conversation size/token estimate in UI

**Components:**
- `context-repo/.context/pipelines/ai-assistant.mjs`
- `app/src/renderer/stores/aiStore.ts`
- `app/src/renderer/components/AIAssistantPanel.vue`

**Data Structure:**
```typescript
interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens?: number; // estimated
}

// Build context from last N messages
const messages = [
  { role: 'system', content: systemPrompt },
  ...conversation.slice(-5).map(msg => ({
    role: msg.role,
    content: msg.content
  })),
  { role: 'user', content: question }
];
```

#### 3. Better Error Handling & Retry Logic (Medium Impact)
**Status**: Planned  
**Priority**: P2

**Goal**: Add automatic retry with exponential backoff for transient failures.

**Implementation:**
- Wrap `callProvider` with retry logic
- Detect transient errors (network, rate limits, timeouts)
- Exponential backoff: 1s, 2s, 4s delays
- Show retry indicator in UI
- Allow user to cancel retry
- Log retry attempts for debugging

**Components:**
- `context-repo/.context/pipelines/ai-common.mjs`
- `app/src/renderer/stores/aiStore.ts`

**Implementation:**
```typescript
async function callProviderWithRetry(options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callProvider(options);
    } catch (error) {
      if (!isRetryable(error) || attempt === maxRetries - 1) {
        throw error;
      }
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### 4. Diff Viewer for Edits (High UX Impact)
**Status**: Planned  
**Priority**: P1

**Goal**: Display proposed edits in a side-by-side diff view instead of raw YAML.

**Implementation:**
- Create new `DiffViewer.vue` component
- Use diff library (e.g., `diff-match-patch`, `jsdiff`, or `monaco-editor`)
- Show before/after with syntax highlighting
- Highlight added/removed/changed lines
- Support line numbers and context
- Integrate into `AIAssistantPanel.vue` edit display

**Components:**
- `app/src/renderer/components/DiffViewer.vue` (new)
- `app/src/renderer/components/AIAssistantPanel.vue`

**Dependencies:**
```json
{
  "diff-match-patch": "^1.0.5",
  "@types/diff-match-patch": "^1.0.36"
}
```

**UI Structure:**
```vue
<DiffViewer
  :original="originalContent"
  :modified="edit.updatedContent"
  :language="'yaml'"
  :file-path="edit.filePath"
/>
```

#### 5. Conversation Export/Import (Low Impact)
**Status**: Planned  
**Priority**: P3

**Goal**: Allow users to save/load conversations for reference.

**Implementation:**
- Add "Export" button to export conversation as JSON or Markdown
- Add "Import" button to load previous conversation
- Store exports in user data directory
- Include metadata (timestamp, repo, model used)
- Option to share conversations across team

**Components:**
- `app/src/renderer/stores/aiStore.ts`
- `app/src/renderer/components/AIAssistantPanel.vue`
- `app/src/main/index.ts` (file I/O handlers)

#### 6. Cost Estimation (Medium Impact)
**Status**: Planned  
**Priority**: P2

**Goal**: Show estimated cost before sending requests (especially for paid APIs).

**Implementation:**
- Add token counting utility (tiktoken or approximate)
- Estimate tokens in prompt + expected response
- Display cost based on provider pricing
- Add cost tracking per session/day/month
- Warn when approaching budget limits

**Components:**
- `app/src/renderer/stores/aiStore.ts`
- `app/src/renderer/components/AIAssistantPanel.vue`
- `context-repo/.context/pipelines/ai-common.mjs`

**Pricing Data:**
```typescript
const PRICING = {
  'azure-openai': {
    'gpt-4o': { input: 0.00015, output: 0.0006 }, // per 1K tokens
    'gpt-4o-mini': { input: 0.000003, output: 0.00001 }
  },
  'ollama': { '*': { input: 0, output: 0 } } // Free
};
```

#### 7. Multi-turn Edit Refinement (High Impact)
**Status**: Planned  
**Priority**: P1

**Goal**: Allow user to request changes to proposed edits before applying.

**Implementation:**
- Add "Refine" button next to each proposed edit
- Open refinement dialog with edit context
- Send refinement request to AI with original edit
- Replace edit in conversation with refined version
- Support multiple refinement rounds
- Track edit history/versions

**Components:**
- `app/src/renderer/components/AIAssistantPanel.vue`
- `app/src/renderer/stores/aiStore.ts`
- `context-repo/.context/pipelines/ai-assistant.mjs`

**Workflow:**
```
1. AI proposes edit
2. User clicks "Refine" → enters feedback
3. AI generates new version considering feedback
4. User reviews → Apply or Refine again
```

#### 8. Batch Operations (Medium Impact)
**Status**: Planned  
**Priority**: P2

**Goal**: Apply multiple edits atomically with rollback on failure.

**Implementation:**
- Add "Apply All" button for pending edits
- Create backup of all files before applying
- Apply edits sequentially, tracking success/failure
- On any failure, rollback all changes
- Show progress indicator during batch apply
- Display summary of results

**Components:**
- `app/src/renderer/stores/aiStore.ts`
- `app/src/main/index.ts`
- `context-repo/.context/pipelines/ai-assistant.mjs`

**Implementation:**
```typescript
async function applyEditsBatch(edits: AssistantEdit[]) {
  const backups = await createBackups(edits);
  const results = [];
  
  try {
    for (const edit of edits) {
      const result = await applyEdit(edit);
      results.push(result);
      if (!result.ok) throw new Error('Edit failed');
    }
    return { ok: true, results };
  } catch (error) {
    await restoreBackups(backups);
    return { ok: false, error: error.message, results };
  }
}
```

### Implementation Priorities

**Phase 1 (Immediate - 1-2 weeks):**
- ✅ Robust JSON parsing with fallback (COMPLETED)
- ✅ Diff Viewer for Edits (COMPLETED)
- P1: Streaming Responses

**Phase 2 (Short-term - 2-3 weeks):**
- P1: Conversation Context Management
- P1: Multi-turn Edit Refinement

**Phase 3 (Medium-term - 3-4 weeks):**
- P2: Better Error Handling & Retry Logic
- P2: Cost Estimation
- P2: Batch Operations

**Phase 4 (Future - 4+ weeks):**
- P3: Conversation Export/Import

### Success Metrics

- **User Experience**: 40% reduction in time-to-apply AI edits (via diff viewer)
- **Reliability**: 90% reduction in JSON parsing errors (via robust extraction)
- **Engagement**: 2x increase in multi-turn AI conversations (via context management)
- **Efficiency**: 30% reduction in failed edit applications (via preview+diff)
- **Cost Transparency**: 100% of paid API users aware of costs before sending

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
