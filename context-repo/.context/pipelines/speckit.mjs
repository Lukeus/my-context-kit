#!/usr/bin/env node

/**
 * Speckit Pipeline - SDD Workflow Commands
 * 
 * Implements the /speckit command system for Specification-Driven Development:
 * - /speckit.specify - Create feature specifications with auto-numbering and branch creation
 * - /speckit.plan - Generate implementation plans from specifications
 * - /speckit.tasks - Derive executable task lists from plans
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import simpleGit from 'simple-git';
import { execa } from 'execa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get repository root (two levels up from pipelines/)
const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * /speckit.specify command
 * Creates a new feature specification with auto-numbering and branch creation
 * 
 * @param {string} description - Feature description from user
 * @returns {object} - { specNumber, branchName, specPath, created: boolean }
 */
async function specify(description) {
  try {
    // 1. Scan existing specs to determine next number
    const specsDir = path.join(REPO_ROOT, 'specs');
    
    // Ensure specs directory exists
    await fs.mkdir(specsDir, { recursive: true });
    
    const existingSpecs = await fs.readdir(specsDir);
    
    // Extract numbers from directory names (e.g., "001-feature-name" → 1)
    const specNumbers = existingSpecs
      .map(name => {
        const match = name.match(/^(\d{3})-/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    
    const nextNumber = specNumbers.length > 0 ? Math.max(...specNumbers) + 1 : 1;
    const specNumberFormatted = String(nextNumber).padStart(3, '0');
    
    // 2. Generate branch name from description
    const branchSlug = description
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50); // Limit length
    
    const branchName = `${specNumberFormatted}-${branchSlug}`;
    
    // 3. Create spec directory
    const specDir = path.join(specsDir, branchName);
    await fs.mkdir(specDir, { recursive: true });
    
    // 4. Generate spec.md from template
    const template = await loadTemplate('feature-spec-template.md');
    const specContent = template
      .replace(/{{number}}/g, specNumberFormatted)
      .replace(/{{description}}/g, description)
      .replace(/{{branchName}}/g, branchName)
      .replace(/{{date}}/g, new Date().toISOString().split('T')[0]);
    
    const specPath = path.join(specDir, 'spec.md');
    await fs.writeFile(specPath, specContent, 'utf-8');
    
    // 5. Create implementation-details directory
    await fs.mkdir(path.join(specDir, 'implementation-details'), { recursive: true });
    
    // 6. Create and checkout feature branch
    const branchCreated = await createFeatureBranch(branchName);
    
    return {
      ok: true,
      specNumber: specNumberFormatted,
      branchName,
      specPath: path.relative(REPO_ROOT, specPath),
      created: true,
      branchCreated,
      message: `Specification ${specNumberFormatted} created at ${branchName}/spec.md${branchCreated ? ` and branch created` : ''}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * /speckit.plan command
 * Generates an implementation plan from a specification
 * 
 * @param {string} specPath - Path to spec.md file
 * @param {object} options - { techStack?: string[], constitution?: boolean }
 * @returns {object} - { planPath, gates: {...}, created: boolean }
 */
async function plan(specPath, options = {}) {
  try {
    const fullSpecPath = path.join(REPO_ROOT, specPath);
    
    // 1. Read specification
    const specContent = await fs.readFile(fullSpecPath, 'utf-8');
    
    // 2. Parse spec for key information
    const specInfo = parseSpecification(specContent);
    
    // 3. Load implementation plan template
    const template = await loadTemplate('implementation-plan-template.md');
    
    // 4. Generate plan content
    const techStack = options.techStack || ['TypeScript', 'Vue 3', 'Tailwind CSS'];
    const planContent = template
      .replace(/{{specNumber}}/g, specInfo.number || '???')
      .replace(/{{specTitle}}/g, specInfo.title || 'Untitled')
      .replace(/{{techStack}}/g, techStack.join(', '))
      .replace(/{{date}}/g, new Date().toISOString().split('T')[0])
      .replace(/{{requirements}}/g, specInfo.requirements.join('\n'))
      .replace(/{{userStories}}/g, specInfo.userStories.join('\n'));
    
    // 5. Validate constitutional gates if requested
    const gates = options.constitution ? await validateConstitutionalGates(planContent) : null;
    
    // 6. Write plan.md
    const planPath = path.join(path.dirname(fullSpecPath), 'plan.md');
    await fs.writeFile(planPath, planContent, 'utf-8');
    
    return {
      ok: true,
      planPath: path.relative(REPO_ROOT, planPath),
      gates: gates || { passed: true, warnings: [] },
      created: true,
      message: `Implementation plan created at ${path.basename(path.dirname(planPath))}/plan.md`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * /speckit.tasks command
 * Derives executable task list from implementation plan
 * 
 * @param {string} planPath - Path to plan.md file
 * @returns {object} - { tasksPath, tasks: [], parallelGroups: [], created: boolean }
 */
async function tasks(planPath) {
  try {
    const fullPlanPath = path.join(REPO_ROOT, planPath);
    
    // 1. Read plan
    const planContent = await fs.readFile(fullPlanPath, 'utf-8');
    
    // 2. Extract tasks from plan
    const extractedTasks = extractTasksFromPlan(planContent);
    
    // 3. Load task list template
    const template = await loadTemplate('task-list-template.md');
    
    // 4. Generate tasks.md content
    const taskListContent = template
      .replace(/{{specNumber}}/g, extractedTasks.specNumber || '???')
      .replace(/{{date}}/g, new Date().toISOString().split('T')[0])
      .replace(/{{taskList}}/g, formatTaskList(extractedTasks.tasks));
    
    // 5. Write tasks.md
    const tasksPath = path.join(path.dirname(fullPlanPath), 'tasks.md');
    await fs.writeFile(tasksPath, taskListContent, 'utf-8');
    
    return {
      ok: true,
      tasksPath: path.relative(REPO_ROOT, tasksPath),
      tasks: extractedTasks.tasks,
      parallelGroups: extractedTasks.parallelGroups,
      created: true,
      message: `Task list created with ${extractedTasks.tasks.length} tasks (${extractedTasks.parallelGroups.length} parallel groups)`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

async function runFetch(argv) {
  const normalizedArgs = Array.isArray(argv) ? [...argv] : [];
  const hasRepoPathArg = normalizedArgs.some((arg, index) => {
    if (arg === '--repoPath') {
      return true;
    }
    if (arg.startsWith('--repoPath=')) {
      return true;
    }
    if (arg === '-r') {
      const next = normalizedArgs[index + 1];
      return typeof next === 'string' && !next.startsWith('-');
    }
    return false;
  });

  const cmdArgs = ['.context/pipelines/speckit-fetch.mjs'];

  if (!hasRepoPathArg) {
    cmdArgs.push('--repoPath', REPO_ROOT);
  }

  cmdArgs.push(...normalizedArgs);

  const result = await execa('node', cmdArgs, {
    cwd: REPO_ROOT,
    reject: false,
  });

  let payload;

  try {
    const stdout = result.stdout?.trim();
    payload = stdout ? JSON.parse(stdout.split('\n').pop() ?? '{}') : {};
  } catch {
    payload = {
      ok: false,
      error: result.stderr?.trim() || 'Spec Kit fetch returned invalid output',
    };
  }

  if (result.exitCode !== 0 && result.exitCode !== 202) {
    payload.ok = false;
    if (!payload.error) {
      payload.error = `Spec Kit fetch failed (exit code ${result.exitCode})`;
    }
  }

  return { payload, exitCode: result.exitCode ?? 1 };
}

// ===== Helper Functions =====

/**
 * Create a feature branch for the specification
 * 
 * @param {string} branchName - Branch name (e.g., "001-feature-name")
 * @returns {Promise<boolean>} - True if branch was created, false if it already exists or git not available
 */
async function createFeatureBranch(branchName) {
  try {
    const git = simpleGit(REPO_ROOT);
    
    // Check if we're in a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.warn('Not a git repository, skipping branch creation');
      return false;
    }
    
    // Check if branch already exists
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName) || branches.all.includes(`feature/${branchName}`)) {
      console.log(`Branch ${branchName} already exists, skipping creation`);
      return false;
    }
    
    // Get current branch to check if we have uncommitted changes
    const status = await git.status();
    if (status.files.length > 0) {
      console.warn('Uncommitted changes detected, creating branch without checkout');
      // Create branch without checking out
      await git.branch([`feature/${branchName}`]);
      return true;
    }
    
    // Create and checkout the feature branch
    await git.checkoutLocalBranch(`feature/${branchName}`);
    console.log(`Created and checked out branch: feature/${branchName}`);
    return true;
    
  } catch (error) {
    console.error('Failed to create branch:', error.message);
    // Don't fail the entire operation if branch creation fails
    return false;
  }
}

/**
 * Load a template file from .context/templates/sdd/
 */
async function loadTemplate(templateName) {
  const templatePath = path.join(REPO_ROOT, '.context', 'templates', 'sdd', templateName);
  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    // Return basic template if file doesn't exist
    console.warn(`Template ${templateName} not found, using default`);
    return getDefaultTemplate(templateName);
  }
}

/**
 * Get default template if file doesn't exist
 */
function getDefaultTemplate(templateName) {
  if (templateName === 'feature-spec-template.md') {
    return `# Feature Specification: {{description}}

**Spec Number**: {{number}}  
**Branch**: \`{{branchName}}\`  
**Date**: {{date}}  
**Status**: Draft

## Overview

[NEEDS CLARIFICATION: Provide a high-level overview of what this feature does and why it's needed]

## What (Not How)

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)

## User Stories

[NEEDS CLARIFICATION: Add user stories in the format: "As a [role], I want [capability], so that [benefit]"]

## Acceptance Criteria

[NEEDS CLARIFICATION: Define measurable success criteria]

## Non-Functional Requirements

- Performance: [NEEDS CLARIFICATION]
- Security: [NEEDS CLARIFICATION]
- Accessibility: [NEEDS CLARIFICATION]

## Constraints & Assumptions

[NEEDS CLARIFICATION: List any known constraints or assumptions]

## Out of Scope

[NEEDS CLARIFICATION: Explicitly state what this feature will NOT include]

## Constitutional Compliance Checklist

### Simplicity Gate (Article VII)
- [ ] Using ≤3 projects?
- [ ] No future-proofing?

### Anti-Abstraction Gate (Article VIII)
- [ ] Using framework directly?
- [ ] Single model representation?

### Integration-First Gate (Article IX)
- [ ] Contracts defined?
- [ ] Real environment testing planned?

---

**Review Checklist:**
- [ ] No \`[NEEDS CLARIFICATION]\` markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Constitutional gates are addressed
`;
  }
  
  if (templateName === 'implementation-plan-template.md') {
    return `# Implementation Plan: {{specTitle}}

**Spec**: {{specNumber}}  
**Tech Stack**: {{techStack}}  
**Date**: {{date}}  
**Status**: Draft

## Requirements Summary

{{requirements}}

## User Stories

{{userStories}}

## Phase -1: Pre-Implementation Gates

### Simplicity Gate (Article VII)
- [ ] Using ≤3 projects? [Document if >3]
- [ ] No future-proofing? [Document speculative features]

### Anti-Abstraction Gate (Article VIII)
- [ ] Using framework directly? [Document wrappers/abstractions]
- [ ] Single model representation? [Document data model duplication]

### Integration-First Gate (Article IX)
- [ ] Contracts defined? [Link to contracts/]
- [ ] Contract tests written? [Link to test files]

**Gate Status**: [PASS/FAIL]

## Phase 0: Test Scaffolds (TDD-First)

Per Article III, tests MUST be written and validated before implementation.

### Contract Tests
- [ ] API contract tests (if applicable)
- [ ] Service contract tests

### Integration Tests
- [ ] Database integration tests
- [ ] External service integration tests

### Unit Tests
- [ ] Core business logic tests

## Phase 1: Core Implementation

[Detail implementation steps here]

## Phase 2: Integration & Refinement

[Detail integration steps here]

## Complexity Tracking

Document any gates that failed and justification:

- **Gate**: [Name]
- **Status**: FAIL
- **Justification**: [Why this complexity is necessary]
- **Mitigation**: [How we minimize impact]

---

**Implementation Order:**
1. Write contracts → contract tests
2. Write integration tests
3. Write unit tests
4. Verify all tests FAIL (Red phase)
5. Get user approval
6. Implement to make tests pass (Green phase)
7. Refactor (Blue phase)
`;
  }
  
  if (templateName === 'task-list-template.md') {
    return `# Task List: Spec {{specNumber}}

**Generated**: {{date}}  
**Status**: Ready for execution

## Tasks

{{taskList}}

## Parallelization Strategy

Tasks marked with \`[P]\` can be executed in parallel.

**Parallel Groups:**
- Group 1: Tasks 1-3 (independent)
- Group 2: Tasks 4-5 (depend on Group 1)

## Execution Notes

- Follow TDD order: contracts → integration → unit tests → implementation
- Run validation after each phase
- Create feature branch if not already created
`;
  }
  
  return `# Template: ${templateName}\n\n[Template content not available]\n`;
}

/**
 * Parse specification content for key information
 */
function parseSpecification(content) {
  const info = {
    number: '',
    title: '',
    requirements: [],
    userStories: [],
  };
  
  // Extract spec number
  const numberMatch = content.match(/\*\*Spec Number\*\*:\s*(\d{3})/);
  if (numberMatch) {
    info.number = numberMatch[1];
  }
  
  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(?:Feature Specification:\s*)?(.+)$/m);
  if (titleMatch) {
    info.title = titleMatch[1].trim();
  }
  
  // Extract requirements (bullet points under ## Acceptance Criteria or ## Requirements)
  const reqSection = content.match(/##\s+(?:Acceptance Criteria|Requirements)\s*\n([\s\S]*?)(?=\n##|$)/);
  if (reqSection) {
    info.requirements = reqSection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.trim());
  }
  
  // Extract user stories
  const storySection = content.match(/##\s+User Stories\s*\n([\s\S]*?)(?=\n##|$)/);
  if (storySection) {
    info.userStories = storySection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.trim());
  }
  
  return info;
}

/**
 * Validate constitutional gates in implementation plan
 */
async function validateConstitutionalGates(planContent) {
  // Try to use full constitution validation if available
  try {
    const { validatePlan, parseConstitution } = await import('./constitution.mjs');
    const constitutionPath = path.join(REPO_ROOT, 'contexts', 'governance', 'constitution.yaml');
    
    // Try parsing constitution
    const constitution = await parseConstitution(constitutionPath);
    if (constitution.ok) {
      // Write plan content to temp file for validation
      const tempPlanPath = path.join(REPO_ROOT, '.context', '.temp-plan.md');
      await fs.writeFile(tempPlanPath, planContent, 'utf-8');
      
      const validation = await validatePlan(tempPlanPath, constitution);
      
      // Clean up temp file
      try { await fs.unlink(tempPlanPath); } catch {}
      
      if (validation.ok) {
        return {
          passed: validation.results.passed,
          warnings: validation.results.warnings.map(w => w.message),
          violations: validation.results.violations,
          checks: validation.results.gates,
        };
      }
    }
  } catch (error) {
    // Fall through to basic validation
    console.warn('Constitution validation not available, using basic checks');
  }
  
  // Fallback: Basic validation (original implementation)
  const gates = {
    passed: true,
    warnings: [],
    violations: [],
    checks: {
      simplicity: { passed: true, issues: [] },
      antiAbstraction: { passed: true, issues: [] },
      integrationFirst: { passed: true, issues: [] },
    },
  };
  
  // Check Simplicity Gate (Article VII)
  if (planContent.match(/>\s*3\s+projects/i)) {
    gates.checks.simplicity.passed = false;
    gates.checks.simplicity.issues.push('More than 3 projects detected');
    gates.passed = false;
    gates.violations.push({ article: 'VII', message: 'Simplicity Gate: >3 projects' });
  }
  
  if (planContent.match(/future[- ]proof/i)) {
    gates.checks.simplicity.passed = false;
    gates.checks.simplicity.issues.push('Future-proofing detected');
    gates.passed = false;
    gates.violations.push({ article: 'VII', message: 'Simplicity Gate: Future-proofing detected' });
  }
  
  // Check Anti-Abstraction Gate (Article VIII)
  if (planContent.match(/wrapper|adapter.*class/i) && !planContent.match(/justification/i)) {
    gates.warnings.push('Possible abstraction layer detected - ensure it\'s justified');
  }
  
  // Check Integration-First Gate (Article IX)
  if (!planContent.match(/contract.*test/i)) {
    gates.checks.integrationFirst.passed = false;
    gates.checks.integrationFirst.issues.push('No contract tests mentioned');
    gates.passed = false;
    gates.violations.push({ article: 'IX', message: 'Integration-First Gate: No contract tests' });
  }
  
  return gates;
}

/**
 * Extract tasks from implementation plan
 */
function extractTasksFromPlan(planContent) {
  const tasks = [];
  const parallelGroups = [];
  
  // Extract spec number
  const specMatch = planContent.match(/\*\*Spec\*\*:\s*(\d{3})/);
  const specNumber = specMatch ? specMatch[1] : '???';
  
  // Extract tasks from Phase sections
  const phasePattern = /##\s+Phase\s+\d+:.*?\n([\s\S]*?)(?=\n##|$)/g;
  let phaseMatch;
  let taskId = 1;
  
  while ((phaseMatch = phasePattern.exec(planContent)) !== null) {
    const phaseContent = phaseMatch[1];
    const taskLines = phaseContent
      .split('\n')
      .filter(line => line.trim().startsWith('-') && !line.includes('[ ]'));
    
    const phaseTasks = taskLines.map(line => ({
      id: `T-${String(taskId++).padStart(4, '0')}`,
      description: line.replace(/^-\s*\[.\]\s*/, '').trim(),
      parallel: false,
    }));
    
    tasks.push(...phaseTasks);
  }
  
  // Mark parallelizable tasks (simple heuristic: tasks in same phase)
  if (tasks.length > 0) {
    parallelGroups.push({ groupId: 1, taskIds: tasks.slice(0, Math.ceil(tasks.length / 2)).map(t => t.id) });
    parallelGroups.push({ groupId: 2, taskIds: tasks.slice(Math.ceil(tasks.length / 2)).map(t => t.id) });
  }
  
  return {
    specNumber,
    tasks,
    parallelGroups,
  };
}

/**
 * Format task list for output
 */
function formatTaskList(tasks) {
  return tasks
    .map((task, idx) => {
      const parallelMarker = task.parallel ? ' [P]' : '';
      return `${idx + 1}. **${task.id}**${parallelMarker}: ${task.description}`;
    })
    .join('\n');
}

// ===== CLI Interface =====

async function main() {
  const [, , command, ...args] = process.argv;
  
  if (!command) {
    console.error('Usage: node speckit.mjs <command> [args]');
    console.error('Commands:');
    console.error('  specify <description>    - Create a new specification');
    console.error('  plan <specPath>          - Generate implementation plan');
    console.error('  tasks <planPath>         - Generate task list');
    process.exit(1);
  }
  
  let result;
  let exitCodeOverride;
  
  switch (command) {
    case 'specify':
      result = await specify(args.join(' '));
      break;
    case 'plan':
      result = await plan(args[0], { constitution: true });
      break;
    case 'tasks':
      result = await tasks(args[0]);
      break;
    case 'fetch':
      ({ payload: result, exitCode: exitCodeOverride } = await runFetch(args));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
  
  console.log(JSON.stringify(result, null, 2));
  if (typeof exitCodeOverride === 'number') {
    process.exit(exitCodeOverride);
  }

  process.exit(result?.ok ? 0 : 1);
}

// Run if called directly (check if this is the main module)
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

export { specify, plan, tasks };
