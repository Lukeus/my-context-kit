import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeckitService } from '../../src/main/services/SpeckitService';
import type { ContextService } from '../../src/main/services/ContextService';
import { existsSync } from 'node:fs';
import { execa } from 'execa';
import successFetch from '../mocks/speckit-fetch-success.json';
import staleFetch from '../mocks/speckit-fetch-stale.json';
import type {
  SpecKitFetchPipelineResult,
  SpecKitFetchPipelineSuccess,
  SpecKitFetchPipelineInProgress,
  SpecKitEntityType,
} from '@shared/speckit';

vi.mock('node:fs', () => {
  const mocks = {
    existsSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  };
  return {
    ...mocks,
    default: mocks,
  };
});

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

vi.mock('../../src/main/services/AIService', () => {
  return {
    AIService: vi.fn(function(this: any) {
      this.getConfig = vi.fn().mockResolvedValue({
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        enabled: true,
      });
      this.hasCredentials = vi.fn().mockResolvedValue(true);
      this.getCredentials = vi.fn().mockResolvedValue('test-api-key');
    }),
  };
});

const isSuccessFetchResult = (payload: SpecKitFetchPipelineResult): payload is SpecKitFetchPipelineSuccess => payload.ok === true;

const isInProgressFetchResult = (payload: SpecKitFetchPipelineResult): payload is SpecKitFetchPipelineInProgress =>
  !payload.ok && 'inProgress' in payload && payload.inProgress === true;

type ContextServiceMock = {
  validate: ReturnType<typeof vi.fn>;
  buildGraph: ReturnType<typeof vi.fn>;
  calculateImpact: ReturnType<typeof vi.fn>;
  generate: ReturnType<typeof vi.fn>;
};

const createContextServiceMock = (): { mock: ContextServiceMock; instance: ContextService } => {
  const mock: ContextServiceMock = {
    validate: vi.fn(),
    buildGraph: vi.fn(),
    calculateImpact: vi.fn(),
    generate: vi.fn(),
  };

  return {
    mock,
    instance: mock as unknown as ContextService,
  };
};

