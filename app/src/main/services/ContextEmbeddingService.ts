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
  private indexed = false;

  constructor(private config: AIConfig) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apiKey,
      configuration: {
        baseURL: config.provider === 'azure-openai' 
          ? `${config.endpoint}/openai/deployments/text-embedding-ada-002`
          : undefined,
        defaultQuery: config.provider === 'azure-openai'
          ? { 'api-version': '2024-12-01-preview' }
          : undefined,
        defaultHeaders: config.provider === 'azure-openai'
          ? { 'api-key': config.apiKey || '' }
          : undefined,
      },
      modelName: config.provider === 'azure-openai' ? 'text-embedding-ada-002' : 'text-embedding-ada-002',
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
        const documents: Document<EmbeddingMetadata>[] = [];
        
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

        // Generate embeddings for all documents
        const embeddings = await this.embeddings.embedDocuments(
          documents.map(d => d.pageContent)
        );
        
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
  }> {
    return {
      indexed: this.indexed,
      documentCount: this.documents.length
    };
  }
}
