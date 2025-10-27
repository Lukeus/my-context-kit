import { ipcMain, clipboard } from 'electron';
import { successWith, error } from '../types';

/**
 * Registers all clipboard IPC handlers
 */
export function registerClipboardHandlers(): void {
  ipcMain.handle('clipboard:writeText', async (_event, { text }: { text: string }) => {
    try {
      clipboard.writeText(text);
      return successWith({});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to write to clipboard';
      return error(message);
    }
  });
}
