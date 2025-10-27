import { ipcMain, dialog } from 'electron';
import { toErrorMessage } from '../../utils/errorHandler';
import { successWith, error } from '../types';

/**
 * Registers all dialog IPC handlers
 */
export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:selectDirectory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Directory'
      });

      if (result.canceled || !result.filePaths?.length) {
        return successWith({ paths: [] });
      }

      return successWith({ paths: result.filePaths });
    } catch (err: unknown) {
      return error(toErrorMessage(err, 'Failed to open directory picker.'));
    }
  });
}
