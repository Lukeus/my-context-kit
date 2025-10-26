import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Electron E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  
  // Maximum time one test can run
  timeout: 60 * 1000,
  
  // Run tests in files in parallel
  fullyParallel: false,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: 1,
  
  // Reporter to use
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5173',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers - not needed for Electron
  projects: [
    {
      name: 'electron',
      use: {
        // Electron-specific configuration will be in test files
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Don't use webServer since we'll launch Electron directly
});
