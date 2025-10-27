import { ipcMain } from 'electron';
import { FileSystemService } from '../../services/FileSystemService';
import { ContextService } from '../../services/ContextService';
import { toErrorMessage } from '../../utils/errorHandler';
import { successWith, error } from '../types';

/**
 * Registers all filesystem-related IPC handlers
 */
export function registerFileSystemHandlers(): void {
  const fsService = new FileSystemService();

  ipcMain.handle('fs:readFile', async (_event, { filePath }: { filePath: string }) => {
    try {
      const content = await fsService.readFile(filePath);
      return successWith({ content });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('fs:writeFile', async (_event, { filePath, content }: { filePath: string; content: string }) => {
    try {
      await fsService.writeFile(filePath, content);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('context:createEntity', async (_event, { dir, entity, entityType }: { dir: string; entity: any; entityType: string }) => {
    try {
      const filePath = await fsService.createEntity(dir, entity, entityType);
      return successWith({ filePath });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('file:read', async (_event, { filePath }: { filePath: string }) => {
    try {
      const content = await fsService.readFile(filePath);
      return successWith({ content });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });
}
