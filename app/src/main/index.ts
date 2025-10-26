import { app, BrowserWindow, ipcMain, clipboard, safeStorage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, readdir, rename, mkdir, access, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import started from 'electron-squirrel-startup';
import { execa } from 'execa';
import { simpleGit } from 'simple-git';
import { parse as parseYAML } from 'yaml';
import chokidar, { type FSWatcher } from 'chokidar';

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

// Track active AI streaming processes by streamId
const aiStreamProcs = new Map<string, ReturnType<typeof execa>>();

// Repo file watchers by absolute path
const repoWatchers = new Map<string, FSWatcher>();
ipcMain.handle('context:validate', async (_event, { dir }: { dir: string }) => {
  try {
    const result = await execa('node', [path.join(dir, '.context', 'pipelines', 'validate.mjs')], { 
      cwd: dir
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('context:buildGraph', async (_event, { dir }: { dir: string }) => {
  const pipelinePath = path.join(dir, '.context', 'pipelines', 'build-graph.mjs');

  if (!existsSync(pipelinePath)) {
    return {
      error: 'Selected repository is missing .context/pipelines/build-graph.mjs. Choose a valid context repo or generate the required pipeline files.'
    };
  }

  try {
    const result = await execa('node', [pipelinePath], {
      cwd: dir
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to run build graph pipeline.';
    if (message.includes('Cannot find module')) {
      return {
        error: 'build-graph.mjs failed to execute. Ensure all pipeline dependencies are installed inside the selected repository.'
      };
    }

    return { error: message };
  }
});

ipcMain.handle('context:impact', async (_event, { dir, changedIds }: { dir: string; changedIds: string[] }) => {
  try {
    const result = await execa('node', [path.join(dir, '.context', 'pipelines', 'impact.mjs'), ...changedIds], {
      cwd: dir
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('context:generate', async (_event, { dir, ids }: { dir: string; ids: string[] }) => {
  try {
    const result = await execa('node', [path.join(dir, '.context', 'pipelines', 'generate.mjs'), ...ids], {
      cwd: dir
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    if (error?.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        // Fall through to default error return if stdout isn't valid JSON
      }
    }
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
      governance: 'governance',
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
    let matchingFile = files.find(f =>
      (f.endsWith('.yaml') || f.endsWith('.yml')) &&
      (f === `${entityId}.yaml` || f === `${entityId}.yml` || f.startsWith(`${entityId}-`))
    );

    if (!matchingFile) {
      // Fallback: parse YAML files to match entities whose filenames omit the ID (e.g. constitution)
      const { parse: parseYAML } = await import('yaml');
      for (const fileName of files) {
        if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
          continue;
        }

        try {
          const content = await readFile(path.join(entityDir, fileName), 'utf-8');
          const data = parseYAML(content);
          if (data && data.id === entityId) {
            matchingFile = fileName;
            break;
          }
        } catch {
          // Ignore parse errors and keep searching other files
        }
      }
    }
    
    if (matchingFile) {
      return { ok: true, filePath: path.join(entityDir, matchingFile) };
    } else {
      return { ok: false, error: `File not found for entity ${entityId}` };
    }
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// Repo watch handlers
ipcMain.handle('repo:watch', async (event, { dir }: { dir: string }) => {
  try {
    const abs = path.resolve(dir);
    if (repoWatchers.has(abs)) {
      return { ok: true };
    }
    const watcher = chokidar.watch([
      path.join(abs, 'contexts'),
      path.join(abs, '.context', 'schemas')
    ], {
      ignored: (p: string) => path.basename(p).startsWith('.'),
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
    });

    watcher.on('all', (evt, changedPath) => {
      // Only forward YAML or template/schema changes
      if (!changedPath.match(/\.(ya?ml|hbs|json)$/i)) return;
      event.sender.send('repo:fileChanged', { dir: abs, event: evt, file: changedPath });
    });

    repoWatchers.set(abs, watcher);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('repo:unwatch', async (_event, { dir }: { dir: string }) => {
  try {
    const abs = path.resolve(dir);
    const watcher = repoWatchers.get(abs);
    if (watcher) {
      await watcher.close();
      repoWatchers.delete(abs);
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// Git handlers
ipcMain.handle('git:status', async (_event, { dir }: { dir: string }) => {
  try {
    // Git should run from parent directory (project root) not context-repo
    const projectRoot = path.dirname(dir);
    const git = simpleGit(projectRoot);
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
      behind: status.behind || 0,
      not_added: status.not_added || []
    };
    
    return { ok: true, status: serializedStatus };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:diff', async (_event, { dir, filePath }: { dir: string; filePath?: string }) => {
  try {
    // Git should run from parent directory (project root)
    const projectRoot = path.dirname(dir);
    const git = simpleGit(projectRoot);
    
    if (filePath) {
      // Check file status
      const status = await git.status();
      const isNewFile = status.created.includes(filePath) || 
                        status.not_added.includes(filePath);
      const isStaged = status.staged.includes(filePath);
      
      if (isNewFile && !isStaged) {
        // For new untracked files, show the entire file content as "added"
        try {
          const content = await readFile(path.join(projectRoot, filePath), 'utf-8');
          const lines = content.split('\n');
          const diff = lines.map(line => `+${line}`).join('\n');
          return { ok: true, diff: `New file: ${filePath}\n\n${diff}` };
        } catch (readError) {
          return { ok: true, diff: 'New file (unable to read content)' };
        }
      }
      
      // For staged files, use --cached flag
      if (isStaged) {
        const diff = await git.diff(['--cached', filePath]);
        return { ok: true, diff: diff || 'No changes in staged file' };
      }
      
      // For modified tracked files, use normal diff
      const diff = await git.diff([filePath]);
      return { ok: true, diff: diff || 'No changes' };
    } else {
      // Diff all changes
      const diff = await git.diff();
      return { ok: true, diff };
    }
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:commit', async (_event, { dir, message, files }: { dir: string; message: string; files?: string[] }) => {
  try {
    // Git should run from parent directory (project root)
    const projectRoot = path.dirname(dir);
    const git = simpleGit(projectRoot);
    
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
    // Git should run from parent directory (project root)
    const projectRoot = path.dirname(dir);
    const git = simpleGit(projectRoot);
    const branch = await git.branchLocal();
    return { ok: true, current: branch.current, branches: branch.all };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:createBranch', async (_event, { dir, branchName, checkout }: { dir: string; branchName: string; checkout?: boolean }) => {
  try {
    // Git should run from parent directory (project root)
    const projectRoot = path.dirname(dir);
    const git = simpleGit(projectRoot);
    
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
    // Git should run from parent directory (project root)
    const projectRoot = path.dirname(dir);
    const git = simpleGit(projectRoot);
    await git.checkout(branchName);
    return { ok: true, branch: branchName };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:push', async (_event, { dir, remote, branch }: { dir: string; remote?: string; branch?: string }) => {
  try {
    // Git should run from parent directory (project root)
    const projectRoot = path.dirname(dir);
    const git = simpleGit(projectRoot);
    await git.push(remote || 'origin', branch);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('git:createPR', async (_event, { dir, title, body, base }: { dir: string; title: string; body: string; base?: string }) => {
  try {
    // Git should run from parent directory (project root)
    const projectRoot = path.dirname(dir);
    
    // Use GitHub CLI to create PR
    const args = ['pr', 'create', '--title', title, '--body', body];
    if (base) {
      args.push('--base', base);
    }
    
    const result = await execa('gh', args, {
      cwd: projectRoot
    });
    
    return { ok: true, url: result.stdout };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('app:getDefaultRepoPath', async () => {
  try {
    const envOverride = process.env.CONTEXT_REPO_PATH;
    if (envOverride && existsSync(envOverride)) {
      await upsertRepoEntry(envOverride, { setActive: true, label: path.basename(envOverride) });
      return { ok: true, path: envOverride };
    }

    const activePath = await ensureRepoRegistryActivePath();
    if (activePath) {
      return { ok: true, path: activePath };
    }

    const appPath = app.getAppPath();
    const candidates = [
      path.resolve(appPath, '..', 'context-repo'),
      path.resolve(appPath, '..', '..', 'context-repo'),
      path.resolve(process.cwd(), 'context-repo')
    ];

    const matchingPath = candidates.find(candidate => existsSync(candidate));
    if (matchingPath) {
      await upsertRepoEntry(matchingPath, {
        setActive: true,
        autoDetected: true,
        label: path.basename(matchingPath)
      });
      return { ok: true, path: matchingPath };
    }

    return { ok: true, path: '' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('repos:list', async () => {
  try {
    const registry = await loadRepoRegistry();
    return { ok: true, registry };
  } catch (error: any) {
    return { ok: false, error: error.message };
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

    const registry = await upsertRepoEntry(repoPath, {
      label,
      setActive: setActive ?? true,
      autoDetected
    });

    return { ok: true, registry };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('repos:update', async (_event, { id, label, path: repoPath, autoDetected }: { id: string; label?: string; path?: string; autoDetected?: boolean }) => {
  try {
    const registry = await loadRepoRegistry();
    const repo = registry.repos.find(entry => entry.id === id);
    if (!repo) {
      return { ok: false, error: 'Repository not found' };
    }

    if (label) {
      repo.label = label;
    }

    if (repoPath) {
      if (!existsSync(repoPath)) {
        return { ok: false, error: 'Repository path does not exist' };
      }
      const canonicalNew = canonicalizeRepoPath(repoPath);
      const collision = registry.repos.find(entry => entry.id !== id && canonicalizeRepoPath(entry.path) === canonicalNew);
      if (collision) {
        return { ok: false, error: 'Another repository already uses this path' };
      }
      repo.path = path.normalize(path.resolve(repoPath));
    }

    if (autoDetected !== undefined) {
      repo.autoDetected = autoDetected;
    }

    await saveRepoRegistry(registry);
    return { ok: true, registry };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('repos:remove', async (_event, { id }: { id: string }) => {
  try {
    const registry = await removeRepoEntry(id);
    return { ok: true, registry };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('repos:setActive', async (_event, { id }: { id: string }) => {
  try {
    const registry = await loadRepoRegistry();
    const repo = registry.repos.find(entry => entry.id === id);
    if (!repo) {
      return { ok: false, error: 'Repository not found' };
    }

    registry.activeRepoId = id;
    repo.lastUsed = new Date().toISOString();
    await saveRepoRegistry(registry);

    return { ok: true, registry };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// Context Builder handlers
ipcMain.handle('context:nextId', async (_event, { dir, entityType }: { dir: string; entityType: string }) => {
  try {
    // Map entity types to their directory names
    const typeDirMap: Record<string, string> = {
      governance: 'governance',
      feature: 'features',
      userstory: 'userstories',
      spec: 'specs',
      task: 'tasks',
      service: 'services',
      package: 'packages'
    };
    
    const typeDir = typeDirMap[entityType];
    if (!typeDir) {
      return { ok: false, error: `Unknown entity type: ${entityType}` };
    }
    
    const entityDir = path.join(dir, 'contexts', typeDir);
    
    try {
      const files = await readdir(entityDir);
      
      // Extract numeric IDs from existing files
      const idPattern = entityType === 'feature' ? /FEAT-(\d+)/ :
                       entityType === 'userstory' ? /US-(\d+)/ :
                       entityType === 'spec' ? /SPEC-(\d+)/ :
                       entityType === 'task' ? /T-(\d+)/ :
                       entityType === 'service' ? /svc-(.+)/ :
                       /pkg-(.+)/;
      
      const numericIds: number[] = [];
      
      for (const file of files) {
        const match = file.match(idPattern);
        if (match && match[1]) {
          const numId = parseInt(match[1], 10);
          if (!isNaN(numId)) {
            numericIds.push(numId);
          }
        }
      }
      
      // Find next available ID
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const nextId = maxId + 1;
      
      // Format based on entity type
      let formattedId: string;
      switch (entityType) {
        case 'feature':
          formattedId = `FEAT-${String(nextId).padStart(3, '0')}`;
          break;
        case 'userstory':
          formattedId = `US-${String(nextId).padStart(3, '0')}`;
          break;
        case 'spec':
          formattedId = `SPEC-${String(nextId).padStart(3, '0')}`;
          break;
        case 'task':
          formattedId = `T-${String(nextId).padStart(4, '0')}`;
          break;
        case 'service':
          formattedId = `svc-new-${nextId}`;
          break;
        case 'package':
          formattedId = `pkg-new-${nextId}`;
          break;
        default:
          formattedId = `${entityType}-${nextId}`;
      }
      
      return { ok: true, id: formattedId };
    } catch (readError: any) {
      // Directory might not exist yet - return first ID
      const firstId = entityType === 'feature' ? 'FEAT-001' :
                      entityType === 'userstory' ? 'US-001' :
                      entityType === 'spec' ? 'SPEC-001' :
                      entityType === 'task' ? 'T-0001' :
                      entityType === 'service' ? 'svc-new-1' :
                      'pkg-new-1';
      return { ok: true, id: firstId };
    }
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('file:read', async (_event, { filePath }: { filePath: string }) => {
  try {
    const content = await readFile(filePath, 'utf-8');
    return { ok: true, content };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('context:createEntity', async (_event, { dir, entity, entityType }: { dir: string; entity: any; entityType: string }) => {
  try {
    // Map entity types to their directory names
    const typeDirMap: Record<string, string> = {
      governance: 'governance',
      feature: 'features',
      userstory: 'userstories',
      spec: 'specs',
      task: 'tasks',
      service: 'services',
      package: 'packages'
    };
    
    const typeDir = typeDirMap[entityType];
    if (!typeDir) {
      return { ok: false, error: `Unknown entity type: ${entityType}` };
    }
    
    if (!entity.id) {
      return { ok: false, error: 'Entity ID is required' };
    }
    
    // Import yaml module dynamically
    const { stringify: stringifyYAML } = await import('yaml');
    
    const entityDir = path.join(dir, 'contexts', typeDir);
    
    // Create filename from ID and title
    const sanitizedTitle = entity.title ? entity.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40) : 'untitled';
    const filename = `${entity.id}-${sanitizedTitle}.yaml`;
    const filePath = path.join(entityDir, filename);
    
    // Convert entity to YAML
    const yamlContent = stringifyYAML(entity);
    
    // Write file
    await writeFile(filePath, yamlContent, 'utf-8');
    
    return { ok: true, filePath };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('context:getSuggestions', async (_event, { dir, command, params }: { dir: string; command: string; params: any[] }) => {
  try {
    // Base64-encode any JSON objects to avoid Windows shell quote escaping issues
    const encodedParams = params.map(param => {
      if (typeof param === 'object') {
        return Buffer.from(JSON.stringify(param)).toString('base64');
      }
      return param;
    });
    
    const args = [path.join(dir, '.context', 'pipelines', 'context-builder.mjs'), command, ...encodedParams];
    const result = await execa('node', args, {
      cwd: dir
    });
    return JSON.parse(result.stdout);
  } catch (error: any) {
    return { error: error.message };
  }
});

ipcMain.handle('context:getTemplates', async (_event, { dir, entityType }: { dir: string; entityType?: string }) => {
  try {
    const { parse: parseYAML } = await import('yaml');
    const templatesDir = path.join(dir, '.context', 'templates', 'builder');
    
    try {
      const files = await readdir(templatesDir);
      const templates = [];
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          try {
            const content = await readFile(path.join(templatesDir, file), 'utf-8');
            const data = parseYAML(content);
            
            // Extract template metadata
            if (data._template) {
              const template = {
                filename: file,
                ...data._template,
                content: data
              };
              
              // Filter by entity type if specified
              if (!entityType || template.entityType === entityType) {
                templates.push(template);
              }
            }
          } catch (parseError) {
            console.error(`Failed to parse template ${file}:`, parseError);
          }
        }
      }
      
      return { ok: true, templates };
    } catch (readError: any) {
      return { ok: false, error: `Templates directory not found: ${readError.message}`, templates: [] };
    }
  } catch (error: any) {
    return { ok: false, error: error.message, templates: [] };
  }
});

ipcMain.handle('context:scaffoldNewRepo', async (_event, { dir, repoName, projectPurpose, constitutionSummary }: { dir: string; repoName: string; projectPurpose?: string; constitutionSummary?: string }) => {
  try {
    const targetDir = path.join(dir, repoName);
    
    // Check if directory already exists
    try {
      await access(targetDir);
      return { ok: false, error: 'Directory already exists' };
    } catch {
      // Directory doesn't exist, which is what we want
    }
    
    // Get the reference template path from the app resources
    // In development, use context-repo from parent directory
    // In production, this would be bundled with the app
    const isDev = process.env.NODE_ENV === 'development';
    const templateSourcePath = isDev 
      ? path.join(__dirname, '..', '..', '..', '..', 'context-repo')
      : path.join(process.resourcesPath, 'context-repo-template');
    
    // Check if template exists
    try {
      await access(templateSourcePath);
    } catch {
      return { ok: false, error: 'Context repo template not found' };
    }
    
    // Create target directory
    await mkdir(targetDir, { recursive: true });
    
    // Create required folder structure
    const requiredDirs = [
      '.context',
      '.context/pipelines',
      '.context/rules',
      '.context/schemas',
      '.context/templates',
      '.context/templates/builder',
      '.context/templates/docs',
      '.context/templates/prompts',
      'contexts',
      'contexts/features',
      'contexts/governance',
      'contexts/packages',
      'contexts/services',
      'contexts/specs',
      'contexts/tasks',
      'contexts/userstories',
      'generated',
      'generated/docs',
      'generated/prompts',
      'generated/docs/impact',
    ];
    
    for (const dir of requiredDirs) {
      await mkdir(path.join(targetDir, dir), { recursive: true });
    }
    
    // Copy pipeline files from template
    const pipelineFiles = [
      'build-graph.mjs',
      'validate.mjs',
      'impact.mjs',
      'generate.mjs',
      'context-builder.mjs',
      'ai-assistant.mjs'
    ];
    
    for (const file of pipelineFiles) {
      try {
        const sourcePath = path.join(templateSourcePath, '.context', 'pipelines', file);
        const destPath = path.join(targetDir, '.context', 'pipelines', file);
        await cp(sourcePath, destPath);
      } catch (err) {
        console.warn(`Failed to copy pipeline file ${file}:`, err);
      }
    }
    
    // Copy template files (handlebars)
    const templateDirs = ['builder', 'docs', 'prompts'];
    for (const templateDir of templateDirs) {
      try {
        const sourcePath = path.join(templateSourcePath, '.context', 'templates', templateDir);
        const destPath = path.join(targetDir, '.context', 'templates', templateDir);
        await cp(sourcePath, destPath, { recursive: true });
      } catch (err) {
        console.warn(`Failed to copy template directory ${templateDir}:`, err);
      }
    }
    
    // Copy schema files
    try {
      const sourcePath = path.join(templateSourcePath, '.context', 'schemas');
      const destPath = path.join(targetDir, '.context', 'schemas');
      await cp(sourcePath, destPath, { recursive: true });
    } catch (err) {
      console.warn('Failed to copy schema files:', err);
    }
    
    // Copy package.json for dependencies
    try {
      const sourcePath = path.join(templateSourcePath, 'package.json');
      const destPath = path.join(targetDir, 'package.json');
      await cp(sourcePath, destPath);
    } catch (err) {
      console.warn('Failed to copy package.json:', err);
    }
    
    // Create a default README.md
    const readmeContent = `# ${repoName}

This is a Context-Kit repository for managing project context, specifications, and relationships.

## Structure

- \`contexts/\` - YAML entities (features, user stories, specs, tasks, services, packages, governance)
- \`.context/pipelines/\` - Automation scripts for validation, graph building, and impact analysis
- \`.context/templates/\` - Handlebars templates for code generation
- \`generated/\` - Auto-generated documentation and prompts

## Getting Started

1. Install dependencies: \`npm install\`
2. Add your first entities in \`contexts/\`
3. Open in Context-Kit app to visualize and manage

## Governance

Create a constitution in \`contexts/governance/constitution.yaml\` to define principles and compliance rules.
`;
    await writeFile(path.join(targetDir, 'README.md'), readmeContent, 'utf-8');
    
    // Create .gitignore
    const gitignoreContent = `node_modules/
generated/
.env
*.log
`;
    await writeFile(path.join(targetDir, '.gitignore'), gitignoreContent, 'utf-8');
    
    // Create constitution file if summary provided
    if (constitutionSummary && constitutionSummary.trim()) {
      const { stringify: stringifyYAML } = await import('yaml');
      const crypto = await import('crypto');
      
      const constitution: any = {
        id: `CONST-${repoName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`,
        name: `${repoName} Constitution`,
        version: '1.0.0',
        status: 'draft',
        ratifiedOn: new Date().toISOString().split('T')[0],
        summary: constitutionSummary.trim(),
        ...(projectPurpose && projectPurpose.trim() ? { purpose: projectPurpose.trim() } : {}),
        principles: [
          {
            id: 'core-principle',
            title: 'Core Principle',
            summary: 'Placeholder principle - replace with your project-specific principles',
            appliesTo: ['global'],
            nonNegotiable: false,
            requirements: []
          }
        ],
        governance: {
          owners: ['@team'],
          reviewCadence: 'quarterly',
          changeControl: 'Updates require approval and documentation'
        },
        compliance: {
          rules: [
            {
              id: 'placeholder-rule',
              description: 'Placeholder rule - replace with your project-specific compliance rules',
              targets: ['global'],
              conditions: [
                {
                  path: 'id',
                  operator: 'exists',
                  message: 'All entities must have an ID'
                }
              ],
              severity: 'medium'
            }
          ],
          exceptions: []
        }
      };
      
      const constitutionYaml = stringifyYAML(constitution);
      const constitutionPath = path.join(targetDir, 'contexts', 'governance', 'constitution.yaml');
      
      // Write file first
      await writeFile(constitutionPath, constitutionYaml, 'utf-8');
      
      // Generate checksum for the written file and add it
      const fileBuffer = await readFile(constitutionPath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      constitution.checksum = checksum;
      
      // Rewrite with checksum included
      const constitutionYamlWithChecksum = stringifyYAML(constitution);
      await writeFile(constitutionPath, constitutionYamlWithChecksum, 'utf-8');
    }
    
    // Initialize git repository
    try {
      const git = simpleGit(targetDir);
      await git.init();
      await git.add('.');
      await git.commit('Initial commit: Scaffold context repository');
    } catch (err) {
      console.warn('Failed to initialize git repository:', err);
    }
    
    return { ok: true, path: targetDir };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// Configuration and Secure Credential Storage
const APP_SETTINGS_FILE = 'app-settings.json';
const AI_CONFIG_FILE = 'ai-config.json';
const CREDENTIALS_FILE = 'ai-credentials.enc';
const REPO_REGISTRY_FILE = 'repo-registry.json';
const REGISTRY_BACKUP_PREFIX = 'repo-registry.invalid';

type RepoEntry = {
  id: string;
  label: string;
  path: string;
  createdAt: string;
  lastUsed: string;
  autoDetected?: boolean;
};

type RepoRegistry = {
  activeRepoId: string | null;
  repos: RepoEntry[];
};

const getRegistryPath = (): string => path.join(app.getPath('userData'), REPO_REGISTRY_FILE);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const sanitizeRepoEntry = (value: unknown): RepoEntry | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const idValue = value.id;
  const labelValue = value.label;
  const pathValue = value.path;
  const createdAtValue = value.createdAt;
  const lastUsedValue = value.lastUsed;
  const autoDetectedValue = value.autoDetected;

  if (typeof idValue !== 'string' || idValue.trim().length === 0) {
    return null;
  }

  if (typeof pathValue !== 'string' || pathValue.trim().length === 0) {
    return null;
  }

  const normalizeDate = (input: unknown): string => {
    if (typeof input === 'string' && !Number.isNaN(Date.parse(input))) {
      return input;
    }
    return new Date().toISOString();
  };

  const normalizedPath = pathValue;
  const normalizedLabel = typeof labelValue === 'string' && labelValue.trim().length > 0
    ? labelValue
    : path.basename(normalizedPath) || normalizedPath;
  const normalizedCreated = normalizeDate(createdAtValue);
  const normalizedLastUsed = normalizeDate(lastUsedValue);
  const normalizedAutoDetected = typeof autoDetectedValue === 'boolean' ? autoDetectedValue : undefined;

  return {
    id: idValue,
    label: normalizedLabel,
    path: normalizedPath,
    createdAt: normalizedCreated,
    lastUsed: normalizedLastUsed,
    autoDetected: normalizedAutoDetected
  };
};

const sanitizeRepoRegistry = (value: unknown): RepoRegistry | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const rawRepos = value.repos;
  if (!Array.isArray(rawRepos)) {
    return null;
  }

  const sanitizedRepos = rawRepos
    .map(sanitizeRepoEntry)
    .filter((repo): repo is RepoEntry => repo !== null);

  if (sanitizedRepos.length === 0 && rawRepos.length > 0) {
    return null;
  }

  let activeRepoId: string | null = null;
  if (typeof value.activeRepoId === 'string' && sanitizedRepos.some(repo => repo.id === value.activeRepoId)) {
    activeRepoId = value.activeRepoId;
  } else if (sanitizedRepos.length > 0) {
    activeRepoId = sanitizedRepos[0].id;
  }

  return {
    activeRepoId,
    repos: sanitizedRepos
  };
};

const quarantineCorruptRegistry = async (registryPath: string): Promise<void> => {
  try {
    if (!existsSync(registryPath)) {
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${REGISTRY_BACKUP_PREFIX}-${timestamp}.json`;
    const backupPath = path.join(path.dirname(registryPath), backupName);
    await rename(registryPath, backupPath);
    console.warn(`Repository registry was invalid and has been quarantined as ${backupName}`);
  } catch (error) {
    console.warn('Failed to quarantine invalid repository registry.', error);
  }
};

const canonicalizeRepoPath = (input: string): string => {
  const normalizedPath = path.normalize(path.resolve(input));
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;
};

const loadRepoRegistry = async (): Promise<RepoRegistry> => {
  const registryPath = getRegistryPath();
  try {
    const content = await readFile(registryPath, 'utf-8');
    const parsed = JSON.parse(content);
    const sanitized = sanitizeRepoRegistry(parsed);
    if (sanitized) {
      return sanitized;
    }
    await quarantineCorruptRegistry(registryPath);
  } catch (error: any) {
    if (error?.code && error.code !== 'ENOENT') {
      console.warn('Failed to load repository registry; falling back to defaults.', error);
    }
  }
  return { activeRepoId: null, repos: [] };
};

const saveRepoRegistry = async (registry: RepoRegistry): Promise<void> => {
  await writeFile(getRegistryPath(), JSON.stringify(registry, null, 2), 'utf-8');
};

const upsertRepoEntry = async (
  repoPath: string,
  options: { label?: string; setActive?: boolean; autoDetected?: boolean } = {}
): Promise<RepoRegistry> => {
  const normalizedPath = path.normalize(path.resolve(repoPath));
  const canonicalPath = canonicalizeRepoPath(normalizedPath);
  const registry = await loadRepoRegistry();
  const existing = registry.repos.find(entry => canonicalizeRepoPath(entry.path) === canonicalPath);
  const nowIso = new Date().toISOString();

  if (existing) {
    if (options.label && existing.label !== options.label) {
      existing.label = options.label;
    }
    if (options.autoDetected !== undefined) {
      existing.autoDetected = options.autoDetected;
    }
    if (options.setActive) {
      registry.activeRepoId = existing.id;
      existing.lastUsed = nowIso;
    }
  } else {
    const entry: RepoEntry = {
      id: randomUUID(),
      label: options.label || path.basename(normalizedPath) || normalizedPath,
      path: normalizedPath,
      createdAt: nowIso,
      lastUsed: nowIso,
      autoDetected: options.autoDetected
    };
    registry.repos.push(entry);
    if (options.setActive ?? true) {
      registry.activeRepoId = entry.id;
    }
  }

  await saveRepoRegistry(registry);
  return registry;
};

const removeRepoEntry = async (id: string): Promise<RepoRegistry> => {
  const registry = await loadRepoRegistry();
  registry.repos = registry.repos.filter(entry => entry.id !== id);
  if (registry.activeRepoId === id) {
    registry.activeRepoId = registry.repos[0]?.id ?? null;
    if (registry.activeRepoId) {
      const nextActive = registry.repos.find(entry => entry.id === registry.activeRepoId);
      if (nextActive) {
        nextActive.lastUsed = new Date().toISOString();
      }
    }
  }
  await saveRepoRegistry(registry);
  return registry;
};

const ensureRepoRegistryActivePath = async (): Promise<string | null> => {
  const registry = await loadRepoRegistry();
  const activeRepo = registry.repos.find(entry => entry.id === registry.activeRepoId);
  if (activeRepo && existsSync(activeRepo.path)) {
    return activeRepo.path;
  }

  const firstExisting = registry.repos.find(entry => existsSync(entry.path));
  if (firstExisting) {
    registry.activeRepoId = firstExisting.id;
    firstExisting.lastUsed = new Date().toISOString();
    await saveRepoRegistry(registry);
    return firstExisting.path;
  }

  return null;
};

// App Settings handlers
ipcMain.handle('settings:get', async (_event, { key }: { key: string }) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), APP_SETTINGS_FILE);
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    return { ok: true, value: settings[key] };
  } catch (error: any) {
    // Return default if file doesn't exist or key not found
    return { ok: true, value: null };
  }
});

ipcMain.handle('settings:set', async (_event, { key, value }: { key: string; value: any }) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), APP_SETTINGS_FILE);
    let settings: Record<string, any> = {};
    
    // Load existing settings if file exists
    try {
      const content = await readFile(settingsPath, 'utf-8');
      settings = JSON.parse(content);
    } catch {
      // File doesn't exist yet, use empty object
    }
    
    // Update setting
    settings[key] = value;
    
    // Save back to file
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('ai:getConfig', async (_event, { dir }: { dir: string }) => {
  try {
    const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
    const content = await readFile(configPath, 'utf-8');
    return { ok: true, config: JSON.parse(content) };
  } catch (error: any) {
    // Return default config if file doesn't exist
    return {
      ok: true,
      config: {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        enabled: false
      }
    };
  }
});

ipcMain.handle('ai:saveConfig', async (_event, { dir, config }: { dir: string; config: any }) => {
  try {
    const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
    // Never save API keys in config file
    const safeConfig = { ...config };
    delete safeConfig.apiKey;
    
    await writeFile(configPath, JSON.stringify(safeConfig, null, 2), 'utf-8');
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('ai:saveCredentials', async (_event, { provider, apiKey }: { provider: string; apiKey: string }) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: 'Encryption not available on this system' };
    }

    // Encrypt the API key
    const encrypted = safeStorage.encryptString(apiKey);
    
    // Store encrypted credentials in app data directory
    const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
    await writeFile(credPath, encrypted);
    
    return { ok: true };
  } catch (error: any) {
    console.error('Failed to save credentials (error logged without sensitive data)');
    return { ok: false, error: 'Failed to save credentials securely' };
  }
});

ipcMain.handle('ai:getCredentials', async (_event, { provider }: { provider: string }) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, error: 'Encryption not available' };
    }

    const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
    const encrypted = await readFile(credPath);
    const decrypted = safeStorage.decryptString(encrypted);
    
    // Return indicator that credentials exist, but not the actual key
    return { ok: true, hasCredentials: true };
  } catch (error: any) {
    return { ok: true, hasCredentials: false };
  }
});

ipcMain.handle('ai:testConnection', async (_event, { dir, provider, endpoint, model, useStoredKey }: 
  { dir: string; provider: string; endpoint: string; model: string; useStoredKey: boolean }) => {
  try {
    let apiKey = '';
    
    if (useStoredKey) {
      const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
      const encrypted = await readFile(credPath);
      apiKey = safeStorage.decryptString(encrypted);
    }

    // Test connection based on provider
    if (provider === 'ollama') {
      // Ollama doesn't require API key
      const response = await fetch(`${endpoint}/api/tags`);
      if (response.ok) {
        return { ok: true, message: 'Connected to Ollama successfully' };
      } else {
        return { ok: false, error: 'Failed to connect to Ollama' };
      }
    } else if (provider === 'azure-openai') {
      // Test Azure OpenAI connection
      if (!apiKey && useStoredKey) {
        return { ok: false, error: 'No API key found' };
      }
      // Azure test would go here
      return { ok: true, message: 'Azure OpenAI configuration saved' };
    }
    
    return { ok: false, error: 'Unknown provider' };
  } catch (error: any) {
    console.error('Connection test failed (error logged without sensitive data)');
    return { ok: false, error: 'Connection test failed' };
  }
});

ipcMain.handle('ai:generate', async (_event, { dir, entityType, userPrompt }:
  { dir: string; entityType: string; userPrompt: string }) => {
  try {
    const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
    let config;
    try {
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      return { ok: false, error: 'AI not configured. Please configure AI settings first.' };
    }

    if (!config.enabled) {
      return { ok: false, error: 'AI assistance is disabled' };
    }

    let apiKey = '';
    if (config.provider === 'azure-openai') {
      try {
        const credPath = path.join(app.getPath('userData'), `${config.provider}-${CREDENTIALS_FILE}`);
        const encrypted = await readFile(credPath);
        apiKey = safeStorage.decryptString(encrypted);
      } catch {
        return { ok: false, error: 'API key not found. Please configure credentials.' };
      }
    }

    const args = [
      path.join(dir, '.context', 'pipelines', 'ai-generator.mjs'),
      'generate',
      config.provider,
      config.endpoint,
      config.model,
      apiKey,
      entityType,
      userPrompt
    ];

    const result = await execa('node', args, {
      cwd: dir,
      env: {
        ...process.env,
        HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
        HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
        NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
      }
    });

    return JSON.parse(result.stdout);
  } catch (error: any) {
    console.error('AI generation failed:', error.stderr || error.stdout || error.message);
    const errorMsg = error.stdout || error.stderr || 'AI generation failed. Check configuration.';
    if (error?.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        // ignore JSON parsing errors and fall through
      }
    }
    return { ok: false, error: errorMsg };
  }
});

ipcMain.handle('ai:assist', async (_event, { dir, question, mode, focusId }:
  { dir: string; question: string; mode?: string; focusId?: string }) => {
  try {
    if (!question || !question.trim()) {
      return { ok: false, error: 'Question is required' };
    }

    const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
    let config;
    try {
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      return { ok: false, error: 'AI not configured. Please configure AI settings first.' };
    }

    if (!config.enabled) {
      return { ok: false, error: 'AI assistance is disabled' };
    }

    let apiKey = '';
    if (config.provider === 'azure-openai') {
      try {
        const credPath = path.join(app.getPath('userData'), `${config.provider}-${CREDENTIALS_FILE}`);
        const encrypted = await readFile(credPath);
        apiKey = safeStorage.decryptString(encrypted);
      } catch {
        return { ok: false, error: 'API key not found. Please configure credentials.' };
      }
    }

    const encodedQuestion = Buffer.from(question, 'utf-8').toString('base64');
    const encodedOptions = Buffer.from(JSON.stringify({ mode, focusId }), 'utf-8').toString('base64');

    const args = [
      path.join(dir, '.context', 'pipelines', 'ai-assistant.mjs'),
      config.provider,
      config.endpoint,
      config.model,
      apiKey,
      encodedQuestion,
      encodedOptions
    ];

    const result = await execa('node', args, {
      cwd: dir,
      env: {
        ...process.env,
        HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
        HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
        NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
      }
    });

    return JSON.parse(result.stdout);
  } catch (error: any) {
    console.error('AI assistant failed:', error.stderr || error.stdout || error.message);
    const errorMsg = error.stdout || error.stderr || 'AI assistant request failed. Check configuration.';
    if (error?.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        // fall through if not JSON
      }
    }
    return { ok: false, error: errorMsg };
  }
});

ipcMain.handle('ai:assistStreamStart', async (event, { dir, question, mode, focusId }:
  { dir: string; question: string; mode?: string; focusId?: string }) => {
  try {
    if (!question || !question.trim()) {
      return { ok: false, error: 'Question is required' };
    }

    const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
    let config;
    try {
      const content = await readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      return { ok: false, error: 'AI not configured. Please configure AI settings first.' };
    }

    if (!config.enabled) {
      return { ok: false, error: 'AI assistance is disabled' };
    }

    let apiKey = '';
    if (config.provider === 'azure-openai') {
      try {
        const credPath = path.join(app.getPath('userData'), `${config.provider}-${CREDENTIALS_FILE}`);
        const encrypted = await readFile(credPath);
        apiKey = safeStorage.decryptString(encrypted);
      } catch {
        return { ok: false, error: 'API key not found. Please configure credentials.' };
      }
    }

    const streamId = randomUUID();
    const encodedQuestion = Buffer.from(question, 'utf-8').toString('base64');
    const encodedOptions = Buffer.from(JSON.stringify({ mode, focusId }), 'utf-8').toString('base64');

    const args = [
      path.join(dir, '.context', 'pipelines', 'ai-assistant.mjs'),
      config.provider,
      config.endpoint,
      config.model,
      apiKey,
      encodedQuestion,
      encodedOptions,
      '--stream'
    ];

    const child = execa('node', args, {
      cwd: dir,
      env: {
        ...process.env,
        HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
        HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
        NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
      }
    });

    aiStreamProcs.set(streamId, child);

    // Stream stdout lines as JSON events
    child.stdout?.on('data', (data: Buffer | string) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const payload = JSON.parse(line);
          event.sender.send('ai:assistStream:event', { streamId, ...payload });
        } catch {
          // ignore non-JSON line
        }
      }
    });

    const cleanup = () => {
      aiStreamProcs.delete(streamId);
      event.sender.send('ai:assistStream:end', { streamId });
    };

    child.on('close', cleanup);
    child.on('exit', cleanup);
    child.on('error', (err: any) => {
      event.sender.send('ai:assistStream:event', { streamId, type: 'error', ok: false, error: err?.message || 'Stream error' });
      cleanup();
    });

    return { ok: true, streamId };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('ai:assistStreamCancel', async (_event, { streamId }: { streamId: string }) => {
  try {
    const child = aiStreamProcs.get(streamId);
    if (child) {
      child.kill('SIGTERM');
      aiStreamProcs.delete(streamId);
      return { ok: true };
    }
    return { ok: false, error: 'Stream not found' };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

ipcMain.handle('ai:applyEdit', async (_event, { dir, filePath, updatedContent, summary }:
  { dir: string; filePath: string; updatedContent: string; summary?: string }) => {
  try {
    if (!dir || !filePath) {
      return { ok: false, error: 'Repository path and file path are required.' };
    }

    const repoRoot = path.resolve(dir);
    const targetPath = path.resolve(repoRoot, filePath);

    if (!targetPath.startsWith(repoRoot)) {
      return { ok: false, error: 'Edit rejected because the target is outside the repository.' };
    }

    if (!existsSync(targetPath)) {
      return { ok: false, error: `Target file does not exist: ${filePath}` };
    }

    try {
      parseYAML(updatedContent);
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown YAML parsing error';
      const lineMatch = errorMsg.match(/at line (\d+)/);
      const columnMatch = errorMsg.match(/column (\d+)/);
      let detailedError = `Updated content is not valid YAML: ${errorMsg}`;
      
      if (lineMatch || columnMatch) {
        const line = lineMatch ? lineMatch[1] : '?';
        const column = columnMatch ? columnMatch[1] : '?';
        detailedError += ` (Line ${line}, Column ${column})`;
      }
      
      detailedError += '\n\nThe AI generated invalid YAML. Please try asking again or edit the YAML manually.';
      return { ok: false, error: detailedError };
    }

    await writeFile(targetPath, updatedContent, 'utf-8');

    // TODO: capture summary in an activity log once telemetry module is available.
    return { ok: true };
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
