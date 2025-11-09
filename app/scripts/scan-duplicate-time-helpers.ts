#!/usr/bin/env tsx
/**
 * Scan for Duplicate Time Helper Functions
 * 
 * Purpose: Detect duplicate time/duration formatting functions across the codebase
 * to ensure centralization in timeHelpers.ts
 * 
 * Usage: pnpm scan:time
 * Output: JSON report with duplicate locations
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface DuplicateOccurrence {
  filePath: string;
  line: number;
  functionName: string;
  snippet: string;
}

interface DuplicateReport {
  id: string;
  generatedAt: string;
  canonicalPath: string;
  duplicates: DuplicateOccurrence[];
  count: number;
}

const CANONICAL_PATH = 'app/src/renderer/services/assistant/timeHelpers.ts';
const SEARCH_PATTERNS = [
  /function\s+formatDuration\s*\(/,
  /const\s+formatDuration\s*=/,
  /export\s+function\s+formatDuration\s*\(/,
];

async function scanFile(filePath: string): Promise<DuplicateOccurrence[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const duplicates: DuplicateOccurrence[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SEARCH_PATTERNS) {
      if (pattern.test(line)) {
        duplicates.push({
          filePath: filePath.replace(/\\/g, '/'),
          line: i + 1,
          functionName: 'formatDuration',
          snippet: line.trim(),
        });
      }
    }
  }

  return duplicates;
}

async function main() {
  const startTime = Date.now();
  
  // Search for TypeScript and Vue files
  const files = glob.sync('src/**/*.{ts,vue}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    cwd: process.cwd(),
  });

  const allDuplicates: DuplicateOccurrence[] = [];

  for (const file of files) {
    // Skip the canonical file
    if (file.includes(CANONICAL_PATH.replace(/\//g, path.sep))) {
      continue;
    }

    const duplicates = await scanFile(file);
    allDuplicates.push(...duplicates);
  }

  const report: DuplicateReport = {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    canonicalPath: CANONICAL_PATH,
    duplicates: allDuplicates,
    count: allDuplicates.length,
  };

  const duration = Date.now() - startTime;
  
  console.log(JSON.stringify(report, null, 2));
  console.error(`\n✓ Scan completed in ${duration}ms`);
  console.error(`Found ${report.count} duplicate(s)`);

  // Exit with error if duplicates found
  process.exit(report.count > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
