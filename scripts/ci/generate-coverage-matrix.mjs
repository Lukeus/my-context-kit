#!/usr/bin/env node
/**
 * Generates a requirements coverage matrix mapping FR-/SC- IDs in the spec
 * to task IDs (T###) found in tasks.md lines referencing those requirements.
 *
 * Output: generated/trace/coverage-matrix.json
 * Structure: {
 *   generatedAt, version, summary: { totalRequirements, covered, missing },
 *   requirements: [{ id, tasks:[], status }]
 * }
 *
 * Usage:
 *   node scripts/ci/generate-coverage-matrix.mjs [--fail-on-missing]
 *
 * Notes:
 * - Simple heuristic: a task line is associated if it contains the requirement ID.
 * - This script is intentionally deterministic (sorted outputs).
 * - Extend later with explicit mapping block or parsing TODO annotations.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import process from 'process';

const SPEC_PATH = resolve('specs/001-assistant-sidecar-unify/spec.md');
const TASKS_PATH = resolve('specs/001-assistant-sidecar-unify/tasks.md');
const OUTPUT_PATH = resolve('generated/trace/coverage-matrix.json');

function readFile(path) {
  try { return readFileSync(path, 'utf8'); } catch (e) {
    console.error(`ERROR: Unable to read ${path}:`, e.message);
    process.exit(1);
  }
}

function extractRequirementIds(specContent) {
  const ids = new Set();
  const re = /\b(FR|SC)-\d{3}\b/g;
  for (const line of specContent.split(/\r?\n/)) {
    let m;
    while ((m = re.exec(line)) !== null) {
      ids.add(m[0]);
    }
  }
  return Array.from(ids).sort();
}

function mapTasksToRequirements(tasksContent, reqIds) {
  const lines = tasksContent.split(/\r?\n/);
  const taskLineRe = /^\s*- \[[ Xx*]\] (T\d{3}[A-Z]?)/; // allow optional indent before task bullet
  const requirementRe = /\b(FR|SC)-\d{3}\b/g;
  const coverage = new Map(reqIds.map(id => [id, new Set()]));

  let currentTaskId = null;

  for (const line of lines) {
    const taskMatch = line.match(taskLineRe);
    if (taskMatch) {
      currentTaskId = taskMatch[1];
    }

    let match;
    while ((match = requirementRe.exec(line)) !== null) {
      const reqId = match[0];
      const tasksForReq = coverage.get(reqId);
      if (!tasksForReq) {
        continue; // Requirement not in spec (ignore stray references).
      }

      if (taskMatch) {
        tasksForReq.add(taskMatch[1]);
      } else if (currentTaskId) {
        tasksForReq.add(currentTaskId);
      } else {
        // TODO: If no nearby task is found, consider logging this occurrence for manual follow-up.
      }
    }
  }

  return reqIds.map(id => {
    const tasks = Array.from(coverage.get(id) ?? []).sort();
    return {
      id,
      tasks,
      status: tasks.length > 0 ? 'covered' : 'missing'
    };
  });
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function main() {
  const failOnMissing = process.argv.includes('--fail-on-missing');
  const spec = readFile(SPEC_PATH);
  const tasks = readFile(TASKS_PATH);
  const reqIds = extractRequirementIds(spec);
  const coverage = mapTasksToRequirements(tasks, reqIds);
  const covered = coverage.filter(c => c.status === 'covered').length;
  const missing = coverage.length - covered;

  const matrix = {
    generatedAt: new Date().toISOString(),
    version: '1.0.0',
    summary: {
      totalRequirements: coverage.length,
      covered,
      missing,
      coverageRatio: coverage.length ? +(covered / coverage.length).toFixed(4) : 1
    },
    requirements: coverage
  };

  ensureDir(dirname(OUTPUT_PATH));
  writeFileSync(OUTPUT_PATH, JSON.stringify(matrix, null, 2));
  console.log(`Coverage matrix written to ${OUTPUT_PATH}`);
  console.log(`Total: ${coverage.length} Covered: ${covered} Missing: ${missing}`);

  if (missing > 0) {
    console.warn('Missing coverage for:', coverage.filter(c => c.status === 'missing').map(c => c.id).join(', '));
    if (failOnMissing) {
      console.error('Failing due to --fail-on-missing flag.');
      process.exit(2);
    }
  }
}

main();
