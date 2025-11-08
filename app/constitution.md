# Constitution - Context-Sync Application

## Purpose
This document defines the architectural principles, patterns, and constraints for the Context-Sync Electron application. It serves as the source of truth for technical decisions and guides all development work.

## Core Principles

### 1. Clean Architecture
- **Separation of Concerns**: Main process, renderer process, and domain logic must be clearly separated
- **Service Layer**: All business logic resides in services, not IPC handlers or Vue components
- **Domain-Driven Design**: Domain logic lives in `domain/` folder, independent of Electron or Vue

### 2. Type Safety
- **TypeScript Everywhere**: All code must be TypeScript with strict mode enabled
- **Zod for Validation**: Use Zod for runtime validation and schema definitions
- **Shared Types**: Common types live in `types/` or `shared/` and are used by both main and renderer

### 3. IPC Architecture
- **Namespaced Channels**: All IPC channels use namespace prefixes:
  - `ctx:*` - Context repository operations
  - `git:*` - Git operations
  - `fs:*` - File system operations
  - `ent:*` - Enterprise features
  - `ai:*` - AI/LLM operations
  - `rag:*` - RAG operations
  - `settings:*` - Application settings
- **Centralized Registration**: All IPC handlers registered in `src/main/ipc/register.ts`
- **Handler Modules**: Each domain has its own handler file in `src/main/ipc/handlers/`
- **Thin Handlers**: IPC handlers only validate input and delegate to services

### 4. Service Layer (Main Process)
Services in `src/main/services/` encapsulate all business logic:
- **GitService**: Git operations (clone, commit, push, pull, status)
- **GitHubService**: GitHub API operations (repos, issues, PRs)
- **AIService**: Unified interface for Azure OpenAI and Ollama
- **EnterpriseService**: Enterprise spec orchestration
- **ContextBuilderService**: Context document generation
- **RAGService**: Vector storage and semantic search

Services are:
- Pure TypeScript classes or modules
- Testable in isolation
- Reusable across multiple IPC handlers
- Independent of Electron APIs where possible

### 5. Renderer Architecture (Vue 3)
- **Component Organization**:
  - `views/` - Route-level components
  - `components/` - Reusable UI components
  - `stores/` - Pinia stores for state management
  - `services/` - IPC client wrappers
  - `composables/` - Reusable Vue composition functions
- **State Management**: Pinia stores, not component-local state for shared data
- **IPC Abstraction**: Components call `services/ipcClient.ts`, never `window.electronAPI` directly
- **Material 3 + Tailwind v4**: All UI follows Material 3 design patterns using Tailwind v4 utilities

### 6. Domain Logic
Domain logic in `domain/` is framework-agnostic:
- **No Electron dependencies**
- **No Vue dependencies**
- **Pure business logic**
- Can be moved to a separate package if needed

Examples:
- `domain/prompts/PromptRegistry.ts` - Load and manage prompt templates
- `domain/enterprise/ConstitutionMerger.ts` - Merge global and local constitutions
- `domain/specs/SpecDeriver.ts` - Generate specs from code analysis

### 7. Configuration
- **Environment Variables**: Sensitive config (API keys, endpoints) in `.env`
- **User Settings**: Non-sensitive user preferences in app data folder
- **Enterprise Config**: GHE org, enterprise repo name, service endpoints

### 8. Security
- **No Hardcoded Secrets**: All API keys and tokens from environment or secure storage
- **Context Isolation**: Renderer runs with `contextIsolation: true`
- **CSP Headers**: Content Security Policy enforced in production
- **Preload Bridge**: Minimal, type-safe API surface exposed to renderer

### 9. Testing
- **Unit Tests**: All services must have unit tests (Vitest)
- **E2E Tests**: Critical user flows covered by Playwright
- **Type Safety**: TypeScript compiler is the first line of defense

### 10. Code Quality
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Consistent formatting via ESLint
- **Type Checking**: `tsc --noEmit` must pass before deployment
- **No Shortcuts**: Quality and correctness over speed

## Enterprise Features

### Spec-Driven Development (SDD)
Context-Sync implements enterprise-wide spec-driven development:
1. **Global Constitution**: Central `enterprise-specs` repo defines organizational standards
2. **Local Specs**: Each project repo has its own `specs/` folder
3. **Constitution Hierarchy**: Local constitution can only tighten global rules, not loosen
4. **Prompt Templates**: Reusable prompt templates in enterprise repo
5. **Automated Derivation**: Derive specs from existing code using AI

### Enterprise Repository Management
- List all repos in GitHub Enterprise organization
- Detect which repos have constitutions and specs
- Clone/update enterprise-specs repo automatically
- Apply templates to new or existing repos

## File Structure

```
app/
├── domain/                    # Framework-agnostic business logic
│   ├── prompts/
│   │   └── PromptRegistry.ts
│   ├── enterprise/
│   │   └── ConstitutionMerger.ts
│   └── specs/
│       └── SpecDeriver.ts
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App bootstrap
│   │   ├── ipc/
│   │   │   ├── register.ts    # Central IPC registration
│   │   │   └── handlers/      # IPC handler modules
│   │   ├── services/          # Business logic services
│   │   │   ├── GitService.ts
│   │   │   ├── GitHubService.ts
│   │   │   ├── AIService.ts
│   │   │   └── EnterpriseService.ts
│   │   └── config/            # App configuration
│   ├── preload/               # Preload scripts
│   │   └── index.ts
│   ├── renderer/              # Vue 3 app
│   │   ├── views/             # Route components
│   │   ├── components/        # Reusable components
│   │   ├── stores/            # Pinia stores
│   │   ├── services/          # IPC client wrappers
│   │   └── composables/       # Vue composables
│   ├── shared/                # Code shared between main and renderer
│   │   └── types/
│   └── types/                 # Type definitions
│       └── enterprise.ts
├── enterprise/                # Enterprise prompt templates
│   └── prompts/
│       └── derive-spec.md
├── constitution.md            # This file
├── copilot-instructions.md    # GitHub Copilot instructions
└── warp.md                    # Warp AI agent instructions
```

## Technology Stack

### Core
- **Electron 39**: Desktop app framework
- **Vue 3**: Reactive UI framework
- **TypeScript**: Type-safe language
- **Vite**: Build tool and dev server

### Styling
- **Tailwind CSS v4**: Utility-first CSS
- **Material 3**: Design system (via Tailwind utilities)

### State & Routing
- **Pinia**: Vue state management
- **Vue Router**: Client-side routing

### Backend Services
- **simple-git**: Git operations
- **Octokit** (via fetch): GitHub API
- **LangChain**: AI orchestration
- **Azure OpenAI**: Primary LLM
- **Ollama**: Local LLM fallback

### Validation & Schemas
- **Zod**: Runtime validation
- **JSON Schema** (via Ajv): Additional validation where needed

## Non-Negotiables

1. **No feature logic in IPC handlers** - handlers must be thin
2. **No direct IPC calls from Vue components** - use ipcClient service
3. **No hardcoded prompts** - all prompts in markdown files
4. **No breaking changes to existing context-repo functionality**
5. **All new code must be TypeScript with strict types**
6. **All services must be testable without Electron**
7. **Quality over speed - no shortcuts**

## Evolution

This constitution can be updated as the project evolves, but changes must:
1. Be documented with rationale
2. Maintain backward compatibility where possible
3. Be reviewed for impact on existing code
4. Update this document before implementation

---

*Last Updated: 2025-11-08*
*Version: 1.0.0*
