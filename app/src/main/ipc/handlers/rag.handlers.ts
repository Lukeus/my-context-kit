import { ipcMain } from 'electron';
import { ContextEmbeddingService } from '../../services/ContextEmbeddingService';
import { ContextRAGService } from '../../services/ContextRAGService';
import { AICredentialResolver } from '../../services/AICredentialResolver';
import { LangChainAIService, type AIConfig } from '../../services/LangChainAIService';
import { logger } from '../../utils/logger';

// Singleton instances per repository
const embeddingServices = new Map<string, ContextEmbeddingService>();
const ragServices = new Map<string, ContextRAGService>();
const credentialResolver = new AICredentialResolver();
const langChainService = new LangChainAIService();
const streamControllers = new Map<string, AbortController>();

/**
 * Resolve API credentials for the config if missing.
 */
async function resolveCredentials(repoPath: string, incoming?: Partial<AIConfig>): Promise<AIConfig> {
  const baseConfig = await langChainService.getConfig(repoPath);
  const mergedConfig: AIConfig = {
    ...baseConfig,
    ...(incoming ?? {}),
  };

  if (!mergedConfig.provider) {
    mergedConfig.provider = 'azure-openai';
  }

  if (mergedConfig.provider === 'azure-openai') {
    if (!mergedConfig.endpoint || !mergedConfig.model) {
      throw new Error('Azure OpenAI configuration incomplete. Please set endpoint and deployment model in AI settings.');
    }

    const resolvedKey = await credentialResolver.resolveApiKey({
      provider: mergedConfig.provider,
      explicitKey: mergedConfig.apiKey as string | undefined,
      useStoredCredentials: true,
      useEnvironmentVars: true,
    });

    if (!resolvedKey) {
      throw new Error('No API key found for Azure OpenAI. Save credentials in AI settings or set AZURE_OPENAI_KEY.');
    }

    mergedConfig.apiKey = resolvedKey;
  }

  if (!('embeddingModel' in mergedConfig) || !(mergedConfig as any).embeddingModel) {
    (mergedConfig as any).embeddingModel = (incoming as any)?.embeddingModel || (baseConfig as any)?.embeddingModel || mergedConfig.model;
  }

  logger.debug(
    { service: 'rag.handlers', method: 'resolveCredentials' },
    `Resolved config for provider=${mergedConfig.provider}`
  );

  return mergedConfig;
}

/**
 * Get or create embedding service for a repository.
 */
async function getEmbeddingService(repoPath: string, config: AIConfig): Promise<ContextEmbeddingService> {
  const embeddingKeyModel = (config as any).embeddingModel || config.model || '';
  const key = `${repoPath}:${embeddingKeyModel}`; // simplified key (drop provider)

  if (!embeddingServices.has(key)) {
    logger.info(
      { service: 'rag.handlers', method: 'getEmbeddingService' },
      `Creating new embedding service for ${repoPath}`
    );
    embeddingServices.set(key, new ContextEmbeddingService(config));
    // Attempt to load persisted index (await to ensure status reflects loaded data)
    // TODO(Persistence): consider async race impacts for simultaneous loads.
    await embeddingServices.get(key)!.loadIndex(repoPath);
  }

  return embeddingServices.get(key)!;
}

/**
 * Get or create RAG service for a repository.
 */
async function getRAGService(repoPath: string, config: AIConfig): Promise<ContextRAGService> {
  const embeddingKeyModel = (config as any).embeddingModel || config.model || '';
  const key = `${repoPath}:${embeddingKeyModel}`;

  if (!ragServices.has(key)) {
    // Fallback: migrate legacy provider-inclusive keys if present
    const legacyPrefix = `${repoPath}:${config.provider || ''}:${embeddingKeyModel}`;
    for (const existingKey of ragServices.keys()) {
      if (existingKey === legacyPrefix) {
        const service = ragServices.get(existingKey)!;
        ragServices.set(key, service);
        ragServices.delete(existingKey);
        logger.info({ service: 'rag.handlers', method: 'getRAGService' }, `Migrated legacy RAG key ${existingKey} -> ${key}`);
        break;
      }
    }
  }

  if (!ragServices.has(key)) {
    logger.info(
      { service: 'rag.handlers', method: 'getRAGService' },
      `Creating new RAG service for ${repoPath}`
    );
    const embeddingService = await getEmbeddingService(repoPath, config);
    ragServices.set(key, new ContextRAGService(config, embeddingService));
  } else {
    // Update cached service config if credentials have been resolved
    const cachedService = ragServices.get(key)!;
    if (config.apiKey && !(cachedService as any).config?.apiKey) {
      logger.info(
        { service: 'rag.handlers', method: 'getRAGService' },
        `Updating cached RAG service with resolved credentials`
      );
      // Use updateConfig to safely apply credentials and reset model
      (cachedService as any).updateConfig({ apiKey: config.apiKey });
    }
  }

  return ragServices.get(key)!;
}/**
 * Register all RAG-related IPC handlers.
 */
