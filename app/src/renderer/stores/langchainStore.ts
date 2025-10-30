import { defineStore } from 'pinia';
import { ref, computed, reactive } from 'vue';
import { useContextStore } from './contextStore';

interface LangChainMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  lastRequestTimestamp: number | null;
}

interface StreamMetrics {
  streamId: string;
  startTime: number;
  firstTokenTime: number | null;
  tokenCount: number;
  completed: boolean;
}

/**
 * Store for LangChain AI implementation feature flag and metrics.
 * 
 * This store manages:
 * - Runtime feature flag toggle (persisted to settings)
 * - Performance metrics and monitoring
 * - Streaming state management
 * - Cache statistics
 * 
 * The feature flag allows switching between legacy AI and LangChain
 * implementations without restarting the app.
 */
export const useLangChainStore = defineStore('langchain', () => {
  // State
  const enabled = ref(false);
  const isChecking = ref(false);
  const metrics = reactive<LangChainMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    totalTokensUsed: 0,
    lastRequestTimestamp: null
  });
  // Use a reactive object keyed by streamId to avoid manual ref reassigns
  const activeStreams = reactive<Record<string, StreamMetrics>>({});

  // Computed
  const successRate = computed(() => {
    if (metrics.totalRequests === 0) return 0;
    return (metrics.successfulRequests / metrics.totalRequests) * 100;
  });

  const cacheHitRate = computed(() => {
    const total = metrics.cacheHits + metrics.cacheMisses;
    if (total === 0) return 0;
    return (metrics.cacheHits / total) * 100;
  });

  const hasActiveStreams = computed(() => Object.keys(activeStreams).length > 0);

  const activeStreamCount = computed(() => Object.keys(activeStreams).length);

  // Actions

  /**
   * Load feature flag from environment and settings
   */
  async function loadSettings(): Promise<void> {
    try {
      // Check environment variable first (server-side flag)
      const envResult = await window.api.langchain.isEnabled();
      const envEnabled = envResult.ok && envResult.enabled;

      // Check user preference
      const prefResult = await window.api.settings.get('langchain.enabled');
      const prefEnabled = prefResult.ok && prefResult.value === true;

      // Enable LangChain if either the environment enables it or the user has persisted the preference
      enabled.value = Boolean(envEnabled || prefEnabled);
    } catch (error) {
      console.error('Failed to load LangChain settings:', error);
      enabled.value = false;
    }
  }

  /**
   * Toggle LangChain feature flag
   */
  async function toggle(): Promise<boolean> {
    try {
      const newValue = !enabled.value;

      // Save preference (persist to app settings)
      const saveResult = await window.api.settings.set('langchain.enabled', newValue);
      if (!saveResult.ok) {
        throw new Error(saveResult.error || 'Failed to save setting');
      }

      enabled.value = newValue;
      return true;
    } catch (error) {
      console.error('Failed to toggle LangChain:', error);
      return false;
    }
  }

  /**
   * Check if LangChain is available (environment check)
   */
  async function checkAvailability(): Promise<boolean> {
    isChecking.value = true;
    try {
      const result = await window.api.langchain.isEnabled();
      return result.ok && !!result.enabled;
    } catch (error) {
      console.error('Failed to check LangChain availability:', error);
      return false;
    } finally {
      isChecking.value = false;
    }
  }

  /**
   * Test connection to AI provider
   */
  async function testConnection(provider: string, endpoint: string, model: string, apiKey?: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      const result = await window.api.langchain.testConnection({
        provider,
        endpoint,
        model,
        apiKey
      });

      const responseTime = Date.now() - startTime;

      if (result.ok) {
        recordRequest(true, responseTime);
        return result.message || 'Connection successful';
      } else {
        recordRequest(false, responseTime);
        throw new Error(result.error || 'Connection test failed');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      recordRequest(false, responseTime);
      throw error;
    }
  }

  /**
   * Generate entity using LangChain
   */
  async function generateEntity(entityType: string, userPrompt: string, apiKey?: string): Promise<any> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    const startTime = Date.now();

    try {
      const result = await window.api.langchain.generateEntity(
        contextStore.repoPath,
        entityType,
        userPrompt,
        apiKey
      );

      const responseTime = Date.now() - startTime;

      if (result.ok) {
        recordRequest(true, responseTime);
        return result.entity;
      } else {
        recordRequest(false, responseTime);
        throw new Error(result.error || 'Entity generation failed');
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      recordRequest(false, responseTime);
      throw error;
    }
  }

  /**
   * Start streaming assistant conversation
   */
  async function startAssistStream(
    question: string,
    conversationHistory?: Array<{ role: string; content: string }>,
    contextSnapshot?: any
  ): Promise<string> {
    const contextStore = useContextStore();
    if (!contextStore.repoPath) {
      throw new Error('No repository selected');
    }

    const result = await window.api.langchain.assistStreamStart(
      contextStore.repoPath,
      question,
      conversationHistory,
      contextSnapshot
    );

    if (result.ok && result.streamId) {
      // Track stream metrics
      activeStreams[result.streamId] = {
        streamId: result.streamId,
        startTime: Date.now(),
        firstTokenTime: null,
        tokenCount: 0,
        completed: false
      };

      return result.streamId;
    } else {
      throw new Error(result.error || 'Failed to start stream');
    }
  }

  /**
   * Cancel an active stream
   */
  async function cancelStream(streamId: string): Promise<void> {
    // Defensive: if we don't have the stream tracked locally, treat as success
    if (!activeStreams[streamId]) {
      try { console.log('[LangChainStore] cancelStream called for unknown streamId, ignoring', { streamId }); } catch {}
      return;
    }

    const result = await window.api.langchain.assistStreamCancel(streamId);
    // If the backend reports stream not found, we consider it a successful cancellation
    if (!result.ok && result.error && result.error.toLowerCase().includes('stream not found')) {
      try { console.log('[LangChainStore] assistStreamCancel: backend reports stream not found; treating as cancelled', { streamId }); } catch {}
      delete activeStreams[streamId];
      return;
    }

    if (!result.ok) {
      throw new Error(result.error || 'Failed to cancel stream');
    }

    delete activeStreams[streamId];
  }

  /**
   * Record stream token
   */
  function recordStreamToken(streamId: string): void {
    const stream = activeStreams[streamId];
    if (stream) {
      if (stream.firstTokenTime === null) {
        stream.firstTokenTime = Date.now();
      }
      stream.tokenCount++;
      try { console.log('[LangChainStore] recordStreamToken', { streamId, tokenCount: stream.tokenCount }); } catch {}
    }
  }

  /**
   * Mark stream as completed
   */
  function completeStream(streamId: string): void {
    const stream = activeStreams[streamId];
    if (stream) {
      stream.completed = true;
      const totalTime = Date.now() - stream.startTime;
      recordRequest(true, totalTime);

      // Clean up after a delay
      setTimeout(() => {
        delete activeStreams[streamId];
      }, 5000);
      try { console.log('[LangChainStore] completeStream', { streamId, totalTime }); } catch {}
    }
  }

  /**
   * Clear model cache
   */
  async function clearCache(): Promise<void> {
    const result = await window.api.langchain.clearCache();
    if (!result.ok) {
      throw new Error(result.error || 'Failed to clear cache');
    }
    
    // Reset cache metrics
    metrics.cacheHits = 0;
    metrics.cacheMisses = 0;
    try { console.log('[LangChainStore] clearCache, metrics reset', metrics); } catch {}
  }

  /**
   * Record a request for metrics
   */
  function recordRequest(success: boolean, responseTime: number): void {
    metrics.totalRequests++;

    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Update average response time (running average)
    const prevTotal = metrics.averageResponseTime * (metrics.totalRequests - 1);
    metrics.averageResponseTime = (prevTotal + responseTime) / metrics.totalRequests;

    metrics.lastRequestTimestamp = Date.now();
    try { console.log('[LangChainStore] recordRequest', { success, responseTime, metrics }); } catch {}
  }

  /**
   * Record cache hit/miss
   */
  function recordCacheAccess(hit: boolean): void {
    if (hit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }
  }

  /**
   * Reset metrics
   */
  function resetMetrics(): void {
    metrics.totalRequests = 0;
    metrics.successfulRequests = 0;
    metrics.failedRequests = 0;
    metrics.cacheHits = 0;
    metrics.cacheMisses = 0;
    metrics.averageResponseTime = 0;
    metrics.totalTokensUsed = 0;
    metrics.lastRequestTimestamp = null;
  }

  /**
   * Get stream metrics for a specific stream
   */
  function getStreamMetrics(streamId: string): StreamMetrics | undefined {
    return activeStreams[streamId];
  }

  return {
    // State
    enabled,
    isChecking,
    metrics,
    activeStreams,

    // Computed
    successRate,
    cacheHitRate,
    hasActiveStreams,
    activeStreamCount,

    // Actions
    loadSettings,
    toggle,
    checkAvailability,
    testConnection,
    generateEntity,
    startAssistStream,
    cancelStream,
    recordStreamToken,
    completeStream,
    clearCache,
    recordRequest,
    recordCacheAccess,
    resetMetrics,
    getStreamMetrics
  };
});
