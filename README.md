# Context-Sync

A desktop application for managing GitHub-versioned context repositories for spec-driven software development.

## Project Status

**MVP Development - Phase 2 Complete** ✅

### Completed (Phase 1 & 2)
- ✅ Electron Forge + Vite + TypeScript setup
- ✅ Vue 3 + Pinia + Tailwind CSS configuration
- ✅ IPC bridge between main and renderer processes
- ✅ Context repository structure
- ✅ JSON Schemas for all 6 entity types
- ✅ Validation pipeline with AJV
- ✅ Sample YAML entities for testing
- ✅ Build-graph pipeline (scan YAML, construct dependency graph)
- ✅ Impact analysis pipeline (find affected entities)
- ✅ Prompt generation pipeline (Handlebars templates)
- ✅ ContextTree component (collapsible, searchable, status indicators)
- ✅ Pinia stores (contextStore, impactStore)
- ✅ Basic impact analysis UI
- ✅ TypeScript 5.3+ with strict typing

### In Progress (Phase 3)
- ⏳ YAML editor component with live validation
- ⏳ GraphView component with Cytoscape.js
- ⏳ Enhanced impact panel with visual diff
- ⏳ File system operations (save, create entities)

## Prerequisites

- **Node.js**: 22+ (LTS)
- **pnpm**: 10+ (installed via corepack)
- **Git**: 2.33+
- **PowerShell**: 7+ (Windows)

## Quick Start

### 1. Setup

```powershell
# Enable pnpm
corepack enable
corepack prepare pnpm@latest --activate
pnpm config set node-linker hoisted

# Clone repository
git clone <your-repo-url>
cd my-context-kit
```

### 2. Install Dependencies

```powershell
# Install app dependencies
cd app
pnpm install

# Install context-repo dependencies
cd ../context-repo
pnpm install
```

### 3. Run the App

```powershell
cd app
pnpm start
```

### 4. Validate Context Repository

```powershell
cd context-repo
pnpm validate
```

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

pnpm validate       # Validate all YAML entities
pnpm build-graph    # Build dependency graph (coming soon)
pnpm impact         # Run impact analysis (coming soon)
pnpm generate       # Generate prompts (coming soon)
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

## Next Steps

1. Implement build-graph pipeline
2. Implement impact analysis pipeline
3. Implement prompt generation pipeline
4. Build UI components (ContextTree, YamlEditor, ImpactPanel, GraphView)
5. Set up Pinia stores
6. Add Git integration
7. Implement CI/CD with GitHub Actions

## Contributing

1. Follow the existing architecture
2. Use pnpm exclusively
3. Write TypeScript with strict typing
4. Test locally with `pnpm start`
5. Validate changes with `pnpm lint` and `pnpm typecheck`

## Documentation

- [WARP.md](./WARP.md) - Complete build guide
- [docs/spec.md](./docs/spec.md) - Technical specification
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) - AI assistant guidelines

## License

MIT

## Author

Luke Adams (@lukeu)

---

**Status**: MVP Phase 1 Complete | **Version**: 0.1.0 | **Last Updated**: 2025-10-23
