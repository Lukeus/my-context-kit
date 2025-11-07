# CI Scripts

- `run-gates.ts`: Generates FR-040 gating artifact by combining sidecar guard results, embeddings checksum verification, classification enforcement checks, and interaction latency SLO enforcement (reads `generated/perf/interaction.json`). Exits non-zero when any gate fails.

Future enhancements:
- Spawn additional CI tasks (`pnpm validate`, `pnpm lint`, `pnpm test`) and incorporate their durations into the artifact once deterministic output format is finalised.
- Extend checksum gate to include vector dimension metadata once sidecar embeddings service exposes schema.
- Integrate approval telemetry snapshot for destructive tool runs when FR-017 harness is complete.
