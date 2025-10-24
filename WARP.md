# WARP.MD — Build the **Context‑Sync** Electron+Vue App

A fast, copy‑pasteable guide (optimized for Warp) to scaffold an Electron Forge + Vue 3 + Tailwind desktop app that manages a **GitHub context repo** for spec‑driven development. Includes a consistency engine, prompt generation, and CI.

> **Goal**: MVP app that keeps features ⇄ stories ⇄ specs ⇄ tasks ⇄ services ⇄ packages **in sync** and generates agent‑ready prompt contexts.

---

## TL;DR (one‑shot for Windows/PowerShell)

```powershell
# 1) prerequisites
node -v  # should be 20+
corepack enable
corepack prepare pnpm@latest --activate

# 2) workspace
mkdir -p $HOME\work\context-sync
cd $HOME\work\context-sync

# 3) init Electron Forge (TypeScript) and add Vite+Vue+Tailwind
pnpm dlx @electron-forge/cli@latest init app --template=typescript
cd app
pnpm add -D @electron-forge/plugin-vite vite @vitejs/plugin-vue tailwindcss postcss autoprefixer
pnpm add vue pinia
pnpm add yaml ajv handlebars chokidar cytoscape isomorphic-git simple-git execa
pnpm add -D @types/node @types/handlebars

# 4) add renderer scaffolding, Tailwind, and Forge config
# (create the files below in this doc under "Files to add/replace")

# 5) context repo sidecar (schemas, rules, templates, pipelines)
cd ..
mkdir context-repo
cd context-repo
git init
mkdir -p .context\schemas,.context\rules,.context\templates\prompts,.context\templates\docs,.context\pipelines,contexts\features,contexts\userstories,contexts\specs,contexts\tasks,contexts\services,contexts\packages,generated\prompts,generated\docs\impact

# 6) add schema + pipeline files (see sections below) and test
node .context\pipelines\validate.mjs

# 7) run app
cd ..\app
pnpm install
pnpm start
```

---

## Prerequisites

* Node.js 20+ (LTS version)
* Git (CLI)
* **pnpm** (via `corepack enable && corepack prepare pnpm@latest --activate`)
* Windows with PowerShell 7+ (current environment: PowerShell 7.5.4)

**IMPORTANT**: 
- **Always use pnpm as the package manager**—never use npm or yarn
- pnpm is required for workspace management and dependency efficiency
- Always use LTS (Long Term Support) versions of dependencies and packages for stability

---

## Architecture & Best Practices

### Core Technologies
- **Desktop Framework**: Electron Forge with TypeScript
- **Package Manager**: pnpm (exclusive - DO NOT use npm or yarn)
- **Frontend**: Vue 3 (Composition API) + Pinia for state management
- **Styling**: Tailwind CSS with PostCSS
- **Build Tool**: Vite with @vitejs/plugin-vue
- **Version Control Integration**: isomorphic-git, simple-git
- **Data Validation**: AJV (JSON Schema validator)
- **Template Engine**: Handlebars
- **File Watching**: chokidar
- **Graph Visualization**: Cytoscape

### Development Philosophy
* **Source of truth = GitHub context repo**: YAML + JSON Schema; PRs + CI validation block drift
* **Deterministic generation** first, **AI second**: pipelines (validate/graph/impact/generate) are repeatable and diffable
* **Strict ESM everywhere**: Electron main, renderer, and pipelines use ESM to avoid dual‑module headaches
* **Clear boundaries**: UI (Electron/Vue) only orchestrates; all graph/consistency logic lives in repo pipelines
* **Single package manager**: pnpm + lockfile committed; versions pinned via `overrides`
* **Schema‑first contracts**: changes to stories/specs/services trigger impact analysis before merge
* **Branch‑per‑change + PR template**: auto‑generated impact report in PR body
* **Graph visibility**: Cytoscape graph in app; stale items highlighted
* **Tests where it matters**: unit tests for pipelines; snapshot tests for prompt output if needed

---

## Module Resolution & Package Management (Critical)

To keep imports, builds, and runtime resolution consistent across **Electron main**, **preload**, **renderer (Vite)**, and **Node pipelines**, we use a unified strategy.

### ✅ Recommended Strategy: **Bundle main + preload with Vite**

Unify everything under a bundler so import rules are identical across the app.

**What this buys you**

* Extensionless ESM imports everywhere (no `./file.js` suffix games in TS)
* One alias map (TS + Vite) for main, preload, renderer
* No Node ESM edge‑cases at runtime; Vite resolves and bundles

**Implementation**

1. **Forge config**: enable Vite for **main**, **preload**, and **renderer**

```typescript path=null start=null
// app/forge.config.ts
import { VitePlugin } from '@electron-forge/plugin-vite';
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: { executableName: 'context-sync' },
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/main/preload.ts', config: 'vite.preload.config.ts', target: 'preload' }
      ],
      renderer: {
        configFile: 'vite.renderer.config.ts',
        devContentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
      },
    }),
  ],
};
export default config;
```

2. **Vite configs share aliases** (match TS paths)

