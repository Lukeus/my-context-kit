import { ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { toErrorMessage } from '../../utils/errorHandler';
import { RepoService } from '../../services/repo.service';
import { successWith, error } from '../types';

const repoService = new RepoService();


/**
 * Registers all repository registry IPC handlers
 */
export function registerRepoHandlers(): void {
  ipcMain.handle('app:getDefaultRepoPath', async () => {
    try {
      const path = await repoService.getDefaultRepoPath();
      return successWith({ path });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('repos:list', async () => {
    try {
      const registry = await repoService.loadRepoRegistry();
      return successWith({ registry });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('repos:add', async (_event, { label, path: repoPath, setActive, autoDetected }: { label: string; path: string; setActive?: boolean; autoDetected?: boolean }) => {
    try {
      if (!repoPath || !label) {
        return error('Repository label and path are required', 'VALIDATION_ERROR');
      }
      if (!existsSync(repoPath)) {
        return error('Repository path does not exist', 'PATH_NOT_FOUND');
      }

      const registry = await repoService.upsertRepoEntry(repoPath, {
        label,
        setActive: setActive ?? true,
        autoDetected
      });

      return successWith({ registry });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('repos:update', async (_event, { id, label, path: repoPath, autoDetected }: { id: string; label?: string; path?: string; autoDetected?: boolean }) => {
    try {
      const registry = await repoService.updateRepoEntry(id, {
        label,
        path: repoPath,
        autoDetected
      });
      return successWith({ registry });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('repos:remove', async (_event, { id }: { id: string }) => {
    try {
      const registry = await repoService.removeRepoEntry(id);
      return successWith({ registry });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('repos:setActive', async (_event, { id }: { id: string }) => {
    try {
      const registry = await repoService.setActiveRepo(id);
      return successWith({ registry });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // File watching handlers
  ipcMain.handle('repo:watch', async (event, { dir }: { dir: string }) => {
    try {
      const abs = path.resolve(dir);
      await repoService.watchRepo(abs, (evt, changedPath) => {
        event.sender.send('repo:fileChanged', { dir: abs, event: evt, file: changedPath });
      });
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('repo:unwatch', async (_event, { dir }: { dir: string }) => {
    try {
      const abs = path.resolve(dir);
      await repoService.unwatchRepo(abs);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });
}
