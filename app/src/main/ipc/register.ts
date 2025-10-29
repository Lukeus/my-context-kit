import { registerContextHandlers } from './handlers/context.handlers';
import { registerGitHandlers } from './handlers/git.handlers';
import { registerFileSystemHandlers } from './handlers/filesystem.handlers';
import { registerRepoHandlers } from './handlers/repo.handlers';
import { registerBuilderHandlers } from './handlers/builder.handlers';
import { registerSettingsHandlers } from './handlers/settings.handlers';
import { registerClipboardHandlers } from './handlers/clipboard.handlers';
import { registerDialogHandlers } from './handlers/dialog.handlers';
import { registerAIHandlers } from './handlers/ai.handlers';
import { registerSpeckitHandlers } from './handlers/speckit.handlers';
import { registerC4Handlers } from './handlers/c4.handlers';
import { registerAssistantHandlers } from './handlers/assistant.handlers';

/**
 * Registers all IPC handlers for the application
 * 
 * This is called once during app initialization to set up
 * all communication channels between main and renderer processes.
 */
export function registerAllHandlers(): void {
  // Core context operations
  registerContextHandlers();
  
  // Git operations
  registerGitHandlers();
  
  // File system operations
  registerFileSystemHandlers();
  
  // Repository registry handlers
  registerRepoHandlers();
  
  // Context builder operations
  registerBuilderHandlers();
  
  // Application settings
  registerSettingsHandlers();
  
  // Clipboard operations
  registerClipboardHandlers();
  
  // Native dialog operations
  registerDialogHandlers();
  
  // AI operations
  registerAIHandlers();

  // Assistant safe tooling operations
  registerAssistantHandlers();
  
  // Speckit (SDD workflow) operations
  registerSpeckitHandlers();
  
  // C4 diagram operations
  registerC4Handlers();
}
