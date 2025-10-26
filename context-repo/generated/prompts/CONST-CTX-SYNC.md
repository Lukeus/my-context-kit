# Context-Sync System Constitution
<!-- Constitution ID: CONST-CTX-SYNC -->

This Governs the Context-Sync platform with core principles that enforce spec-driven development,
Git-backed single source of truth, and disciplined validation workflows for every entity.



## Core Principles

### Spec-Driven Development (NON-NEGOTIABLE)
<!-- ID: spec-driven-development | Position: 0 -->
Every deliverable flows from a ratified specification to maintain architectural clarity.

Features, user stories, and tasks derive from an authoritative specification and must point back to
their knowledge source. Specifications act as the contract between planning and execution.


**Requirements**:
- Features must declare a governing domain to preserve ownership boundaries. (high)

**References**: `docs/spec.md`

**Applies To**: feature, userstory, spec, task

### Git as Source of Truth (NON-NEGOTIABLE)
<!-- ID: git-single-source-of-truth | Position: 1 -->
The context repository is the canonical record for every entity and rule.

All artifacts live in Git and changes are validated before merging. Automation uses repository state
as the single system of record.


**Requirements**:
- Each task must have a named owner to ensure accountability for Git-tracked work. (medium)

**References**: `docs/phase6-git-workflow-completion.md`

**Applies To**: service, package, task

### Validation-First Workflows (NON-NEGOTIABLE)
<!-- ID: validation-first | Position: 2 -->
All context entities must include acceptance or done criteria that can be validated.

Work items include measurable acceptance or done criteria. Pipelines enforce the presence of
actionable validation checklists so quality gates remain automated.


**Requirements**:
- User stories provide at least one acceptance criterion before implementation begins. (high)

**References**: `docs/phase3-implementation.md`

**Applies To**: userstory, task

### Observability and Feedback
<!-- ID: observability-and-feedback | Position: 3 -->
Changes surface their impact immediately across UI and automation.

Automated analysis highlights downstream impact for every entity change, enabling fast feedback across
the engineering workflow.



**References**: `docs/phase5-implementation.md`

**Applies To**: feature, userstory, spec

### Secure Pipeline Execution (NON-NEGOTIABLE)
<!-- ID: secure-pipeline-execution | Position: 4 -->
Automation must execute with least privilege and zero key exposure.

IPC invokes pipeline scripts in isolated processes. Secrets are stored securely and never exposed to
the renderer context.



**References**: `docs/phase4-implementation.md`

**Applies To**: service, package, layer


## Governance

**Owners**: @architecture-guild, @lukeus  
**Review Cadence**: per-release  

Updates require architecture guild approval and a corresponding ADR entry.

**References**:
- docs/phase6-git-workflow-completion.md
- docs/phase7-cicd-documentation.md

## Compliance & Enforcement

### Features must declare a domain to align with ownership boundaries.
<!-- Rule ID: feature-domain-required -->

**Severity**: high  
**Targets**: feature

**Conditions**:
- `domain` must exists - _Feature must specify a domain to comply with spec-driven planning._


**References**: `docs/spec.md`

### User stories require measurable acceptance criteria.
<!-- Rule ID: userstory-acceptance-required -->

**Severity**: high  
**Targets**: userstory

**Conditions**:
- `acceptanceCriteria` must exists - _User story requires acceptanceCriteria section._
- `acceptanceCriteria` must greaterThan - _User story must define at least one acceptance criterion._


**References**: `docs/spec.md`

### Tasks must have an accountable owner.
<!-- Rule ID: task-owner-required -->

**Severity**: medium  
**Targets**: task

**Conditions**:
- `owner` must exists - _Task must identify an owner._
- `status` must exists - _Task status must be declared._


**References**: `docs/phase3-implementation.md`



---

**Version**: 1.2.0 | **Ratified**: 2025-10-22 | **Last Amended**: 2025-10-26  
**Generated**: 2025-10-26T15:34:58.131Z | **Source**: C:\Users\lukeu\source\repos\my-context-kit\context-repo\contexts\governance\constitution.yaml
