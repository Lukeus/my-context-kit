import { ipcMain } from 'electron';
import { ContextEmbeddingService } from '../../services/ContextEmbeddingService';
import { ContextRAGService } from '../../services/ContextRAGService';
import type { AIConfig } from '../../services/LangChainAIService';
import { logger } from '../../utils/logger';

// Singleton instances per repository
const embeddingServices = new Map<string, ContextEmbeddingService>();
const ragServices = new Map<string, ContextRAGService>();

/**
 * Get or create embedding service for a repository.
 */
async function getEmbeddingService(repoPath: string, config: AIConfig): Promise<ContextEmbeddingService> {
  const embeddingKeyModel = (config as any).embeddingModel || config.model || '';
  const key = `${repoPath}:${config.provider}:${embeddingKeyModel}`;

  if (!embeddingServices.has(key)) {
    logger.info(
      { service: 'rag.handlers', method: 'getEmbeddingService' },
      `Creating new embedding service for ${repoPath}`
    );

    // If essential config fields are missing, attempt to load repository AI config
    try {
      if (!config.provider || !config.endpoint || !config.model) {
        const { LangChainAIService } = await import('../../services/LangChainAIService');
        const aiService = new LangChainAIService();
        try {
          const repoConfig = await aiService.getConfig(repoPath);
          // Merge missing fields
          if (!config.provider && repoConfig.provider) config.provider = repoConfig.provider;
          if (!config.endpoint && repoConfig.endpoint) config.endpoint = repoConfig.endpoint;
          if (!config.model && repoConfig.model) config.model = repoConfig.model;
          if (!('embeddingModel' in config) && (repoConfig as any).embeddingModel) {
            (config as any).embeddingModel = (repoConfig as any).embeddingModel;
          }
        } catch (err) {
          logger.debug({ service: 'rag.handlers', method: 'getEmbeddingService' }, `Could not load repo AI config: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch {
      // non-fatal
    }

    // If apiKey not present, attempt to load from secure credential store
    try {
      if (!('apiKey' in config) || !config.apiKey) {
        const { LangChainAIService } = await import('../../services/LangChainAIService');
        const aiService = new LangChainAIService();

        // Try multiple provider keys to account for variations used when saving credentials
        const triedProviders: string[] = [];
        const providerCandidates = new Set<string>([
          String(config.provider || ''),
          'azure-openai',
          'openai'
        ]);

        let foundKey: string | undefined;
        for (const prov of providerCandidates) {
          if (!prov) continue;
          triedProviders.push(prov);
          try {
            const api = await aiService.getStoredCredentials(prov);
            if (api) {
              foundKey = api;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (config as any).apiKey = api;
              logger.info({ service: 'rag.handlers', method: 'getEmbeddingService' }, `Loaded stored credentials for provider '${prov}'`);
              break;
            }
          } catch {
            // ignore and try next provider
          }
        }

        if (!foundKey) {
          logger.debug({ service: 'rag.handlers', method: 'getEmbeddingService' }, `No stored credentials found for providers: ${triedProviders.join(', ')}`);
        }
      }
    } catch (err) {
      logger.debug({ service: 'rag.handlers', method: 'getEmbeddingService' }, `Could not load stored credentials: ${err instanceof Error ? err.message : String(err)}`);
    }

    embeddingServices.set(key, new ContextEmbeddingService(config));
  }

  return embeddingServices.get(key)!;
}

/**
 * Get or create RAG service for a repository.
 */
async function getRAGService(repoPath: string, config: AIConfig): Promise<ContextRAGService> {
  const embeddingKeyModel = (config as any).embeddingModel || config.model || '';
  const key = `${repoPath}:${config.provider}:${embeddingKeyModel}`;

  if (!ragServices.has(key)) {
    logger.info(
      { service: 'rag.handlers', method: 'getRAGService' },
      `Creating new RAG service for ${repoPath}`
    );
    const embeddingService = await getEmbeddingService(repoPath, config);
    ragServices.set(key, new ContextRAGService(config, embeddingService));
  }

  return ragServices.get(key)!;
}

/**
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

      const embeddingService = await getEmbeddingService(params.repoPath, params.config);
      
      // Send progress updates back to renderer
      const documentCount = await embeddingService.indexRepository(
        params.repoPath,
        (progress) => {
          event.sender.send('rag:indexProgress', progress);
        }
      );

      // Reinitialize RAG service chain after indexing
      const ragService = await getRAGService(params.repoPath, params.config);
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

      const ragService = await getRAGService(params.repoPath, params.config);
      
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
        sources: result.sources
      };
    } catch (error) {
      logger.error({ service: 'rag.handlers', method: 'query' }, error as Error);
      return {
        ok: false,
        error: (error as Error).message
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

      const ragService = await getRAGService(params.repoPath, params.config);
      
      if (!ragService.isReady()) {
        throw new Error('RAG not ready. Repository must be indexed first.');
      }

      // Start streaming in background
      void (async () => {
        try {
          for await (const chunk of ragService.streamQuery(params.question, params.topK)) {
            event.sender.send('rag:streamChunk', {
              streamId: params.streamId,
              type: chunk.type,
              data: chunk.data
            });
          }
        } catch (error) {
          logger.error({ service: 'rag.handlers', method: 'queryStream' }, error as Error);
          event.sender.send('rag:streamError', {
            streamId: params.streamId,
            error: (error as Error).message
          });
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

      const embeddingService = await getEmbeddingService(params.repoPath, params.config);
      
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

      const embeddingService = await getEmbeddingService(params.repoPath, params.config);
      
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

      const ragService = await getRAGService(params.repoPath, params.config);
      
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
      const embeddingKeyModel = (params.config as any).embeddingModel || params.config.model || '';
      const key = `${params.repoPath}:${params.config.provider}:${embeddingKeyModel}`;
      const embeddingService = embeddingServices.get(key);
      
      if (!embeddingService) {
        return {
          ok: true,
          indexed: false,
          documentCount: 0
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

      const embeddingKeyModel = (params.config as any).embeddingModel || params.config.model || '';
      const key = `${params.repoPath}:${params.config.provider}:${embeddingKeyModel}`;
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
