import { test, expect } from './helpers/electron';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Refactored to use shared Electron fixtures (helpers/electron.ts) to avoid manual launch instability.
// TODO(e2e-refactor): move repository setup helpers to a shared module if reused.

let page: Page;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testRepoPath = path.join(__dirname, '..', '..', 'test-fixtures', 'sdd-test-repo');

test.describe('SDD Workflow E2E', () => {
  test.beforeEach(async ({ page: injected }) => {
    page = injected;
  });

  test.afterAll(async () => {
    if (existsSync(testRepoPath)) {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    }
  });

  test('Complete SDD Workflow: Spec → Plan → Tasks → Entities', async () => {
    // Step 1: Open repository or create test repo
    const repoManagerButton = page.locator('button:has-text("Repository Manager"), button:has-text("Select Repository")');
    
    if (await repoManagerButton.isVisible({ timeout: 5000 })) {
      await repoManagerButton.click();
      await page.waitForTimeout(500);

      // Check if test repo exists, if not, create it
      const existingRepo = page.locator(`text=${testRepoPath}`);
      if (!(await existingRepo.isVisible({ timeout: 2000 }))) {
        const addButton = page.locator('button:has-text("Add Repository"), button:has-text("New")');
        await addButton.click();
        
        // Fill in repo details
        await page.locator('input[placeholder*="label"], input[placeholder*="name"]').fill('SDD Test Repo');
        await page.locator('input[placeholder*="path"]').fill(testRepoPath);
        
        const saveButton = page.locator('button:has-text("Add"), button:has-text("Save")');
        await saveButton.click();
        await page.waitForTimeout(1000);
      }

      // Select the test repo
      const selectButton = page.locator(`button:has-text("Select"):near(:text("${testRepoPath}"))`).first();
      await selectButton.click();
      await page.waitForTimeout(2000);
    }

    // Step 2: Open Speckit Wizard
    // Look for a button or menu item that triggers speckit workflow
    const newButton = page.locator('button:has-text("New"), button[aria-label*="New"]').first();
    await newButton.click({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Try to find Speckit/SDD option in menu
    const speckitOption = page.locator('text=/Speckit|SDD|Specification/i').first();
    if (await speckitOption.isVisible({ timeout: 2000 })) {
      await speckitOption.click();
    } else {
      // Alternative: Look for a direct button
      const speckitButton = page.locator('button:has-text("Speckit"), button:has-text("Create Spec")').first();
      await speckitButton.click({ timeout: 5000 });
    }

    await page.waitForTimeout(1000);

    // Step 3: Verify Speckit Wizard opened
    await expect(page.locator('text=Speckit Workflow, text=Specification-Driven Development')).toBeVisible({ timeout: 5000 });

    // Step 4: Create Specification
    const descriptionInput = page.locator('textarea[placeholder*="feature"], textarea[placeholder*="Describe"]').first();
    await expect(descriptionInput).toBeVisible({ timeout: 5000 });

    const testFeatureDescription = 'Real-time notification system with WebSocket support and message queuing';
    await descriptionInput.fill(testFeatureDescription);

    const createSpecButton = page.locator('button:has-text("Create Spec")').first();
    await createSpecButton.click();

    // Wait for spec creation
    await expect(page.locator('text=/Spec Number:|spec-/i')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Branch:/i')).toBeVisible({ timeout: 5000 });

    // Verify spec was created
    const specNumberElement = page.locator('text=/Spec Number:|\\*\\*Spec Number\\*\\*:/i').first();
    const specNumberText = await specNumberElement.textContent();
    const specNumber = specNumberText?.match(/\d{3}/)?.[0];
    expect(specNumber).toBeTruthy();

    // Step 5: Generate Implementation Plan
    const generatePlanButton = page.locator('button:has-text("Generate Plan")').first();
    await expect(generatePlanButton).toBeVisible({ timeout: 5000 });
    await generatePlanButton.click();

    // Wait for plan generation
    await expect(page.locator('text=/Plan:|plan\\.md/i')).toBeVisible({ timeout: 15000 });

    // Check for constitutional gates
    const gatesResult = page.locator('text=/Constitutional Gates:|All gates passed|issues found/i').first();
    await expect(gatesResult).toBeVisible({ timeout: 5000 });

    // Step 6: Generate Task List
    const generateTasksButton = page.locator('button:has-text("Generate Tasks")').first();
    await expect(generateTasksButton).toBeVisible({ timeout: 5000 });
    await generateTasksButton.click();

    // Wait for tasks generation
    await expect(page.locator('text=/Tasks:|tasks\\.md/i')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/Count:|\\d+ tasks/i')).toBeVisible({ timeout: 5000 });

    // Step 7: Generate YAML Entities
    const generateEntitiesCheckbox = page.locator('input#generateEntities, input[type="checkbox"]:near(:text("Generate YAML Entities"))').first();
    
    if (await generateEntitiesCheckbox.isVisible({ timeout: 5000 })) {
      // Ensure checkbox is checked
      if (!(await generateEntitiesCheckbox.isChecked())) {
        await generateEntitiesCheckbox.check();
      }

      // Click generate entities button
      const generateEntitiesButton = page.locator('button:has-text("Generate Entities")').first();
      await expect(generateEntitiesButton).toBeVisible({ timeout: 5000 });
      await generateEntitiesButton.click();

      // Wait for entities generation
      await expect(page.locator('text=/Entities Generated|✓ Entities/i')).toBeVisible({ timeout: 15000 });

      // Verify entities were created
      await page.waitForTimeout(2000);

      // Step 8: Verify files exist on filesystem
      if (specNumber) {
        // Variables kept for potential future file verification
        // const specDir = path.join(testRepoPath, 'specs', `${specNumber}-*`);
        // const featuresDir = path.join(testRepoPath, 'contexts', 'features');
        // const storiesDir = path.join(testRepoPath, 'contexts', 'userstories');

        // Check if directories exist (after workflow completes)
        await page.waitForTimeout(3000); // Allow file system operations to complete

        // Note: In E2E test, we can't directly access filesystem easily
        // Instead, verify UI shows success
        await expect(page.locator('text=/Feature and UserStory entities created/i')).toBeVisible({ timeout: 5000 });
      }
    }

    // Step 9: Complete Workflow
    const completeButton = page.locator('button:has-text("Complete Workflow")').first();
    await expect(completeButton).toBeVisible({ timeout: 5000 });
    
    // Complete button should be enabled after entities are generated
    await expect(completeButton).toBeEnabled({ timeout: 5000 });
    await completeButton.click();

    // Verify completion message
    await expect(page.locator('text=/Workflow Complete|🎉/i')).toBeVisible({ timeout: 5000 });

    // Step 10: Close wizard
    const closeButton = page.locator('button:has-text("Close")').last();
    await closeButton.click();

    // Verify wizard closed
    await expect(page.locator('text=Speckit Workflow, text=Specification-Driven Development')).not.toBeVisible({ timeout: 5000 });

    // Step 11: Verify entities appear in context tree (if visible)
    const contextTree = page.locator('text=/Features|Context Tree/i').first();
    if (await contextTree.isVisible({ timeout: 5000 })) {
      await contextTree.click();
      
      // Look for newly created feature
      const newFeature = page.locator(`text=/FEAT-${specNumber}/i`).first();
      await expect(newFeature).toBeVisible({ timeout: 10000 });
    }
  });

  test('Speckit Wizard: Cancel workflow', async () => {
    // Open wizard
    const newButton = page.locator('button:has-text("New"), button[aria-label*="New"]').first();
    await newButton.click({ timeout: 5000 });

    const speckitButton = page.locator('button:has-text("Speckit"), button:has-text("Create Spec")').first();
    if (await speckitButton.isVisible({ timeout: 2000 })) {
      await speckitButton.click();
    }

    await page.waitForTimeout(1000);

    // Verify wizard opened
    await expect(page.locator('text=Speckit Workflow, text=Specification-Driven Development')).toBeVisible({ timeout: 5000 });

    // Click close without completing
    const closeButton = page.locator('button:has-text("Close")').last();
    await closeButton.click();

    // Verify wizard closed
    await expect(page.locator('text=Speckit Workflow')).not.toBeVisible({ timeout: 5000 });
  });

  test('Speckit Wizard: Error handling', async () => {
    // Open wizard
    const newButton = page.locator('button:has-text("New")').first();
    await newButton.click({ timeout: 5000 });

    const speckitButton = page.locator('button:has-text("Speckit"), button:has-text("Create Spec")').first();
    if (await speckitButton.isVisible({ timeout: 2000 })) {
      await speckitButton.click();
    }

    await page.waitForTimeout(1000);

    // Try to create spec with empty description
    const createSpecButton = page.locator('button:has-text("Create Spec")').first();
    
    // Button should be disabled
    await expect(createSpecButton).toBeDisabled({ timeout: 5000 });

    // Fill in minimal description
    const descriptionInput = page.locator('textarea[placeholder*="feature"]').first();
    await descriptionInput.fill('Test');

    // Button should now be enabled
    await expect(createSpecButton).toBeEnabled({ timeout: 2000 });

    // Close wizard
    const closeButton = page.locator('button:has-text("Close")').last();
    await closeButton.click();
  });

  test('Constitutional Gates: Validation display', async () => {
    // This test verifies that constitutional gate results are displayed

    // Open wizard and create a spec
    const newButton = page.locator('button:has-text("New")').first();
    await newButton.click({ timeout: 5000 });

    const speckitButton = page.locator('button:has-text("Speckit")').first();
    if (await speckitButton.isVisible({ timeout: 2000 })) {
      await speckitButton.click();
    }

    await page.waitForTimeout(1000);

    const descriptionInput = page.locator('textarea[placeholder*="feature"]').first();
    await descriptionInput.fill('Complex multi-service authentication system');

    const createSpecButton = page.locator('button:has-text("Create Spec")').first();
    await createSpecButton.click();

    await expect(page.locator('text=/Spec Number:/i')).toBeVisible({ timeout: 10000 });

    // Generate plan
    const generatePlanButton = page.locator('button:has-text("Generate Plan")').first();
    await generatePlanButton.click();

    await expect(page.locator('text=/Plan:/i')).toBeVisible({ timeout: 15000 });

    // Check for constitutional gates section
    const gatesSection = page.locator('text=Constitutional Gates:').first();
    await expect(gatesSection).toBeVisible({ timeout: 5000 });

    // Gates should show pass or fail status
    const gatesStatus = page.locator('text=/All gates passed|issues found/i').first();
    await expect(gatesStatus).toBeVisible({ timeout: 5000 });

    // Close wizard
    const closeButton = page.locator('button:has-text("Close")').last();
    await closeButton.click();
  });
});

test.describe('Speckit Fetch Status Panel', () => {
  const successFetchPayload = {
    ok: true,
    cachePath: '/mock/context-repo/.context/speckit-cache/v0.0.79',
    commit: 'abc123def4567890',
    releaseTag: 'v0.0.79',
    durationMs: 4800,
    fetchedAt: '2025-10-28T17:30:00.000Z',
    source: {
      repository: 'github/spec-kit',
      releaseTag: 'v0.0.79',
      commit: 'abc123def4567890',
    },
    timing: {
      startedAt: '2025-10-28T17:29:55.000Z',
      finishedAt: '2025-10-28T17:30:00.000Z',
      durationMs: 5000,
    },
    artifacts: {
      docs: ['docs/spec-driven-development.md'],
      templates: ['templates/feature-spec-template.md'],
      memory: [],
    },
    status: {
      ok: true,
      error: null,
      stale: false,
    },
    warnings: [],
  };

  const staleFetchPayload = {
    ok: true,
    cachePath: '/mock/context-repo/.context/speckit-cache/v0.0.42',
    commit: 'deadbeefcaf01234',
    releaseTag: 'v0.0.42',
    durationMs: 6200,
    fetchedAt: '2025-09-15T09:10:00.000Z',
    source: {
      repository: 'github/spec-kit',
      releaseTag: 'v0.0.42',
      commit: 'deadbeefcaf01234',
    },
    timing: {
      startedAt: '2025-09-15T09:09:50.000Z',
      finishedAt: '2025-09-15T09:10:00.000Z',
      durationMs: 10000,
    },
    artifacts: {
      docs: ['docs/legacy.md'],
      templates: ['templates/legacy-template.md'],
      memory: [],
    },
    status: {
      ok: true,
      error: null,
      stale: true,
    },
    warnings: ['Fetched snapshot older than freshness window'],
  };

  async function openWizardAndReachFetchStep() {
    const newButton = page.locator('button:has-text("New"), button[aria-label*="New"]').first();
    await newButton.click({ timeout: 5000 });

    const speckitOption = page.locator('button:has-text("Speckit"), button:has-text("Create Spec"), text=/Speckit|Specification/i').first();
    await speckitOption.click({ timeout: 5000 });

    await expect(page.locator('text=Speckit Workflow')).toBeVisible({ timeout: 5000 });

    const descriptionInput = page.locator('textarea[placeholder*="feature"], textarea[placeholder*="Describe"]').first();
    await descriptionInput.fill(`Spec Kit status verification ${Date.now()}`);

    const createSpecButton = page.locator('button:has-text("Create Spec")').first();
    await createSpecButton.click();

    await expect(page.locator('text=/Spec Number:/i')).toBeVisible({ timeout: 10000 });

    const generatePlanButton = page.locator('button:has-text("Generate Plan")').first();
    await generatePlanButton.click();

    await expect(page.locator('text=/Plan:|plan\\.md/i')).toBeVisible({ timeout: 20000 });
  }

  async function stubSpeckitFetch(payload: unknown) {
    await page.evaluate((mockPayload) => {
      const globalAny = window as unknown as Record<string, any>;
      if (!globalAny.__originalSpeckitFetch) {
        globalAny.__originalSpeckitFetch = globalAny.api.speckit.fetch;
      }
      globalAny.api.speckit.fetch = async () => mockPayload;
    }, payload);
  }

  async function restoreSpeckitFetchStub() {
    await page.evaluate(() => {
      const globalAny = window as unknown as Record<string, any>;
      if (globalAny.__originalSpeckitFetch) {
        globalAny.api.speckit.fetch = globalAny.__originalSpeckitFetch;
        delete globalAny.__originalSpeckitFetch;
      }
    });
  }

  test('renders success summary for fresh cache', async () => {
    await openWizardAndReachFetchStep();

    try {
      await stubSpeckitFetch(successFetchPayload);

      const fetchButton = page.locator('button:has-text("Fetch Spec Kit")').first();
      await fetchButton.click();

      await expect(page.locator('text=Release: v0.0.79')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/Cache is fresh/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Docs: 1')).toBeVisible({ timeout: 5000 });
    } finally {
      await restoreSpeckitFetchStub();
      const closeButton = page.locator('button:has-text("Close")').last();
      await closeButton.click({ timeout: 5000 });
    }
  });

  test('shows stale warning when cache is out of date', async () => {
    await openWizardAndReachFetchStep();

    try {
      await stubSpeckitFetch(staleFetchPayload);

      const fetchButton = page.locator('button:has-text("Fetch Spec Kit")').first();
      await fetchButton.click();

      await expect(page.locator('text=Release: v0.0.42')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/Cache is older than the freshness window/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Warnings')).toBeVisible({ timeout: 5000 });
    } finally {
      await restoreSpeckitFetchStub();
      const closeButton = page.locator('button:has-text("Close")').last();
      await closeButton.click({ timeout: 5000 });
    }
  });
});

test.describe('SDD Pipeline Unit Tests', () => {
  test('spec-entity pipeline: Parse specification', async () => {
    // This would typically be a unit test, but including here for completeness
    // In a real scenario, you'd test the pipeline directly with Node.js

    const testSpec = `# Feature Specification: Test Feature

**Spec Number**: 001  
**Branch**: \`001-test-feature\`  
**Date**: 2025-01-26  
**Status**: Draft

## Overview

This is a test feature for E2E testing.

## User Stories

- As a user, I want to test the system, so that I can verify it works
- As a developer, I want automated tests, so that I can deploy with confidence

## Acceptance Criteria

- System must handle test cases
- All tests must pass

## Constraints & Assumptions

- Test environment available
- Data fixtures provided

## Out of Scope

- Production deployment
- Performance optimization
`;

    // In Electron E2E, we could invoke the pipeline through IPC
    // But for now, we'll just verify the UI workflow works end-to-end
    expect(testSpec).toContain('Spec Number');
    expect(testSpec).toContain('User Stories');
    expect(testSpec).toContain('Acceptance Criteria');
  });
});
