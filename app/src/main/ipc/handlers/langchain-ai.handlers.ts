import { ipcMain } from 'electron';
import { toErrorMessage } from '../../utils/errorHandler';
import { LangChainAIService } from '../../services/LangChainAIService';
import { getSchemaForEntityType } from '../../schemas/entitySchemas';
import type { TestConnectionOptions } from '../../services/LangChainAIService';
import { successWith, error } from '../types';
import { randomUUID } from 'node:crypto';

const langchainService = new LangChainAIService();

// Track active streams for cancellation
const activeStreams = new Map<string, boolean>();

/**
 * Feature flag to enable/disable LangChain implementation.
 * 
 * Set via environment variable: USE_LANGCHAIN=true
 * Default: false (uses legacy AIService)
 * 
 * This allows gradual rollout and easy rollback if issues are discovered.
 */
const USE_LANGCHAIN = process.env.USE_LANGCHAIN === 'true';

/**
 * Registers all LangChain AI-related IPC handlers.
 * 
 * These handlers provide a parallel implementation to the existing AI handlers,
 * allowing for A/B testing and gradual migration. The feature flag USE_LANGCHAIN
 * determines which implementation is used.
 * 
 * Handlers:
 * - langchain:testConnection - Test provider connectivity
 * - langchain:generateEntity - Generate entity with structured output
 * - langchain:assistStreamStart - Start streaming conversation
 * - langchain:assistStreamCancel - Cancel active stream
 * - langchain:isEnabled - Check if LangChain is enabled
 * - langchain:clearCache - Clear model cache
 */
export function registerLangChainAIHandlers(): void {
  /**
   * Check if LangChain implementation is enabled
   */
  ipcMain.handle('langchain:isEnabled', async () => {
    try {
      return successWith({ enabled: USE_LANGCHAIN });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  /**
   * Test connection to AI provider
   */
  ipcMain.handle('langchain:testConnection', async (_event, payload: TestConnectionOptions) => {
    try {
      const message = await langchainService.testConnection(payload);
      return successWith({ message });
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      console.error('LangChain connection test failed:', detail);
      return error(toErrorMessage(err, 'Connection test failed'));
    }
  });

  /**
   * Generate entity with structured output validation
   * 
   * Uses Zod schemas to guarantee valid entity generation.
   * Automatically retries if AI generates invalid output.
   */
  ipcMain.handle('langchain:generateEntity', async (_event, { dir, entityType, userPrompt, apiKey }:
    { dir: string; entityType: string; userPrompt: string; apiKey?: string }) => {
    try {
      // Get AI config (reusing existing config loading logic)
      const { AIService } = await import('../../services/AIService');
      const legacyService = new AIService();
      const config = await legacyService.getConfig(dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Add API key if provided (for providers that need it)
      if (apiKey) {
        config.apiKey = apiKey;
      }

      // Get appropriate schema for entity type
      const schema = getSchemaForEntityType(entityType);

      // Generate entity using LangChain
      const entity = await langchainService.generateEntity({
        config: {
          ...config,
          apiKey: (config.apiKey as string | undefined) || apiKey
        },
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
      console.error('LangChain entity generation failed:', message);
      return error(toErrorMessage(err, 'Entity generation failed'));
    }
  });

  /**
   * Start streaming AI assistance
   * 
   * Streams responses token-by-token using LangChain's built-in streaming.
   * Handles conversation history automatically.
   */
  ipcMain.handle('langchain:assistStreamStart', async (event, { dir, question, conversationHistory, contextSnapshot }:
    { dir: string; question: string; conversationHistory?: Array<{ role: string; content: string }>; contextSnapshot?: any }) => {
    try {
      // Get AI config
      const { AIService } = await import('../../services/AIService');
      const legacyService = new AIService();
      const config = await legacyService.getConfig(dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Get credentials if needed
      if (config.provider === 'azure-openai') {
        if (await legacyService.hasCredentials(config.provider)) {
          // Note: For security, we can't directly access credentials from legacy service
          // This is a limitation that needs to be addressed in production
          // For now, assume API key is in config
        }
      }

      const streamId = randomUUID();
      activeStreams.set(streamId, true);

      // Start streaming in background
      void (async () => {
        try {
          const stream = langchainService.assistStream({
            config,
            question,
            conversationHistory: conversationHistory || [],
            contextSnapshot: contextSnapshot || {}
          });

          for await (const token of stream) {
            // Check if stream was cancelled
            if (!activeStreams.get(streamId)) {
              break;
            }

            // Send token to renderer
            event.sender.send('langchain:assistStream:token', {
              streamId,
              token,
              type: 'token'
            });
          }

          // Stream completed
          event.sender.send('langchain:assistStream:end', { streamId });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Streaming failed';
          event.sender.send('langchain:assistStream:error', {
            streamId,
            error: message
          });
        } finally {
          activeStreams.delete(streamId);
        }
      })();

      return successWith({ streamId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start stream';
      console.error('LangChain stream start failed:', message);
      return error(message);
    }
  });

  /**
   * Cancel an active streaming session
   */
  ipcMain.handle('langchain:assistStreamCancel', async (_event, { streamId }: { streamId: string }) => {
    try {
      if (activeStreams.has(streamId)) {
        activeStreams.delete(streamId);
        return successWith({ cancelled: true });
      }
      return error('Stream not found');
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  /**
   * Clear cached models
   * 
   * Useful when switching configurations or for testing.
   */
  ipcMain.handle('langchain:clearCache', async () => {
    try {
      langchainService.clearCache();
      return successWith({ cleared: true });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });
}

/**
 * Get current feature flag status
 */
export function isLangChainEnabled(): boolean {
  return USE_LANGCHAIN;
}
