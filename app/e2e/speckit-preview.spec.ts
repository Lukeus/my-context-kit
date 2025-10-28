import type { ElectronApplication, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

type SpeckitPreviewStub = {
  ok: true;
  data: {
    releaseTag: string;
    commit: string;
    fetchedAt: string | null;
    generatedAt: string;
    totalCount: number;
    warnings: string[];
    groups: Array<{
      entityType: string;
      items: Array<{
        id: string;
        displayName: string;
        entityType: string;
        content: string;
        source: {
          releaseTag: string;
          commit: string;
          path: string;
        };
      }>;
    }>;
  };
};

type SpeckitFetchStub = {
  ok: true;
  cachePath: string;
  commit: string;
  releaseTag: string;
  durationMs: number;
  fetchedAt: string;
  source: {
    repository: string;
    releaseTag: string;
    commit: string;
  };
  timing: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
  };
  artifacts: {
    docs: string[];
    templates: string[];
    memory: string[];
  };
  status: {
    ok: true;
    error: null;
    stale: false;
  };
  warnings: string[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication;
let window: Page;

const previewStub: SpeckitPreviewStub = {
  ok: true,
  data: {
    releaseTag: 'v0.0.79',
    commit: 'abc123def',
    fetchedAt: '2025-10-28T12:00:00.000Z',
    generatedAt: '2025-10-28T12:05:00.000Z',
    totalCount: 3,
    warnings: ['Templates refreshed from upstream release.'],
    groups: [
      {
        entityType: 'template',
        items: [
          {
            id: 'templates/feature.md',
            displayName: 'Feature Template',
            entityType: 'template',
            content: '# Feature Template\n\n## Overview\nNew feature template body.',
            source: {
              releaseTag: 'v0.0.79',
              commit: 'abc123def',
              path: 'templates/feature.md',
            },
          },
        ],
      },
      {
        entityType: 'spec',
        items: [
          {
            id: 'docs/spec-driven-development.md',
            displayName: 'Spec Driven Development',
            entityType: 'spec',
            content: '# Spec Driven Development\n\nDetailed guidance.',
            source: {
              releaseTag: 'v0.0.79',
              commit: 'abc123def',
              path: 'docs/spec-driven-development.md',
            },
          },
        ],
      },
      {
        entityType: 'userstory',
        items: [
          {
            id: 'docs/userstories/onboarding.md',
            displayName: 'Onboarding Story',
            entityType: 'userstory',
            content: '# Onboarding\n\nAs a user, I want onboarding guidance.',
            source: {
              releaseTag: 'v0.0.79',
              commit: 'abc123def',
              path: 'docs/userstories/onboarding.md',
            },
          },
        ],
      },
    ],
  },
};

const fetchStub: SpeckitFetchStub = {
  ok: true,
  cachePath: '/mock/context-repo/.context/speckit-cache/v0.0.79',
  commit: 'abc123def',
  releaseTag: 'v0.0.79',
  durationMs: 4200,
  fetchedAt: '2025-10-28T12:00:00.000Z',
  source: {
    repository: 'github/spec-kit',
    releaseTag: 'v0.0.79',
    commit: 'abc123def',
  },
  timing: {
    startedAt: '2025-10-28T11:59:55.000Z',
    finishedAt: '2025-10-28T12:00:00.000Z',
    durationMs: 5000,
  },
  artifacts: {
    docs: ['docs/spec-driven-development.md', 'docs/userstories/onboarding.md'],
    templates: ['templates/feature.md'],
    memory: [],
  },
  status: {
    ok: true,
    error: null,
    stale: false,
  },
  warnings: [],
};

test.describe('Speckit preview library', () => {
  test.beforeAll(async () => {
    const requireModule = createRequire(import.meta.url);
    const electronPath = requireModule('electron') as string;
    electronApp = await electron.launch({
      executablePath: electronPath,
      args: [path.join(__dirname, '..', 'out', 'main', 'index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
      timeout: 30000,
    });

    window = await electronApp.firstWindow({ timeout: 30000 });
    await window.waitForLoadState('domcontentloaded', { timeout: 30000 });
    await window.waitForTimeout(1000);

    await window.evaluate(({ previewStub, fetchStub }) => {
      const globalAny = window as unknown as Record<string, any>;
      globalAny.__originalSpeckitFetch = globalAny.api.speckit.fetch;
      globalAny.__originalSpeckitListPreviews = globalAny.api.speckit.listPreviews;
      globalAny.api.speckit.fetch = async () => fetchStub;
      globalAny.api.speckit.listPreviews = async () => previewStub;
    }, { previewStub, fetchStub });
  });

  test.afterAll(async () => {
    if (window) {
      await window.evaluate(() => {
        const globalAny = window as unknown as Record<string, any>;
        if (globalAny.__originalSpeckitFetch) {
          globalAny.api.speckit.fetch = globalAny.__originalSpeckitFetch;
          delete globalAny.__originalSpeckitFetch;
        }
        if (globalAny.__originalSpeckitListPreviews) {
          globalAny.api.speckit.listPreviews = globalAny.__originalSpeckitListPreviews;
          delete globalAny.__originalSpeckitListPreviews;
        }
      });
    }

    if (electronApp) {
      await electronApp.close();
    }
  });

  test('shows filtered previews with markdown pane', async () => {
    // Open Speckit wizard
    await window.locator('button:has-text("New")').first().click({ timeout: 5000 });
    const speckitOption = window.locator('text=/Speckit|Specification/i').first();
    await speckitOption.click({ timeout: 5000 });

    await expect(window.locator('text=Speckit Workflow')).toBeVisible({ timeout: 5000 });

    // Bypass specification steps by creating minimal spec input
    const descriptionInput = window.locator('textarea[placeholder*="feature"], textarea[placeholder*="Describe"]').first();
    await descriptionInput.fill('Preview flow validation');
    await window.locator('button:has-text("Create Spec")').click();

    await expect(window.locator('text=/Spec Number:/i')).toBeVisible({ timeout: 10000 });

    await window.locator('button:has-text("Generate Plan")').click();
    await expect(window.locator('text=/Plan:/i')).toBeVisible({ timeout: 15000 });

    // Trigger fetch (stubs respond immediately)
    await window.locator('button:has-text("Fetch Spec Kit")').click();
    await expect(window.locator('text=Feature Template')).toBeVisible({ timeout: 5000 });

    // Verify selection count updates
    const featureCheckbox = window.locator('label:has-text("Feature Template") input[type="checkbox"]').first();
    await featureCheckbox.check();
    await expect(window.locator('text=1 selected')).toBeVisible({ timeout: 2000 });

    // Switch filter to templates only
    const templateFilter = window.locator('button:has-text("Templates")').first();
    await templateFilter.click();
    await expect(window.locator('label:has-text("Feature Template")')).toBeVisible({ timeout: 2000 });
    await expect(window.locator('label:has-text("Spec Driven Development")')).not.toBeVisible({ timeout: 2000 });

    // Reset filters and search for onboarding story
    await window.locator('button:has-text("Reset")').click();
    const searchInput = window.locator('input[placeholder="Search Spec Kit library"]').first();
    await searchInput.fill('Onboarding');
    await expect(window.locator('label:has-text("Onboarding Story")')).toBeVisible({ timeout: 2000 });
    await expect(window.locator('label:has-text("Feature Template")')).not.toBeVisible({ timeout: 2000 });

    // Clear search and ensure preview pane renders markdown
    await window.locator('button:has-text("Clear")').click();
    await window.locator('button:has-text("Spec Driven Development")').click();
    await expect(window.locator('text=Spec Driven Development').nth(0)).toBeVisible({ timeout: 2000 });
    await expect(window.locator('text=Detailed guidance.')).toBeVisible({ timeout: 2000 });
  });
});
