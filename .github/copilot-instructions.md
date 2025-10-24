# GitHub Copilot Instructions for Context-Sync

## Project Overview
Context-Sync is a desktop application built with Electron Forge, Vue 3, and Tailwind CSS that manages a GitHub-versioned context repository for spec-driven software development.

## Key Guidelines

### Package Manager
- **ALWAYS use pnpm** - never use npm or yarn
- Use LTS versions of all dependencies

### Architecture
- Follow the repository's existing architecture - do not change it
- Maintain separation between Electron main process, preload, and renderer
- All context-repo operations execute through IPC to pipeline scripts

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
- Use Tailwind utility classes - avoid custom CSS when possible
- Follow mobile-first responsive design
- Extract common patterns to reusable components

### Workflow
- Always run linting/formatting after building
- Ensure all lint issues are fixed before deploying
- Never deploy without explicit confirmation from user
- Never commit changes unless explicitly requested

### Testing
- Never assume test frameworks - check README or search codebase first
- Verify solutions with tests when possible
- Run typecheck commands if available

## File Organization
```
app/
  src/
    main/           # Electron main process + IPC handlers
    renderer/       # Vue 3 application
      components/   # Vue components
      stores/       # Pinia stores
      styles/       # Tailwind CSS

context-repo/
  .context/
    schemas/        # JSON Schemas
    pipelines/      # Node.js validation/generation scripts
    templates/      # Handlebars templates
  contexts/         # YAML entity storage
  generated/        # Auto-generated artifacts
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
```

## Important Reminders
- Follow OAuth 2.0 best practices for authentication features
- Maintain context isolation in Electron (no nodeIntegration)
- Use CSP headers for security
- All secrets must be environment variables - never plain text
- Git operations use simple-git or isomorphic-git libraries
