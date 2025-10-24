import { app, BrowserWindow, ipcMain, clipboard, safeStorage } from 'electron';
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
      behind: status.behind || 0
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
          const content = await readFile(path.join(dir, filePath), 'utf-8');
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
      cwd: projectRoot,
      shell: true
    });
    
    return { ok: true, url: result.stdout };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
});

// Context Builder handlers
ipcMain.handle('context:nextId', async (_event, { dir, entityType }: { dir: string; entityType: string }) => {
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

ipcMain.handle('context:createEntity', async (_event, { dir, entity, entityType }: { dir: string; entity: any; entityType: string }) => {
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
    const args = [path.join(dir, '.context', 'pipelines', 'context-builder.mjs'), command, ...params];
    const result = await execa('node', args, {
      cwd: dir,
      shell: true
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

// AI Configuration and Secure Credential Storage
const AI_CONFIG_FILE = 'ai-config.json';
const CREDENTIALS_FILE = 'ai-credentials.enc';

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
    // Load AI config
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

    // Get API key if needed
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

    // Call AI generator pipeline
    const args = [
      path.join(dir, '.context', 'pipelines', 'ai-generator.mjs'),
      'generate',
      config.provider,
      config.endpoint,
      config.model,
      apiKey, // Will be empty for ollama
      entityType,
      userPrompt
    ];

    const result = await execa('node', args, {
      cwd: dir,
      shell: true
    });

    return JSON.parse(result.stdout);
  } catch (error: any) {
    console.error('AI generation failed (error logged without sensitive data)');
    return { ok: false, error: 'AI generation failed. Check configuration.' };
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
