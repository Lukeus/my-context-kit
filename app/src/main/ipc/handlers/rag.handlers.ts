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
function getEmbeddingService(repoPath: string, config: AIConfig): ContextEmbeddingService {
  const key = `${repoPath}:${config.provider}:${config.model}`;
  
  if (!embeddingServices.has(key)) {
    logger.info(
      { service: 'rag.handlers', method: 'getEmbeddingService' },
      `Creating new embedding service for ${repoPath}`
    );
    embeddingServices.set(key, new ContextEmbeddingService(config));
  }
  
  return embeddingServices.get(key)!;
}

/**
 * Get or create RAG service for a repository.
 */
function getRAGService(repoPath: string, config: AIConfig): ContextRAGService {
  const key = `${repoPath}:${config.provider}:${config.model}`;
  
  if (!ragServices.has(key)) {
    logger.info(
      { service: 'rag.handlers', method: 'getRAGService' },
      `Creating new RAG service for ${repoPath}`
    );
    const embeddingService = getEmbeddingService(repoPath, config);
    ragServices.set(key, new ContextRAGService(config, embeddingService));
  }
  
  return ragServices.get(key)!;
}

/**
 * Register all RAG-related IPC handlers.
 */
export function registerRAGHandlers(): void {
  /**
   * Check if RAG is enabled via environment variable.
   */
  ipcMain.handle('rag:isEnabled', async () => {
    try {
      const enabled = process.env.USE_LANGCHAIN === 'true';
      
      logger.debug(
        { service: 'rag.handlers', method: 'isEnabled' },
        `RAG enabled: ${enabled}`
      );
      
      return {
        ok: true,
        enabled
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

      const embeddingService = getEmbeddingService(params.repoPath, params.config);
      
      // Send progress updates back to renderer
      const documentCount = await embeddingService.indexRepository(
        params.repoPath,
        (progress) => {
          event.sender.send('rag:indexProgress', progress);
        }
      );

      // Reinitialize RAG service chain after indexing
      const ragService = getRAGService(params.repoPath, params.config);
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

      const ragService = getRAGService(params.repoPath, params.config);
      
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

      const ragService = getRAGService(params.repoPath, params.config);
      
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

      const embeddingService = getEmbeddingService(params.repoPath, params.config);
      
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

      const embeddingService = getEmbeddingService(params.repoPath, params.config);
      
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

      const ragService = getRAGService(params.repoPath, params.config);
      
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
      const key = `${params.repoPath}:${params.config.provider}:${params.config.model}`;
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

      const key = `${params.repoPath}:${params.config.provider}:${params.config.model}`;
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