```typescript path=null start=null
// app/vite.shared.alias.ts
import path from 'node:path';
export const alias = {
  '@': path.resolve(__dirname, 'src/renderer'),
  '~main': path.resolve(__dirname, 'src/main')
};
```

```typescript path=null start=null
// app/vite.main.config.ts
import { defineConfig } from 'vite';
import { alias } from './vite.shared.alias';
export default defineConfig({ resolve: { alias } });
```

```typescript path=null start=null
// app/vite.preload.config.ts
import { defineConfig } from 'vite';
import { alias } from './vite.shared.alias';
export default defineConfig({ resolve: { alias } });
```

```typescript path=null start=null
// app/vite.renderer.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { alias } from './vite.shared.alias';
export default defineConfig({ plugins: [vue()], resolve: { alias } });
```

3. **TypeScript uses Bundler everywhere**

```json path=null start=null
// app/tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/renderer/*"], "~main/*": ["src/main/*"] },
    "skipLibCheck": true
  }
}
```

**Import Rule:** **Do NOT append `.js`** in TS source. Use `import x from '~/file'` or `'./file'`. Vite/TS resolve it.

### Node & Package Management

* Pin versions: `.nvmrc`, `"packageManager": "pnpm@x.y.z"`, `engines.node`
* One PM: **pnpm** only; commit `pnpm-lock.yaml`
* Use `overrides` to pin transitive deps

### Electron ESM Notes

If you ever drop down to Node APIs in main:

```typescript path=null start=null
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

> **Result:** Identical module resolution across processes, no extension suffix churn, reproducible builds.

---

## Project Structure

```
my-context-kit/
├─ app/                          # Electron Forge + Vue + Tailwind desktop app
│  ├─ src/
│  │  ├─ main/                   # Electron main process
│  │  │  ├─ index.ts             # Main entry, BrowserWindow, IPC handlers
│  │  │  ├─ preload.ts           # Context bridge for renderer IPC
│  │  │  └─ pipelines.ts         # Bridge to context-repo scripts
│  │  └─ renderer/               # Vue frontend
│  │     ├─ main.ts              # Vue app initialization
│  │     ├─ App.vue              # Root component
│  │     └─ styles/
│  │        └─ tailwind.css
│  ├─ forge.config.ts            # Electron Forge configuration
│  ├─ vite.main.config.ts        # Vite config for main process
│  ├─ vite.preload.config.ts     # Vite config for preload
│  ├─ vite.renderer.config.ts    # Vite config for renderer
│  ├─ vite.shared.alias.ts       # Shared path aliases
│  └─ package.json
└─ context-repo/                 # Git-versioned source of truth
   ├─ .context/
   │  ├─ schemas/                # JSON Schemas for YAML entities
   │  ├─ rules/                  # Declarative consistency rules
   │  ├─ templates/              # Handlebars templates
   │  │  ├─ prompts/             # Prompt generation templates
   │  │  └─ docs/                # Documentation templates
   │  └─ pipelines/              # Node.js validation/generation scripts
   │     ├─ validate.mjs         # Schema validation
   │     ├─ build-graph.mjs      # Dependency graph builder
   │     ├─ impact.mjs           # Impact analysis
   │     └─ generate.mjs         # Artifact generation
   ├─ contexts/                  # YAML entity storage
   │  ├─ features/
   │  ├─ userstories/
   │  ├─ specs/
   │  ├─ tasks/
   │  ├─ services/
   │  └─ packages/
   └─ generated/                 # Auto-generated artifacts
      ├─ prompts/
      └─ docs/impact/
```

---

## Coding Standards

### TypeScript
- **Always use TypeScript** for all new code (compiles to JavaScript)
- Use strict typing; avoid `any` types
- Prefer interfaces for object shapes
- Use modern ES6+ syntax (async/await, destructuring, arrow functions)

### Vue 3 Conventions
- **Use Composition API exclusively** (not Options API)
- Use `<script setup lang="ts">` syntax
- Follow single-file component (SFC) structure
- Leverage Pinia for state management across components

### Styling with Tailwind
- Use Tailwind utility classes; avoid custom CSS when possible
- Follow mobile-first responsive design patterns
- Extract common patterns to reusable components, not custom CSS classes

### File Naming
- **Components**: PascalCase (e.g., `ContextTree.vue`, `GraphView.vue`)
- **Utilities/helpers**: camelCase (e.g., `buildGraph.ts`, `validateSchema.ts`)
- **Pipeline scripts**: kebab-case with .mjs extension (e.g., `build-graph.mjs`)
- **YAML entities**: kebab-case (e.g., `FEAT-002-ds-button.yaml`)

### Import Order & Organization
- Group imports in this order:
  1. Node built-ins (e.g., `fs`, `path`)
  2. External packages (e.g., `electron`, `vue`)
  3. Internal aliases (e.g., `@/components`)
  4. Relative imports (e.g., `./utils`)
- Use extensionless imports with Vite bundler (no `.js` suffix needed)
- Consistency: All imports must follow the same convention across main and renderer processes

### Code Quality Expectations
- Never take shortcuts for speed; prioritize quality and correctness
- Break large tasks into smaller, manageable subtasks
- Write clear, self-documenting code with appropriate comments for complex logic
- Follow the repository's existing architecture—do not change it without discussion
- **Always prefer LTS versions** of dependencies and packages when installing or updating

---

## Development Workflow

### Common Commands (Warp-friendly)

```powershell
# Install dependencies (ALWAYS use pnpm)
cd app
pnpm install

