import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fsPromises from 'node:fs/promises';
import { execa } from 'execa';
import { parse as parseYAML } from 'yaml';

vi.mock('node:fs/promises', () => {
  const mocks = {
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    cp: vi.fn(),
  };
  return {
    ...mocks,
    default: mocks,
  };
});
vi.mock('execa', () => ({
  execa: vi.fn(),
}));
vi.mock('yaml', () => ({
  parse: vi.fn(),
  stringify: vi.fn((obj: any) => JSON.stringify(obj)),
}));
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => `/mock/user/data`),
    getAppPath: vi.fn(() => '/mock/app/path'),
    isReady: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve()),
    isPackaged: false,
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
}));

import { ContextBuilderService } from './ContextBuilderService';
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('ContextBuilderService', () => {
  let service: ContextBuilderService;

  beforeEach(() => {
    service = new ContextBuilderService();
    vi.clearAllMocks();
  });

  describe('getSuggestions', () => {
    it('should execute context-builder pipeline and return parsed JSON', async () => {
      const mockOutput = { suggestions: ['option1', 'option2'] };
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify(mockOutput),
      } as any);

      const result = await service.getSuggestions({
        dir: '/test/repo',
        command: 'suggest',
        params: ['entity', 'component'],
      });

      expect(result).toEqual(mockOutput);
      expect(execa).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining([
          expect.stringContaining('context-builder.mjs'),
          'suggest',
          'entity',
          'component',
        ]),
        expect.objectContaining({ cwd: '/test/repo' })
      );
    });

    it('should base64-encode object parameters', async () => {
      vi.mocked(execa).mockResolvedValue({ stdout: '{}' } as any);

      await service.getSuggestions({
        dir: '/test/repo',
        command: 'analyze',
        params: [{ type: 'feature', name: 'login' }],
      });

      const execaCall = vi.mocked(execa).mock.calls[0];
      const encodedParam = (execaCall?.[1] as any)?.[2];
      expect(typeof encodedParam).toBe('string');
      expect(encodedParam).not.toContain('{');
    });

    it('should throw error when pipeline execution fails', async () => {
      vi.mocked(execa).mockRejectedValue(new Error('Pipeline error'));

      await expect(
        service.getSuggestions({ dir: '/test/repo', command: 'test', params: [] })
      ).rejects.toThrow('Pipeline error');
    });
  });

  describe('getTemplates', () => {
    it('should return templates from builder directory', async () => {
      const mockFiles = ['component.yaml', 'service.yaml', 'readme.txt'];
      const mockTemplate = {
        _template: { entityType: 'component', title: 'Component Template' },
        name: 'Example',
      };

      vi.mocked(fsPromises.readdir).mockResolvedValue(
        mockFiles as any
      );
      vi.mocked(fsPromises.readFile).mockResolvedValue('template-content');
      vi.mocked(parseYAML).mockReturnValue(mockTemplate);

      const result = await service.getTemplates({ dir: '/test/repo' });

      expect(result.length).toBeGreaterThan(0);
      expect(fsPromises.readdir).toHaveBeenCalledWith(
        expect.stringContaining('.context/templates/builder')
      );
    });

    it('should filter templates by entityType when specified', async () => {
      vi.mocked(fsPromises.readdir).mockResolvedValue(['t1.yaml', 't2.yaml'] as any);
      vi.mocked(fsPromises.readFile).mockResolvedValue('content');
      vi.mocked(parseYAML)
        .mockReturnValueOnce({ _template: { entityType: 'component' } })
        .mockReturnValueOnce({ _template: { entityType: 'service' } });

      const result = await service.getTemplates({
        dir: '/test/repo',
        entityType: 'component',
      });

      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('component');
    });

    it('should skip files that fail to parse', async () => {
      vi.mocked(fsPromises.readdir).mockResolvedValue(
        ['valid.yaml', 'invalid.yaml'] as any
      );
      vi.mocked(fsPromises.readFile).mockResolvedValue('content');
      vi.mocked(parseYAML)
        .mockReturnValueOnce({ _template: { entityType: 'valid' } })
        .mockImplementationOnce(() => {
          throw new Error('Parse error');
        });

      const result = await service.getTemplates({ dir: '/test/repo' });

      expect(result).toHaveLength(1);
    });
  });

  describe('scaffoldNewRepo', () => {
    beforeEach(() => {
      vi.mocked(fsPromises.access).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      vi.mocked(fsPromises.readdir).mockResolvedValue([]);
      vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('content'));
      vi.mocked(execa).mockResolvedValue({ stdout: '' } as any);
    });

    it('should throw error if directory already exists', async () => {
      vi.mocked(fsPromises.access).mockResolvedValueOnce(undefined);

      await expect(
        service.scaffoldNewRepo({
          dir: '/test',
          repoName: 'existing-repo',
        })
      ).rejects.toThrow('Directory already exists');
    });

    it('should create required directory structure', async () => {
      const result = await service.scaffoldNewRepo({
        dir: '/test',
        repoName: 'new-repo',
      });

      expect(result.path).toBe('/test/new-repo');
      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('contexts'),
        expect.objectContaining({ recursive: true })
      );
      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.context'),
        expect.objectContaining({ recursive: true })
      );
    });

    it('should create README with repo name', async () => {
      await service.scaffoldNewRepo({
        dir: '/test',
        repoName: 'my-repo',
      });

      const writeFileCalls = vi.mocked(fsPromises.writeFile).mock.calls;
      const readmeCall = writeFileCalls.find((call) =>
        call[0].toString().includes('README.md')
      );

      expect(readmeCall).toBeDefined();
      expect(readmeCall?.[1]).toContain('my-repo');
    });

    it('should create constitution when summary provided', async () => {
      await service.scaffoldNewRepo({
        dir: '/test',
        repoName: 'new-repo',
        constitutionSummary: 'Our core values',
      });

      const writeFileCalls = vi.mocked(fsPromises.writeFile).mock.calls;
      const constitutionCall = writeFileCalls.find((call) =>
        call[0].toString().includes('constitution.yaml')
      );

      expect(constitutionCall).toBeDefined();
      expect(constitutionCall?.[1]).toContain('Our core values');
    });

    it('should include project purpose if provided', async () => {
      await service.scaffoldNewRepo({
        dir: '/test',
        repoName: 'new-repo',
        projectPurpose: 'Build awesome features',
        constitutionSummary: 'Our values',
      });

      const writeFileCalls = vi.mocked(fsPromises.writeFile).mock.calls;
      const constitutionCall = writeFileCalls.find((call) =>
        call[0].toString().includes('constitution.yaml')
      );

      expect(constitutionCall?.[1]).toContain('Build awesome features');
    });

    it('should return warning when dependency installation fails', async () => {
      vi.mocked(execa).mockRejectedValueOnce(new Error('pnpm not found'));

      const result = await service.scaffoldNewRepo({
        dir: '/test',
        repoName: 'new-repo',
      });

      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('Dependencies were not installed');
    });
  });
});
