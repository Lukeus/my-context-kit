import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { test as base } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ElectronFixtures {
  electronApp: ElectronApplication;
  page: Page;
}

/**
 * Extended Playwright test with Electron fixtures
 * Automatically launches and closes Electron app for each test
 */
export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Path to the packaged app.asar
    const appPath = path.join(
      __dirname,
      '../../out/Context-Sync-win32-x64/resources/app.asar'
    );
    
    // Get Electron executable
    const require = createRequire(import.meta.url);
    const electronPath = require('electron');
    
    // Launch Electron with the packaged app.asar
    const app = await electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Disable auto-updates and other production features in tests
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });

    // Wait for app to be ready
    await app.context().tracing.start({ screenshots: true, snapshots: true });
    
    await use(app);
    
    // Cleanup
    await app.context().tracing.stop({
      path: `playwright-report/trace-${Date.now()}.zip`,
    });
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    // Get the first window that the app opens
    const window = await electronApp.firstWindow();
    
    // Wait for the app to load
    await window.waitForLoadState('domcontentloaded');
    
    await use(window);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper to wait for IPC response
 */
export async function waitForIPC(page: Page, channel: string, timeout = 5000): Promise<any> {
  return page.evaluate(
    ({ channel, timeout }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`IPC timeout waiting for ${channel}`));
        }, timeout);

        // This is a simplified example - actual implementation depends on your IPC setup
        window.addEventListener('message', function handler(event) {
          if (event.data?.channel === channel) {
            clearTimeout(timer);
            window.removeEventListener('message', handler);
            resolve(event.data.payload);
          }
        });
      });
    },
    { channel, timeout }
  );
}

/**
 * Helper to get app version
 */
export async function getAppVersion(electronApp: ElectronApplication): Promise<string> {
  return electronApp.evaluate(async ({ app }) => {
    return app.getVersion();
  });
}

/**
 * Helper to get app path
 */
export async function getAppPath(electronApp: ElectronApplication): Promise<string> {
  return electronApp.evaluate(async ({ app }) => {
    return app.getAppPath();
  });
}
