import { ipcMain } from 'electron';
import { GitService } from '../../services/GitService';
import { toErrorMessage } from '../../utils/errorHandler';
import { successWith, error } from '../types';

/**
 * Registers all Git-related IPC handlers
 */
export function registerGitHandlers(): void {
  ipcMain.handle('git:status', async (_event, { dir }: { dir: string }) => {
    try {
      const service = new GitService(dir);
      const status = await service.getStatus();
      return successWith({ status });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:diff', async (_event, { dir, filePath }: { dir: string; filePath?: string }) => {
    try {
      const service = new GitService(dir);
      const diff = await service.getDiff(filePath);
      return successWith({ diff });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:commit', async (_event, { dir, message, files }: { dir: string; message: string; files?: string[] }) => {
    try {
      const service = new GitService(dir);
      const commit = await service.commit(message, files);
      return successWith({ commit });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:branch', async (_event, { dir }: { dir: string }) => {
    try {
      const service = new GitService(dir);
      const info = await service.getBranches();
      return successWith({ current: info.current, branches: info.branches });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:createBranch', async (_event, { dir, branchName, checkout }: { dir: string; branchName: string; checkout?: boolean }) => {
    try {
      const service = new GitService(dir);
      const branch = await service.createBranch(branchName, checkout);
      return successWith({ branch });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:checkout', async (_event, { dir, branchName }: { dir: string; branchName: string }) => {
    try {
      const service = new GitService(dir);
      const branch = await service.checkout(branchName);
      return successWith({ branch });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:revertFile', async (_event, { dir, filePath }: { dir: string; filePath: string }) => {
    try {
      const service = new GitService(dir);
      await service.revertFile(filePath);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:pull', async (_event, { dir, remote, branch }: { dir: string; remote?: string; branch?: string }) => {
    try {
      const service = new GitService(dir);
      await service.pull(remote, branch);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:fetch', async (_event, { dir, remote }: { dir: string; remote?: string }) => {
    try {
      const service = new GitService(dir);
      await service.fetch(remote);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:push', async (_event, { dir, remote, branch }: { dir: string; remote?: string; branch?: string }) => {
    try {
      const service = new GitService(dir);
      await service.push(remote, branch);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('git:createPR', async (_event, { dir, title, body, base }: { dir: string; title: string; body: string; base?: string }) => {
    try {
      const service = new GitService(dir);
      const url = await service.createPR(title, body, base);
      return successWith({ url });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });
}
