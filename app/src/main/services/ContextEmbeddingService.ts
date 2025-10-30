import { OpenAIEmbeddings } from '@langchain/openai';
import type { Document } from '@langchain/core/documents';

type EmbeddingVector = number[];

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
import path from 'node:path';
import { ContextService } from './ContextService';
import { logger } from '../utils/logger';
import type { AIConfig } from './LangChainAIService';

export interface EmbeddingMetadata {
  id: string;
  type: string;
  path: string;
  field?: string;
  title?: string;
}

export interface IndexingProgress {
  total: number;
  processed: number;
  percentage: number;
  currentEntity?: string;
}

function mapChatModelToEmbeddingModel(chatModel?: string, provider?: string): string | undefined {
  if (!chatModel) return undefined;
  
  // For Ollama, use a common embedding model
  if (provider === 'ollama') {
    return 'nomic-embed-text';
  }
  
  // For Azure OpenAI, use text-embedding-ada-002 deployment (most common)
  // Users should set embeddingModel explicitly in config if using a different deployment
  if (provider === 'azure-openai') {
    return 'text-embedding-ada-002';
  }
  
  const m = chatModel.toLowerCase();
  if (m.startsWith('gpt-4') || m.startsWith('gpt4') || m.startsWith('gpt-')) return 'text-embedding-3-small';
  if (m.startsWith('gpt-3.5') || m.includes('turbo')) return 'text-embedding-3-small';
  return undefined;
}

/**
 * Service for creating and managing vector embeddings of context entities.
 * 
 * This service indexes YAML entities as vector embeddings for semantic search.
 * It supports incremental updates and caches embeddings for performance.
 * 
 * Features:
 * - Index entire repository with progress tracking
 * - Incremental updates for changed entities
 * - In-memory vector store (can be swapped for persistent storage)
 * - Multiple fields per entity (title, objective, description)
 * 
 * @example
 * ```typescript
 * const service = new ContextEmbeddingService(config);
 * 
 * // Index repository
 * await service.indexRepository('/path/to/repo', (progress) => {
 *   console.log(`${progress.percentage}% complete`);
 * });
 * 
 * // Search for similar entities
 * const results = await service.findSimilar('FEAT-001', 5);
 * ```
 */
export class ContextEmbeddingService {
  private documents: Array<{ doc: Document<EmbeddingMetadata>; embedding: EmbeddingVector }> = [];
  private embeddings: OpenAIEmbeddings;
  private embeddingModelName: string;
  private embeddingErrorCount = 0;
  private embeddingHttp4xx = 0;
  private embeddingHttp5xx = 0;
  private lastEmbeddingError?: string;
  private indexed = false;

  constructor(private config: AIConfig) {
    // Embedding model: prefer explicit embeddingModel, else map chat model -> embedding, else default
    const defaultEmbeddingModel = config.provider === 'ollama' 
      ? 'nomic-embed-text' 
      : config.provider === 'azure-openai'
      ? 'text-embedding-ada-002'
      : 'text-embedding-3-small';
    this.embeddingModelName = (config.embeddingModel as string)
      || mapChatModelToEmbeddingModel(config.model as string, config.provider)
      || defaultEmbeddingModel;

    // For Ollama, provide a dummy API key since it doesn't need one
    const apiKey = config.provider === 'ollama' 
      ? 'ollama-does-not-need-a-key' 
      : config.apiKey;

    this.embeddings = new OpenAIEmbeddings({
      apiKey: apiKey,
      configuration: config.provider === 'azure-openai' ? {
        baseURL: `${config.endpoint}/openai/deployments/${encodeURIComponent(this.embeddingModelName)}`,
        defaultQuery: { 'api-version': '2024-12-01-preview' },
        defaultHeaders: { 'api-key': config.apiKey || '' }
      } : config.provider === 'ollama' ? {
        baseURL: config.endpoint.endsWith('/v1') ? config.endpoint : `${config.endpoint.replace(/\/$/, '')}/v1`,
      } : undefined,
      modelName: this.embeddingModelName,
    });
  }

