# Context-Sync

A desktop application for managing GitHub-versioned context repositories for spec-driven software development.

<img width="2559" height="1546" alt="image" src="https://github.com/user-attachments/assets/f6c1ef81-9c8c-400e-9fce-62bb4edc3c62" />

<img width="2556" height="1545" alt="image" src="https://github.com/user-attachments/assets/7307d982-0880-4cea-a0f4-4572c24565d9" />


<img width="1879" height="1092" alt="image" src="https://github.com/user-attachments/assets/8ebd3773-869b-4301-b2e4-20701c93641b" />


<img width="701" height="964" alt="image" src="https://github.com/user-attachments/assets/d6ab660d-d743-4e93-bc79-2352eaaa154d" />




## Project Status

**MVP Development - Phase 7 Complete** ✅

### Completed Phases

#### Phase 1-2: Foundation ✅
- ✅ Electron Forge + Vite + TypeScript setup
- ✅ Vue 3 + Pinia + Tailwind CSS configuration
- ✅ IPC bridge between main and renderer processes
- ✅ Context repository structure
- ✅ JSON Schemas for all 6 entity types
- ✅ Validation pipeline with AJV
- ✅ Sample YAML entities for testing

#### Phase 3: Core UI ✅
- ✅ YAML editor component with CodeMirror
- ✅ Live schema validation in editor
- ✅ File save/load operations
- ✅ Enhanced ContextTree with filtering
- ✅ Impact panel with real-time analysis

#### Phase 4: Prompt Generation ✅
- ✅ Handlebars template system
- ✅ Prompt generation pipeline
- ✅ Prompt modal with copy-to-clipboard
- ✅ Template-based prompt rendering

#### Phase 5: Graph Visualization ✅
- ✅ Cytoscape.js integration
- ✅ Interactive dependency graph
- ✅ Node coloring by entity type
- ✅ Path finding between nodes
- ✅ Zoom, pan, and search functionality
- ✅ Click to open entity in editor

#### Phase 6: Git Integration ✅
- ✅ Git status tracking (via simple-git)
- ✅ Diff viewer for changed files
- ✅ Commit UI with smart templates
- ✅ Branch creation and switching
- ✅ PR creation via GitHub CLI
- ✅ Impact analysis in commit messages

#### Phase 7: CI/CD ✅
- ✅ GitHub Actions workflow for validation
- ✅ Impact analysis on pull requests
- ✅ PR comment bot with reports
- ✅ Merge protection documentation
- ✅ Complete CI/CD pipeline

#### Phase 8: Polish & Docs ✅
- ✅ Error handling (network, file I/O)
- ✅ Loading states and spinners
- ✅ Keyboard shortcuts (Ctrl+N for entity creation)
- ✅ User guide (README)

#### Phase 9: Context Building & Generation ✅
- ✅ Multi-step wizard modal for entity creation
- ✅ Smart suggestions (domain, relationships, ID generation)
- ✅ Template library with 7 pre-built entity patterns
- ✅ AI integration (Ollama and Azure OpenAI support)
- ✅ Secure credential storage with OS-level encryption
- ✅ Keyboard shortcuts (Ctrl+N for quick create)
- ✅ Auto-commit and feature branch creation
- ✅ Bulk entity creation mode

### Current Phase

All MVP phases complete! The application now includes:
- **AI-Assisted Entity Creation**: Generate entities from natural language with Ollama or Azure OpenAI
- **Intelligent Context Building**: Smart suggestions, templates, and relationship inference
- **Material 3 Design System**: Consistent, modern UI with Intel brand colors

## Prerequisites

- **Node.js**: 22+ (LTS)
- **pnpm**: 10+ (installed via corepack)
- **Git**: 2.33+
- **PowerShell**: 7+ (Windows)

## Quick Start

### 1. Clone and Setup

```powershell
# Clone the repository
git clone https://github.com/lukeus/my-context-kit.git
cd my-context-kit

# Enable pnpm (if not already enabled)
corepack enable
corepack prepare pnpm@latest --activate
```

### 2. Install Dependencies

```powershell
# Install app dependencies
cd app
pnpm install

# Install context-repo dependencies (if needed)
cd ../context-repo
pnpm install

# Return to app directory
cd ../app
```

### 3. Run the Application

```powershell
# Start the Electron app in development mode
pnpm start
```

The app will launch and open a window where you can:
- Browse and edit YAML entities in the context repository
- Create new entities with AI assistance using natural language
- View dependency graphs between features, stories, specs, and tasks
- Validate entity schemas
- Generate AI-ready prompts
- Commit changes with Git integration

### 4. Validate Context Repository (Optional)

```powershell
# From project root
cd context-repo
pnpm validate
```

## Spec Kit Workflow

### Additional Prerequisites
- Access to the `github/spec-kit` release artifacts (GitHub credentials or token if releases are private)
- Outbound HTTPS connectivity from the desktop where Context-Sync runs
- `context-repo/.context` committed to Git so cached releases and telemetry stay traceable

