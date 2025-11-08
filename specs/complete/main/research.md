# Research: Spec Kit Context Generator Integration

## Decision: Target latency for Spec Kit fetch pipeline
- **Outcome**: Limit initial repository hydrate to ≤90 seconds and incremental updates to ≤15 seconds, failing fast with user-facing retries.
- **Rationale**: Cloning `github/spec-kit` (~40 MB) over typical broadband completes in under a minute; setting a 90s ceiling keeps UI responsive while allowing for slower enterprise VPN links. Subsequent `git fetch --depth 1` against a pinned tag averages <5 seconds, so a 15s incremental target provides buffer for transient network lag without masking regressions.
- **Alternatives considered**:
  - **No explicit SLO**: Rejected because UI would provide inconsistent feedback and violate Constitution Article II observability expectations.
  - **Aggressive 30s cap**: Risked hard failures on constrained networks; 90s balances reliability with user expectations.

## Decision: Observability sink for fetch metrics
- **Outcome**: Emit structured logs through existing `logger` utility (`app/src/main/utils/logger.ts`) with `service: 'SpeckitService', method: 'fetchSpecKit'`, and persist the last-run summary under `context-repo/.context/state/speckit-fetch.json` for UI surfacing.
- **Rationale**: Logger already standardises service telemetry, adhering to Constitution Article V. Persisting a small JSON snapshot mirrors patterns used by other pipelines (e.g., `impact.mjs`) and keeps history under git control if desired.
- **Alternatives considered**:
  - **Introduce new telemetry sink**: Adding an external dependency would violate pnpm-only constraint and complicate offline usage.
  - **Console logging only**: Would not satisfy observability requirements for post-run inspection inside the UI.

## Decision: C4 diagram updates
- **Outcome**: Update `context-repo/c4/context-sync-mvp.md` container diagram to include the Spec Kit SaaS boundary, the new `speckit-fetch` pipeline process, and the data flow into `context-repo/.context/speckit-cache/`.
- **Rationale**: Constitution Article I mandates architecture diagrams remain in lock-step; adding a remote fetch boundary impacts trust zones and must be reviewed.
- **Alternatives considered**:
  - **No diagram changes**: Rejected because external dependency and new pipeline are material architectural changes.

## Decision: Spec source of truth
- **Outcome**: Author `/specs/main/spec.md` before implementation outlining functional requirements for the fetch workflow, referencing this research.
- **Rationale**: Plan currently references a missing spec; implementation without an approved spec would violate workflow Step 1.
- **Alternatives considered**:
  - **Proceed without spec**: Rejected; fails governance workflow and risks misalignment with stakeholders.
