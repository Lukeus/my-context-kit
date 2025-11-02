import { test, expect } from './helpers/electron';
import type { Page } from '@playwright/test';

// NOTE: This spec now relies on shared Electron fixtures (packaged app) from helpers/electron.ts
// Avoids repeated electron.launch crashes in CI by standardizing launch sequence.
// TODO(e2e-refactor): Consolidate Speckit stubbing utilities into a shared helper if more specs need them.

let page: Page; // assigned in beforeEach via fixture injection

const previewStub = {
  ok: true,
  data: {
    releaseTag: 'v0.0.79',
    commit: 'abc123def',
    fetchedAt: '2025-10-28T12:00:00.000Z',
    generatedAt: '2025-10-28T12:05:00.000Z',
    totalCount: 2,
    warnings: [],
    groups: [
      {
        entityType: 'template',
        items: [
          {
            id: 'templates/feature.md',
            displayName: 'Feature Template',
            entityType: 'template',
            content: '# Feature Template\n\nBody',
            source: {
              releaseTag: 'v0.0.79',
              commit: 'abc123def',
              path: 'templates/feature.md',
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
            content: '# Onboarding\n\nAs a user…',
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
} as const;

const pipelineReportStub = {
  batchId: 'batch-001',
  entities: [
    {
      id: 'FEAT-123',
      type: 'feature',
      status: 'succeeded',
      errors: [],
      path: 'contexts/features/FEAT-123.yaml',
      sourcePath: 'templates/feature.md',
    },
    {
      id: 'US-12301',
      type: 'userstory',
      status: 'failed',
      errors: ['Validation reported an unspecified error.'],
      path: 'contexts/userstories/US-12301.yaml',
      sourcePath: 'docs/userstories/onboarding.md',
    },
  ],
  generatedFiles: ['contexts/features/FEAT-123.yaml', 'contexts/userstories/US-12301.yaml'],
  sourcePreviews: ['templates/feature.md', 'docs/userstories/onboarding.md'],
  pipelines: {
    validate: { status: 'succeeded' },
    buildGraph: { status: 'succeeded' },
    impact: { status: 'succeeded' },
    generate: { status: 'failed', error: 'Generate pipeline reported failures.' },
  },
} as const;

test.describe('Speckit pipeline orchestration', () => {
  test.beforeEach(async ({ page: injected }) => {
    page = injected;
    // Inject stubs fresh for each test to avoid cross-test leakage
    await page.evaluate(({ previewStub, pipelineReportStub }) => {
      const globalAny = window as unknown as Record<string, any>;
      globalAny.api ||= {};
      globalAny.api.speckit ||= {};

      // Store originals only once per page lifecycle (idempotent)
      if (!globalAny.__originalSpeckitFetch) {
        globalAny.__originalSpeckitFetch = globalAny.api.speckit.fetch;
      }
      if (!globalAny.__originalSpeckitListPreviews) {
        globalAny.__originalSpeckitListPreviews = globalAny.api.speckit.listPreviews;
      }
      if (!globalAny.__originalSpeckitToEntity) {
        globalAny.__originalSpeckitToEntity = globalAny.api.speckit.toEntity;
      }
      if (!globalAny.__originalSpeckitRunPipelines) {
        globalAny.__originalSpeckitRunPipelines = globalAny.api.speckit.runPipelines;
      }

      globalAny.api.speckit.fetch = async () => ({
        ok: true,
        cachePath: '/mock/cache',
        commit: 'abc123def',
        releaseTag: 'v0.0.79',
        durationMs: 1500,
        fetchedAt: '2025-10-28T12:00:00.000Z',
        artifacts: {
          docs: ['docs/userstories/onboarding.md'],
          templates: ['templates/feature.md'],
          memory: [],
        },
        source: {
          repository: 'github/spec-kit',
          releaseTag: 'v0.0.79',
          commit: 'abc123def',
        },
        timing: {
          startedAt: '2025-10-28T12:00:00.000Z',
          finishedAt: '2025-10-28T12:00:01.500Z',
          durationMs: 1500,
        },
        status: {
          ok: true,
          error: null,
          stale: false,
        },
        warnings: [],
      });
      globalAny.api.speckit.listPreviews = async () => previewStub;
      globalAny.api.speckit.toEntity = async () => ({
        ok: true,
        entities: {
          features: [{ id: 'FEAT-123' }],
          stories: [{ id: 'US-12301' }],
        },
        created: ['contexts/features/FEAT-123.yaml', 'contexts/userstories/US-12301.yaml'],
      });
      globalAny.api.speckit.runPipelines = async () => ({ ok: true, data: pipelineReportStub });
    }, { previewStub, pipelineReportStub });
  });

  test.afterEach(async () => {
    if (!page) return;
    await page.evaluate(() => {
      const globalAny = window as unknown as Record<string, any>;
      if (globalAny.__originalSpeckitFetch) {
        globalAny.api.speckit.fetch = globalAny.__originalSpeckitFetch;
        delete globalAny.__originalSpeckitFetch;
      }
      if (globalAny.__originalSpeckitListPreviews) {
        globalAny.api.speckit.listPreviews = globalAny.__originalSpeckitListPreviews;
        delete globalAny.__originalSpeckitListPreviews;
      }
      if (globalAny.__originalSpeckitToEntity) {
        globalAny.api.speckit.toEntity = globalAny.__originalSpeckitToEntity;
        delete globalAny.__originalSpeckitToEntity;
      }
      if (globalAny.__originalSpeckitRunPipelines) {
        globalAny.api.speckit.runPipelines = globalAny.__originalSpeckitRunPipelines;
        delete globalAny.__originalSpeckitRunPipelines;
      }
    });
  });

  test('shows pipeline report after entity generation', async ({ page }) => {
    await page.locator('button:has-text("New")').first().click({ timeout: 5000 });
    const speckitOption = page.locator('text=/Speckit|Specification/i').first();
    await speckitOption.click({ timeout: 5000 });

    await expect(page.locator('text=Speckit Workflow')).toBeVisible({ timeout: 5000 });

    const descriptionInput = page.locator('textarea[placeholder*="feature"], textarea[placeholder*="Describe"]').first();
    await descriptionInput.fill('Pipeline verification flow');
    await page.locator('button:has-text("Create Spec")').click();

    await expect(page.locator('text=/Spec Number:/i')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Generate Plan")').click();
    await expect(page.locator('text=/Plan:/i')).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("Generate Tasks")').click();
    await expect(page.locator('text=/Tasks:/i')).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("Fetch Spec Kit")').click();
    await expect(page.locator('label:has-text("Feature Template")')).toBeVisible({ timeout: 5000 });

    const featureCheckbox = page.locator('label:has-text("Feature Template") input[type="checkbox"]').first();
    await featureCheckbox.check();
    const storyCheckbox = page.locator('label:has-text("Onboarding Story") input[type="checkbox"]').first();
    await storyCheckbox.check();

    const generateEntitiesButton = page.locator('button:has-text("Generate Entities")').first();
    await generateEntitiesButton.click();

    await expect(page.locator('text=\u2713 Entities Generated')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Generate pipeline reported failures.')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=FEAT-123')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=US-12301')).toBeVisible({ timeout: 5000 });
  });
});
