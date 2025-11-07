# Assistant Unification Scripts & Utilities (Scaffold)

This document lists scaffolded utilities created for feature `001-assistant-sidecar-unify`.

## Metrics
- `app/scripts/metrics/component-loc-check.ts`: Enforces FR-001 LOC/import limits for `UnifiedAssistant.vue`.

## Performance
- `app/scripts/perf/transcript-harness.ts`: Placeholder harness for transcript render performance (FR-002).

## Sanitization
- `app/src/renderer/services/assistant/promptSanitizer.ts`: Implements FR-035 prompt sanitization rules.

## Tool Classification
- `app/src/renderer/services/assistant/toolClassification.ts`: Safety classification enforcement (FR-032).

## Gating Artifact
- `scripts/ci/run-gates.ts`: Generates gating artifact per FR-040 by verifying sidecar-only enforcement, embeddings checksum determinism, and classification policy toggles.

## Embeddings Pipeline
- `context-repo/.context/pipelines/build-embeddings.mjs`: Deterministic embeddings builder (FR-039/FR-040) that produces sorted corpus JSONL, metadata, and SHA-256 checksum.

## Timeout Error
- `app/src/renderer/services/assistant/timeoutError.ts`: Structured timeout error factory (FR-041).

## Diff Summarization
- `app/src/renderer/services/assistant/diffSummarizer.ts`: Summarization algorithm scaffold (FR-037).

## Atomic Invariants
- `app/src/renderer/services/assistant/atomicInvariants.ts`: Central definitions for FR-031 test assertions.

## Barrel Export
- `app/src/renderer/services/assistant/index.ts`: Re-exports utilities for easier import.

## Next Steps
1. Extend CI script to capture additional validation/lint/test durations once deterministic logging contract finalised.
2. Add Vitest test files matching tasks (T052J, T052K, etc.).
3. Integrate classification & timeout logic into `assistantStore.ts` invocation path.
4. Wire gating artifact script into CI workflow before merge gate.
5. Hook telemetry emitter to record embeddings checksum (T028B) and propagate gating updates automatically.

> All scaffold files include TODO comments for completion. DO NOT rely on stub logic for production gating.
