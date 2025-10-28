<!--
Sync Impact Report
Version change: N/A → 1.0.0
Modified principles:
- I. Git-Versioned Source of Truth
- II. Deterministic Pipelines Before AI
- III. Unified TypeScript & Build Discipline
- IV. Validation & Impact Gatekeeping
- V. Secure Desktop Boundary & Observability
Added sections:
- Operational Stack Constraints
- Workflow & Quality Gates
Removed sections: none
Templates:
- ✅ .specify/templates/plan-template.md (constitutional gates enumerated)
- ✅ .specify/templates/spec-template.md (C4 impact guidance)
- ✅ .specify/templates/tasks-template.md (pipeline tasks requirement)
Follow-up TODOs: none
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
- Tailwind CSS, Material 3 design, Vue 3 Composition API, and Pinia are mandatory in the renderer; deviations require constitutional amendments.
- C4 diagrams under `context-repo/c4/` MUST be updated in lock-step with architecture-affecting changes and reviewed in PRs.

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

**Version**: 1.0.0 | **Ratified**: 2025-10-28 | **Last Amended**: 2025-10-28
