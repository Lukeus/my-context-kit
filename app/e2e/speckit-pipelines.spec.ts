import type { ElectronApplication, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let electronApp: ElectronApplication;
let window: Page;

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

    await window.evaluate(({ previewStub, pipelineReportStub }) => {
      const globalAny = window as unknown as Record<string, any>;
      globalAny.__originalSpeckitFetch = globalAny.api.speckit.fetch;
      globalAny.__originalSpeckitListPreviews = globalAny.api.speckit.listPreviews;
      globalAny.__originalSpeckitToEntity = globalAny.api.speckit.toEntity;
      globalAny.__originalSpeckitRunPipelines = globalAny.api.speckit.runPipelines;

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
        if (globalAny.__originalSpeckitToEntity) {
          globalAny.api.speckit.toEntity = globalAny.__originalSpeckitToEntity;
          delete globalAny.__originalSpeckitToEntity;
        }
        if (globalAny.__originalSpeckitRunPipelines) {
          globalAny.api.speckit.runPipelines = globalAny.__originalSpeckitRunPipelines;
          delete globalAny.__originalSpeckitRunPipelines;
        }
      });
    }

    if (electronApp) {
      await electronApp.close();
    }
  });

  test('shows pipeline report after entity generation', async () => {
    await window.locator('button:has-text("New")').first().click({ timeout: 5000 });
    const speckitOption = window.locator('text=/Speckit|Specification/i').first();
    await speckitOption.click({ timeout: 5000 });

    await expect(window.locator('text=Speckit Workflow')).toBeVisible({ timeout: 5000 });

    const descriptionInput = window.locator('textarea[placeholder*="feature"], textarea[placeholder*="Describe"]').first();
    await descriptionInput.fill('Pipeline verification flow');
    await window.locator('button:has-text("Create Spec")').click();

    await expect(window.locator('text=/Spec Number:/i')).toBeVisible({ timeout: 10000 });

    await window.locator('button:has-text("Generate Plan")').click();
    await expect(window.locator('text=/Plan:/i')).toBeVisible({ timeout: 15000 });

    await window.locator('button:has-text("Generate Tasks")').click();
    await expect(window.locator('text=/Tasks:/i')).toBeVisible({ timeout: 15000 });

    await window.locator('button:has-text("Fetch Spec Kit")').click();
    await expect(window.locator('label:has-text("Feature Template")')).toBeVisible({ timeout: 5000 });

    const featureCheckbox = window.locator('label:has-text("Feature Template") input[type="checkbox"]').first();
    await featureCheckbox.check();
    const storyCheckbox = window.locator('label:has-text("Onboarding Story") input[type="checkbox"]').first();
    await storyCheckbox.check();

    const generateEntitiesButton = window.locator('button:has-text("Generate Entities")').first();
    await generateEntitiesButton.click();

    await expect(window.locator('text=✓ Entities Generated')).toBeVisible({ timeout: 5000 });
    await expect(window.locator('text=Generate pipeline reported failures.')).toBeVisible({ timeout: 5000 });
    await expect(window.locator('text=FEAT-123')).toBeVisible({ timeout: 5000 });
    await expect(window.locator('text=US-12301')).toBeVisible({ timeout: 5000 });
  });
});
