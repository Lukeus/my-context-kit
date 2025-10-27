import { ipcMain } from 'electron';
import { ContextService } from '../../services/ContextService';
import { toErrorMessage } from '../../utils/errorHandler';
import { successWith, error } from '../types';

/**
 * Registers all context-related IPC handlers
 */
export function registerContextHandlers(): void {
  ipcMain.handle('context:validate', async (_event, { dir }: { dir: string }) => {
    try {
      const service = new ContextService(dir);
      const result = await service.validate();
      return successWith(result);
    } catch (err: unknown) {
      return error(toErrorMessage(err, 'Validation pipeline failed to execute.'));
    }
  });

  ipcMain.handle('context:buildGraph', async (_event, { dir }: { dir: string }) => {
    try {
      const service = new ContextService(dir);
      const result = await service.buildGraph();
      return successWith(result);
    } catch (err: unknown) {
      const message = toErrorMessage(err, 'Failed to run build graph pipeline.');
      return error(message);
    }
  });

  ipcMain.handle('context:impact', async (_event, { dir, changedIds }: { dir: string; changedIds: string[] }) => {
    try {
      const service = new ContextService(dir);
      const result = await service.calculateImpact(changedIds);
      return successWith(result);
    } catch (err: unknown) {
      return error(toErrorMessage(err, 'Impact analysis pipeline failed to execute.'));
    }
  });

  ipcMain.handle('context:generate', async (_event, { dir, ids }: { dir: string; ids: string[] }) => {
    try {
      const service = new ContextService(dir);
      const result = await service.generate(ids);
      return successWith(result);
    } catch (err: unknown) {
      return error(toErrorMessage(err, 'Content generation pipeline failed to execute.'));
    }
  });

  ipcMain.handle('context:nextId', async (_event, { dir, entityType }: { dir: string; entityType: string }) => {
    try {
      const service = new ContextService(dir);
      const id = await service.getNextId(entityType);
      return successWith({ id });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('fs:findEntityFile', async (_event, { dir, entityType, entityId }: { dir: string; entityType: string; entityId: string }) => {
    try {
      const service = new ContextService(dir);
      const filePath = await service.findEntityFile(entityType, entityId);
      return successWith({ filePath });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });
}
