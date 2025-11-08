<!--
Sync Impact Report
Version change: 1.2.0 → 1.3.0
Modified principles: none
Added sections:
- Clean Architecture Layering (MINOR: formalizes enforced layering & dependency direction)
Removed sections: none
Rationale: Codifies the clean architecture refactor now underway to prevent business logic or integration code from leaking into IPC handlers, preload, or renderer layers. Establishes immutable dependency rules and testing guidance.
Templates: no changes required
Follow-up TODOs:
- TODO(clean-arch-enforcement): Add PR checklist items verifying layer boundaries.
-->

# Context-Sync Constitution

## Core Principles

### I. Git-Versioned Source of Truth
All project context—including YAML entities, generated artifacts, and C4 diagrams—MUST live in the `context-repo` Git history.
Every change flows through pipeline-driven commits so reviewers can diff, reproduce, and roll back outputs. Electron-side features
MUST interact with the repository only via IPC calls into approved scripts to prevent drift or hidden state.

### II. Deterministic Pipelines Before AI
Validation, graph, impact, and prompt pipelines MUST be deterministic, idempotent, and source-controlled before any AI-assisted
automation runs. Manual edits to generated results are forbidden; adjustments require updating inputs and re-running pipelines.
Pipeline execution MUST be observable so deviations are caught immediately.

### III. Unified TypeScript & Build Discipline
The stack MUST remain TypeScript-first with strict compiler settings, Vite bundling for main/preload/renderer, and extensionless
imports resolved via shared aliases. pnpm is the sole package manager, Node.js LTS (20+) is mandated, and cross-process boundaries
MUST keep context isolation enabled with preload bridges only exposing typed, documented APIs.

### IV. Validation & Impact Gatekeeping
No change may merge until schema validation, type checking, automated tests, and impact analysis all pass. Feature work MUST plan
and document these gates up front, capture outcomes in the repo, and block release when any downstream artifact is flagged as
stale or needs-review. Test debt or pipeline failures require explicit mitigation captured in planning documents.

### V. Secure Desktop Boundary & Observability
Secrets MUST stay in environment variables, never committed or hard-coded. The Electron app MUST enforce context isolation,
content security policies, and least-privilege IPC. Observability data (structured logs, pipeline telemetry) MUST be captured so
releases remain auditable, and security reviews MUST cover any new integrations before they ship.

## Operational Stack Constraints

- Node.js 20 LTS and pnpm (via Corepack) are the only approved runtime and package tools; lockfiles MUST stay committed.
- Electron Forge with Vite bundles all processes; preload scripts MUST remain Node-disabled except for explicit bridges.
- Pipelines execute with `node <repo>/.context/pipelines/*.mjs`; use deterministic configuration and document required env vars.
- Tailwind CSS, Material 3 design patterns, Vue 3 Composition API, and Pinia are mandatory in the renderer; deviations require constitutional amendments.
- C4 diagrams under `context-repo/c4/` MUST be updated in lock-step with architecture-affecting changes and reviewed in PRs.

## Clean Architecture Layering

The application MUST adhere to a strict inward dependency flow. Outer layers may depend on inner layers; inner layers MUST remain unaware of outer layers. Violations MUST block merge until corrected.

### Layer Definitions (Outer → Inner)

1. Renderer (Vue 3 + Tailwind + Pinia): Pure UI, state management, presentation, user interaction. NO business logic, NO direct filesystem, git, or AI provider calls.
2. Preload Bridges: Typed, minimal exposure of IPC client surface; NO branching business logic, NO persistence, NO side effects beyond invoking IPC. Context isolation MUST remain enabled.
3. IPC Handlers (Main `src/main/ipc/handlers`): Validation + delegation only. They perform Zod-based input validation, trace logging, and forward calls to Services. They MUST remain stateless.
4. Services (Main `src/main/services`): Orchestration & business logic boundary for platform concerns (Git operations, AI orchestration, enterprise workflows, context building). They MAY call Domain logic, system libraries, and sidecar HTTP APIs. Services MUST NOT import renderer code or preload code.
5. Domain (`app/domain/*`): Pure, framework-agnostic logic (spec derivation, prompt assembly, constitution merging, graph transforms). NO Electron, NO fs/network side effects (except through injectable abstractions passed from Services).

### Dependency Rules

- Renderer → Preload → IPC → Services → Domain is the ONLY allowed direction.
- Domain MUST NOT import from Services or any Electron-specific modules.
- Services MUST NOT import from Renderer, Preload, or Components.
- IPC Handlers MUST NOT implement business logic beyond trivial mapping.
- Shared types live in `app/src/shared` or `app/types` and MAY be imported by any layer.

### Cross-Cutting Concerns

- Validation: Zod schemas reside beside IPC handlers or shared types. Domain functions assume validated inputs.
- Logging & Telemetry: Implemented at Service boundary; renderer receives structured events only.
- Error Handling: Services normalize errors to typed results; renderer shows user-friendly messages.
- Configuration: Centralized under `app/src/main/config`; Domain receives primitive values, never reads env vars directly.