export function registerRAGHandlers(): void {
  /**
   * Check if RAG is available.
   * RAG is always available since LangChain is integrated.
   */
  ipcMain.handle('rag:isEnabled', async () => {
    try {
      logger.debug(
        { service: 'rag.handlers', method: 'isEnabled' },
        'RAG is available'
      );
      
      return {
        ok: true,
        enabled: true
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'isEnabled' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Index a context repository.
   */
  ipcMain.handle('rag:indexRepository', async (event, params: {
    repoPath: string;
    config: AIConfig;
  }) => {
    try {
      logger.info(
        { service: 'rag.handlers', method: 'indexRepository', repoPath: params.repoPath },
        'Starting repository indexing'
      );

      // Resolve credentials if missing
      const configWithCredentials = await resolveCredentials(params.repoPath, params.config);

      const embeddingService = await getEmbeddingService(params.repoPath, configWithCredentials);
      
      // Send progress updates back to renderer
      const documentCount = await embeddingService.indexRepository(
        params.repoPath,
        (progress) => {
          event.sender.send('rag:indexProgress', progress);
        }
      );

      // Persist immediately after successful indexing
      await embeddingService.saveIndex(params.repoPath);

      // Reinitialize RAG service chain after indexing
      const ragService = await getRAGService(params.repoPath, configWithCredentials);
      ragService.reinitialize();

      logger.info(
        { service: 'rag.handlers', method: 'indexRepository' },
        `Successfully indexed ${documentCount} documents`
      );

      return {
        ok: true,
        documentCount
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'indexRepository' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Query the repository with RAG.
   */
  ipcMain.handle('rag:query', async (_event, params: {
    repoPath: string;
    config: AIConfig;
    question: string;
    topK?: number;
  }) => {
    try {
      logger.info(
        { service: 'rag.handlers', method: 'query', question: params.question },
        'Processing RAG query'
      );

      // Resolve credentials if missing
      const configWithCredentials = await resolveCredentials(params.repoPath, params.config);

      const ragService = await getRAGService(params.repoPath, configWithCredentials);
      // Rebuild chain if embeddings were loaded after initial construction
      ragService.ensureReady();
      
      if (!ragService.isReady()) {
        throw new Error('RAG not ready. Repository must be indexed first.');
      }

      const result = await ragService.query(params.question, params.topK);

      logger.info(
        { service: 'rag.handlers', method: 'query' },
        `Query returned ${result.sources.length} sources`
      );

      return {
        ok: true,
        answer: result.answer,
        sources: result.sources,
        tokensUsed: result.tokensUsed,
        usage: result.usage,
        toolCalls: result.toolCalls
      };
    } catch (error) {
      const err = error as Error;
      if (err?.name === 'AbortError') {
        logger.debug({ service: 'rag.handlers', method: 'query' }, 'RAG query cancelled');
        return {
          ok: false,
          error: 'cancelled'
        };
      }

      logger.error({ service: 'rag.handlers', method: 'query' }, err);
      return {
        ok: false,
        error: err?.message
      };
    }
  });

  /**
   * Stream a RAG query with token-by-token updates.
   */
  ipcMain.handle('rag:queryStream', async (event, params: {
    repoPath: string;
    config: AIConfig;
    question: string;
    topK?: number;
    streamId: string;
  }) => {
    try {
      logger.info(
        { service: 'rag.handlers', method: 'queryStream', streamId: params.streamId },
        'Starting RAG stream query'
      );

      // Resolve credentials if missing
      const configWithCredentials = await resolveCredentials(params.repoPath, params.config);

      const ragService = await getRAGService(params.repoPath, configWithCredentials);
      
      if (!ragService.isReady()) {
        throw new Error('RAG not ready. Repository must be indexed first.');
      }

      const controller = new AbortController();
      streamControllers.set(params.streamId, controller);

      // Start streaming in background
      void (async () => {
        try {
          for await (const chunk of ragService.streamQuery(params.question, params.topK, { signal: controller.signal })) {
            event.sender.send('rag:streamChunk', {
              streamId: params.streamId,
              type: chunk.type,
              data: chunk.data
            });
          }
        } catch (error) {
          const err = error as Error;
          if (err?.name === 'AbortError') {
            event.sender.send('rag:streamError', {
              streamId: params.streamId,
              error: 'cancelled'
            });
          } else {
            logger.error({ service: 'rag.handlers', method: 'queryStream' }, err);
            event.sender.send('rag:streamError', {
              streamId: params.streamId,
              error: err?.message ?? 'Stream failed'
            });
          }
        } finally {
          streamControllers.delete(params.streamId);
        }
      })();

      return {
        ok: true,
        streamId: params.streamId
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'queryStream' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  ipcMain.handle('rag:cancelStream', async (_event, { streamId }: { streamId: string }) => {
    const controller = streamControllers.get(streamId);
    if (!controller) {
      return {
        ok: false,
        error: 'Stream not found or already completed.'
      };
    }

    controller.abort();
    streamControllers.delete(streamId);
    return {
      ok: true,
      cancelled: true
    };
  });

  ipcMain.handle('rag:cancelQuery', async (_event, params: { repoPath: string; config: AIConfig }) => {
    try {
      const configWithCredentials = await resolveCredentials(params.repoPath, params.config);
      const ragService = await getRAGService(params.repoPath, configWithCredentials);
      const cancelled = ragService.cancelActiveQuery();
      return {
        ok: true,
        cancelled
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'cancelQuery' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Find entities similar to a given entity.
   */
  ipcMain.handle('rag:findSimilar', async (_event, params: {
    repoPath: string;
    config: AIConfig;
    entityId: string;
    limit?: number;
  }) => {
    try {
      logger.info(
        { service: 'rag.handlers', method: 'findSimilar', entityId: params.entityId },
        'Finding similar entities'
      );

      const configWithCredentials = await resolveCredentials(params.repoPath, params.config);
      const embeddingService = await getEmbeddingService(params.repoPath, configWithCredentials);
      
      if (!embeddingService.isIndexed()) {
        throw new Error('Repository not indexed.');
      }

      const similar = await embeddingService.findSimilar(
        params.entityId,
        params.limit || 5
      );

      logger.info(
        { service: 'rag.handlers', method: 'findSimilar' },
        `Found ${similar.length} similar entities`
      );

      return {
        ok: true,
        similar
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'findSimilar' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Search for entities by topic/query.
   */
  ipcMain.handle('rag:search', async (_event, params: {
    repoPath: string;
    config: AIConfig;
    query: string;
    limit?: number;
  }) => {
    try {
      logger.info(
        { service: 'rag.handlers', method: 'search', query: params.query },
        'Searching entities'
      );

      const configWithCredentials = await resolveCredentials(params.repoPath, params.config);
      const embeddingService = await getEmbeddingService(params.repoPath, configWithCredentials);
      
      if (!embeddingService.isIndexed()) {
        throw new Error('Repository not indexed.');
      }

      const results = await embeddingService.search(
        params.query,
        params.limit || 10
      );

      logger.info(
        { service: 'rag.handlers', method: 'search' },
        `Found ${results.length} matching entities`
      );

      return {
        ok: true,
        results
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'search' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Get entity context using RAG.
   */
  ipcMain.handle('rag:getEntityContext', async (_event, params: {
    repoPath: string;
    config: AIConfig;
    entityId: string;
  }) => {
    try {
      logger.info(
        { service: 'rag.handlers', method: 'getEntityContext', entityId: params.entityId },
        'Getting entity context'
      );

      const configWithCredentials = await resolveCredentials(params.repoPath, params.config);
      const ragService = await getRAGService(params.repoPath, configWithCredentials);
      
      if (!ragService.isReady()) {
        throw new Error('RAG not ready. Repository must be indexed first.');
      }

      const result = await ragService.getEntityContext(params.entityId);

      return {
        ok: true,
        answer: result.answer,
        sources: result.sources
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'getEntityContext' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Check indexing status.
   */
  ipcMain.handle('rag:getStatus', async (_event, params: {
    repoPath: string;
    config: AIConfig;
  }) => {
    try {
      const resolvedConfig = await resolveCredentials(params.repoPath, params.config);
      const embeddingKeyModel = (resolvedConfig as any).embeddingModel || resolvedConfig.model || '';
      const key = `${params.repoPath}:${embeddingKeyModel}`;
      const embeddingService = embeddingServices.get(key);
      
      if (!embeddingService) {
        // Fallback: user may have changed provider/model after indexing.
        // Scan for any embedding service keyed to this repo regardless of provider/model.
        // TODO(Persistence): Replace this heuristic with persisted index metadata.
        const prefix = `${params.repoPath}:`;
        const alternate = [...embeddingServices.entries()].find(([k]) => k.startsWith(prefix));
        if (!alternate) {
          return {
            ok: true,
            indexed: false,
            documentCount: 0
          };
        }
        const stats = await alternate[1].getStats();
        return {
          ok: true,
            ...stats
        };
      }

      const stats = await embeddingService.getStats();

      return {
        ok: true,
        ...stats
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'getStatus' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Clear the vector index.
   */
  ipcMain.handle('rag:clearIndex', async (_event, params: {
    repoPath: string;
    config: AIConfig;
  }) => {
    try {
      logger.info(
        { service: 'rag.handlers', method: 'clearIndex', repoPath: params.repoPath },
        'Clearing vector index'
      );

      const resolvedConfig = await resolveCredentials(params.repoPath, params.config);
      const embeddingKeyModel = (resolvedConfig as any).embeddingModel || resolvedConfig.model || '';
      const key = `${params.repoPath}:${embeddingKeyModel}`;
      const embeddingService = embeddingServices.get(key);
      
      if (embeddingService) {
        embeddingService.clearIndex();
      }

      // Remove from cache
      embeddingServices.delete(key);
      ragServices.delete(key);

      logger.info({ service: 'rag.handlers', method: 'clearIndex' }, 'Index cleared successfully');

      return {
        ok: true
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'clearIndex' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
      };
    }
  });

  logger.info({ service: 'rag.handlers', method: 'register' }, 'RAG IPC handlers registered');
}
