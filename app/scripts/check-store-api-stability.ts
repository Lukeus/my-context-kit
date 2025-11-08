#!/usr/bin/env tsx
/**
 * Store API Stability Check
 * 
 * Purpose: Ensure backward compatibility of Pinia store public APIs
 * Captures exported type definitions before/after refactoring
 * 
 * Usage: tsx scripts/check-store-api-stability.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

interface StoreExport {
  storeName: string;
  filePath: string;
  exports: string[];
}

async function extractExports(filePath: string): Promise<string[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const exports: string[] = [];

  // Match export statements
  const exportPatterns = [
    /export\s+const\s+(\w+)/g,
    /export\s+function\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+{\s*([^}]+)\s*}/g,
  ];

  for (const pattern of exportPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1].includes(',')) {
        // Handle multiple exports in one statement
        const names = match[1].split(',').map(n => n.trim());
        exports.push(...names);
      } else {
        exports.push(match[1]);
      }
    }
  }

  return [...new Set(exports)].sort();
}

async function main() {
  const storeFiles = glob.sync('src/renderer/stores/**/*.ts', {
    ignore: ['**/*.spec.ts', '**/node_modules/**'],
    cwd: process.cwd(),
  });

  const storeExports: StoreExport[] = [];

  for (const file of storeFiles) {
    const exports = await extractExports(file);
    const storeName = path.basename(file, '.ts');

    storeExports.push({
      storeName,
      filePath: file.replace(/\\/g, '/'),
      exports,
    });
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    stores: storeExports,
    totalStores: storeExports.length,
    totalExports: storeExports.reduce((sum, store) => sum + store.exports.length, 0),
  };

  console.log(JSON.stringify(snapshot, null, 2));
  console.error(`\n✓ Captured ${snapshot.totalStores} store(s) with ${snapshot.totalExports} export(s)`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
