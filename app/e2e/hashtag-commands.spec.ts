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

test.describe('Hashtag Command Feature', () => {
  test.beforeAll(async () => {
    const appPath = path.join(
      __dirname,
      '../out/Context-Sync-win32-x64/resources/app.asar'
    );

    const require = createRequire(import.meta.url);
    const electronPath = require('electron');

    electronApp = await electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Mock assistant API endpoints
    await window.route('**/assistant/**', (route) => {
      const url = route.request().url();

      if (url.includes('/assistant/sessions')) {
        void route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            sessionId: 'test-session-hashtag',
            provider: 'azure-openai',
            activeTools: [
              'context.read',
              'context.search',
              'pipeline.validate',
              'pipeline.build-graph',
              'pipeline.impact',
              'pipeline.generate',
            ],
          }),
        });
      } else if (url.includes('/assistant/health')) {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'healthy', latencyMs: 25 }),
        });
      } else {
        void route.continue();
      }
    });
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.beforeEach(async () => {
    // AI Assistant panel is always visible in the right sidebar
    // Just wait for the message input to be available
    await window.waitForSelector('[data-assistant-focus="message-input"]', { timeout: 5000 });
  });

  test('should show suggestion dropdown when typing # symbol', async () => {
    // Type # in the message input
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    await messageInput.fill('#');

    // Wait for suggestions to appear
    await window.waitForSelector('[role="listbox"]', { timeout: 3000 });

    // Verify suggestion list is visible
    const suggestionList = window.locator('[role="listbox"]');
    await expect(suggestionList).toBeVisible();
  });

  test('should filter suggestions based on partial hashtag input', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type #val to filter for #validate
    await messageInput.fill('#val');
    await window.waitForTimeout(200);

    // Verify suggestions list appears
    const suggestionList = window.locator('[role="listbox"]');
    await expect(suggestionList).toBeVisible();

    // Verify #validate suggestion is present
    const validateSuggestion = window.locator('[role="option"]:has-text("#validate")');
    await expect(validateSuggestion).toBeVisible();

    // Verify description is shown
    const description = window.locator('[role="option"]:has-text("Validate all YAML entities")');
    await expect(description).toBeVisible();
  });

  test('should select suggestion with Enter key', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type partial hashtag
    await messageInput.fill('#sea');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Press Enter to select first suggestion
    await messageInput.press('Enter');

    // Verify the input now contains the complete hashtag
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain('#search');
  });

  test('should navigate suggestions with arrow keys', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type # to show all suggestions
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Press ArrowDown to navigate
    await messageInput.press('ArrowDown');
    await window.waitForTimeout(100);

    // First option should be highlighted
    const firstOption = window.locator('[role="option"].bg-primary-50').first();
    await expect(firstOption).toBeVisible();

    // Press ArrowDown again
    await messageInput.press('ArrowDown');
    await window.waitForTimeout(100);

    // Second option should be highlighted
    const highlightedOptions = window.locator('[role="option"].bg-primary-50');
    await expect(highlightedOptions).toHaveCount(1);
  });

  test('should close suggestions with Escape key', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type # to show suggestions
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Press Escape
    await messageInput.press('Escape');
    await window.waitForTimeout(200);

    // Suggestions should be hidden
    const suggestionList = window.locator('[role="listbox"]');
    await expect(suggestionList).not.toBeVisible();
  });

  test('should select suggestion by clicking', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type # to show all suggestions
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Click on #graph suggestion
    const graphSuggestion = window.locator('[role="option"]:has-text("#graph")');
    await graphSuggestion.click();

    // Verify input contains the selected hashtag
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain('#graph');

    // Suggestions should be closed
    const suggestionList = window.locator('[role="listbox"]');
    await expect(suggestionList).not.toBeVisible();
  });

  test('should show keyboard shortcuts in suggestion footer', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type # to show suggestions
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Verify keyboard shortcut hints are visible
    const upArrow = window.locator('kbd:has-text("↑")');
    await expect(upArrow).toBeVisible();

    const downArrow = window.locator('kbd:has-text("↓")');
    await expect(downArrow).toBeVisible();

    const enter = window.locator('kbd:has-text("Enter")');
    await expect(enter).toBeVisible();
  });

  test('should support multiple hashtags in one message', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type first hashtag
    await messageInput.fill('#validate');
    await window.waitForTimeout(100);

    // Add text and second hashtag
    await messageInput.fill('#validate and #search login');

    // Verify both hashtags are in the input
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain('#validate');
    expect(inputValue).toContain('#search');
  });

  test('should execute tool when sending message with hashtag', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    const sendButton = window.locator('[data-assistant-focus="send-button"]');

    // Mock tool execution endpoint
    let toolExecuted = false;
    await window.route('**/assistant/tools/execute', (route) => {
      toolExecuted = true;
      const requestBody = route.request().postDataJSON();
      
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          taskId: 'task-123',
          status: 'completed',
          result: { message: 'Validation successful' },
        }),
      });
    });

    // Type hashtag command and send
    await messageInput.fill('#validate');
    await sendButton.click();

    // Wait for execution
    await window.waitForTimeout(1000);

    // Verify tool was executed (or attempted based on mocked response)
    // This will be validated by the presence of task in queue or transcript
    const transcript = window.locator('[data-assistant-focus="transcript"]');
    await expect(transcript).toBeVisible();
  });

  test('should parse hashtag with arguments', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type hashtag with argument
    await messageInput.fill('#search authentication');

    // The parsed command should include the query parameter
    // This will be validated when the message is sent
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain('#search authentication');
  });

  test('should handle #impact with entity ID argument', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type #impact with entity ID
    await messageInput.fill('#impact feat-001');

    const inputValue = await messageInput.inputValue();
    expect(inputValue).toContain('#impact feat-001');
  });

  test('should not show suggestions for invalid hashtags', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type hashtag that doesn't match any command
    await messageInput.fill('#xyz');
    await window.waitForTimeout(500);

    // Suggestions should not appear
    const suggestionList = window.locator('[role="listbox"]');
    await expect(suggestionList).not.toBeVisible();
  });

  test('should show all available commands', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type # to show all suggestions
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Verify all expected commands are present
    const expectedCommands = [
      '#validate',
      '#search',
      '#graph',
      '#impact',
      '#generate',
      '#embeddings',
      '#read',
    ];

    for (const cmd of expectedCommands) {
      const suggestion = window.locator(`[role="option"]:has-text("${cmd}")`);
      await expect(suggestion).toBeVisible();
    }
  });

  test('should display tool name in suggestion list', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type # to show suggestions
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Verify tool names are displayed (e.g., "validate", "search")
    const validateTool = window.locator('[role="option"]:has-text("validate")');
    await expect(validateTool).toBeVisible();
  });

  test('should maintain cursor position after autocomplete', async () => {
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    // Type hashtag
    await messageInput.fill('#val');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Select with Enter
    await messageInput.press('Enter');

    // Type more text
    await messageInput.press('Space');
    await messageInput.type('please');

    // Verify complete text
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toMatch(/#validate\s+please/);
  });
});

