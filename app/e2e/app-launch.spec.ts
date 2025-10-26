import { test, expect, getAppVersion } from './helpers/electron';

test.describe('Application Launch', () => {
  test('should launch the app successfully', async ({ electronApp }) => {
    // Check that the app has launched
    expect(electronApp).toBeTruthy();
    
    // Verify the app version
    const version = await getAppVersion(electronApp);
    expect(version).toBeTruthy();
  });

  test('should render Vue application', async ({ page }) => {
    // Wait for Vue app to mount
    await page.waitForSelector('#app', { timeout: 30000 });
    
    // Check that the app container exists and is visible
    const appContainer = page.locator('#app');
    await expect(appContainer).toBeVisible();
  });

  test('should have window title', async ({ page }) => {
    // Wait for page load
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Check the window title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
});