describe('SpeckitService', () => {
  let speckitService: SpeckitService;

  beforeEach(() => {
    speckitService = new SpeckitService();
    vi.clearAllMocks();
  });

  describe('specify', () => {
    it('should generate specification from description', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, spec: { id: 'SPEC-001' } }),
      } as any);

      const result = await speckitService.specify({
        repoPath: '/test/repo',
        description: 'User authentication system',
      });

      expect(result).toEqual({ ok: true, spec: { id: 'SPEC-001' } });
      expect(execa).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining(['specify', 'User authentication system']),
        expect.any(Object)
      );
    });

    it('should throw error if pipeline does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        speckitService.specify({
          repoPath: '/test/repo',
          description: 'Test description',
        })
      ).rejects.toThrow('speckit.mjs pipeline not found');
    });
  });

  describe('plan', () => {
    it('should create implementation plan from spec', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, plan: { tasks: [] } }),
      } as any);

      const result = await speckitService.plan({
        repoPath: '/test/repo',
        specPath: 'specs/001-auth/spec.md',
      });

      expect(result).toEqual({ ok: true, plan: { tasks: [] } });
    });
  });

  describe('tasks', () => {
    it('should generate tasks from plan', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, tasks: ['Task 1', 'Task 2'] }),
      } as any);

      const result = await speckitService.tasks({
        repoPath: '/test/repo',
        planPath: 'specs/001-auth/plan.md',
      });

      expect(result.tasks).toHaveLength(2);
    });
  });

  describe('fetch', () => {
    const repoPath = '/test/repo';

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
    });

    it('should return fetch summary payload when pipeline succeeds', async () => {
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify(successFetch),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await speckitService.fetch({ repoPath });

      expect(isSuccessFetchResult(result)).toBe(true);
      if (!isSuccessFetchResult(result)) {
        throw new Error('Expected success fetch payload');
      }

      expect(result.status.stale).toBe(false);
      expect(result.warnings).toEqual([]);
      expect(result.source.releaseTag).toBe(successFetch.source.releaseTag);
    });

    it('should flag summary as stale when fetchedAt exceeds freshness window', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-10-28T17:30:00.000Z'));

      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify(staleFetch),
        stderr: '',
        exitCode: 0,
      } as any);

      try {
        const result = await speckitService.fetch({ repoPath });

        expect(isSuccessFetchResult(result)).toBe(true);
        if (!isSuccessFetchResult(result)) {
          throw new Error('Expected success fetch payload');
        }

        expect(result.status.stale).toBe(true);
        expect(result.warnings).toContain('Fetched snapshot older than freshness window');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should return in-progress payload when fetch lock is active', async () => {
      const inProgressPayload = {
        ok: false,
        inProgress: true,
        startedAt: '2025-10-28T17:00:00.000Z',
        error: 'Spec Kit fetch already in progress',
      };

      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify(inProgressPayload),
        stderr: '',
        exitCode: 202,
      } as any);

      const result = await speckitService.fetch({ repoPath });

      expect(result.ok).toBe(false);
      expect(isInProgressFetchResult(result)).toBe(true);
      if (!isInProgressFetchResult(result)) {
        throw new Error('Expected in-progress fetch payload');
      }

      expect(result.error).toContain('in progress');
    });
  });

  describe('toEntity', () => {
    it('should convert spec to context entities', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, entities: [{ id: 'FEAT-001' }] }),
      } as any);

      const result = await speckitService.toEntity({
        repoPath: '/test/repo',
        specPath: 'specs/001-auth/spec.md',
      });

      expect(result.entities).toHaveLength(1);
    });
  });

  describe('tasksToEntity', () => {
    it('should convert tasks to entities', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, entities: [] }),
      } as any);

      const result = await speckitService.tasksToEntity({
        repoPath: '/test/repo',
        tasksPath: 'specs/001-auth/tasks.md',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('aiGenerateSpec', () => {
    it('should generate spec using AI', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, spec: 'Generated spec content' }),
      } as any);

      const result = await speckitService.aiGenerateSpec({
        repoPath: '/test/repo',
        description: 'Login system with OAuth',
      });

      expect(result.ok).toBe(true);
      expect(result.spec).toBeDefined();
    });

    it('should throw error if AI pipeline missing', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        speckitService.aiGenerateSpec({
          repoPath: '/test/repo',
          description: 'Test',
        })
      ).rejects.toThrow('ai-spec-generator.mjs pipeline not found');
    });
  });

  describe('aiRefineSpec', () => {
    it('should refine spec with AI feedback', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, refined: true }),
      } as any);

      const result = await speckitService.aiRefineSpec({
        repoPath: '/test/repo',
        specPath: 'specs/001-auth/spec.md',
        feedback: 'Add more security requirements',
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('runPipelines', () => {
    const repoPath = '/test/repo';

    const buildEntities = () => ({
      createdPaths: ['contexts/features/FEAT-001.yaml', 'contexts/userstories/US-001.yaml'],
      entityMetadata: [
        { id: 'FEAT-001', type: 'feature', path: 'contexts/features/FEAT-001.yaml' },
        { id: 'US-001', type: 'userstory' },
      ] satisfies Array<{ id: string; type: SpecKitEntityType; path?: string; sourcePath?: string }>,
      sourcePreviewPaths: [
        '.context/cache/spec-kit/feature-overview.md',
        '.context/cache/spec-kit/user-story.md',
      ],
    });

    it('should orchestrate pipelines and summarize entity results', async () => {
      const { mock: contextMock, instance: contextInstance } = createContextServiceMock();
      const { createdPaths, entityMetadata, sourcePreviewPaths } = buildEntities();

      vi.mocked(existsSync).mockReturnValue(true);

      contextMock.validate.mockResolvedValue({
        ok: true,
        errors: [],
      });

      contextMock.buildGraph.mockResolvedValue({
        ok: true,
        nodes: [],
        edges: [],
      });

      contextMock.calculateImpact.mockResolvedValue({
        ok: true,
        changed: ['FEAT-001', 'US-001'],
        directImpact: [],
        indirectImpact: [],
        totalImpact: 2,
      });

      contextMock.generate.mockResolvedValue({
        ok: true,
        generated: ['FEAT-001', 'US-001'],
        paths: {
          'FEAT-001': 'contexts/features/FEAT-001.yaml',
          'US-001': 'contexts/userstories/US-001.yaml',
        },
      });

      const report = await speckitService.runPipelines({
        repoPath,
        createdPaths,
        entityMetadata,
        sourcePreviewPaths,
        contextService: contextInstance,
      });

      expect(report.batchId).toMatch(/[0-9a-f-]{36}/i);
      expect(report.generatedFiles).toEqual(['contexts/features/FEAT-001.yaml', 'contexts/userstories/US-001.yaml']);
      expect(report.sourcePreviews).toEqual(['.context/cache/spec-kit/feature-overview.md', '.context/cache/spec-kit/user-story.md']);

      expect(contextMock.validate).toHaveBeenCalledTimes(1);
      expect(contextMock.buildGraph).toHaveBeenCalledTimes(1);
      expect(contextMock.calculateImpact).toHaveBeenCalledWith(['FEAT-001', 'US-001']);
      expect(contextMock.generate).toHaveBeenCalledWith(['FEAT-001', 'US-001']);

      const featureEntity = report.entities.find((entity) => entity.id === 'FEAT-001');
      const storyEntity = report.entities.find((entity) => entity.id === 'US-001');

      expect(featureEntity).toMatchObject({
        type: 'feature',
        status: 'succeeded',
        sourcePath: '.context/cache/spec-kit/feature-overview.md',
        path: 'contexts/features/FEAT-001.yaml',
      });

      expect(storyEntity).toMatchObject({
        type: 'userstory',
        status: 'succeeded',
        sourcePath: '.context/cache/spec-kit/user-story.md',
        path: 'contexts/userstories/US-001.yaml',
      });

      expect(report.pipelines.validate.status).toBe('succeeded');
      expect(report.pipelines.buildGraph.status).toBe('succeeded');
      expect(report.pipelines.impact.status).toBe('succeeded');
      expect(report.pipelines.generate.status).toBe('succeeded');
    });

    it('should stop execution and record validation failures', async () => {
      const { mock: contextMock, instance: contextInstance } = createContextServiceMock();
      const { createdPaths, entityMetadata, sourcePreviewPaths } = buildEntities();

      vi.mocked(existsSync).mockReturnValue(true);

      contextMock.validate.mockResolvedValue({
        ok: false,
        error: 'Validation issues detected',
        errors: [
          {
            entity: 'FEAT-001',
            error: 'Feature YAML missing required fields',
          },
        ],
      });

      const report = await speckitService.runPipelines({
        repoPath,
        createdPaths,
        entityMetadata,
        sourcePreviewPaths,
        contextService: contextInstance,
      });

      expect(report.pipelines.validate.status).toBe('failed');
      expect(report.pipelines.validate.error).toBe('Validation issues detected');
      expect(report.pipelines.buildGraph).toMatchObject({
        status: 'failed',
        error: expect.stringContaining('validate'),
      });
      expect(report.pipelines.impact).toMatchObject({
        status: 'failed',
        error: expect.stringContaining('validate'),
      });
      expect(report.pipelines.generate).toMatchObject({
        status: 'failed',
        error: expect.stringContaining('validate'),
      });

      const featureEntity = report.entities.find((entity) => entity.id === 'FEAT-001');
      expect(featureEntity?.status).toBe('failed');
      expect(featureEntity?.errors).toContain('Feature YAML missing required fields');

      expect(contextMock.buildGraph).not.toHaveBeenCalled();
      expect(contextMock.calculateImpact).not.toHaveBeenCalled();
      expect(contextMock.generate).not.toHaveBeenCalled();
    });
  });
});
