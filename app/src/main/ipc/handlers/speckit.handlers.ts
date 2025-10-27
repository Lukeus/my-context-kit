import { ipcMain } from 'electron';
import { toErrorMessage } from '../../utils/errorHandler';
import { SpeckitService } from '../../services/SpeckitService';
import { error } from '../types';

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