### Fetch & Cache Lifecycle
1. Use **Fetch Spec Kit** inside the Speckit Workflow (or run `pnpm exec node .context/pipelines/speckit-fetch.mjs --repoPath %CD%` from `context-repo/`).
2. Successful fetches update `.context/state/speckit-fetch.json` with provenance and hydrate `.context/speckit-cache/<tag>/` with markdown previews and templates.
3. The Speckit store treats the cache as stale when `fetchedAt` is older than seven days. Stale caches surface warnings in the UI and block generation until a refresh (or an explicit override from the command palette).

> **Policy**: Keep Spec Kit caches younger than seven days to guarantee template freshness. The UI prompts for refresh and will refuse to run generation workflows until the cache is renewed.

### Automated Pipeline Verification
- After entities are generated from Spec Kit markdown, Context-Sync automatically runs `validate`, `build-graph`, `impact`, and `generate` in order.
- Each stage’s status, errors, and generated file paths appear in the Pipeline Status panel, with quick links back to both the YAML entity and originating Spec Kit preview.
- The workflow reuses cached fetch data; rerunning the pipelines after fixes simply retries the chain without requiring another fetch unless the cache is stale.

## Project Structure

```
my-context-kit/
├── app/                          # Electron desktop application
│   ├── src/
│   │   ├── main/                 # Electron main process
│   │   │   ├── index.ts          # Main entry, BrowserWindow, IPC handlers
│   │   │   └── preload.ts        # Context bridge for renderer IPC
│   │   └── renderer/             # Vue 3 frontend
│   │       ├── main.ts           # Vue app initialization
│   │       ├── App.vue           # Root component
│   │       ├── components/       # Vue components
│   │       ├── stores/           # Pinia stores
│   │       └── styles/           # Tailwind CSS
│   ├── forge.config.ts           # Electron Forge configuration
│   ├── vite.*.config.ts          # Vite configurations
│   └── package.json
│
├── context-repo/                 # Git-versioned source of truth
│   ├── .context/
│   │   ├── schemas/              # JSON Schemas for validation
│   │   ├── rules/                # Consistency rules
│   │   ├── templates/            # Handlebars templates
│   │   └── pipelines/            # Node.js scripts
│   │       └── validate.mjs      # Schema validation
│   ├── contexts/                 # YAML entity storage
│   │   ├── features/
│   │   ├── userstories/
│   │   ├── specs/
│   │   ├── tasks/
│   │   ├── services/
│   │   └── packages/
│   └── generated/                # Auto-generated artifacts
│       ├── prompts/
│       └── docs/
│
├── docs/                         # Documentation
│   └── spec.md                   # Technical specification
├── WARP.md                       # Build guide
└── README.md                     # This file
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop Framework | Electron Forge 7 | Cross-platform packaging |
| Frontend | Vue 3 (Composition API) | Reactive UI |
| State Management | Pinia | Centralized state |
| Styling | Tailwind CSS | Utility-first CSS |
| Build Tool | Vite 5 | Fast bundling |
| Type Safety | TypeScript (strict) | Static typing |
| Schema Validation | AJV | YAML validation |
| Templating | Handlebars | Prompt generation |
| Graph Visualization | Cytoscape.js | Dependency graphs |
| Git Integration | simple-git | Version control |
| Package Manager | pnpm (exclusive) | Fast dependencies |

## Development Commands

### App Development

```powershell
cd app

pnpm start          # Start Electron app in dev mode
pnpm build          # Build for production
pnpm package        # Package as executable
pnpm lint           # Lint TypeScript/Vue files
pnpm format         # Auto-fix linting issues
pnpm typecheck      # TypeScript type checking
```

### Context Repository

```powershell
cd context-repo

node .context/pipelines/validate.mjs       # Validate all YAML entities
node .context/pipelines/build-graph.mjs    # Build dependency graph
node .context/pipelines/impact.mjs FEAT-001 # Run impact analysis
node .context/pipelines/generate.mjs FEAT-001 # Generate prompts
```

## Entity Types

The context repository supports 6 entity types:

1. **Feature** (`FEAT-###`) - High-level capabilities
2. **User Story** (`US-###`) - User-centric functionality
3. **Spec** (`SPEC-###`) - Technical specifications
4. **Task** (`T-###`) - Implementation tasks
5. **Service** - Backend/infrastructure services
6. **Package** - Software packages/libraries

All entities are stored as YAML files and validated against JSON Schemas.

## Validation

The validation pipeline checks:
- ✅ YAML syntax correctness
- ✅ Schema compliance (required fields, types, patterns)
- ✅ Cross-reference integrity (no dangling references)
- ✅ ID format consistency

