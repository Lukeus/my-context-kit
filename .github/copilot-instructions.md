# GitHub Copilot Instructions for My Context Kit

## Project Overview
My Context Kit is a desktop application built with Electron, Vue 3, and Tailwind CSS that manages context repositories for spec-driven software development. It provides AI-powered assistance for validating, navigating, and maintaining structured context graphs.

**IMPORTANT**: The application is undergoing a clean architecture refactoring. Follow the guidelines in `app/constitution.md` for the target architecture. Key changes:
- Service layer in `src/main/services/` for all business logic
- Domain logic in `domain/` folder (framework-agnostic)
- IPC handlers are thin and delegate to services
- Enterprise features for organization-wide spec management

**Note**: Also see `AGENTS.md` in the root for comprehensive architectural guidance.

## Key Guidelines

### Package Manager
- **ALWAYS use pnpm** - never use npm or yarn
- Use LTS versions of all dependencies

### Architecture
- Follow the **clean layered architecture** defined in `app/constitution.md`
- **Service Layer**: All business logic in `src/main/services/` (GitService, GitHubService, AIService, EnterpriseService)
- **Domain Layer**: Framework-agnostic logic in `domain/` (prompts, enterprise, specs)
- **IPC Handlers**: Thin handlers that only validate and delegate to services
- **Renderer Services**: Vue components call `services/ipcClient.ts`, never `window.electronAPI` directly
- Maintain separation between Electron main process, preload, and renderer
- All context-repo operations execute through IPC to pipeline scripts
- C4 diagrams are treated as first-class entities in the Context Tree
- Single left panel architecture - avoid duplicate navigation panels
- **IPC Namespaces**: Use `ctx:*`, `git:*`, `fs:*`, `ent:*`, `ai:*`, `rag:*`, `settings:*` prefixes
- **AI Assistant**: Use `assistantStore` (session-based) for all AI features

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
- **Tailwind v4 with Material 3**: All UI follows Material 3 design patterns using Tailwind v4 utilities
- Use Material 3 design tokens (e.g., `bg-surface`, `text-secondary-900`, `rounded-m3-lg`)
- Follow mobile-first responsive design
- Extract common patterns to reusable components
- Ensure visual consistency across all views (existing + enterprise features)

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
  domain/                    # Framework-agnostic business logic (NEW)
    prompts/                 # Prompt registry and management
    enterprise/              # Constitution merging, spec derivation
    specs/                   # Spec generation logic
  src/
    main/                    # Electron main process
      index.ts               # App bootstrap
      ipc/
        register.ts          # Central IPC registration
        handlers/            # Domain-specific IPC handlers
          enterprise.handlers.ts  # NEW: Enterprise features
      services/              # Business logic services
        GitService.ts        # Git operations
        GitHubService.ts     # GitHub API operations (NEW)
        AIService.ts         # Unified AI interface (NEW)
        EnterpriseService.ts # Enterprise orchestration (NEW)
        ContextBuilderService.ts
      config/                # App configuration
    preload/                 # Context isolation bridges
    renderer/                # Vue 3 application
      views/                 # Route-level components
      components/            # Reusable UI components
        assistant/           # Safe tooling assistant UI
        enterprise/          # Enterprise dashboard, settings (NEW)
      stores/                # Pinia stores
        enterpriseStore.ts   # NEW: Enterprise state
      services/              # IPC client wrappers
        ipcClient.ts         # Typed IPC methods (NEW)
      styles/                # Tailwind CSS
    shared/                  # Shared types between main/renderer
    types/                   # Type definitions
      enterprise.ts          # NEW: Enterprise types
  enterprise/                # Enterprise prompt templates (NEW)
    prompts/
  constitution.md            # Architectural principles (NEW)
  copilot-instructions.md    # This file
  warp.md                    # Warp AI instructions

context-repo/
  .context/
    schemas/                 # JSON Schemas
    pipelines/               # Node.js validation/generation scripts
    templates/               # Handlebars templates
  contexts/                  # YAML entity storage
  generated/                 # Auto-generated artifacts
  c4/                        # C4 architecture diagrams (Mermaid)
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
- Git operations use simple-git library via GitService
- **AI Features**: Use session-based approach from `assistantStore`, guard risky operations with approvals, log telemetry for all tool invocations
- Support both Azure OpenAI and Ollama providers via unified AIService
- **No hardcoded prompts**: All AI prompts must be in markdown files in `enterprise/prompts/`
- **Service layer**: Never put business logic in IPC handlers or Vue components
- **Type safety**: Use Zod for runtime validation, strict TypeScript everywhere

## AI Assistant Architecture (Critical)

### Current Implementation
- **Primary**: `assistantStore.ts` + `components/assistant/` (session-based, tools, approvals, telemetry)
- **Service Layer**: All AI operations go through `AIService` in main process
- **Unified Interface**: Single service supports Azure OpenAI and Ollama
- **Sidecar Integration**: LangChain/FastAPI sidecar for complex AI operations

### When Working on AI Features
- Use `assistantStore` for all AI features
- Call `AIService` methods via IPC (`ai:*` channels)
- Never call AI providers directly from renderer
- Always add telemetry logging for tool invocations
- Use approval workflows for risky operations
- Support streaming and non-streaming modes
- Route tooling through LangChain/FastAPI sidecar
- Use capability manifest + health polling for conditional execution

### Enterprise AI Features
- **Spec Derivation**: Analyze code and generate specs using AI (`ent:deriveSpec`)
- **Constitution Merging**: Combine global and local constitutions
- **Prompt Templates**: Load prompts from markdown files in `enterprise/prompts/`
- **Provider Configuration**: Store Azure/Ollama endpoints in enterprise settings
