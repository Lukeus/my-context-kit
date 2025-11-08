#!/usr/bin/env tsx
/**
 * Verify Design Token Usage
 * 
 * Purpose: Ensure components use Material 3 semantic tokens instead of raw Tailwind color classes
 * 
 * Usage: pnpm verify:tokens
 * Output: JSON report with violations
 */

import fs from 'fs/promises';
import { glob } from 'glob';
import { z } from 'zod';

const DesignTokenViolationReportSchema = z.object({
  id: z.string().uuid(),
  generatedAt: z.string(),
  violations: z.array(
    z.object({
      filePath: z.string(),
      line: z.number(),
      rawClass: z.string(),
      suggestedToken: z.string().optional(),
    })
  ),
  total: z.number(),
  allowedExceptions: z.array(z.string()),
});

type DesignTokenViolationReport = z.infer<typeof DesignTokenViolationReportSchema>;

// Raw color patterns that should be replaced with semantic tokens
const RAW_COLOR_PATTERNS = [
  /\b(bg|text|border)-(red|blue|green|yellow|purple|pink|indigo|gray|slate|zinc|neutral|stone|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-(50|100|200|300|400|500|600|700|800|900)\b/g,
];

// Documented exceptions (with justification)
const ALLOWED_EXCEPTIONS: string[] = [
  // Add exceptions here as they are documented
];

// Suggested token mappings
const TOKEN_SUGGESTIONS: Record<string, string> = {
  'bg-blue-50': 'bg-surface-container-low',
  'bg-blue-100': 'bg-surface-container',
  'bg-green-50': 'bg-success-container',
  'bg-yellow-50': 'bg-warning-container',
  'bg-red-50': 'bg-error-container',
  'text-blue-700': 'text-primary',
  'text-green-700': 'text-success',
  'text-yellow-700': 'text-warning',
  'text-red-700': 'text-error',
};

async function scanFile(filePath: string): Promise<Array<{ line: number; rawClass: string; suggestedToken?: string }>> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: Array<{ line: number; rawClass: string; suggestedToken?: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const pattern of RAW_COLOR_PATTERNS) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        const rawClass = match[0];
        
        // Skip if it's an allowed exception
        if (ALLOWED_EXCEPTIONS.includes(rawClass)) {
          continue;
        }

        violations.push({
          line: i + 1,
          rawClass,
          suggestedToken: TOKEN_SUGGESTIONS[rawClass],
        });
      }
    }
  }

  return violations;
}

async function main() {
  const startTime = Date.now();

  // Search for Vue files (where styling is done)
  // Glob runs from the app directory when called via pnpm script
  const files = glob.sync('src/**/*.vue', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    cwd: process.cwd(),
  });

  const allViolations: Array<{ filePath: string; line: number; rawClass: string; suggestedToken?: string }> = [];

  for (const file of files) {
    const violations = await scanFile(file);
    for (const violation of violations) {
      allViolations.push({
        filePath: file.replace(/\\/g, '/'),
        ...violation,
      });
    }
  }

  const report: DesignTokenViolationReport = {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    violations: allViolations,
    total: allViolations.length,
    allowedExceptions: ALLOWED_EXCEPTIONS,
  };

  // Validate with Zod schema
  const validatedReport = DesignTokenViolationReportSchema.parse(report);

  const duration = Date.now() - startTime;

  console.log(JSON.stringify(validatedReport, null, 2));
  console.error(`\n✓ Verification completed in ${duration}ms`);
  console.error(`Found ${validatedReport.total} violation(s)`);
  console.error(`Allowed exceptions: ${validatedReport.allowedExceptions.length}`);

  // Exit with error if violations exceed allowed exceptions
  const exitCode = validatedReport.total > validatedReport.allowedExceptions.length ? 1 : 0;
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
