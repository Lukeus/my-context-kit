# Testing Guide for Context-Sync

This document provides a comprehensive overview of the testing strategy and tools used in the Context-Sync project.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Unit Tests (Vitest)](#unit-tests-vitest)
3. [E2E Tests (Playwright)](#e2e-tests-playwright)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)

---

## Testing Philosophy

Context-Sync follows a comprehensive testing strategy:

- **Unit Tests**: Test individual stores and utilities in isolation
- **E2E Tests**: Test the complete application flow with real Electron environment
- **Quality over Speed**: Never take shortcuts for speed; prioritize quality and correctness
- **Test Coverage**: Focus on critical paths and complex logic

### Architecture Adherence

- Follow the repository's existing architecture
- Do not change architecture patterns in tests
- Use TypeScript exclusively with strict typing
- Always use pnpm as the package manager

---

## Unit Tests (Vitest)

### Overview

Unit tests are located in the `tests/` directory and use [Vitest](https://vitest.dev/) as the test runner. Tests focus on Pinia stores and utility functions.

### Test Structure

```
tests/
├── setup.ts              # Global test setup with API mocks
├── contextStore.spec.ts  # Context/repository store tests (3 tests)
├── gitStore.spec.ts      # Git operations store tests (15 tests)
└── impactStore.spec.ts   # Impact analysis store tests (19 tests)
```

### Current Coverage

- **contextStore**: Repository initialization, switching, and management
- **gitStore**: Git status, commits, branches, PR creation
- **impactStore**: Impact analysis, prompt generation, issue tracking

### Configuration

Tests are configured via `vitest.config.ts`:
- Test environment: Node.js
- Global setup: `tests/setup.ts` provides mocked `window.api`
- Coverage provider: v8

### Running Unit Tests

```powershell
# Run all unit tests
pnpm test

# Run with watch mode (during development)
pnpm vitest

# Run with coverage
pnpm vitest --coverage
```

### Writing Unit Tests

Example test structure:

```typescript
import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMyStore } from '../src/renderer/stores/myStore';

describe('myStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    
    // Mock API calls
    const api = window.api.myApi as any;
    api.someMethod.mockResolvedValue({ ok: true });
  });

  it('should perform action', async () => {
    const store = useMyStore();
    
    const result = await store.someAction();
    
    expect(result).toBe(true);
    expect(window.api.myApi.someMethod).toHaveBeenCalled();
  });
});
```

### Key Testing Patterns

1. **Async Store Initialization**: Use `vi.waitFor()` to wait for auto-initialization
2. **API Mocking**: All `window.api` calls are mocked in `tests/setup.ts`
3. **Pinia Setup**: Always call `setActivePinia(createPinia())` in `beforeEach`

---

## E2E Tests (Playwright)

### Overview

E2E tests are located in the `e2e/` directory and use [Playwright](https://playwright.dev/) to test the actual Electron application in a realistic environment.

### Test Structure

```
e2e/
├── helpers/
│   └── electron.ts       # Electron test fixtures and utilities
├── app-launch.spec.ts    # Application launch and initialization
├── navigation.spec.ts    # Navigation and UI layout
└── README.md            # Detailed E2E testing guide
```

### Configuration

Tests are configured via `playwright.config.ts`:
- Test directory: `./e2e`
- Timeout: 60 seconds per test
- Workers: 1 (no parallel execution for Electron)
- Reporters: List, HTML, JSON

### Running E2E Tests

```powershell
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Debug tests (step through)
pnpm test:e2e:debug

# View test report
pnpm test:e2e:report

# Run all tests (unit + E2E)
pnpm test:all
```

### Writing E2E Tests

Example E2E test:

```typescript
import { test, expect } from './helpers/electron';

test.describe('Feature Name', () => {
  test('should perform user workflow', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click button
    await page.click('[data-testid="my-button"]');
    
    // Verify result
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

### Best Practices for E2E

1. **Use `data-testid` attributes** for reliable selectors
2. **Wait for state changes** using `waitForLoadState()` or `waitForSelector()`
3. **Keep tests independent** - each test should run standalone
4. **Use Page Object pattern** for complex workflows
5. **Take screenshots on failure** (configured automatically)

---

## Running Tests

### Quick Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:e2e` | Run E2E tests (Playwright) |
| `pnpm test:all` | Run all tests (unit + E2E) |
| `pnpm test:e2e:ui` | Run E2E with interactive UI |
| `pnpm test:e2e:debug` | Debug E2E tests |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run ESLint |

### Pre-Deployment Checklist

Before deploying to production:

1. ✅ Run unit tests: `pnpm test`
2. ✅ Run E2E tests: `pnpm test:e2e`
3. ✅ Run type checking: `pnpm typecheck`
4. ✅ Run linting: `pnpm lint`
5. ✅ Fix all lint errors
6. ✅ Get explicit confirmation from user before deploying

---

## Writing Tests

### General Guidelines

1. **Quality First**: Never take shortcuts; prioritize correctness
2. **Break Down Tasks**: If a test seems too big, break it into smaller tests
3. **Clear Naming**: Use descriptive test names that explain what is being tested
4. **TypeScript**: Always use TypeScript with proper types
5. **Follow Architecture**: Adhere to existing code patterns and architecture

### Test Organization

- **Unit Tests**: One test file per store/module
- **E2E Tests**: Group by feature or workflow
- **Test Data**: Use factory functions for creating test data
- **Mocks**: Centralize mocks in setup files

### Avoiding Common Pitfalls

❌ **Don't**:
- Use `any` types unnecessarily
- Skip waiting for async operations
- Write tests that depend on test execution order
- Hardcode paths or URLs
- Ignore ESLint warnings

✅ **Do**:
- Use proper TypeScript types
- Wait for async operations with `await`
- Make each test independent
- Use relative paths and configuration
- Fix all linting issues before committing

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
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
      
      - name: Run unit tests
        run: pnpm test
      
      - name: Type check
        run: pnpm typecheck
      
      - name: Lint
        run: pnpm lint

  e2e-tests:
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

### Required Checks

Per project rules, the following checks must pass before deploying:

1. All lint issues fixed
2. Type checking passes
3. Unit tests pass
4. E2E tests pass (when applicable)
5. No deployment without explicit user confirmation

---

## Test Statistics

### Current Coverage (as of last update)

- **Unit Tests**: 37 tests across 3 test files
  - contextStore: 3 tests
  - gitStore: 15 tests
  - impactStore: 19 tests

- **E2E Tests**: 2 test files (additional tests to be added)
  - app-launch: 4 tests
  - navigation: 5 tests

- **Pass Rate**: 100%
- **Type Check**: ✅ Passing
- **Lint**: ⚠️ Warnings exist (mainly `@typescript-eslint/no-explicit-any`)

### Future Coverage Goals

Stores to add tests for:
- **aiStore**: AI conversation management, streaming, edit application
- **builderStore**: Entity builder wizard, templates, validation

---

## Troubleshooting

### Common Issues

#### Unit Tests

**Issue**: Tests fail with "Repository path is not configured"
**Solution**: Ensure contextStore is properly initialized in test setup

**Issue**: Async operations timeout
**Solution**: Use `vi.waitFor()` to wait for store initialization

#### E2E Tests

**Issue**: App won't launch in tests
**Solution**: 
- Build the app first: `pnpm build`
- Check Electron installation: `pnpm install`
- Verify paths in `e2e/helpers/electron.ts`

**Issue**: Can't find UI elements
**Solution**:
- Add `data-testid` attributes to components
- Use flexible selectors
- Use Playwright Inspector: `pnpm test:e2e:debug`

**Issue**: Tests timeout
**Solution**:
- Increase timeout in `playwright.config.ts`
- Use `page.waitForLoadState('networkidle')`
- Check if app starts correctly

---

## Resources

### Documentation
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Playwright with Electron](https://playwright.dev/docs/api/class-electron)
- [Pinia Testing Guide](https://pinia.vuejs.org/cookbook/testing.html)

### Project Documentation
- [WARP.md](../WARP.md) - Project build guide
- [spec.md](../docs/spec.md) - Technical specification
- [e2e/README.md](./e2e/README.md) - E2E testing detailed guide

---

**Last Updated**: 2025-10-26  
**Maintained By**: Development Team  
**Test Framework Versions**: Vitest 2.1.4, Playwright 1.56.1
