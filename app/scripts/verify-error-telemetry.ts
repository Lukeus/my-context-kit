#!/usr/bin/env tsx
/**
 * verify-error-telemetry.ts
 *
 * User Story 4 Verification Harness (T060)
 * Purpose: Emit a synthetic set of normalized errors and produce a JSON report
 * confirming errorCode coverage and shape integrity. This does NOT spin up
 * Electron; it reuses the shared adapter and map to validate deterministic
 * normalization. Acts as a lightweight guard until full integration telemetry
 * capture is instrumented.
 *
 * Exit Codes:
 *  0 - All sampled errors produced a normalized code and userMessage
 *  1 - One or more samples missing code/userMessage (should never happen)
 *
 * Usage:
 *   pnpm --filter context-sync exec tsx app/scripts/verify-error-telemetry.ts > specs/001-code-cleanup/artefacts/error-telemetry-report.json
 *
 * TODO(T060-future): Extend to tail actual session tool failures once a public
 * telemetry subscription API is exposed.
 */

import { errorNormalizationAdapter } from '@/utils/errorNormalizationAdapter';
import { DEFAULT_ERROR_MAP } from '@shared/errorNormalization';

interface SampleSpec { input: unknown; label: string }

const samples: SampleSpec[] = [
  { label: 'validation', input: new Error('Validation failed: field required') },
  { label: 'timeout', input: new Error('Operation timed out after 5s') },
  { label: 'file-missing', input: Object.assign(new Error('ENOENT: file not found'), { code: 'ENOENT' }) },
  { label: 'permission', input: Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }) },
  { label: 'network-refused', input: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1'), { code: 'ECONNREFUSED' }) },
  { label: 'parse', input: new Error('Failed to parse JSON payload') },
  { label: 'schema', input: new Error('Schema validation error in entity record') },
  { label: 'credential', input: new Error('Credential error: token invalid') },
  { label: 'config', input: new Error('Configuration missing for provider') },
  { label: 'provider', input: new Error('Provider unavailable') },
  { label: 'api', input: new Error('API responded with 500') },
  { label: 'service', input: new Error('Service unavailable due to maintenance') },
  { label: 'session', input: new Error('No active session present') },
  { label: 'index', input: new Error('Repository not indexed') },
  { label: 'tool-not-found', input: new Error('Tool not found: pipeline.run') },
  { label: 'tool-disabled', input: new Error('Tool execution failed: tool disabled') },
  { label: 'op-unsupported', input: new Error('Operation not supported in current context') },
  { label: 'state', input: new Error('Invalid lifecycle state transition') },
  { label: 'path-security', input: new Error('Access outside security boundary denied') },
  { label: 'design-token', input: new Error('Design token violation in component') },
  { label: 'unknown-generic', input: new Error('Some rare unexpected condition') },
  { label: 'string-network', input: 'Network connection lost unexpectedly' },
  { label: 'number-error', input: 404 },
];

type NormalizedSummary = {
  label: string;
  code: string;
  userMessage: string;
  retryable: boolean;
};

const normalized: NormalizedSummary[] = samples.map(s => {
  const n = errorNormalizationAdapter(s.input);
  return { label: s.label, code: n.code, userMessage: n.userMessage, retryable: n.retryable };
});

const counts = normalized.reduce<Record<string, number>>((acc, n) => {
  acc[n.code] = (acc[n.code] || 0) + 1;
  return acc;
}, {});

const missingCodes: string[] = [];
// All map keys should be represented at least once except those intentionally
// not easily triggerable. UNKNOWN_ERROR guaranteed present by a generic sample.
for (const key of Object.keys(DEFAULT_ERROR_MAP)) {
  if (!counts[key]) {
    // DESIGN_TOKEN_VIOLATION may not appear if sample removed; we included one above.
    // Keep track for completeness reporting, not as failure cause.
    missingCodes.push(key);
  }
}

const failures = normalized.filter(n => !n.code || !n.userMessage);

const report = {
  generatedAt: new Date().toISOString(),
  totalSamples: samples.length,
  distinctCodes: Object.keys(counts).length,
  counts,
  missingMapCodes: missingCodes,
  failures: failures.map(f => f.label),
  pass: failures.length === 0,
  notes: 'Pass criterion: every sample produced code+userMessage; missingMapCodes is informational.'
};

console.log(JSON.stringify(report, null, 2));

if (!report.pass) {
  process.exit(1);
}