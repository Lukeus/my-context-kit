import { ipcMain } from 'electron';
import { toErrorMessage } from '../../utils/errorHandler';
import { AIService } from '../../services/AIService';
import type { WritableAIConfig, TestConnectionOptions } from '../../services/AIService';
import { successWith, error } from '../types';

const aiService = new AIService();

/**
 * Registers all AI-related IPC handlers
 */
export function registerAIHandlers(): void {
  // AI Configuration
  ipcMain.handle('ai:getConfig', async (_event, { dir }: { dir: string }) => {
    try {
      const config = await aiService.getConfig(dir);
      return successWith({ config });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('ai:saveConfig', async (_event, { dir, config }: { dir: string; config: WritableAIConfig }) => {
    try {
      await aiService.saveConfig(dir, config);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // Credentials Management
  ipcMain.handle('ai:saveCredentials', async (_event, { provider, apiKey }: { provider: string; apiKey: string }) => {
    try {
      await aiService.saveCredentials(provider, apiKey);
      return successWith({});
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to save credentials (error logged without sensitive data)', detail);
      return error('Failed to save credentials securely');
    }
  });

  ipcMain.handle('ai:getCredentials', async (_event, { provider }: { provider: string }) => {
    try {
      const hasCredentials = await aiService.hasCredentials(provider);
      return successWith({ hasCredentials });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // Connection Testing
  ipcMain.handle('ai:testConnection', async (_event, payload: TestConnectionOptions) => {
    try {
      const message = await aiService.testConnection(payload);
      return successWith({ message });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      console.error('Connection test failed (error logged without sensitive data)', detail);
      return error(toErrorMessage(err, 'Connection test failed'));
    }
  });

  // AI Generation
  ipcMain.handle('ai:generate', async (_event, { dir, entityType, userPrompt }:
    { dir: string; entityType: string; userPrompt: string }) => {
    try {
      return await aiService.generate({ dir, entityType, userPrompt });
    } catch (err: unknown) {
      const execError = err as { stdout?: string; stderr?: string; message?: string };
      const diagnostic = execError.stderr ?? execError.stdout ?? execError.message ?? 'Unknown error';
      console.error('AI generation failed:', diagnostic);
      const errorMsg = execError.stdout || execError.stderr || execError.message || 'AI generation failed. Check configuration.';
      if (execError.stdout) {
        try {
          return JSON.parse(execError.stdout);
        } catch {
          // ignore JSON parsing errors and fall through
        }
      }
      return error(errorMsg);
    }
  });

  // AI Assistance (non-streaming)
  ipcMain.handle('ai:assist', async (_event, { dir, question, mode, focusId }:
    { dir: string; question: string; mode?: string; focusId?: string }) => {
    try {
      return await aiService.assist({ dir, question, mode, focusId });
    } catch (err: unknown) {
      const execError = err as { stdout?: string; stderr?: string; message?: string };
      const diagnostic = execError.stderr ?? execError.stdout ?? execError.message ?? 'Unknown error';
      console.error('AI assistant failed:', diagnostic);
      const errorMsg = execError.stdout || execError.stderr || execError.message || 'AI assistant request failed. Check configuration.';
      if (execError.stdout) {
        try {
          return JSON.parse(execError.stdout);
        } catch {
          // fall through if not JSON
        }
      }
      return error(errorMsg);
    }
  });

  // AI Assistance (streaming)
  ipcMain.handle('ai:assistStreamStart', async (event, { dir, question, mode, focusId }:
    { dir: string; question: string; mode?: string; focusId?: string }) => {
    try {
      const streamId = await aiService.startAssistStream({
        dir,
        question,
        mode,
        focusId,
        onData: (data: any) => {
          event.sender.send('ai:assistStream:event', data);
        },
        onEnd: () => {
          event.sender.send('ai:assistStream:end', { streamId });
        },
        onError: (error: string) => {
          event.sender.send('ai:assistStream:event', { streamId, type: 'error', ok: false, error });
        }
      });

      return successWith({ streamId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start AI assistance stream';
      return error(message);
    }
  });

  ipcMain.handle('ai:assistStreamCancel', async (_event, { streamId }: { streamId: string }) => {
    try {
      await aiService.cancelAssistStream(streamId);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // Apply AI Edits
  ipcMain.handle('ai:applyEdit', async (_event, { dir, filePath, updatedContent, summary }:
    { dir: string; filePath: string; updatedContent: string; summary?: string }) => {
    try {
      await aiService.applyEdit({ dir, filePath, updatedContent, summary });
      return successWith({});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply AI edit';
      return error(message);
    }
  });
}
