import { ipcMain } from 'electron';
import type { SpecKitEntityType } from '@shared/speckit';
import { toErrorMessage } from '../../utils/errorHandler';
import { SpeckitService } from '../../services/SpeckitService';
import { error, success } from '../types';

const speckitService = new SpeckitService();

/**
 * Registers all Speckit (SDD workflow) IPC handlers
 */
export function registerSpeckitHandlers(): void {
  ipcMain.handle('speckit:specify', async (_event, { repoPath, description }: { repoPath: string; description: string }) => {
    try {
      return await speckitService.specify({ repoPath, description });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:plan', async (_event, { repoPath, specPath, techStack }: { repoPath: string; specPath: string; techStack?: string[] }) => {
    try {
      return await speckitService.plan({ repoPath, specPath, techStack });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:tasks', async (_event, { repoPath, planPath }: { repoPath: string; planPath: string }) => {
    try {
      return await speckitService.tasks({ repoPath, planPath });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:fetch', async (_event, { repoPath, releaseTag, forceRefresh }: { repoPath: string; releaseTag?: string; forceRefresh?: boolean }) => {
    try {
      return await speckitService.fetch({ repoPath, releaseTag, forceRefresh });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:listPreviews', async (_event, { repoPath }: { repoPath: string }) => {
    try {
      const previews = await speckitService.listPreviews({ repoPath });
      return success(previews);
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:runPipelines', async (
    _event,
    payload: {
      repoPath: string;
      createdPaths?: string[];
      entityMetadata?: Array<{ id: string; type: SpecKitEntityType; path?: string; sourcePath?: string }>;
      sourcePreviewPaths?: string[];
    },
  ) => {
    try {
      const report = await speckitService.runPipelines(payload);
      return success(report);
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:toEntity', async (_event, { repoPath, specPath, options }:
    { repoPath: string; specPath: string; options?: { createFeature?: boolean; createStories?: boolean } }) => {
    try {
      return await speckitService.toEntity({ repoPath, specPath, options });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:tasksToEntity', async (_event, { repoPath, tasksPath }:
    { repoPath: string; tasksPath: string }) => {
    try {
      return await speckitService.tasksToEntity({ repoPath, tasksPath });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:aiGenerateSpec', async (_event, { repoPath, description }:
    { repoPath: string; description: string }) => {
    try {
      return await speckitService.aiGenerateSpec({ repoPath, description });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('speckit:aiRefineSpec', async (_event, { repoPath, specPath, feedback }:
    { repoPath: string; specPath: string; feedback: string }) => {
    try {
      return await speckitService.aiRefineSpec({ repoPath, specPath, feedback });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });
}
