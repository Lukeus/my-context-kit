# P0 Refactoring Quick Reference

## 📁 New File Structure

```
app/src/main/
├── index.ts (REFACTOR THIS - reduce to ~80 lines)
├── preload.ts (unchanged)
├── errors/
│   └── AppError.ts ✅ (8 error classes)
├── utils/
│   └── errorHandler.ts ✅ (error utilities)
├── services/
│   ├── ContextService.ts ✅ (context operations)
│   ├── GitService.ts ✅ (git operations)
│   ├── FileSystemService.ts ✅ (file operations)
│   ├── RepoRegistryService.ts ❌ TODO
│   ├── AIService.ts ❌ TODO
│   ├── SpeckitService.ts ❌ TODO
│   └── ContextBuilderService.ts ❌ TODO
└── ipc/
    ├── register.ts ✅ (handler registration)
    └── handlers/
        ├── context.handlers.ts ✅ (6 handlers)
        ├── git.handlers.ts ✅ (8 handlers)
        ├── filesystem.handlers.ts ✅ (4 handlers)
        ├── utility.handlers.ts ✅ (4 handlers)
        ├── repo.handlers.ts ❌ TODO (8 handlers)
        ├── ai.handlers.ts ❌ TODO (10 handlers)
        ├── speckit.handlers.ts ❌ TODO (7 handlers)
        └── builder.handlers.ts ❌ TODO (3 handlers)
```

## ✅ What's Done (50%)

- Error handling infrastructure
- 3 services (Context, Git, FileSystem)
- 4 handler files (22 handlers total)
- Registration system
- Documentation

## ❌ What's Left (50%)

- 4 more services (optional but recommended)
- 4 more handler files (28 handlers total)
- Refactor `index.ts` to ~80 lines
- Testing and validation

## 🚀 Fast Track Completion (4-6 hours)

### 1. Create Handler Files (3-4 hours)

Copy this template for each handler file:

```typescript
// app/src/main/ipc/handlers/DOMAIN.handlers.ts
import { ipcMain } from 'electron';
import { toErrorMessage } from '../../utils/errorHandler';
// Import any needed services or utilities

export function registerDOMAINHandlers(): void {
  ipcMain.handle('domain:operation', async (_event, payload) => {
    try {
      // Copy business logic from index.ts here
      const result = await doSomething(payload);
      return { ok: true, ...result };
    } catch (error: unknown) {
      return { ok: false, error: toErrorMessage(error) };
    }
  });
  
  // Add more handlers...
}
```

**Create these files:**
1. `repo.handlers.ts` - Copy all `repos:*` and `app:getDefaultRepoPath` handlers
2. `ai.handlers.ts` - Copy all `ai:*` handlers  
3. `speckit.handlers.ts` - Copy all `speckit:*` handlers
4. `builder.handlers.ts` - Copy `context:getSuggestions`, `context:getTemplates`, `context:scaffoldNewRepo`

### 2. Update Registration (10 minutes)

Edit `app/src/main/ipc/register.ts`:

```typescript
import { registerContextHandlers } from './handlers/context.handlers';
import { registerGitHandlers } from './handlers/git.handlers';
import { registerFileSystemHandlers } from './handlers/filesystem.handlers';
import { registerUtilityHandlers } from './handlers/utility.handlers';
import { registerRepoHandlers } from './handlers/repo.handlers';
import { registerAIHandlers } from './handlers/ai.handlers';
import { registerSpeckitHandlers } from './handlers/speckit.handlers';
import { registerBuilderHandlers } from './handlers/builder.handlers';

export function registerAllHandlers(): void {
  registerContextHandlers();
  registerGitHandlers();
  registerFileSystemHandlers();
  registerUtilityHandlers();
  registerRepoHandlers();
  registerAIHandlers();
  registerSpeckitHandlers();
  registerBuilderHandlers();
}
```

### 3. Refactor index.ts (30 minutes)

**Backup first:**
```powershell
cp app/src/main/index.ts app/src/main/index.backup.ts
```

**Replace with this template:**

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import started from 'electron-squirrel-startup';
import { registerAllHandlers } from './ipc/register';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
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

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register all IPC handlers
registerAllHandlers();

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
```

### 4. Test (1-2 hours)

```powershell
cd app

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Start app
pnpm start

# Manual testing...

# E2E tests
pnpm test:e2e
```

## 📝 Checklist

- [ ] Created `repo.handlers.ts`
- [ ] Created `ai.handlers.ts`
- [ ] Created `speckit.handlers.ts`
- [ ] Created `builder.handlers.ts`
- [ ] Updated `register.ts` with all handlers
- [ ] Refactored `index.ts` to ~80 lines
- [ ] Type check passes
- [ ] Lint passes
- [ ] App starts without errors
- [ ] Can open repository
- [ ] Can validate repository
- [ ] Can view git status
- [ ] Can create entities
- [ ] AI features work (if used)
- [ ] E2E tests pass

## 🆘 If Something Breaks

1. **Check handler registration**: Did you add to `register.ts`?
2. **Check imports**: Are all imports correct?
3. **Check payload destructuring**: Did you destructure parameters correctly?
4. **Compare with working handlers**: Look at `git.handlers.ts` or `context.handlers.ts`
5. **Restore backup**: `cp app/src/main/index.backup.ts app/src/main/index.ts`

## 💡 Pro Tips

1. **Copy helpers/utilities too**: If handlers use helper functions from `index.ts`, copy those to the handler file
2. **Keep same structure**: Don't change how handlers work, just move them
3. **Test incrementally**: After creating each handler file, update register.ts and test
4. **Use git commits**: Commit after each successful handler file

## 📊 Before & After

**Before**: `index.ts` = 2,082 lines
**After**: 
- `index.ts` = ~80 lines (96% reduction!)
- `services/` = ~1,200 lines (organized, testable)
- `ipc/handlers/` = ~500 lines (organized by domain)
- `errors/` + `utils/` = ~236 lines (infrastructure)

**Total**: Same functionality, MUCH better organization!

## 🎯 Success!

When your `index.ts` looks like the template above (~80 lines) and all tests pass, you're done with P0! 🎉

Congrats on dramatically improving your codebase architecture!
