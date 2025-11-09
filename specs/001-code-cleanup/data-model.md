# Data Model: Code Quality & Design System Cleanup

**Branch**: 001-code-cleanup  
**Spec**: `specs/001-code-cleanup/spec.md`

## Overview
Entities are lightweight, internal to refactor scope, supporting scripts, telemetry, and archival. No persistent DB schema changes.

## Entities

### TimeFormatting (Utility Module)
Purpose: Provide canonical duration & timestamp formatting.
Methods:
- `formatDuration(ms: number): string` — <60s => `${ms}ms`; >=60s => `${(ms/60000).toFixed(1)}m`; hours support via `(ms/3600000).toFixed(2)h` (TODO: extend if needed)
- `formatTime(iso: string): string` — locale-safe `HH:MM:SS` fallback; TODO: consider user locale settings.
- `nowIso(): string` — `new Date().toISOString()`
Constraints: Pure functions, no side effects.

### DesignTokenViolationReport
Purpose: Output of semantic token verification script.
Shape:
```ts
export interface DesignTokenViolationReport {
  id: string; // uuid
  generatedAt: string; // ISO 8601
  violations: {
    filePath: string;
    line: number;
    rawClass: string;
    suggestedToken?: string;
  }[];
  total: number; // MUST equal violations.length
  allowedExceptions: string[]; // documented raw classes w/ justification
}
```
Rules:
- `total === violations.length`
- `allowedExceptions` entries MUST NOT appear in `violations.rawClass`
- Exit code: script exits 0 when `total === 0` OR `total <= allowedExceptions.length` and all violations are declared exceptions; non-zero otherwise.

### DocArchiveManifest
Purpose: Traceability for moved legacy docs.
Shape:
```ts
export interface DocArchiveManifest {
  archivedFiles: { originalPath: string; newPath: string; }[];
  archivedCount: number; // MUST equal archivedFiles.length
  generatedAt: string; // ISO 8601
  changelogEntryAdded: boolean; // true only after CHANGELOG updated
}
```
Rules:
- `archivedCount === archivedFiles.length`
- `changelogEntryAdded === true` only after consolidated CHANGELOG entry (T070)

### ErrorNormalizationMap
Purpose: Central config mapping machine codes → user-friendly shape.
Shape:
```ts
export interface NormalizedError {
  code: string;  // e.g., VALIDATION_ERROR
  message: string; // internal/dev detail
  userMessage: string; // sanitized
  retryable: boolean;
  details?: Record<string, unknown>;
}

export type ErrorNormalizationMap = Record<string, {
  defaultUserMessage: string;
  retryable: boolean;
}>;
```
Rules:
- Adapter merges raw error → `NormalizedError` using map defaults; fallback code `UNKNOWN_ERROR`.
- Telemetry emits `errorCode = code` and optionally `details`.

## Relationships
- Verification script outputs `DesignTokenViolationReport`; exceptions folded into map inside `research.md`.
- Archival operation writes `DocArchiveManifest`; referenced in CHANGELOG entry commit.
- Error adapter consumes `ErrorNormalizationMap`, emits `NormalizedError` objects to telemetry.
- TimeFormatting used by telemetry aggregation & any component displaying durations/timestamps.

## Non-Entities / Out of Scope
- No database migrations.
- No external API contracts (pure internal tooling).
- No prompt or AI schema changes.

## Evolution Notes
- Potential future: add dark mode token mapping table; extend `DesignTokenViolationReport` with severity.
- Potential future: move ErrorNormalizationMap to shared JSON config.

## Validation Strategy
- Zod schemas added for report + error map (Phase 2 tasks T016/T017).
- JSON outputs committed for reproducibility (optional) in `specs/001-code-cleanup/artefacts/` // TODO: create folder if storing outputs.

---
Generated during Phase 1 design; update if entity shapes evolve.