### Testing Guidance

- Domain: Pure unit tests (no mocks of Electron). Deterministic & fast.
- Services: Integration-style tests with mocked sidecar / git / fs abstractions.
- IPC: Contract tests verifying validation + delegation only.
- Renderer: Component + store tests (no deep Service logic testing).

### Enforcement & Migration

- Any existing business logic found in renderer, preload, or IPC MUST be migrated to Services/Domain and annotated with `// TODO(clean-arch-migration):` until complete.
- New features MUST list affected layers in their `plan.md` and state compliance with these rules.
- CI SHOULD include static analysis (future enhancement) to detect forbidden imports.

### AI Integration Alignment

- AI operations follow same flow: Renderer (assistantStore) → Preload → `ai:*` IPC → `AIService` → Python sidecar → Domain utilities (for prompt assembly). No layer may bypass `AIService`.

### Prohibited Patterns

- Direct use of `window.electronAPI` inside components (must use `ipcClient.ts`).
- Embedding prompts directly in code (must reside in `enterprise/prompts/`).
- Service logic in Pinia stores.
- Unvalidated IPC parameters reaching Services.

### Allowed Exceptions (Must be Documented)

- Temporary feature flags around deprecated modules (e.g., `// TODO(langchain-js-removal):`) pending deletion.
- Minimal glue code inside IPC handlers needed for streaming events (must remain logic-free).

Failure to comply MUST trigger a constitutional amendment discussion if an exception is required.

## AI Orchestration & Assistant Architecture

- The Python `context-kit-service` sidecar (FastAPI + LangChain for Python) is the canonical orchestration boundary; Electron processes MUST call AI providers only through its versioned HTTP APIs.
- TypeScript code MUST remove direct `@langchain/*` dependencies; any remaining modules MUST be marked with `// TODO(langchain-js-removal):` and kept behind feature flags until deleted.
- Assistant flows MUST use `assistantStore` for session state while delegating tool execution to the Python service; legacy `aiStore` entry points MAY NOT gain new features and MUST emit deprecation warnings until removal.
- Retrieval-augmented generation indexes MUST be built by deterministic Python pipelines checked into `context-repo/.context/pipelines/`; cached artifacts MUST be reproducible from Git commits.
- The sidecar MUST maintain parity across Azure OpenAI and local providers, stream intermediate tool steps, and emit telemetry records that the renderer logs for observability.

## UI Design System

### Material 3 Implementation
The UI follows Material 3 design patterns with an **Intel-inspired color palette** as an approved deviation from the standard M3 color system:

- **Color Tokens**: Custom Intel brand colors (primary: #0068B5, secondary: #39424E, tertiary: #00A6D6) replace standard M3 dynamic color schemes
- **Elevation System**: Standard M3 elevation shadows (elevation-1 through elevation-5) MUST be preserved
- **Border Radius**: M3 shape system (m3-xs through m3-full) MUST be used consistently
- **Typography**: Material Design type scale SHOULD be followed where applicable
- **Component Patterns**: M3 interaction patterns (state layers, ripples, transitions) SHOULD be implemented

**Rationale**: Intel brand identity requirements necessitate custom color palette while maintaining M3's spatial, elevation, and interaction paradigms for consistency and accessibility.

**Configuration**: All design tokens MUST be defined in `app/tailwind.config.ts` as the single source of truth per Principle II (Deterministic Pipelines).

## Workflow & Quality Gates

1. Charter work by drafting or updating specs in `docs/` or `context-repo/specs/`, capturing user stories and C4 impacts.
2. Generate `plan.md` via `/speckit.plan`, answering every constitutional gate before implementation begins.
3. Produce `tasks.md` grouped by user story, including validation and pipeline tasks that keep the repo compliant.
4. Implement features with strict TypeScript practices, keeping renderer, preload, and main responsibilities isolated.
5. Run validation, graph, impact, typecheck, lint, and test commands before requesting review; capture results or failures.
6. Reviewers block merges unless pipelines, artifacts, and observability updates confirm the change keeps the context in sync.

## Governance

- This constitution supersedes ad-hoc practices; conflicts resolve in favor of the stricter constitutional rule.
- Amendments require documented rationale, updated templates, version bump per semantic rules, and reviewer approval.
- Versioning: MAJOR for principle changes/removals, MINOR for new principles/sections, PATCH for clarifications only.
- Ratification and amendment dates MUST stay in ISO format; every change includes a Sync Impact Report comment.
- Compliance checks belong in PR templates and planning artifacts; reviewers MUST verify gates before approving.

**Version**: 1.2.0 | **Ratified**: 2025-10-28 | **Last Amended**: 2025-11-01
**Pending Version (Post-Update)**: 1.3.0 (awaiting ratification date on merge)
