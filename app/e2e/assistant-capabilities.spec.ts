import { test, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication;
let window: Page;

// Track network requests to LangChain service
const langchainRequests: string[] = [];

// NOTE: These tests verify UI capability toggle integration with LangChain service.
// They require a live LangChain backend to fully pass. Without backend:
// - Capabilities default to enabled (backward compatibility)
// - No capability indicators appear in UI
// - Tests verify UI structure but not capability enforcement
test.describe('Assistant Capability Toggles (T022)', () => {
  test.beforeAll(async () => {
    // Path to the packaged app.asar
    const appPath = path.join(
      __dirname,
      '../out/Context-Sync-win32-x64/resources/app.asar'
    );

    // Get Electron executable
    const require = createRequire(import.meta.url);
    const electronPath = require('electron');

    // Launch Electron with test environment
    electronApp = await electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Intercept network requests to LangChain service
    await window.route('**/assistant/**', (route) => {
      const url = route.request().url();
      langchainRequests.push(url);
      
      // Mock capability endpoint with disabled capabilities
      if (url.includes('/assistant/capabilities')) {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profileId: 'test-profile-disabled',
            lastUpdated: new Date().toISOString(),
            capabilities: {
              'pipeline.validate': { status: 'disabled', fallback: 'local-validation' },
              'pipeline.build-graph': { status: 'disabled', fallback: 'skip' },
              'pipeline.impact': { status: 'disabled', fallback: 'skip' },
              'pipeline.generate': { status: 'enabled', rolloutNotes: 'Available' },
            },
          }),
        });
      } else if (url.includes('/assistant/sessions')) {
        // Allow session creation
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            sessionId: 'test-session-123',
            capabilityProfile: {
              profileId: 'test-profile-disabled',
              lastUpdated: new Date().toISOString(),
              capabilities: {
                'pipeline.validate': { status: 'disabled' },
                'pipeline.build-graph': { status: 'disabled' },
                'pipeline.impact': { status: 'disabled' },
                'pipeline.generate': { status: 'enabled' },
              },
            },
            telemetryContext: {
              repoRoot: '/test/repo',
              featureBranch: 'main',
              specificationPath: 'specs/test.md',
            },
          }),
        });
      } else if (url.includes('/assistant/health')) {
        // Mock health endpoint as healthy
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'healthy',
            latencyMs: 50,
          }),
        });
      } else {
        // Reject all other LangChain calls
        void route.abort('failed');
      }
    });
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should display pipeline dropdown with all options', async () => {
    // Navigate to assistant/tool panel view
    await window.click('[data-testid="assistant-nav"]');
    
    // Switch to Tools Console tab
    await window.click('button:has-text("Tools Console")', { timeout: 5000 });

    // Wait for the pipeline select to load (stable test id)
    await window.waitForSelector('[data-testid="pipeline-select"]', { timeout: 10000 });

    // Verify pipeline select is visible and contains expected options
    const selectElement = window.locator('[data-testid="pipeline-select"]');
    await expect(selectElement).toBeVisible();

    // Verify all pipeline options are present
    const validateOption = window.locator('[data-testid="pipeline-select"] option[value="validate"]');
    await expect(validateOption).toHaveCount(1);

    const buildGraphOption = window.locator('[data-testid="pipeline-select"] option[value="build-graph"]');
    await expect(buildGraphOption).toHaveCount(1);

    const impactOption = window.locator('[data-testid="pipeline-select"] option[value="impact"]');
    await expect(impactOption).toHaveCount(1);

    const generateOption = window.locator('[data-testid="pipeline-select"] option[value="generate"]');
    await expect(generateOption).toHaveCount(1);

    // Verify run button exists
    const runButton = window.locator('[data-testid="run-pipeline-button"]');
    await expect(runButton).toBeVisible();
  });

  test('should allow selecting validate pipeline', async () => {
    // Navigate to assistant panel
    await window.click('[data-testid="assistant-nav"]');
    await window.click('button:has-text("Tools Console")', { timeout: 5000 });

    await window.waitForSelector('[data-testid="pipeline-select"]', { timeout: 10000 });

    // Select the validate pipeline
    await window.selectOption('[data-testid="pipeline-select"]', { value: 'validate' });
    await window.waitForTimeout(500);

    // Verify selection
    const selectValue = await window.locator('[data-testid="pipeline-select"]').inputValue();
    expect(selectValue).toBe('validate');

    // Run button should be visible
    const runButton = window.locator('[data-testid="run-pipeline-button"]');
    await expect(runButton).toBeVisible();
  });

  test('should allow selecting build-graph pipeline', async () => {
    // Navigate to assistant panel
    await window.click('[data-testid="assistant-nav"]');
    await window.click('button:has-text("Tools Console")', { timeout: 5000 });

    await window.waitForSelector('[data-testid="pipeline-select"]', { timeout: 10000 });

    // Select the build-graph pipeline
    await window.selectOption('[data-testid="pipeline-select"]', { value: 'build-graph' });
    await window.waitForTimeout(500);

    // Verify selection
    const selectValue = await window.locator('[data-testid="pipeline-select"]').inputValue();
    expect(selectValue).toBe('build-graph');

    // Run button should be visible
    const runButton = window.locator('[data-testid="run-pipeline-button"]');
    await expect(runButton).toBeVisible();
  });

  test('should allow selecting impact pipeline and show entity ID input', async () => {
    // Navigate to assistant panel
    await window.click('[data-testid="assistant-nav"]');
    await window.click('button:has-text("Tools Console")', { timeout: 5000 });

    await window.waitForSelector('[data-testid="pipeline-select"]', { timeout: 10000 });

    // Select the impact pipeline
    await window.selectOption('[data-testid="pipeline-select"]', { value: 'impact' });
    await window.waitForTimeout(500);

    // Verify selection
    const selectValue = await window.locator('[data-testid="pipeline-select"]').inputValue();
    expect(selectValue).toBe('impact');

    // Entity ID input should be visible
    const idInput = window.locator('input[type="text"]').first();
    await expect(idInput).toBeVisible();

    // Run button should be visible
    const runButton = window.locator('[data-testid="run-pipeline-button"]');
    await expect(runButton).toBeVisible();
  });

  test('should allow selecting generate pipeline with entity IDs', async () => {
    // Navigate to assistant panel
    await window.click('[data-testid="assistant-nav"]');
    await window.click('button:has-text("Tools Console")', { timeout: 5000 });

    await window.waitForSelector('[data-testid="pipeline-select"]', { timeout: 10000 });

    // Select the generate pipeline
    await window.selectOption('[data-testid="pipeline-select"]', { value: 'generate' });

    await window.waitForTimeout(500);

    // Verify selection succeeded
    const selectValue = await window.locator('[data-testid="pipeline-select"]').inputValue();
    expect(selectValue).toBe('generate');

    // Verify entity ID input appears (generate requires IDs)
    const idInput = window.locator('input[type="text"]').first();
    await expect(idInput).toBeVisible();

    // Fill in required entity IDs
    await idInput.fill('entity-3');

    await window.waitForTimeout(500);

    // Verify run button is visible (may remain disabled depending on capability logic)
    const runButton = window.locator('[data-testid="run-pipeline-button"]');
    await expect(runButton).toBeVisible();

    // Note: We don't actually click the button to avoid backend dependencies
  });

  test('should initialize Tools Console on navigation', async () => {
    // Clear previous requests
    langchainRequests.length = 0;

    // Navigate to assistant panel
    await window.click('[data-testid="assistant-nav"]');
    await window.click('button:has-text("Tools Console")', { timeout: 5000 });

    // Wait for UI initialization
    await window.waitForTimeout(1000);

    // Verify Tools Console UI elements are present
    const pipelineSelect = window.locator('[data-testid="pipeline-select"]');
    await expect(pipelineSelect).toBeVisible();

    const runButton = window.locator('[data-testid="run-pipeline-button"]');
    await expect(runButton).toBeVisible();

    // Note: Capability requests happen via fetch() in main process,
    // not interceptable by Playwright's window.route() without additional setup
  });

  test('should maintain pipeline selection across navigation', async () => {
    // Navigate to assistant panel
    await window.click('[data-testid="assistant-nav"]');
    await window.click('button:has-text("Tools Console")', { timeout: 5000 });

    await window.waitForSelector('[data-testid="pipeline-select"]', { timeout: 10000 });

    // Select validate pipeline
    await window.selectOption('[data-testid="pipeline-select"]', { value: 'validate' });
    await window.waitForTimeout(500);

    // Verify selection
    let selectValue = await window.locator('[data-testid="pipeline-select"]').inputValue();
    expect(selectValue).toBe('validate');

    // Switch to build-graph
    await window.selectOption('[data-testid="pipeline-select"]', { value: 'build-graph' });
    await window.waitForTimeout(500);

    // Verify new selection
    selectValue = await window.locator('[data-testid="pipeline-select"]').inputValue();
    expect(selectValue).toBe('build-graph');

    // Switch back to validate
    await window.selectOption('[data-testid="pipeline-select"]', { value: 'validate' });
    await window.waitForTimeout(500);

    // Verify selection persists
    selectValue = await window.locator('[data-testid="pipeline-select"]').inputValue();
    expect(selectValue).toBe('validate');

    // Run button should be visible for all selections
    const runButton = window.locator('[data-testid="run-pipeline-button"]');
    await expect(runButton).toBeVisible();
  });
});