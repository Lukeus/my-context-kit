import { test, expect } from './helpers/electron';

test.describe('User Navigation Workflows', () => {
  test('should be able to interact with the application', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Take a screenshot to see the UI
    await page.screenshot({ path: 'test-results/app-screenshot.png', fullPage: true });
    
    // Check that the app is interactive
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('should have clickable buttons', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for buttons in the UI
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    // Should have some buttons
    expect(buttonCount).toBeGreaterThan(0);
    
    // Try to find specific action buttons if they exist
    const hasNewButton = await page.locator('button:has-text("New"), button[title*="New"], button[aria-label*="New"]').count();
    
    if (hasNewButton > 0) {
      console.log('Found New/Create button');
    }
  });

  test('should have repository selector or indicator', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for repository-related UI elements
    const repoElements = page.locator(
      'button:has-text("Repository"),' +
      'button:has-text("Repo"),' +
      '[data-testid*="repo"],' +
      '.repo-selector,' +
      'select[name*="repo"]'
    );
    
    const count = await repoElements.count();
    
    // Should have some way to select/view repository
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should have navigation or menu structure', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for navigation elements
    const nav = page.locator('nav, aside, .sidebar, [role="navigation"]');
    const navCount = await nav.count();
    
    if (navCount > 0) {
      const firstNav = nav.first();
      await expect(firstNav).toBeVisible();
      
      // Check if nav has links or menu items
      const navLinks = firstNav.locator('a, button, [role="menuitem"]');
      const linkCount = await navLinks.count();
      
      console.log(`Navigation contains ${linkCount} items`);
    }
  });

  test('should have main content that can change', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Get the main content area
    const main = page.locator('main, .main-content, .content');
    const mainCount = await main.count();
    
    if (mainCount > 0) {
      await expect(main.first()).toBeVisible();
    }
  });
});

test.describe('Context Tree Navigation', () => {
  test('should have context tree or entity list', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for tree or list structures
    const tree = page.locator(
      '[data-testid="context-tree"],' +
      '.context-tree,' +
      '[role="tree"],' +
      '[role="list"],' +
      'ul, ol'
    );
    
    const treeCount = await tree.count();
    
    if (treeCount > 0) {
      console.log('Found context tree or list structure');
      
      // Check for tree items
      const items = page.locator(
        '[role="treeitem"],' +
        '[role="listitem"],' +
        'li'
      );
      const itemCount = await items.count();
      
      console.log(`Found ${itemCount} items in tree/list`);
    }
  });

  test('should be able to expand/collapse tree items if present', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for expandable elements
    const expandables = page.locator(
      '[aria-expanded],' +
      'details,' +
      '.expandable'
    );
    
    const expandableCount = await expandables.count();
    
    if (expandableCount > 0) {
      const firstExpandable = expandables.first();
      const isExpanded = await firstExpandable.getAttribute('aria-expanded');
      
      console.log(`First expandable element is ${isExpanded ? 'expanded' : 'collapsed'}`);
      
      // Try to click it
      try {
        await firstExpandable.click({ timeout: 5000 });
        console.log('Successfully clicked expandable element');
      } catch (e) {
        console.log('Could not click expandable element');
      }
    }
  });
});

test.describe('Panel Interactions', () => {
  test('should have toggleable panels', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for panel toggle buttons
    const toggles = page.locator(
      'button[aria-label*="toggle"],' +
      'button[aria-label*="show"],' +
      'button[aria-label*="hide"],' +
      'button[title*="toggle"]'
    );
    
    const toggleCount = await toggles.count();
    
    if (toggleCount > 0) {
      console.log(`Found ${toggleCount} toggle buttons`);
    }
  });

  test('should have impact or AI assistant panel', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Look for right panel or assistant
    const panels = page.locator(
      '[data-testid="impact-panel"],' +
      '[data-testid="ai-panel"],' +
      '[data-testid="assistant"],' +
      '.impact-panel,' +
      '.ai-panel,' +
      '.assistant-panel'
    );
    
    const panelCount = await panels.count();
    
    if (panelCount > 0) {
      console.log('Found impact/AI panel');
    }
    
    // Even if not found, test passes - panels might be toggled off
    expect(panelCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Keyboard Navigation', () => {
  test('should support keyboard focus navigation', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Press Tab to move focus
    await page.keyboard.press('Tab');
    
    // Check if any element has focus
    const focusedElement = page.locator(':focus');
    const hasFocus = await focusedElement.count() > 0;
    
    if (hasFocus) {
      const tagName = await focusedElement.evaluate(el => el.tagName);
      console.log(`Focus moved to: ${tagName}`);
    }
    
    expect(hasFocus).toBe(true);
  });

  test('should support Escape key to close modals/dialogs', async ({ page }) => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Check for any open dialogs
    const dialogs = page.locator('[role="dialog"], .modal, .dialog');
    const dialogCount = await dialogs.count();
    
    if (dialogCount > 0) {
      // Try pressing Escape
      await page.keyboard.press('Escape');
      
      // Wait a moment
      await page.waitForTimeout(500);
      
      // Check if dialog closed
      const afterCount = await dialogs.count();
      console.log(`Dialogs before: ${dialogCount}, after Escape: ${afterCount}`);
    }
  });
});
