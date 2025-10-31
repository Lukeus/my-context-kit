import { ContextEmbeddingService } from '../ContextEmbeddingService';
import type { AIConfig } from '../LangChainAIService';

export interface SearchContextRepositoryOptions {
  repoPath: string;
  query: string;
  limit?: number;
  config: AIConfig;
}

export interface SearchContextRepositoryResult {
  results: Array<{
    id: string;
    title?: string;
    type: string;
    relevance: number;
    excerpt: string;
  }>;
  count: number;
}

/**
 * Search the context repository using semantic search (embeddings + vector similarity).
 * Returns the most relevant entities based on the query.
 * 
 * @param options - Search parameters including query and repository path
 * @returns Search results with entity metadata and relevance scores
 */
export async function searchContextRepository(
  options: SearchContextRepositoryOptions
): Promise<SearchContextRepositoryResult> {
  if (!options.repoPath) {
    throw new Error('Repository path is required for context search.');
  }
  
  if (!options.query || typeof options.query !== 'string' || options.query.trim().length === 0) {
    throw new Error('A search query is required.');
  }

  const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 20) : 10;

  // Create embedding service and load index
  const embeddingService = new ContextEmbeddingService(options.config);
  const indexed = await embeddingService.loadIndex(options.repoPath);
  
  if (!indexed) {
    throw new Error('Repository not indexed. Please index the repository first using the RAG panel.');
  }

  // Perform semantic search
  const results = await embeddingService.search(options.query, limit);

  return {
    results,
    count: results.length
  };
}
