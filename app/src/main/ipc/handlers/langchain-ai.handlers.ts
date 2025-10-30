import { ipcMain, app } from 'electron';
import { toErrorMessage } from '../../utils/errorHandler';
import { LangChainAIService } from '../../services/LangChainAIService';
import { AICredentialResolver } from '../../services/AICredentialResolver';
import { EnhancedLangChainService } from '../../services/EnhancedLangChainService';
import { getSchemaForEntityType } from '../../schemas/entitySchemas';
import type { TestConnectionOptions } from '../../services/LangChainAIService';
import { successWith, error } from '../types';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../utils/logger';

const langchainService = new LangChainAIService();
const enhancedService = new EnhancedLangChainService();
const credentialResolver = new AICredentialResolver();

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
      // Allow LangChain to be enabled either via environment variable or via persisted app setting
      const envEnabled = USE_LANGCHAIN;

      // Read persisted app settings using safe loader which will back up and repair malformed JSON
      const settingsPath = path.join(app.getPath('userData'), 'app-settings.json');
      let prefEnabled = false;
      try {
        const parsed = await loadOrRepairSettings(settingsPath);
        if (parsed !== null && parsed['langchain.enabled'] === true) prefEnabled = true;
      } catch (err) {
        // loader logs its own diagnostics; assume false
        logger.debug({ service: 'langchain.handlers', method: 'isEnabled' }, `Could not load/repair app settings: ${err instanceof Error ? err.message : String(err)}`);
      }

      const enabled = Boolean(envEnabled || prefEnabled);
      return successWith({ enabled });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  /**
   * Test connection to AI provider
   */
  ipcMain.handle('langchain:testConnection', async (_event, payload: TestConnectionOptions) => {
    try {
      // Resolve API key using unified resolver if not provided
      if (!payload.apiKey) {
        const resolvedKey = await credentialResolver.resolveApiKey({
          provider: payload.provider,
          useStoredCredentials: true,
          useEnvironmentVars: true
        });
        if (resolvedKey) {
          payload.apiKey = resolvedKey;
        }
      }

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
      // Get AI config using unified service
      const config = await langchainService.getConfig(dir);

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
    { dir: string; question: string; conversationHistory?: Array<{ role: string; content: string }>; contextSnapshot?: unknown }) => {
    try {
      // Get AI config using unified service
      const config = await langchainService.getConfig(dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Resolve credentials using unified resolver and inject into config
      if (config.provider === 'azure-openai') {
        logger.debug(
          { service: 'langchain.handlers', method: 'assistStreamStart' },
          `Resolving credentials - has config.apiKey: ${!!config.apiKey}`
        );
        
        const apiKey = await credentialResolver.resolveApiKey({
          provider: config.provider,
          explicitKey: config.apiKey as string | undefined,
          useStoredCredentials: true,
          useEnvironmentVars: true
        });

        logger.debug(
          { service: 'langchain.handlers', method: 'assistStreamStart' },
          `Credential resolution result: ${apiKey ? 'Found (length: ' + apiKey.length + ')' : 'Not found'}`
        );

        if (!apiKey) {
          const msg = 'No API key found for provider azure-openai. Please save credentials in Settings or set OPENAI_API_KEY/AZURE_OPENAI_KEY.';
          logger.warn({ service: 'langchain.handlers', method: 'assistStreamStart' }, msg);
          return error(msg);
        }

        // Inject resolved key into config
        (config as any).apiKey = apiKey;
        logger.debug(
          { service: 'langchain.handlers', method: 'assistStreamStart' },
          `Injected API key into config - now has config.apiKey: ${!!config.apiKey}`
        );
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
      // If stream not present, treat as already-cancelled to make cancel idempotent
      return successWith({ cancelled: true, alreadyAbsent: true });
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
      enhancedService.clearCache();
      return successWith({ cleared: true });
    } catch (err: unknown) {
      return error(toErrorMessage(err));
    }
  });

  // ============================================================================
  // Enhanced LangChain Features
  // ============================================================================

  /**
   * 1. Context-Aware Entity Generation
   * Generate entities with full awareness of the context repository
   */
  ipcMain.handle('langchain:generateContextAware', async (_event, payload: {
    dir: string;
    entityType: 'feature' | 'userstory' | 'spec' | 'task';
    userPrompt: string;
    linkedFeatureId?: string;
  }) => {
    try {
      const config = await langchainService.getConfig(payload.dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Resolve credentials
      if (config.provider === 'azure-openai') {
        const apiKey = await credentialResolver.resolveApiKey({
          provider: config.provider,
          explicitKey: config.apiKey as string | undefined,
          useStoredCredentials: true,
          useEnvironmentVars: true
        });

        if (!apiKey) {
          return error('No API key found for Azure OpenAI');
        }

        (config as any).apiKey = apiKey;
      }

      const entity = await enhancedService.generateContextAwareEntity({
        config,
        entityType: payload.entityType,
        userPrompt: payload.userPrompt,
        linkedFeatureId: payload.linkedFeatureId,
        repoPath: payload.dir
      });

      return successWith({ entity });
    } catch (err: unknown) {
      logger.error(
        { service: 'langchain.handlers', method: 'generateContextAware' },
        err instanceof Error ? err : new Error(String(err))
      );
      return error(toErrorMessage(err, 'Context-aware generation failed'));
    }
  });

  /**
   * 2. Intelligent Impact Analysis
   * Analyze the impact of proposed changes with AI explanation
   */
  ipcMain.handle('langchain:analyzeImpact', async (_event, payload: {
    dir: string;
    entityId: string;
    proposedChange: string;
  }) => {
    try {
      const config = await langchainService.getConfig(payload.dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Resolve credentials
      if (config.provider === 'azure-openai') {
        const apiKey = await credentialResolver.resolveApiKey({
          provider: config.provider,
          explicitKey: config.apiKey as string | undefined,
          useStoredCredentials: true,
          useEnvironmentVars: true
        });

        if (!apiKey) {
          return error('No API key found for Azure OpenAI');
        }

        (config as any).apiKey = apiKey;
      }

      const analysis = await enhancedService.analyzeImpact({
        config,
        entityId: payload.entityId,
        proposedChange: payload.proposedChange,
        repoPath: payload.dir
      });

      return successWith({ analysis });
    } catch (err: unknown) {
      logger.error(
        { service: 'langchain.handlers', method: 'analyzeImpact' },
        err instanceof Error ? err : new Error(String(err))
      );
      return error(toErrorMessage(err, 'Impact analysis failed'));
    }
  });

  /**
   * 3. Conversational Validation
   * Refine invalid YAML through conversational iteration
   */
  ipcMain.handle('langchain:refineYaml', async (_event, payload: {
    dir: string;
    yamlContent: string;
    entityType: string;
    schemaErrors: Array<{ path: string; message: string }>;
    conversationHistory: Array<{ role: string; content: string }>;
  }) => {
    try {
      const config = await langchainService.getConfig(payload.dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Resolve credentials
      if (config.provider === 'azure-openai') {
        const apiKey = await credentialResolver.resolveApiKey({
          provider: config.provider,
          explicitKey: config.apiKey as string | undefined,
          useStoredCredentials: true,
          useEnvironmentVars: true
        });

        if (!apiKey) {
          return error('No API key found for Azure OpenAI');
        }

        (config as any).apiKey = apiKey;
      }

      const refinement = await enhancedService.refineEntityConversationally({
        config,
        yamlContent: payload.yamlContent,
        entityType: payload.entityType,
        schemaErrors: payload.schemaErrors,
        conversationHistory: payload.conversationHistory,
        repoPath: payload.dir
      });

      return successWith({ refinement });
    } catch (err: unknown) {
      logger.error(
        { service: 'langchain.handlers', method: 'refineYaml' },
        err instanceof Error ? err : new Error(String(err))
      );
      return error(toErrorMessage(err, 'YAML refinement failed'));
    }
  });

  /**
   * 4. Semantic Search
   * Search entities semantically using vector embeddings
   */
  ipcMain.handle('langchain:semanticSearch', async (_event, payload: {
    dir: string;
    query: string;
    entityTypes?: string[];
    limit?: number;
  }) => {
    try {
      const config = await langchainService.getConfig(payload.dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Resolve credentials
      if (config.provider === 'azure-openai') {
        const apiKey = await credentialResolver.resolveApiKey({
          provider: config.provider,
          explicitKey: config.apiKey as string | undefined,
          useStoredCredentials: true,
          useEnvironmentVars: true
        });

        if (!apiKey) {
          return error('No API key found for Azure OpenAI');
        }

        (config as any).apiKey = apiKey;
      }

      const searchResults = await enhancedService.semanticSearch({
        config,
        query: payload.query,
        entityTypes: payload.entityTypes,
        limit: payload.limit,
        repoPath: payload.dir
      });

      return successWith({ results: searchResults.results });
    } catch (err: unknown) {
      logger.error(
        { service: 'langchain.handlers', method: 'semanticSearch' },
        err instanceof Error ? err : new Error(String(err))
      );
      return error(toErrorMessage(err, 'Semantic search failed'));
    }
  });

  /**
   * 5. Multi-Agent Orchestration
   * Execute complex workflows with agent-based planning
   */
  ipcMain.handle('langchain:executeWorkflow', async (_event, payload: {
    dir: string;
    instruction: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }) => {
    try {
      const config = await langchainService.getConfig(payload.dir);

      if (!config.enabled) {
        return error('AI assistance is disabled in configuration');
      }

      // Resolve credentials
      if (config.provider === 'azure-openai') {
        const apiKey = await credentialResolver.resolveApiKey({
          provider: config.provider,
          explicitKey: config.apiKey as string | undefined,
          useStoredCredentials: true,
          useEnvironmentVars: true
        });

        if (!apiKey) {
          return error('No API key found for Azure OpenAI');
        }

        (config as any).apiKey = apiKey;
      }

      const workflowResult = await enhancedService.executeMultiAgentWorkflow({
        config,
        instruction: payload.instruction,
        repoPath: payload.dir,
        conversationHistory: payload.conversationHistory
      });

      return successWith({ workflow: workflowResult });
    } catch (err: unknown) {
      logger.error(
        { service: 'langchain.handlers', method: 'executeWorkflow' },
        err instanceof Error ? err : new Error(String(err))
      );
      return error(toErrorMessage(err, 'Workflow execution failed'));
    }
  });
}

/**
 * Get current feature flag status
 */
export function isLangChainEnabled(): boolean {
  return USE_LANGCHAIN;
}

/**
 * Load app settings JSON, backing up and attempting simple repair if parsing fails.
 * - If file doesn't exist, returns {}.
 * - If JSON.parse fails, moves the broken file to a timestamped .bak and attempts a
 *   best-effort repair by extracting top-level key-value pairs using a tolerant regexp.
 *   If repair succeeds, writes repaired JSON back to settingsPath and returns it.
 */
async function loadOrRepairSettings(settingsPath: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(settingsPath, 'utf-8');
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      // Backup the broken file (parseErr unused)
      try {
        const bakPath = `${settingsPath}.broken.${Date.now()}`;
        await rename(settingsPath, bakPath);
        logger.warn({ service: 'langchain.handlers', method: 'loadOrRepairSettings' }, `Backed up broken settings to ${bakPath}`);
      } catch (bakErr) {
        logger.warn({ service: 'langchain.handlers', method: 'loadOrRepairSettings' }, `Failed to backup broken settings: ${bakErr instanceof Error ? bakErr.message : String(bakErr)}`);
      }

      // Attempt a simple repair: find top-level key: value pairs and rebuild JSON
      const repaired: Record<string, unknown> = {};
      try {
        // Match lines like "key": <value>, allowing trailing commas and unescaped paths
        const kvRegex = /"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*"|true|false|null|\[.*?\]|\{.*?\}|-?\d+(?:\.\d+)?)/gs;
        let match;
        while ((match = kvRegex.exec(content)) !== null) {
          const k = match[1];
          const raw = match[2];
          // If raw is a quoted string, unquote and unescape backslashes
          if (raw.startsWith('"') && raw.endsWith('"')) {
            try { repaired[k] = JSON.parse(raw); } catch { repaired[k] = raw.slice(1, -1).replace(/\\\\/g, "\\"); }
          } else if (raw === 'true' || raw === 'false') {
            repaired[k] = raw === 'true';
          } else if (raw === 'null') {
            repaired[k] = null;
          } else {
            // try parse numbers/arrays/objects
            try { repaired[k] = JSON.parse(raw); } catch { repaired[k] = raw; }
          }
        }
      } catch (reErr) {
        logger.warn({ service: 'langchain.handlers', method: 'loadOrRepairSettings' }, `Repair attempt failed: ${reErr instanceof Error ? reErr.message : String(reErr)}`);
      }

      // Write repaired file if we captured any keys
      if (Object.keys(repaired).length > 0) {
        try {
          await writeFile(settingsPath, JSON.stringify(repaired, null, 2), 'utf-8');
          logger.info({ service: 'langchain.handlers', method: 'loadOrRepairSettings' }, `Wrote repaired settings to ${settingsPath}`);
          return repaired;
        } catch (werr) {
          logger.warn({ service: 'langchain.handlers', method: 'loadOrRepairSettings' }, `Failed to write repaired settings: ${werr instanceof Error ? werr.message : String(werr)}`);
        }
      }

      // If repair failed, return empty object
      return {};
    }
  } catch {
    // File doesn't exist or unreadable (err unused)
    return {};
  }
}
