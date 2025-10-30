import { ipcMain, app, safeStorage } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { toErrorMessage } from '../../utils/errorHandler';
import { LangChainAIService } from '../../services/LangChainAIService';
import type { WritableAIConfig, TestConnectionOptions } from '../../services/LangChainAIService';
import { getSchemaForEntityType } from '../../schemas/entitySchemas';
import { successWith, error } from '../types';
import { randomUUID } from 'node:crypto';

const aiService = new LangChainAIService();

/**
 * Registers all AI-related IPC handlers.
 * 
 * Now uses LangChainAIService as the single unified AI service.
 * All AI operations (config, credentials, generation, streaming) go through
 * the LangChain-powered implementation for consistency and maintainability.
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

  // Non-sensitive credentials diagnostic info (file exists, size, safeStorage availability)
  ipcMain.handle('ai:credentialsInfo', async (_event, { provider }: { provider: string }) => {
    try {
      const safeAvailable = safeStorage.isEncryptionAvailable();
      const credPath = path.join(app.getPath('userData'), `${provider}-credentials.enc`);
      const exists = existsSync(credPath);
      let size = 0;
      if (exists) {
        const stat = await (await import('node:fs/promises')).stat(credPath);
        size = stat.size;
      }
      return successWith({ safeAvailable, exists, credPath, size });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // Connection Testing
  ipcMain.handle('ai:testConnection', async (_event, payload: TestConnectionOptions) => {
    try {
      // Use LangChainAIService for connection testing
      const message = await aiService.testConnection(payload);
      return successWith({ message });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      console.error('Connection test failed:', detail);
      return error(toErrorMessage(err, 'Connection test failed'));
    }
  });

  // AI Generation (using LangChain structured outputs)
  ipcMain.handle('ai:generate', async (_event, { dir, entityType, userPrompt }:
    { dir: string; entityType: string; userPrompt: string }) => {
    try {
      // Get AI config
      const config = await aiService.getConfig(dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Get appropriate schema for entity type
      const schema = getSchemaForEntityType(entityType);

      // Generate entity using LangChain with structured output validation
      const entity = await aiService.generateEntity({
        config,
        entityType,
        userPrompt,
        schema
      });

      return successWith({ 
        ok: true, 
        entity,
        message: 'Entity generated successfully'
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('AI generation failed:', message);
      return error(toErrorMessage(err, 'Entity generation failed'));
    }
  });

  // AI Assistance (non-streaming) - Deprecated in favor of streaming
  // Kept for backward compatibility but not recommended for new code
  ipcMain.handle('ai:assist', async (_event, { dir, question }:
    { dir: string; question: string; mode?: string; focusId?: string }) => {
    try {
      const config = await aiService.getConfig(dir);
      
      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Collect all tokens into a single response
      let fullResponse = '';
      for await (const token of aiService.assistStream({
        config,
        question,
        conversationHistory: [],
        contextSnapshot: {}
      })) {
        fullResponse += token;
      }

      return successWith({ ok: true, answer: fullResponse });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('AI assistant failed:', message);
      return error(toErrorMessage(err, 'AI assistance failed'));
    }
  });

  // Track active streams for cancellation
  const activeStreams = new Map<string, boolean>();

  // AI Assistance (streaming) - Now using LangChain streaming
  ipcMain.handle('ai:assistStreamStart', async (event, { dir, question, conversationHistory, contextSnapshot }:
    { dir: string; question: string; conversationHistory?: Array<{ role: string; content: string }>; contextSnapshot?: unknown }) => {
    try {
      const config = await aiService.getConfig(dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      const streamId = randomUUID();
      activeStreams.set(streamId, true);

      // Start streaming in background
      void (async () => {
        try {
          for await (const token of aiService.assistStream({
            config,
            question,
            conversationHistory: conversationHistory || [],
            contextSnapshot: contextSnapshot || {}
          })) {
            // Check if stream was cancelled
            if (!activeStreams.has(streamId)) {
              break;
            }

            // Send token to renderer
            event.sender.send('ai:assistStream:event', {
              streamId,
              type: 'token',
              token
            });
          }

          // Stream completed successfully
          if (activeStreams.has(streamId)) {
            event.sender.send('ai:assistStream:end', { streamId });
            activeStreams.delete(streamId);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Streaming failed';
          event.sender.send('ai:assistStream:event', {
            streamId,
            type: 'error',
            ok: false,
            error: message
          });
          activeStreams.delete(streamId);
        }
      })();

      return successWith({ streamId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start AI assistance stream';
      return error(message);
    }
  });

  ipcMain.handle('ai:assistStreamCancel', async (_event, { streamId }: { streamId: string }) => {
    try {
      // Simply mark stream as cancelled - the async loop will check and stop
      if (activeStreams.has(streamId)) {
        activeStreams.delete(streamId);
      }
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // Per-Provider Configuration Management
  ipcMain.handle('ai:getProviderConfigs', async (_event, { dir }: { dir: string }) => {
    try {
      const configs = await aiService.getProviderConfigs(dir);
      return successWith({ configs });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  ipcMain.handle('ai:saveProviderConfig', async (_event, { dir, provider, config }:
    { dir: string; provider: string; config: { endpoint: string; model: string } }) => {
    try {
      await aiService.saveProviderConfig(dir, provider, config);
      return successWith({});
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // Apply AI Edits - Kept for backward compatibility
  // This method validates and writes YAML files (no AI invocation)
  ipcMain.handle('ai:applyEdit', async (_event, { dir, filePath, updatedContent }:
    { dir: string; filePath: string; updatedContent: string; summary?: string }) => {
    try {
      // Import necessary modules
      const { writeFile } = await import('node:fs/promises');
      const { parse: parseYAML } = await import('yaml');

      if (!dir || !filePath) {
        return error('Repository path and file path are required');
      }

      const repoRoot = path.resolve(dir);
      const targetPath = path.resolve(repoRoot, filePath);

      // Security: Prevent path traversal
      if (!targetPath.startsWith(repoRoot)) {
        return error('Edit rejected: target is outside the repository');
      }

      // Validate YAML syntax before writing
      try {
        parseYAML(updatedContent);
      } catch (yamlErr: unknown) {
        const errorMsg = yamlErr instanceof Error ? yamlErr.message : 'Unknown YAML parsing error';
        return error(`Invalid YAML: ${errorMsg}`);
      }

      // Write file atomically - if file doesn't exist, writeFile will fail with ENOENT
      // This eliminates TOCTOU race condition by letting the OS handle the check+write atomically
      try {
        await writeFile(targetPath, updatedContent, { encoding: 'utf-8', flag: 'w' });
      } catch (writeErr: unknown) {
        if (writeErr instanceof Error && 'code' in writeErr && writeErr.code === 'ENOENT') {
          return error(`Target file does not exist: ${filePath}`);
        }
        throw writeErr;
      }
      return successWith({});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply edit';
      return error(message);
    }
  });
}
