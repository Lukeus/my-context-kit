import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeckitService } from '../../src/main/services/SpeckitService';
import { existsSync } from 'node:fs';
import { execa } from 'execa';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

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
});
