/**
 * Shared assistant constants
 * Origin: Spec FR-010, FR-037 (summarization thresholds), FR-022 (concurrency cap),
 * FR-032 (destructive reason length), SC-005 (first token latency), SC-002 (interaction latency).
 * Centralizing prevents drift across store logic, UI components, and tests.
 */

// Thresholds that trigger summarization of large outputs/diffs.
export const SUMMARY_TRIGGER = Object.freeze({
  MAX_LINES: 800,      // Summarize when total lines exceed this
  MAX_BYTES: 100_000   // Or when raw byte size exceeds this
} as const);
export type SummaryTrigger = typeof SUMMARY_TRIGGER;

// Maximum concurrent tool executions (queued beyond this limit).
export const CONCURRENCY_LIMIT = 3; // FR-022

// Minimum non-whitespace characters required for destructive reason input.
export const DESTRUCTIVE_REASON_MIN = 8; // FR-032

// Performance SLO guidance (milliseconds) used by perf harness & gating.
export const FIRST_TOKEN_P95_TARGET_MS = 300;       // SC-005
export const INTERACTION_MEDIAN_TARGET_MS = 180_000; // SC-002 (3 minutes)

// TODO: If future FRs introduce adjustable runtime configuration, migrate these to a
// config schema with validation and environment overrides (without breaking determinism).

export const ASSISTANT_CONSTANTS_VERSION = 1; // Increment if structure changes.
