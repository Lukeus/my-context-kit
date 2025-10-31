import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useContextStore } from './contextStore';

interface IndexingProgress {
  total: number;
  processed: number;
  percentage: number;
  currentEntity?: string;
}

interface RAGSource {
  id: string;
  title?: string;
  type: string;
  relevance: number;
  excerpt: string;
}

interface RAGQueryResult {
  answer: string;
  sources: RAGSource[];
  tokensUsed?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
}

interface RAGQuery {
  id: string;
  question: string;
  result: RAGQueryResult;
  timestamp: number;
}

interface RAGSettings {
  enabled: boolean;
  topK: number;
  autoIndex: boolean;
  showSources: boolean;
}

interface RAGStats {
  indexed: boolean;
  documentCount: number;
}

interface SimilarEntity {
  id: string;
  similarity: number;
  title?: string;
  type: string;
}

/**
 * Store for RAG (Retrieval-Augmented Generation) functionality.
 * 
 * This store manages:
 * - Repository indexing status and progress
 * - Query history with sources
 * - RAG settings (enabled, topK)
 * - Active sources for current context
 * - Token usage tracking
 */
export const useRAGStore = defineStore('rag', () => {
  // State
  const settings = ref<RAGSettings>({
    enabled: false,
    topK: 5,
    autoIndex: true,
    showSources: true
  });

  const indexing = ref<{
    inProgress: boolean;
    progress: IndexingProgress | null;
    error: string | null;
  }>({
    inProgress: false,
    progress: null,
    error: null
  });

  const stats = ref<RAGStats>({
    indexed: false,
    documentCount: 0
  });

  const queryHistory = ref<RAGQuery[]>([]);
  const activeSources = ref<RAGSource[]>([]);
  const lastQuery = ref<RAGQuery | null>(null);
  const totalTokensSaved = ref(0);

  // Computed
  const isIndexed = computed(() => stats.value.indexed);
  const isReady = computed(() => settings.value.enabled && stats.value.indexed);
  const recentQueries = computed(() => queryHistory.value.slice(-10).reverse());
  const lastQuerySources = computed(() => lastQuery.value?.result.sources || []);
  const querySources = computed(() => queryHistory.value.flatMap(q => q.result.sources));
  
  const indexingProgress = computed(() => {
    if (!indexing.value.inProgress || !indexing.value.progress) return null;
    return indexing.value.progress;
  });

  // Actions

  /**
   * Load RAG settings from persistent storage
   */
  async function loadSettings(): Promise<void> {
    try {
      // Check if RAG is available (requires LangChain)
      const availableResult = await window.api.rag.isEnabled();
      if (!availableResult.ok || !availableResult.enabled) {
        settings.value.enabled = false;
        return;
      }

      // Load user preferences
      const enabledResult = await window.api.settings.get('rag.enabled');
      if (enabledResult.ok && typeof enabledResult.value === 'boolean') {
        settings.value.enabled = enabledResult.value;
      }

      const topKResult = await window.api.settings.get('rag.topK');
      if (topKResult.ok && typeof topKResult.value === 'number') {
        settings.value.topK = topKResult.value;
      }

      const autoIndexResult = await window.api.settings.get('rag.autoIndex');
      if (autoIndexResult.ok && typeof autoIndexResult.value === 'boolean') {
        settings.value.autoIndex = autoIndexResult.value;
      }

      const showSourcesResult = await window.api.settings.get('rag.showSources');
      if (showSourcesResult.ok && typeof showSourcesResult.value === 'boolean') {
        settings.value.showSources = showSourcesResult.value;
      }

      // Load stats for current repository
      await refreshStats();
    } catch (error) {
      console.error('Failed to load RAG settings:', error);
    }
  }

  /**
   * Save RAG settings to persistent storage
   */
  async function saveSettings(): Promise<void> {
    try {
      await window.api.settings.set('rag.enabled', settings.value.enabled);
      await window.api.settings.set('rag.topK', settings.value.topK);
      await window.api.settings.set('rag.autoIndex', settings.value.autoIndex);
      await window.api.settings.set('rag.showSources', settings.value.showSources);
    } catch (error) {
      console.error('Failed to save RAG settings:', error);
    }
  }

  /**
   * Toggle RAG enabled state
   */
  async function toggleEnabled(): Promise<boolean> {
    try {
      // Check if RAG is available
      const result = await window.api.rag.isEnabled();
      if (!result.ok || !result.enabled) {
        throw new Error('RAG is not available. Ensure LangChain is enabled (USE_LANGCHAIN=true).');
      }

      settings.value.enabled = !settings.value.enabled;
      await saveSettings();
      return true;
    } catch (error) {
      console.error('Failed to toggle RAG:', error);
      return false;
    }
  }

  /**
   * Update RAG settings
   */
  async function updateSettings(updates: Partial<RAGSettings>): Promise<void> {
    Object.assign(settings.value, updates);
    await saveSettings();
  }

  /**
   * Index the current repository
   */
  async function indexRepository(onProgress?: (progress: IndexingProgress) => void): Promise<boolean> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    indexing.value.inProgress = true;
    indexing.value.error = null;
    indexing.value.progress = { total: 0, processed: 0, percentage: 0 };

    try {
      // Set up progress listener
      if (onProgress) {
        window.api.rag.onIndexProgress((progress) => {
          indexing.value.progress = progress;
          onProgress(progress);
        });
      }

      // Get AI config from context store
      const config = await getAIConfig();

      // Start indexing
      const result = await window.api.rag.indexRepository(
        contextStore.repoPath,
        config
      );

      if (result.ok) {
        stats.value.indexed = true;
        stats.value.documentCount = result.documentCount || 0;
        indexing.value.inProgress = false;
        return true;
      } else {
        throw new Error(result.error || 'Indexing failed');
      }
    } catch (error) {
      indexing.value.error = error instanceof Error ? error.message : 'Indexing failed';
      indexing.value.inProgress = false;
      console.error('Failed to index repository:', error);
      return false;
    }
  }

  /**
   * Query the RAG system
   */
  async function query(question: string, topK?: number): Promise<RAGQueryResult> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    if (!stats.value.indexed) {
      throw new Error('Repository not indexed. Please index the repository first.');
    }

    try {
      const config = await getAIConfig();
      const k = topK || settings.value.topK;

      const result = await window.api.rag.query(
        contextStore.repoPath,
        config,
        question,
        k
      );

      if (result.ok) {
        const queryResult: RAGQueryResult = {
          answer: result.answer || '',
          sources: result.sources || []
        };

        if ('usage' in result && result.usage) {
          queryResult.usage = result.usage as RAGQueryResult['usage'];
          queryResult.tokensUsed = result.usage?.totalTokens ?? result.usage?.completionTokens ?? result.usage?.promptTokens;
        } else if ('tokensUsed' in result) {
          queryResult.tokensUsed = result.tokensUsed as number | undefined;
        }

        if ('toolCalls' in result && Array.isArray(result.toolCalls)) {
          queryResult.toolCalls = result.toolCalls as RAGQueryResult['toolCalls'];
        }

        // Save to history
        const queryRecord: RAGQuery = {
          id: generateId(),
          question,
          result: queryResult,
          timestamp: Date.now()
        };

        queryHistory.value.push(queryRecord);
        lastQuery.value = queryRecord;
        activeSources.value = queryResult.sources;

        // Track token savings if provided
        if (queryResult.tokensUsed) {
          totalTokensSaved.value += queryResult.tokensUsed;
        }

        return queryResult;
      } else {
        throw new Error(result.error || 'Query failed');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'cancelled') {
        // TODO(RAG-UX): Surface cancellation feedback to UI when streaming integration lands.
        return {
          answer: '',
          sources: []
        };
      }

      console.error('Failed to query RAG:', error);
      throw error;
    }
  }

  /**
   * Stream a RAG query with token-by-token updates
   */
  async function* queryStream(
    question: string,
    topK?: number
  ): AsyncGenerator<{ type: 'source' | 'token' | 'done'; data?: any }> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    if (!stats.value.indexed) {
      throw new Error('Repository not indexed');
    }

    const config = await getAIConfig();
    const k = topK || settings.value.topK;

    const result = await window.api.rag.queryStream(
      contextStore.repoPath,
      config,
      question,
      k,
      generateId()
    );

    if (!result.ok) {
      throw new Error(result.error || 'Failed to start stream');
    }

    // Listen for stream events
    // Note: This would need IPC event handlers in the preload
    // For now, returning a placeholder
    yield { type: 'done' };
  }

  /**
   * Find entities similar to a given entity
   */
  async function findSimilar(entityId: string, limit = 5): Promise<SimilarEntity[]> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    try {
      const config = await getAIConfig();
      const result = await window.api.rag.findSimilar(
        contextStore.repoPath,
        config,
        entityId,
        limit
      );

      if (result.ok) {
        return result.similar || [];
      } else {
        throw new Error(result.error || 'Failed to find similar entities');
      }
    } catch (error) {
      console.error('Failed to find similar entities:', error);
      throw error;
    }
  }

  /**
   * Search for entities by query
   */
  async function search(query: string, limit = 10): Promise<RAGSource[]> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    try {
      const config = await getAIConfig();
      const result = await window.api.rag.search(
        contextStore.repoPath,
        config,
        query,
        limit
      );

      if (result.ok) {
        return result.results || [];
      } else {
        throw new Error(result.error || 'Search failed');
      }
    } catch (error) {
      console.error('Failed to search:', error);
      throw error;
    }
  }

  /**
   * Get context for a specific entity
   */
  async function getEntityContext(entityId: string): Promise<RAGQueryResult> {
    return query(`Provide context and related information for ${entityId}`, 5);
  }

  /**
   * Clear the RAG index
   */
  async function clearIndex(): Promise<boolean> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    try {
      const config = await getAIConfig();
      const result = await window.api.rag.clearIndex(
        contextStore.repoPath,
        config
      );

      if (result.ok) {
        stats.value.indexed = false;
        stats.value.documentCount = 0;
        activeSources.value = [];
        return true;
      } else {
        throw new Error(result.error || 'Failed to clear index');
      }
    } catch (error) {
      console.error('Failed to clear index:', error);
      return false;
    }
  }

  async function cancelActiveQuery(): Promise<boolean> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      return false;
    }

    try {
      const config = await getAIConfig();
      const result = await window.api.rag.cancelQuery(contextStore.repoPath, config);
      return !!(result.ok && result.cancelled);
    } catch (error) {
      console.error('Failed to cancel RAG query:', error);
      return false;
    }
  }

  async function cancelStream(streamId: string): Promise<boolean> {
    try {
      const result = await window.api.rag.cancelStream(streamId);
      return !!(result.ok && result.cancelled);
    } catch (error) {
      console.error('Failed to cancel RAG stream:', error);
      return false;
    }
  }

  /**
   * Refresh RAG statistics
   */
  async function refreshStats(): Promise<void> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      return;
    }

    try {
      const config = await getAIConfig();
      const result = await window.api.rag.getStatus(
        contextStore.repoPath,
        config
      );

      if (result.ok) {
        stats.value.indexed = result.indexed || false;
        stats.value.documentCount = result.documentCount || 0;
      }
    } catch (error) {
      console.error('Failed to refresh stats:', error);
    }
  }

  /**
   * Clear query history
   */
  function clearHistory(): void {
    queryHistory.value = [];
    lastQuery.value = null;
  }

  /**
   * Clear active sources
   */
  function clearSources(): void {
    activeSources.value = [];
  }

  /**
   * Clear last query sources
   */
  function clearLastQuerySources(): void {
    lastQuery.value = null;
  }

  /**
   * Helper to get AI config from settings
   */
  async function getAIConfig(): Promise<any> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    const response = await window.api.ai.getConfig(contextStore.repoPath);
    if (!response.ok || !response.config) {
      throw new Error(response.error || 'Failed to load AI configuration');
    }

    return response.config;
  }

  /**
   * Generate unique ID for queries
   */
  function generateId(): string {
    return `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  return {
    // State
    settings,
    indexing,
    stats,
    queryHistory,
    activeSources,
    lastQuery,
    totalTokensSaved,

    // Computed
    isIndexed,
    isReady,
    recentQueries,
    lastQuerySources,
    querySources,
    indexingProgress,

    // Actions
    loadSettings,
    saveSettings,
    toggleEnabled,
    updateSettings,
    indexRepository,
    query,
    queryStream,
    findSimilar,
    search,
    getEntityContext,
    clearIndex,
    cancelActiveQuery,
    cancelStream,
    refreshStats,
    clearHistory,
    clearSources,
    clearLastQuerySources
  };
});
