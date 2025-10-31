// Reverted imports to supported specifiers for installed LangChain version.
// TODO(LangChainUpgrade): When bumping LangChain, reassess package entry points.
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { createProxyAwareFetch } from '../utils/proxyFetch';

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
import { AICredentialResolver } from './AICredentialResolver';

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
  
  // For Azure OpenAI, use text-embedding-3-small deployment (newer generation model)
  // Users should set embeddingModel explicitly in config if using a different deployment
  if (provider === 'azure-openai') {
    return 'text-embedding-3-small';
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
  private credentialResolver = new AICredentialResolver();

  constructor(private config: AIConfig) {
    // Embedding model selection
    const defaultEmbeddingModel = config.provider === 'ollama'
      ? 'nomic-embed-text'
      : config.provider === 'azure-openai'
        ? 'text-embedding-3-small'
        : 'text-embedding-3-small';

    this.embeddingModelName = (config.embeddingModel as string)
      || mapChatModelToEmbeddingModel(config.model as string, config.provider)
      || defaultEmbeddingModel;

    // NOTE: API key may not be present in config (stored separately); we resolve lazily on first embed.
    // We create a temporary embeddings instance with possibly missing key; will rebuild if needed.
    this.embeddings = this.createEmbeddingsClient(config, this.embeddingModelName, config.apiKey);
  }

  private resolveAzureApiVersion(): string {
    const explicit = typeof this.config.apiVersion === 'string' && this.config.apiVersion.trim()
      ? this.config.apiVersion.trim() : '';
    if (explicit) return explicit;
    const envVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();
    return envVersion || '2024-12-01-preview';
  }

  private createEmbeddingsClient(config: AIConfig, embeddingModelName: string, apiKey?: string): OpenAIEmbeddings {
    const resolvedVersion = this.resolveAzureApiVersion();
    const baseDeploymentUrl = `${config.endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(embeddingModelName)}`;
    const fetchTarget = config.provider === 'azure-openai'
      ? baseDeploymentUrl
      : config.endpoint;
    const fetchFn = createProxyAwareFetch(fetchTarget);
    const finalKey = apiKey || (config.provider === 'ollama' ? 'ollama-does-not-need-a-key' : '');
    logger.debug({ service: 'ContextEmbeddingService', method: 'createEmbeddingsClient' }, `Creating embeddings client: deployment=${embeddingModelName}, baseURL=${baseDeploymentUrl}, apiVersion=${resolvedVersion}`);
    return new OpenAIEmbeddings({
      apiKey: finalKey,
      configuration: config.provider === 'azure-openai' ? {
        baseURL: baseDeploymentUrl,
        defaultQuery: { 'api-version': resolvedVersion },
        defaultHeaders: { 'api-key': apiKey || '' },
        fetch: fetchFn
      } : config.provider === 'ollama' ? {
        baseURL: config.endpoint.endsWith('/v1') ? config.endpoint : `${config.endpoint.replace(/\/$/, '')}/v1`,
        fetch: fetchFn
      } : undefined,
      modelName: embeddingModelName
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
        // Validate embedding deployment before bulk indexing
        if (this.config.provider === 'azure-openai') {
          if (this.embeddingModelName === this.config.model) {
            throw new Error(`Embedding deployment name (${this.embeddingModelName}) must differ from chat model (${this.config.model}). Set ai.embeddingModel to your Azure embedding deployment name (e.g., text-embedding-3-small).`);
          }
          logger.info({ service: 'ContextEmbeddingService', method: 'indexRepository' }, `Testing embedding deployment: ${this.embeddingModelName}`);
          try {
            await this.embeddings.embedQuery('validation test');
            logger.info({ service: 'ContextEmbeddingService', method: 'indexRepository' }, `Embedding deployment test succeeded`);
          } catch (testErr: any) {
            const msg = testErr?.message || String(testErr);
            if (msg.includes('404') || msg.includes('does not exist')) {
              throw new Error(`Embedding deployment '${this.embeddingModelName}' not found in Azure (HTTP 404). Verify deployment exists in Azure portal and name matches exactly (case-sensitive).`);
            }
            throw new Error(`Embedding deployment test failed: ${msg}`);
          }
        }
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

              // Lazily resolve missing API key for Azure before first real network call
              if (this.config.provider === 'azure-openai' && (!this.config.apiKey || this.config.apiKey.length < 10)) {
                const resolved = await this.credentialResolver.resolveApiKey({
                  provider: 'azure-openai',
                  useStoredCredentials: true,
                  useEnvironmentVars: true
                });
                if (!resolved) {
                  throw new Error('No API key available for Azure OpenAI embeddings.');
                }
                // Rebuild embeddings client with resolved key
                this.config.apiKey = resolved;
                this.embeddings = this.createEmbeddingsClient(this.config, this.embeddingModelName, resolved);
                logger.debug({ service: 'ContextEmbeddingService', method: 'indexRepository' }, 'Rebuilt embeddings client with resolved API key');
              }

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
        // Resolve key if needed for Azure queries
        if (this.config.provider === 'azure-openai' && (!this.config.apiKey || this.config.apiKey.length < 10)) {
          const resolved = await this.credentialResolver.resolveApiKey({ provider: 'azure-openai', useStoredCredentials: true, useEnvironmentVars: true });
          if (!resolved) throw new Error('No API key available for Azure OpenAI embeddings.');
          this.config.apiKey = resolved;
          this.embeddings = this.createEmbeddingsClient(this.config, this.embeddingModelName, resolved);
        }
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

    if (this.config.provider === 'azure-openai' && (!this.config.apiKey || this.config.apiKey.length < 10)) {
      const resolved = await this.credentialResolver.resolveApiKey({ provider: 'azure-openai', useStoredCredentials: true, useEnvironmentVars: true });
      if (!resolved) throw new Error('No API key available for Azure OpenAI embeddings.');
      this.config.apiKey = resolved;
      this.embeddings = this.createEmbeddingsClient(this.config, this.embeddingModelName, resolved);
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

  /**
   * Persist the current in-memory index to disk.
   * @param repoPath Repository root path
   */
  async saveIndex(repoPath: string): Promise<void> {
    if (!this.indexed || this.documents.length === 0) {
      return; // Nothing to persist
    }
    try {
      const { mkdir, writeFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const crypto = await import('node:crypto');
      const dir = path.join(repoPath, '.context', '.rag');
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, 'vector-index.json');
      const checksumSource = this.documents.map(d => `${d.doc.metadata.id}:${d.doc.pageContent}`).join('|');
      const checksum = crypto.createHash('sha256').update(checksumSource).digest('hex');
      const payload = {
        version: 1,
        embeddingModel: this.embeddingModelName,
        provider: this.config.provider,
        docCount: this.documents.length,
        checksum,
        documents: this.documents.map(d => ({
          id: d.doc.metadata.id,
          title: d.doc.metadata.title,
          type: d.doc.metadata.type,
          content: d.doc.pageContent,
          embedding: d.embedding
        }))
      };
      await writeFile(file, JSON.stringify(payload), 'utf-8');
      logger.info({ service: 'ContextEmbeddingService', method: 'saveIndex', file }, `Persisted ${payload.docCount} documents`);
    } catch (err) {
      logger.warn({ service: 'ContextEmbeddingService', method: 'saveIndex' }, `Failed to persist index: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Load a previously persisted index if present.
   * @param repoPath Repository root path
   */
  async loadIndex(repoPath: string): Promise<boolean> {
    try {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const crypto = await import('node:crypto');
      const file = path.join(repoPath, '.context', '.rag', 'vector-index.json');
      const raw = await readFile(file, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.documents)) return false;
      this.documents = parsed.documents.map((item: any) => ({
        doc: new Document({
          pageContent: item.content,
          metadata: {
            id: item.id,
            title: item.title,
            type: item.type,
            tokenCount: item.content.length // approximate
          }
        }),
        embedding: item.embedding
      }));
      this.indexed = this.documents.length > 0;
      // Validate checksum if present
      if (parsed.checksum) {
        const checksumSource = this.documents.map(d => `${d.doc.metadata.id}:${d.doc.pageContent}`).join('|');
        const actual = crypto.createHash('sha256').update(checksumSource).digest('hex');
        if (actual !== parsed.checksum) {
          logger.warn({ service: 'ContextEmbeddingService', method: 'loadIndex' }, `Checksum mismatch. Expected ${parsed.checksum} got ${actual}`);
        }
      }
      logger.info({ service: 'ContextEmbeddingService', method: 'loadIndex', file }, `Loaded persisted index with ${this.documents.length} documents`);
      return this.indexed;
    } catch (err) {
      // Silence if file not found
      logger.debug({ service: 'ContextEmbeddingService', method: 'loadIndex' }, `No persisted index loaded: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
