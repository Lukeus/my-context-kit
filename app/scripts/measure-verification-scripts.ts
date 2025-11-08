#!/usr/bin/env tsx
/**
 * Performance Timing Harness
 * 
 * Purpose: Measure execution time of verification scripts
 * Ensures scripts meet performance requirements (cold <2000ms, warm <1000ms)
 * 
 * Usage: tsx scripts/measure-verification-scripts.ts
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

interface TimingResult {
  script: string;
  coldRun: number;
  warmRun: number;
  passed: boolean;
}

async function measureScript(scriptPath: string): Promise<TimingResult> {
  const measure = (label: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const proc = spawn('tsx', [scriptPath], {
        stdio: 'pipe',
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', () => {
        const duration = performance.now() - start;
        console.error(`${label}: ${duration.toFixed(2)}ms`);
        resolve(duration);
      });

      proc.on('error', reject);
    });
  };

  console.error(`\nMeasuring: ${scriptPath}`);
  
  const coldRun = await measure('Cold');
  const warmRun = await measure('Warm');

  const passed = coldRun < 2000 && warmRun < 1000;

  return {
    script: scriptPath,
    coldRun: Math.round(coldRun),
    warmRun: Math.round(warmRun),
    passed,
  };
}

async function main() {
  const scripts = [
    'app/scripts/verify-design-tokens.ts',
    'app/scripts/scan-duplicate-time-helpers.ts',
  ];

  const results: TimingResult[] = [];

  for (const script of scripts) {
    try {
      const result = await measureScript(script);
      results.push(result);
    } catch (error) {
      console.error(`Failed to measure ${script}:`, error);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    results,
    allPassed: results.every((r) => r.passed),
    thresholds: {
      cold: '<2000ms',
      warm: '<1000ms',
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.allPassed) {
    console.error('\n⚠ Some scripts exceeded performance thresholds');
    process.exit(1);
  } else {
    console.error('\n✓ All scripts meet performance requirements');
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
