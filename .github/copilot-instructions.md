# GitHub Copilot Instructions for My Context Kit

## Project Overview
My Context Kit is a desktop application built with Electron, Vue 3, and Tailwind CSS that manages context repositories for spec-driven software development. It provides AI-powered assistance for validating, navigating, and maintaining structured context graphs.

**Note**: Also see `AGENTS.md` in the root for comprehensive architectural guidance.

## Key Guidelines

### Package Manager
- **ALWAYS use pnpm** - never use npm or yarn
- Use LTS versions of all dependencies

### Architecture
- Follow the repository's existing architecture - do not change it
- Maintain separation between Electron main process, preload, and renderer
- All context-repo operations execute through IPC to pipeline scripts
- C4 diagrams are treated as first-class entities in the Context Tree
- Single left panel architecture - avoid duplicate navigation panels
- **AI Assistant Unification**: Two separate AI implementations exist (`aiStore` + `assistantStore`). When working on AI features, prioritize using `assistantStore` (session-based) and plan migration from legacy `aiStore`

### Code Quality
- Never take shortcuts for speed - prioritize quality and correctness
- Break large tasks into smaller, manageable subtasks
- Use TypeScript with strict typing - avoid `any` types
- Write self-documenting code with comments for complex logic

### TypeScript & Module Resolution
- Use `moduleResolution: "Bundler"` everywhere
- Import paths: extensionless (no `.js` suffix)
- Use path aliases: `@/*` for renderer, `~main/*` for main process

### Vue 3 Conventions
- Use Composition API exclusively (not Options API)
- Use `<script setup lang="ts">` syntax
- Follow single-file component (SFC) structure
- Leverage Pinia for state management

### Styling
- Use Tailwind utility classes with Material 3 design tokens (e.g., `bg-surface`, `text-secondary-900`, `rounded-m3-lg`)
- Follow mobile-first responsive design
- Extract common patterns to reusable components

### Workflow
- Always run linting/formatting after building
- Ensure all lint issues are fixed before deploying
- Never deploy without explicit confirmation from user
- Never commit changes unless explicitly requested

### Release Management
- Follow semantic versioning (major.minor.patch)
- Update CHANGELOG.md before every release
- Use version bump scripts: `pnpm version:patch|minor|major`
- Never create releases without running full test suite
- Code signing for Windows/macOS is planned (not yet implemented)
- Releases are automated via GitHub Actions on tag push

### Testing
- Never assume test frameworks - check README or search codebase first
- Verify solutions with tests when possible
- Run typecheck commands if available

## File Organization
```
app/
  src/
    main/           # Electron main process + IPC handlers
      ipc/handlers/ # IPC handlers for renderer<->main
      services/     # Business logic (assistantSessionManager, etc.)
    preload/        # Context isolation bridges
    renderer/       # Vue 3 application
      components/   # Vue components
        assistant/  # Safe tooling assistant UI components
      stores/       # Pinia stores (aiStore, assistantStore, contextStore)
      styles/       # Tailwind CSS
    shared/         # Shared types between main/renderer (assistant/types.ts)

context-repo/
  .context/
    schemas/        # JSON Schemas
    pipelines/      # Node.js validation/generation scripts
    templates/      # Handlebars templates
  contexts/         # YAML entity storage
  generated/        # Auto-generated artifacts
  c4/               # C4 architecture diagrams (Mermaid)
```

## Commands
```bash
# App development
cd app
pnpm start          # Start Electron app
pnpm build          # Build app
pnpm lint           # Lint code
pnpm format         # Format code
pnpm typecheck      # Type check

# Context repo operations
cd context-repo
pnpm validate       # Validate YAML entities
pnpm build-graph    # Build dependency graph
pnpm impact         # Run impact analysis
pnpm generate       # Generate prompts

# Release management (from project root)
pnpm version:patch  # Bump patch version (0.1.0 → 0.1.1)
pnpm version:minor  # Bump minor version (0.1.0 → 0.2.0)
pnpm version:major  # Bump major version (0.1.0 → 1.0.0)
pnpm release:prepare # Run all pre-release checks
```

## Important Reminders
- Maintain context isolation in Electron (no nodeIntegration)
- Use CSP headers for security
- All secrets must be environment variables - never plain text
- Git operations use simple-git or isomorphic-git libraries
- **AI Features**: Use session-based approach from `assistantStore`, guard risky operations with approvals, log telemetry for all tool invocations
- Support both Azure OpenAI and Ollama providers

## AI Assistant Architecture (Critical)

### Current State
The app has **TWO separate AI assistant implementations** that need unification:

1. **Legacy**: `aiStore.ts` + `AIAssistantModal.vue` (direct API calls, streaming, edit suggestions)
2. **New**: `assistantStore.ts` + `components/assistant/` (session-based, tools, approvals, telemetry)

### When Working on AI Features
- Prefer `assistantStore` for new features (better architecture)
- Plan migration path from `aiStore` to unified implementation
- See `AGENTS.md` for detailed unification strategy
- Always add telemetry logging for tool invocations
- Use approval workflows for risky operations
- Support streaming and non-streaming modes
 - Route tooling and pipeline execution through the LangChain/FastAPI sidecar (no direct model calls from renderer)
 - Use capability manifest + health polling helpers for conditional execution (see `services/langchain/` and planned `services/sidecar/`)
 - Avoid adding new logic to `aiStore`; add a migration checkpoint instead.
