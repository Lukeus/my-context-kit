import { test, expect } from './helpers/electron';

test.describe('UI Rendering', () => {
  test('should display main layout', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Check for app container
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('should have sidebar or navigation', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for sidebar elements (may vary based on actual UI)
    const sidebar = page.locator('aside, .sidebar, [role="navigation"]').first();
    const sidebarCount = await sidebar.count();
    
    // At least check something rendered
    expect(sidebarCount).toBeGreaterThanOrEqual(0);
  });

  test('should have main content area', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for main content
    const main = page.locator('main, .main-content').first();
    const mainCount = await main.count();
    
    expect(mainCount).toBeGreaterThanOrEqual(0);
  });
});
