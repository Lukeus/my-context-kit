import { ContextEmbeddingService } from '../ContextEmbeddingService';
import type { AIConfig } from '../LangChainAIService';

export interface FindSimilarEntitiesOptions {
  repoPath: string;
  entityId: string;
  limit?: number;
  config: AIConfig;
}

export interface FindSimilarEntitiesResult {
  sourceEntity: string;
  similar: Array<{
    id: string;
    title?: string;
    type: string;
    relevance: number;
    excerpt: string;
  }>;
  count: number;
}

/**
 * Find entities similar to a given entity using semantic embeddings.
 * Useful for discovering related features, tasks, or dependencies.
 * 
 * @param options - Source entity ID and repository path
 * @returns List of similar entities with relevance scores
 */
export async function findSimilarEntities(
  options: FindSimilarEntitiesOptions
): Promise<FindSimilarEntitiesResult> {
  if (!options.repoPath) {
    throw new Error('Repository path is required to find similar entities.');
  }
  
  if (!options.entityId || typeof options.entityId !== 'string') {
    throw new Error('Entity ID is required.');
  }

  const entityId = options.entityId.trim().toUpperCase();
  const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 15) : 5;

  // Create embedding service and load index
  const embeddingService = new ContextEmbeddingService(options.config);
  const indexed = await embeddingService.loadIndex(options.repoPath);
  
  if (!indexed) {
    throw new Error('Repository not indexed. Please index the repository first using the RAG panel.');
  }

  // Find similar entities
  try {
    const rawSimilar = await embeddingService.findSimilar(entityId, limit);
    
    // Transform to match expected output format
    const similar = rawSimilar.map(item => ({
      id: item.id,
      title: item.title,
      type: item.type,
      relevance: item.similarity, // similarity score is already 0-100
      excerpt: '' // findSimilar doesn't provide excerpts
    }));

    return {
      sourceEntity: entityId,
      similar,
      count: similar.length
    };
  } catch (error) {
    throw new Error(`Failed to find similar entities for ${entityId}: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
