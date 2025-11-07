/**
 * promptSanitizer.ts
 * Implements sanitization per FR-035 and FR-028.
 * TODO: expand tests for all rejection patterns.
 */

export interface SanitizedPattern {
  id: string;
  original: string;
  replacement: string;
}

export interface SanitizationResult {
  sanitized: string;
  changed: boolean;
  valid: boolean;
  reasons: string[];
  redactions: SanitizedPattern[];
  collapsedBlankLines: boolean;
}

const MAX_LEN = 4000;
const MAX_CONSECUTIVE_BLANK_LINES = 2;

const BLOCK_PATTERNS: RegExp[] = [
  /\{\{tool:disable}}/i,
  /<script/i,
  /<\/script>/i,
  /\b(fs|child_process|process\.env)\b/i
];

const SECRET_PATTERNS: ReadonlyArray<{ id: string; regex: RegExp; replacement: string }> = [
  { id: 'azure-key', regex: /az(?:ure)?[_-]?openai[_-]?(?:api)?key\s*[:=]\s*([A-Za-z0-9_-]{10,})/gi, replacement: 'AZURE_API_KEY=[REDACTED]' },
  { id: 'openai-key', regex: /openai[_-]?api[_-]?key\s*[:=]\s*([A-Za-z0-9_-]{10,})/gi, replacement: 'OPENAI_API_KEY=[REDACTED]' },
  { id: 'generic-token', regex: /(bearer\s+)[A-Za-z0-9\-_.=]{16,}/gi, replacement: '$1[REDACTED]' },
  { id: 'password', regex: /(password|passwd|pwd)\s*[:=]\s*[^\s]+/gi, replacement: '$1=[REDACTED]' },
  { id: 'secret', regex: /(secret|token)\s*[:=]\s*[^\s]+/gi, replacement: '$1=[REDACTED]' }
];

function redactSecrets(input: string): { output: string; redactions: SanitizedPattern[] } {
  let output = input;
  const redactions: SanitizedPattern[] = [];

  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    const matches = output.match(pattern.regex);
    if (!matches) continue;

    for (const match of matches) {
      redactions.push({ id: pattern.id, original: match, replacement: pattern.replacement });
    }

    output = output.replace(pattern.regex, pattern.replacement);
    pattern.regex.lastIndex = 0;
  }

  return { output, redactions };
}

function collapseBlankLines(input: string): { output: string; collapsed: boolean } {
  const lines = input.split(/\r?\n/);
  const result: string[] = [];
  let consecutiveBlanks = 0;

  for (const line of lines) {
    if (line.trim().length === 0) {
      consecutiveBlanks += 1;
      if (consecutiveBlanks > MAX_CONSECUTIVE_BLANK_LINES) {
        continue;
      }
    } else {
      consecutiveBlanks = 0;
    }
    result.push(line);
  }

  const output = result.join('\n');
  return { output, collapsed: output !== input };
}

export function sanitizePrompt(input: string): SanitizationResult {
  const original = typeof input === 'string' ? input : '';
  let working = original.trim();
  const reasons: string[] = [];
  let valid = true;

  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(working)) {
      valid = false;
      reasons.push(`Blocked pattern: ${pattern.source}`);
    }
  }

  // Remove control chars except newline and tab
  // eslint-disable-next-line no-control-regex
  const controlStripped = working.replace(/[^\x09\x0A\x20-\x7E]/g, '');
  if (controlStripped !== working) {
    reasons.push('Control characters removed');
    working = controlStripped;
  }

  const { output: redacted, redactions } = redactSecrets(working);
  if (redactions.length > 0) {
    reasons.push(`Redacted ${redactions.length} potential secret${redactions.length > 1 ? 's' : ''}`);
  }

  if (redacted.length > MAX_LEN) {
    reasons.push(`Truncated from ${redacted.length}`);
    working = redacted.slice(0, MAX_LEN);
  } else {
    working = redacted;
  }

  const { output: blankCollapsed, collapsed: collapsedBlankLines } = collapseBlankLines(working);

  const normalisedWhitespace = blankCollapsed.replace(/[ \t]+/g, ' ');
  const sanitised = normalisedWhitespace.trim();
  const changed = sanitised !== original;

  return {
    sanitized: sanitised,
    changed,
    valid,
    reasons,
    redactions,
    collapsedBlankLines
  };
}

// TODO(T028F-Integration): Wire sanitiser telemetry once approval workflow updated.