# Start the Electron app
pnpm start

# Build the app
pnpm run build

# Lint and format (always run after building)
pnpm lint
pnpm format

# Type checking
pnpm typecheck

# Run validation on context repo
$env:REPO = "C:\Users\lukeu\source\repos\my-context-kit\context-repo"
node "$env:REPO\.context\pipelines\validate.mjs"

# Build dependency graph
node "$env:REPO\.context\pipelines\build-graph.mjs"

# Run impact analysis
node "$env:REPO\.context\pipelines\impact.mjs" FEAT-002

# Generate artifacts
node "$env:REPO\.context\pipelines\generate.mjs" FEAT-002
```

### Build & Deployment Process
1. **Always run linting/formatting after building** (e.g., `pnpm lint`)
2. **Ensure all lint issues are fixed** before deploying to production
3. **Never deploy without explicit confirmation** from user
4. **Never commit changes** unless explicitly requested

### IPC Architecture
- Main process exposes handlers via `ipcMain.handle`
- Preload script bridges via `contextBridge.exposeInMainWorld`
- Renderer invokes via `window.api.context.*` methods
- All context-repo operations execute pipeline scripts as child processes

## Context Repository Rules

### Entity Types & Schemas
All entities are YAML files validated against JSON Schemas:

1. **Features** (`feature.schema.json`)
   - Required: `id`, `title`, `status`
   - Links to: userStories, specs, tasks, services, packages
   - Contains: prompts (instructions, contextRefs)

2. **User Stories** (`userstory.schema.json`)
   - Required: `id`, `feature`, `asA`, `iWant`, `soThat`
   - Contains: acceptanceCriteria, impacts

3. **Specs** (`spec.schema.json`)
   - Required: `id`, `title`
   - Contains: related entities

4. **Tasks** (`task.schema.json`)
   - Required: `id`, `title`, `status`
   - Status values: `todo`, `doing`, `done`, `blocked`, `needs-review`

### Consistency Rules
- Changes to acceptance criteria trigger `needs-review` status on related tasks/specs
- All entity relationships must reference valid IDs
- Status transitions must be tracked and validated

### Validation Pipeline
- All YAML files must pass schema validation before commit
- CI runs validation on every pull request
- Local validation via `validate.mjs` before pushing

## Prompt Generation

### Templates
- Use Handlebars templates in `.context/templates/prompts/`
- Templates compile entity data into agent-ready markdown
- Generated prompts stored in `generated/prompts/`

### Prompt Instructions
Features define coding constraints via `prompts.instructions`:
- Output format specifications (e.g., "TypeScript + Vue 3 SFC")
- Framework conventions (e.g., "Follow Tailwind utility conventions")
- Reference materials via `prompts.contextRefs`

## Git Integration (Future)
- Branch creation and switching from UI
- Commit generation with structured messages
- PR creation via Octokit/GitHub CLI
- Change tracking and impact visualization

## Testing & Quality Assurance
- **Never assume test frameworks**—check README or search codebase first
- Verify solutions with tests when possible
- Run typecheck commands if available (e.g., `pnpm typecheck`)
- Test IPC communication thoroughly (main ↔ renderer)

## CI/CD
GitHub Actions workflow (`.github/workflows/context-validate.yml`):
- Validates all schemas on PR
- Builds dependency graph
- Runs impact analysis
- Blocks merge on validation failures

## Known Issues & Troubleshooting

### Common Problems
- **Forge + Vite plugin missing**: Ensure `@electron-forge/plugin-vite` in devDependencies
- **Tailwind not applying**: Verify `content` glob includes `src/renderer/**/*.vue`
- **Pipelines not executable**: On Windows, use `node` explicitly instead of direct execution
- **YAML schema errors**: Run `validate.mjs` for structured error output

### Windows-Specific Considerations
- Use PowerShell 7+ for best compatibility
- Path separators: Use `\` or `/` (Node.js normalizes)
- Pipeline scripts: Always invoke with `node` command
- Git line endings: Configure `.gitattribals` for YAML files

## Security & Best Practices
- No secrets in plain text commands
- Use environment variables for sensitive data
- Context repo contains no executable code—only declarative YAML
- Electron CSP configured to prevent XSS

## Future Enhancements
- Real ContextTree component with expand/collapse
- GraphView using Cytoscape for dependency visualization
- Rich YAML editor with live validation
- Semver coupling rules for package dependencies
- OpenAPI spec change detection
- Multi-repo support
- Agent-ready prompt bundles per feature/story

## Cost Estimation Policy
Every response should include an estimated token/cost impact when applicable.

---

**Last Updated**: 2025-10-23  
**Maintainer**: @lukeu  
**Project Status**: MVP Development