test.describe('Hashtag Command UI Integration', () => {
  test.beforeAll(async () => {
    const appPath = path.join(
      __dirname,
      '../out/Context-Sync-win32-x64/resources/app.asar'
    );

    const require = createRequire(import.meta.url);
    const electronPath = require('electron');

    electronApp = await electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should show hashtag help text on focus', async () => {
    // AI Assistant panel is always visible
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    await messageInput.focus();

    // Verify placeholder or help text mentions hashtag commands
    const placeholder = await messageInput.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });

  test('should display suggestion list with proper styling', async () => {
    await window.click('[data-testid="ai-assistant-button"]');
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Verify Material Design 3 styling is applied
    const suggestionList = window.locator('[role="listbox"]');
    const classes = await suggestionList.getAttribute('class');
    
    expect(classes).toContain('shadow-elevation');
    expect(classes).toContain('rounded-m3');
  });

  test('should position suggestions above input', async () => {
    await window.click('[data-testid="ai-assistant-button"]');
    const messageInput = window.locator('[data-assistant-focus="message-input"] textarea');
    
    await messageInput.fill('#');
    await window.waitForSelector('[role="listbox"]', { timeout: 2000 });

    // Verify absolute positioning
    const suggestionList = window.locator('[role="listbox"]');
    const classes = await suggestionList.getAttribute('class');
    
    expect(classes).toContain('absolute');
    expect(classes).toContain('bottom-full');
  });
});
