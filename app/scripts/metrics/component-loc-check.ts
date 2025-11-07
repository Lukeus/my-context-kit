/**
 * component-loc-check.ts
 * Verifies UnifiedAssistant.vue LOC & subcomponent import count per FR-001.
 * TODO: Implement actual file read & AST parse. Currently scaffolds evaluation function.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

interface LocCheckResult { loc: number; maxAllowedLoc: number; imports: number; maxAllowedImports: number; passed: boolean; details: string[]; }

// Configuration constants (could externalize later)
const MAX_ALLOWED_LOC = 500; // FR-001
const MAX_ALLOWED_IMPORTS = 6; // FR-001 subcomponent delegation limit

export function checkUnifiedAssistantMetrics(filePath = join(process.cwd(), 'src', 'renderer', 'components', 'assistant', 'UnifiedAssistant.vue')): LocCheckResult {
  // NOTE: simplistic placeholder logic; replace with Vue SFC parse for robustness.
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const scriptLines = lines.filter(l => !l.trim().startsWith('<!--'));
  const loc = scriptLines.length;
  const importCount = raw.match(/import\s+[^{*]/g)?.length ?? 0;
  const details: string[] = [];
  if (loc > MAX_ALLOWED_LOC) details.push(`LOC ${loc} exceeds max ${MAX_ALLOWED_LOC}`);
  if (importCount > MAX_ALLOWED_IMPORTS) details.push(`Import count ${importCount} exceeds max ${MAX_ALLOWED_IMPORTS}`);
  return {
    loc,
    maxAllowedLoc: MAX_ALLOWED_LOC,
    imports: importCount,
    maxAllowedImports: MAX_ALLOWED_IMPORTS,
    passed: details.length === 0,
    details
  };
}

if (require.main === module) {
  const result = checkUnifiedAssistantMetrics();
  if (!result.passed) {
    console.error('[component-loc-check] FAIL', result);
    process.exit(1);
  }
  console.log('[component-loc-check] PASS', result);
}
