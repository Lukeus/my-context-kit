import { app, BrowserWindow, ipcMain, clipboard } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import started from 'electron-squirrel-startup';
import { execa } from 'execa';
import { simpleGit } from 'simple-git';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Set CSP for development (Vite requires unsafe-eval)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
        ]
      }
    });
  });

  // Load the renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// IPC Handlers for context repo operations
ipcMain.handle('context:validate', async (_event, { dir }: { dir: string }) => {
  try {
    const result = await execa('node', [path.join(dir, '.context', 'pipelines', 'validate.mjs')], { 
      cwd: dir,
      shell: true
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('context:buildGraph', async (_event, { dir }: { dir: string }) => {
  try {
    const result = await execa('node', [path.join(dir, '.context', 'pipelines', 'build-graph.mjs')], {
      cwd: dir,
      shell: true
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('context:impact', async (_event, { dir, changedIds }: { dir: string; changedIds: string[] }) => {
  try {
    const result = await execa('node', [path.join(dir, '.context', 'pipelines', 'impact.mjs'), ...changedIds], {
      cwd: dir,
      shell: true
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('context:generate', async (_event, { dir, ids }: { dir: string; ids: string[] }) => {
  try {
    const result = await execa('node', [path.join(dir, '.context', 'pipelines', 'generate.mjs'), ...ids], {
      cwd: dir,
      shell: true
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// Clipboard handler
ipcMain.handle('clipboard:writeText', async (_event, { text }: { text: string }) => {
  try {
    clipboard.writeText(text);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// File system handlers
ipcMain.handle('fs:readFile', async (_event, { filePath }: { filePath: string }) => {
  try {
    const content = await readFile(filePath, 'utf-8');
    return { ok: true, content };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('fs:writeFile', async (_event, { filePath, content }: { filePath: string; content: string }) => {
  try {
    await writeFile(filePath, content, 'utf-8');
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('fs:findEntityFile', async (_event, { dir, entityType, entityId }: { dir: string; entityType: string; entityId: string }) => {
  try {
    // Map entity types to their directory names
    const typeDirMap: Record<string, string> = {
      feature: 'features',
      userstory: 'userstories',
      spec: 'specs',
      task: 'tasks',
      service: 'services',
      package: 'packages'
    };
    
    const typeDir = typeDirMap[entityType] || entityType + 's';
    const entityDir = path.join(dir, 'contexts', typeDir);
    const files = await readdir(entityDir);
    
    // Find file that starts with the entity ID
    const matchingFile = files.find(f => 
      (f.endsWith('.yaml') || f.endsWith('.yml')) && 
      (f === `${entityId}.yaml` || f === `${entityId}.yml` || f.startsWith(`${entityId}-`))
    );
    
    if (matchingFile) {
      return { ok: true, filePath: path.join(entityDir, matchingFile) };
    } else {
      return { ok: false, error: `File not found for entity ${entityId}` };
    }
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// Git handlers
ipcMain.handle('git:status', async (_event, { dir }: { dir: string }) => {
  try {
    const git = simpleGit(dir);
    const status = await git.status();
    
    // Serialize status object for IPC (remove non-serializable properties)
    const serializedStatus = {
      modified: status.modified || [],
      created: status.created || [],
      deleted: status.deleted || [],
      renamed: status.renamed || [],
      conflicted: status.conflicted || [],
      staged: status.staged || [],
      current: status.current || '',
      tracking: status.tracking || null,
      ahead: status.ahead || 0,
      behind: status.behind || 0
    };
    
    return { ok: true, status: serializedStatus };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:diff', async (_event, { dir, filePath }: { dir: string; filePath?: string }) => {
  try {
    const git = simpleGit(dir);
    const diff = filePath
      ? await git.diff([filePath])
      : await git.diff();
    return { ok: true, diff };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:commit', async (_event, { dir, message, files }: { dir: string; message: string; files?: string[] }) => {
  try {
    const git = simpleGit(dir);
    
    // Add files (or all if not specified)
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }
    
    // Commit
    const result = await git.commit(message);
    return { ok: true, commit: result.commit };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:branch', async (_event, { dir }: { dir: string }) => {
  try {
    const git = simpleGit(dir);
    const branch = await git.branchLocal();
    return { ok: true, current: branch.current, branches: branch.all };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:createBranch', async (_event, { dir, branchName, checkout }: { dir: string; branchName: string; checkout?: boolean }) => {
  try {
    const git = simpleGit(dir);
    
    if (checkout) {
      await git.checkoutLocalBranch(branchName);
    } else {
      await git.branch([branchName]);
    }
    
    return { ok: true, branch: branchName };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:checkout', async (_event, { dir, branchName }: { dir: string; branchName: string }) => {
  try {
    const git = simpleGit(dir);
    await git.checkout(branchName);
    return { ok: true, branch: branchName };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:push', async (_event, { dir, remote, branch }: { dir: string; remote?: string; branch?: string }) => {
  try {
    const git = simpleGit(dir);
    await git.push(remote || 'origin', branch);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:createPR', async (_event, { dir, title, body, base }: { dir: string; title: string; body: string; base?: string }) => {
  try {
    // Use GitHub CLI to create PR
    const args = ['pr', 'create', '--title', title, '--body', body];
    if (base) {
      args.push('--base', base);
    }
    
    const result = await execa('gh', args, {
      cwd: dir,
      shell: true
    });
    
    return { ok: true, url: result.stdout };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// App lifecycle
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