  /**
   * Index all entities in the repository.
   * Creates vector embeddings for each entity's key fields.
   * 
   * @param repoPath - Path to context repository
   * @param onProgress - Optional callback for progress updates
   * @returns Number of documents indexed
   */
  async indexRepository(
    repoPath: string,
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<number> {
    return logger.logServiceCall(
      { service: 'ContextEmbeddingService', method: 'indexRepository', repoPath },
      async () => {
        const contextService = new ContextService(repoPath);
        // List all entities - get all types
        const entityTypes = ['feature', 'userstory', 'spec', 'task', 'service', 'package', 'governance'];
        const entityArrays = await Promise.all(
          entityTypes.map(type => contextService.listEntities(type))
        );
        const entities = entityArrays.flat();

        logger.info(
          { service: 'ContextEmbeddingService', method: 'indexRepository' },
          `Indexing ${entities.length} entities from ${repoPath}`
        );

        // Convert entities to documents
        let documents: Document<EmbeddingMetadata>[] = [];
        
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          
          if (onProgress) {
            onProgress({
              total: entities.length,
              processed: i,
              percentage: Math.round((i / entities.length) * 100),
              currentEntity: entity.id
            });
          }

          // Primary document: ID + title + type
          documents.push({
            pageContent: `ID: ${entity.id}\nTitle: ${entity.title || 'Untitled'}\nType: ${entity._type}\nStatus: ${entity.status || 'unknown'}`,
            metadata: {
              id: entity.id,
              type: entity._type,
              path: entity._file,
              title: entity.title,
              field: 'primary'
            }
          });

          // Secondary document: objective/description
          const description = (entity as any).objective || (entity as any).description || '';
          if (description && description.length > 10) {
            documents.push({
              pageContent: description,
              metadata: {
                id: entity.id,
                type: entity._type,
                path: entity._file,
                title: entity.title,
                field: 'description'
              }
            });
          }

          // User story specific fields
          if (entity._type === 'userstory') {
            const us = entity as any;
            if (us.asA && us.iWant && us.soThat) {
              documents.push({
                pageContent: `As a ${us.asA}, I want ${us.iWant} so that ${us.soThat}`,
                metadata: {
                  id: entity.id,
                  type: entity._type,
                  path: entity._file,
                  title: entity.title,
                  field: 'userstory'
                }
              });
            }
          }
        }

        // Filter out files under node_modules to avoid indexing third-party code
        try {
          const beforeCount = documents.length;
          documents = documents.filter(d => {
            const p = path.normalize(String(d.metadata.path || ''));
            const parts = p.split(path.sep);
            return !parts.includes('node_modules');
          });
          const skipped = beforeCount - documents.length;
          if (skipped > 0) {
            logger.info({ service: 'ContextEmbeddingService', method: 'indexRepository' }, `Skipped ${skipped} document(s) inside node_modules`);
          }
        } catch {
          // ignore filtering errors - proceed with original documents
        }

        // Generate embeddings for all documents using batching and retries to avoid full-run hangs
        const TIMEOUT_MS = 90_000; // per-attempt timeout (increase to 90s)
        const BATCH_SIZE = 4; // number of documents per batch (smaller batches)
        const MAX_RETRIES = 3; // per-batch retries
        const allContents = documents.map(d => d.pageContent);
        const batches: string[][] = [];
        for (let i = 0; i < allContents.length; i += BATCH_SIZE) {
          batches.push(allContents.slice(i, i + BATCH_SIZE));
        }

        try {
          logger.info({ service: 'ContextEmbeddingService', method: 'indexRepository' },
            `Requesting embeddings for ${documents.length} documents in ${batches.length} batch(es) (provider=${this.config.provider}, embeddingModel=${this.embeddingModelName}, chatModel=${this.config.model || 'n/a'}, endpoint=${this.config.endpoint || 'n/a'}, hasApiKey=${!!this.config.apiKey})`
          );
        } catch {
          // ignore logging errors
        }

        const embeddings: EmbeddingVector[] = [];

        for (let bi = 0; bi < batches.length; bi++) {
          const batch = batches[bi];
          let attempt = 0;
          let batchResult: EmbeddingVector[] | null = null;

          while (attempt <= MAX_RETRIES && batchResult === null) {
            attempt++;
            try {
              logger.debug({ service: 'ContextEmbeddingService', method: 'indexRepository', batch: bi, attempt },
                `Requesting embeddings for batch ${bi + 1}/${batches.length} (size=${batch.length}, attempt=${attempt})`
              );

              const embedPromise = this.embeddings.embedDocuments(batch);
              const result = await Promise.race<EmbeddingVector[]>([
                embedPromise,
                new Promise<EmbeddingVector[]>((_, reject) => setTimeout(() => reject(new Error(`Embedding request timed out after ${TIMEOUT_MS}ms (batch ${bi + 1})`)), TIMEOUT_MS))
              ]);

              batchResult = result;
              embeddings.push(...batchResult);
              logger.info({ service: 'ContextEmbeddingService', method: 'indexRepository', batch: bi }, `Received ${batchResult.length} embeddings for batch ${bi + 1}`);
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              const stack = err instanceof Error ? err.stack : undefined;

              // Try to extract HTTP status and body from provider error shapes
              const anyErr = err as any;
              const status = anyErr?.response?.status || anyErr?.statusCode || anyErr?.status;
              const body = anyErr?.response?.data || anyErr?.body || anyErr?.response?.text || anyErr?.response?.data?.error;

              // Increment counters
              this.embeddingErrorCount++;
              if (typeof status === 'number') {
                if (status >= 500) this.embeddingHttp5xx++;
                else if (status >= 400) this.embeddingHttp4xx++;
              }

              // Save last error summary
              this.lastEmbeddingError = `${message}${status ? ` (status=${status})` : ''}`;

              logger.warn({ service: 'ContextEmbeddingService', method: 'indexRepository', batch: bi, attempt }, `Batch ${bi + 1} attempt ${attempt} failed: ${message}${status ? ` (HTTP ${status})` : ''}`);
              if (stack) {
                logger.debug({ service: 'ContextEmbeddingService', method: 'indexRepository', batch: bi, attempt }, `Stack: ${stack}`);
              }
              if (body) {
                // Avoid logging huge bodies at info level
                logger.debug({ service: 'ContextEmbeddingService', method: 'indexRepository', batch: bi, attempt }, `Body: ${JSON.stringify(body)}`);
              }

              if (attempt > MAX_RETRIES) {
                logger.error({ service: 'ContextEmbeddingService', method: 'indexRepository' }, new Error(`Failed to generate embeddings for batch ${bi + 1}: ${message}${status ? ` (HTTP ${status})` : ''}`));
                throw new Error(`Failed to generate embeddings: ${message}${status ? ` (HTTP ${status})` : ''}`);
              }

              // exponential backoff with jitter before retrying
              const base = 500; // ms
              const backoff = Math.min(10_000, base * Math.pow(2, attempt - 1));
              const jitter = Math.floor(Math.random() * 300);
              const wait = backoff + jitter;
              await new Promise((res) => setTimeout(res, wait));
            }
          }
        }
        
        this.documents = documents.map((doc, i) => ({
          doc,
          embedding: embeddings[i]
        }));

        this.indexed = true;

        if (onProgress) {
          onProgress({
            total: entities.length,
            processed: entities.length,
            percentage: 100
          });
        }

        logger.info(
          { service: 'ContextEmbeddingService', method: 'indexRepository' },
          `Successfully indexed ${documents.length} documents from ${entities.length} entities`
        );

        return documents.length;
      }
    );
  }