Example validation output:
```json
{
  "ok": true,
  "message": "All validations passed",
  "stats": {
    "totalEntities": 9,
    "byType": {
      "feature": 1,
      "userstory": 2,
      "spec": 1,
      "task": 3,
      "service": 1,
      "package": 1
    }
  }
}
```

## Configuration

### Module Resolution

All code uses **Bundler** module resolution:
- Extensionless imports (no `.js` suffix)
- Path aliases: `@/*` (renderer), `~main/*` (main)
- Unified Vite bundling for main, preload, and renderer

### TypeScript

```json
{
  "compilerOptions": {
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "strict": true
  }
}
```

## Best Practices

### Code Quality
- ✅ Use TypeScript with strict typing
- ✅ Avoid shortcuts - prioritize correctness
- ✅ Break large tasks into smaller pieces
- ✅ Write self-documenting code

### Workflow
- ✅ Run `pnpm lint` after building
- ✅ Fix all lint issues before deploying
- ✅ Never deploy without confirmation
- ✅ Never commit without explicit request

### Security
- ✅ No hardcoded secrets
- ✅ Use environment variables
- ✅ Context isolation enabled (`contextIsolation: true`)
- ✅ No node integration in renderer

## Troubleshooting

### Common Issues

**Issue**: `pnpm: command not found`
```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

**Issue**: Vite plugin missing
```powershell
pnpm add -D @electron-forge/plugin-vite
```

**Issue**: Tailwind not applying
- Check `tailwind.config.ts` content glob includes `src/renderer/**/*.vue`
- Verify `@tailwind` directives in CSS

**Issue**: Validation fails
```powershell
cd context-repo
pnpm validate
# Review error output for schema/cross-reference issues
```

## Features

### ✅ Implemented

#### AI Assistant (Enhanced)
- **Streaming Responses**: Real-time token-by-token AI responses with progress indicators
- **Configurable Prompts**: Customize system prompts, quick actions, and example questions via UI
- **Token Probability Viewer**: Visualize AI confidence levels with color-coded token probabilities (Azure OpenAI)
- **Smart Edit Suggestions**: AI proposes YAML edits with validation before application
- **Multi-Provider Support**: Ollama (local) and Azure OpenAI with automatic capability detection
- **Secure Credentials**: Encrypted API key storage using OS-level security (Windows Credential Manager)
- **Conversation History**: Context-aware multi-turn conversations with clear, chat-like interface

#### Editor & Validation
- **Auto-Refresh YAML Editor**: Automatically reloads files after AI edits are applied
- **Enhanced Diff Viewer**: Side-by-side comparison with syntax highlighting and color-coded changes
- **Pre-Edit Validation**: YAML syntax validation before applying AI-generated changes
- **Live Schema Validation**: Real-time error detection with inline warnings

#### Core Features
- **AI-Assisted Entity Creation**: Generate entities from natural language
- **Smart Context Builder**: 4-step wizard with templates, suggestions, and validation
- **Context Management**: Browse, edit, and validate YAML entities
- **Dependency Graph**: Visual representation with interactive entity relationships
- **Impact Analysis**: See what changes affect related entities
- **Prompt Generation**: Create AI-ready context for coding agents
- **Git Workflow**: Commit, branch, create PRs from within the app
- **CI/CD**: Automated validation and impact analysis on PRs
- **Material 3 Design**: Modern, consistent UI with Intel brand colors
- **Keyboard Shortcuts**: Ctrl+N for quick create, Ctrl+S for save, Ctrl+Enter to send AI queries

### 🎯 Key Features

**Context Building (Phase 9)**:
- Multi-step wizard for creating features, user stories, specs, and tasks
- AI generation from natural language prompts ("Create a feature for user authentication with OAuth")
- Smart domain suggestions based on keywords and existing patterns
- Relationship suggestions with confidence levels (high ✨, medium, low)
- Template library: CRUD operations, API integration, UI components, bug fixes
- Auto-commit with smart commit messages and feature branch creation
- Bulk creation mode for related entities
- Real-time ID conflict detection and validation

## Contributing

1. Follow the existing architecture
2. Use pnpm exclusively
3. Write TypeScript with strict typing
4. Test locally with `pnpm start`
5. Validate changes with `pnpm lint` and `pnpm typecheck`

## Documentation

- [WARP.md](./WARP.md) - Complete build guide
- [docs/spec.md](./docs/spec.md) - Technical specification
- [docs/phase6-git-workflow-completion.md](./docs/phase6-git-workflow-completion.md) - Git integration
- [docs/phase7-cicd-documentation.md](./docs/phase7-cicd-documentation.md) - CI/CD pipeline
- [docs/merge-protection-setup.md](./docs/merge-protection-setup.md) - Branch protection guide
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) - AI assistant guidelines

## License

MIT

## Author

Luke Adams (@lukeu)

---

**Status**: MVP Phase 7 Complete | **Version**: 0.7.0 | **Last Updated**: 2025-10-24
