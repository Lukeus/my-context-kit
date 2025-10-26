# E2E Testing with Playwright

This directory contains end-to-end tests for the Context-Sync Electron application using Playwright.

## Overview

The E2E tests launch the actual Electron application and test it in a realistic environment, verifying:
- Application launches successfully
- UI components render correctly
- User workflows function as expected
- IPC communication works properly

## Setup

Playwright is already installed as a dev dependency. No additional setup is required.

## Running Tests

### Run all E2E tests
```powershell
pnpm test:e2e
```

### Run tests with UI mode (interactive)
```powershell
pnpm test:e2e:ui
```

### Debug tests (step through with debugger)
```powershell
pnpm test:e2e:debug
```

### View test report
```powershell
pnpm test:e2e:report
```

### Run both unit and E2E tests
```powershell
pnpm test:all
```

## Test Structure

```
e2e/
├── helpers/
│   └── electron.ts      # Electron-specific test helpers and fixtures
├── app-launch.spec.ts   # Tests for application launch and initialization
├── navigation.spec.ts   # Tests for navigation and UI layout
└── README.md           # This file
```

## Writing Tests

### Basic Test Template

```typescript
import { test, expect } from './helpers/electron';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Wait for app to be ready
    await page.waitForLoadState('networkidle');
    
    // Interact with the app
    const button = page.locator('button[data-testid="my-button"]');
    await button.click();
    
    // Assert expected behavior
    await expect(page.locator('.result')).toContainText('Success');
  });
});
```

### Using Electron-Specific Fixtures

The `test` helper from `./helpers/electron` provides:
- `electronApp`: The Electron application instance
- `page`: The main window (Page object)

```typescript
test('should access Electron APIs', async ({ electronApp, page }) => {
  // Get app version
  const version = await getAppVersion(electronApp);
  expect(version).toBe('0.1.0');
  
  // Interact with the page
  await page.click('button');
});
```

## Best Practices

### 1. Use data-testid Attributes
Add `data-testid` attributes to Vue components for reliable selectors:

```vue
<button data-testid="new-entity-button">New Entity</button>
```

Then in tests:
```typescript
const button = page.locator('[data-testid="new-entity-button"]');
```

### 2. Wait for State Changes
Always wait for the app to reach a stable state:

```typescript
await page.waitForLoadState('networkidle');
await page.waitForSelector('[data-testid="context-tree"]');
```

### 3. Use Descriptive Test Names
```typescript
// Good
test('should display validation error when required field is empty', ...)

// Bad
test('validation test', ...)
```

### 4. Keep Tests Independent
Each test should be able to run independently. Don't rely on state from previous tests.

### 5. Use Page Object Pattern for Complex Workflows
For complex UI interactions, create page objects:

```typescript
// e2e/pages/context-builder.ts
export class ContextBuilderPage {
  constructor(private page: Page) {}
  
  async openBuilder() {
    await this.page.click('[data-testid="new-entity-button"]');
  }
  
  async fillTitle(title: string) {
    await this.page.fill('[data-testid="entity-title"]', title);
  }
}
```

## Debugging Tips

### Take Screenshots
```typescript
await page.screenshot({ path: 'debug-screenshot.png' });
```

### Pause Execution
```typescript
await page.pause(); // Opens inspector
```

### View Console Logs
```typescript
page.on('console', msg => console.log('PAGE LOG:', msg.text()));
```

### Inspect Electron Main Process
```typescript
electronApp.on('console', msg => console.log('MAIN LOG:', msg.text()));
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run E2E tests
        run: pnpm test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Tests Timing Out
- Increase timeout in `playwright.config.ts`
- Use `page.waitForLoadState('networkidle')` to wait for app to be ready
- Check if app is starting correctly in development mode

### Can't Find Elements
- Use `page.locator()` with flexible selectors
- Add `data-testid` attributes to components
- Use Playwright Inspector: `pnpm test:e2e:debug`

### Electron App Won't Launch
- Ensure app builds successfully: `pnpm build`
- Check that Electron is installed: `pnpm install`
- Verify `electronPath` in `e2e/helpers/electron.ts` is correct

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright with Electron](https://playwright.dev/docs/api/class-electron)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