  /**
   * Find entities similar to the given entity ID.
   * 
   * @param entityId - Entity ID to find similar entities for
   * @param limit - Maximum number of results (default: 5)
   * @returns Array of similar entities with similarity scores
   */
  async findSimilar(
    entityId: string,
    limit = 5
  ): Promise<Array<{ id: string; similarity: number; title?: string; type: string }>> {
    if (this.documents.length === 0 || !this.indexed) {
      throw new Error('Repository not indexed. Call indexRepository() first.');
    }

    return logger.logServiceCall(
      { service: 'ContextEmbeddingService', method: 'findSimilar', entityId, limit },
      async () => {
        // Find the entity's embedding
        const entityDoc = this.documents.find(d => d.doc.metadata.id === entityId);
        if (!entityDoc) {
          throw new Error(`Entity ${entityId} not found in index`);
        }

        // Calculate similarities
        const similarities = this.documents
          .filter(d => d.doc.metadata.id !== entityId)
          .map(d => ({
            id: d.doc.metadata.id,
            similarity: Math.round(cosineSimilarity(entityDoc.embedding, d.embedding) * 100),
            title: d.doc.metadata.title,
            type: d.doc.metadata.type
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit);

        logger.debug(
          { service: 'ContextEmbeddingService', method: 'findSimilar' },
          `Found ${similarities.length} similar entities for ${entityId}`
        );

        return similarities;
      }
    );
  }

  /**
   * Search for entities matching a text query.
   * 
   * @param query - Search query text
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of matching entities with relevance scores
   */
  async search(
    query: string,
    limit = 10
  ): Promise<Array<{ id: string; relevance: number; title?: string; type: string; excerpt: string }>> {
    if (this.documents.length === 0 || !this.indexed) {
      throw new Error('Repository not indexed. Call indexRepository() first.');
    }

    return logger.logServiceCall(
      { service: 'ContextEmbeddingService', method: 'search', query, limit },
      async () => {
        // Generate embedding for query
        const queryEmbedding = await this.embeddings.embedQuery(query);

        // Calculate similarities
        const results = this.documents
          .map(d => ({
            id: d.doc.metadata.id,
            relevance: Math.round(cosineSimilarity(queryEmbedding, d.embedding) * 100),
            title: d.doc.metadata.title,
            type: d.doc.metadata.type,
            excerpt: d.doc.pageContent.substring(0, 200)
          }))
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, limit);

        logger.debug(
          { service: 'ContextEmbeddingService', method: 'search' },
          `Found ${results.length} results for query: "${query}"`
        );

        return results;
      }
    );
  }

  /**
   * Search for documents similar to a query.
   * Used by RAG service for retrieval.
   * 
   * @param query - Search query
   * @param k - Number of documents to retrieve (default: 4)
   * @returns Array of relevant documents
   */
  async similaritySearch(
    query: string,
    k = 4
  ): Promise<Array<Document<EmbeddingMetadata>>> {
    if (this.documents.length === 0 || !this.indexed) {
      throw new Error('Repository not indexed. Call indexRepository() first.');
    }

    const queryEmbedding = await this.embeddings.embedQuery(query);

    const results = this.documents
      .map(d => ({
        doc: d.doc,
        similarity: cosineSimilarity(queryEmbedding, d.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k)
      .map(r => r.doc);

    return results;
  }

  /**
   * Check if repository is indexed.
   */
  isIndexed(): boolean {
    return this.indexed;
  }

  /**
   * Clear the vector store and reset indexed state.
   */
  clearIndex(): void {
    this.documents = [];
    this.indexed = false;
    
    logger.info(
      { service: 'ContextEmbeddingService', method: 'clearIndex' },
      'Vector store cleared'
    );
  }

  /**
   * Get embedding statistics.
   */
  async getStats(): Promise<{
    indexed: boolean;
    documentCount: number;
    embeddingErrorCount: number;
    embeddingHttp4xx: number;
    embeddingHttp5xx: number;
    lastEmbeddingError?: string;
  }> {
    return {
      indexed: this.indexed,
      documentCount: this.documents.length
      , embeddingErrorCount: this.embeddingErrorCount,
      embeddingHttp4xx: this.embeddingHttp4xx,
      embeddingHttp5xx: this.embeddingHttp5xx,
      lastEmbeddingError: this.lastEmbeddingError
    };
  }
}
