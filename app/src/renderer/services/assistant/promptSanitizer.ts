/**
 * promptSanitizer.ts
 * Implements sanitization per FR-035.
 * TODO: expand tests for all rejection patterns.
 */
export interface SanitizationResult { sanitized: string; changed: boolean; valid: boolean; reasons: string[]; }

const MAX_LEN = 4000;
const BLOCK_PATTERNS: RegExp[] = [
  /\{\{tool:disable}}/i,
  /<script/i,
  /<\/script>/i,
  /\b(fs|child_process|process\.env)\b/i
];

export function sanitizePrompt(input: string): SanitizationResult {
  let working = input; const reasons: string[] = []; let valid = true;
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(working)) { valid = false; reasons.push(`Blocked pattern: ${pattern.source}`); }
  }
  // Remove control chars except newline and tab
  // eslint-disable-next-line no-control-regex
  const cleaned = working.replace(/[^\x09\x0A\x20-\x7E]/g, '');
  if (cleaned !== working) { reasons.push('Control characters removed'); working = cleaned; }
  if (working.length > MAX_LEN) { reasons.push(`Truncated from ${working.length}`); working = working.slice(0, MAX_LEN); }
  // Collapse whitespace
  const collapsed = working.replace(/\s+/g, ' ').trim();
  const changed = collapsed !== input;
  return { sanitized: collapsed, changed, valid, reasons };
}
