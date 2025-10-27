import { ipcMain } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { toErrorMessage } from '../../utils/errorHandler';
import { RepoService } from '../../services/repo.service';

const repoService = new RepoService();


/**
 * Registers all repository registry IPC handlers
 */
export function registerRepoHandlers(): void {
  ipcMain.handle('app:getDefaultRepoPath', async () => {
    try {
      const path = await repoService.getDefaultRepoPath();
      return { ok: true, path };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle('repos:list', async () => {
    try {
      const registry = await repoService.loadRepoRegistry();
      return { ok: true, registry };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle('repos:add', async (_event, { label, path: repoPath, setActive, autoDetected }: { label: string; path: string; setActive?: boolean; autoDetected?: boolean }) => {
    try {
      if (!repoPath || !label) {
        return { ok: false, error: 'Repository label and path are required' };
      }
      if (!existsSync(repoPath)) {
        return { ok: false, error: 'Repository path does not exist' };
      }

      const registry = await repoService.upsertRepoEntry(repoPath, {
        label,
        setActive: setActive ?? true,
        autoDetected
      });

      return { ok: true, registry };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle('repos:update', async (_event, { id, label, path: repoPath, autoDetected }: { id: string; label?: string; path?: string; autoDetected?: boolean }) => {
    try {
      const registry = await repoService.updateRepoEntry(id, {
        label,
        path: repoPath,
        autoDetected
      });
      return { ok: true, registry };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle('repos:remove', async (_event, { id }: { id: string }) => {
    try {
      const registry = await repoService.removeRepoEntry(id);
      return { ok: true, registry };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle('repos:setActive', async (_event, { id }: { id: string }) => {
    try {
      const registry = await repoService.setActiveRepo(id);
      return { ok: true, registry };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  // File watching handlers
  ipcMain.handle('repo:watch', async (event, { dir }: { dir: string }) => {
    try {
      const abs = path.resolve(dir);
      await repoService.watchRepo(abs, (evt, changedPath) => {
        event.sender.send('repo:fileChanged', { dir: abs, event: evt, file: changedPath });
      });
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });

  ipcMain.handle('repo:unwatch', async (_event, { dir }: { dir: string }) => {
    try {
      const abs = path.resolve(dir);
      await repoService.unwatchRepo(abs);
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });
}
