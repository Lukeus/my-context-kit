#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run c4-build.mjs and exit with appropriate code
 */
async function validate() {
  const buildScript = join(__dirname, 'c4-build.mjs');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [buildScript], {
      stdio: 'inherit',
      shell: true
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`C4 validation failed with exit code ${code}`));
      }
    });
    
    proc.on('error', (error) => {
      reject(new Error(`Failed to run c4-build.mjs: ${error.message}`));
    });
  });
}

validate()
  .then(() => {
    console.error('✅ C4 validation passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ C4 validation failed:', error.message);
    process.exit(1);
  });
