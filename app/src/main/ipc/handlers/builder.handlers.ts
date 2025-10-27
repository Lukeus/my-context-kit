import { ipcMain } from 'electron';
import { toErrorMessage } from '../../utils/errorHandler';
import { ContextBuilderService } from '../../services/ContextBuilderService';
import { successWith, error } from '../types';

const contextBuilderService = new ContextBuilderService();

/**
 * Registers all context builder IPC handlers
 */
export function registerBuilderHandlers(): void {
  ipcMain.handle('context:getSuggestions', async (_event, { dir, command, params }: { dir: string; command: string; params: any[] }) => {
    try {
      return await contextBuilderService.getSuggestions({ dir, command, params });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('context:getTemplates', async (_event, { dir, entityType }: { dir: string; entityType?: string }) => {
    try {
      const templates = await contextBuilderService.getTemplates({ dir, entityType });
      return successWith({ templates });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('context:scaffoldNewRepo', async (_event, { dir, repoName, projectPurpose, constitutionSummary }: { dir: string; repoName: string; projectPurpose?: string; constitutionSummary?: string }) => {
    try {
      const result = await contextBuilderService.scaffoldNewRepo({ dir, repoName, projectPurpose, constitutionSummary });
      return successWith(result);
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });
}
