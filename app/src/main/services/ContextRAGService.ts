import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import type { Document } from '@langchain/core/documents';
import { ContextEmbeddingService, type EmbeddingMetadata } from './ContextEmbeddingService';
import { AICredentialResolver } from './AICredentialResolver';
import { logger } from '../utils/logger';
import type { AIConfig } from './LangChainAIService';
import { createProxyAwareFetch } from '../utils/proxyFetch';

export interface RAGQueryResult {
  answer: string;
  sources: Array<{
    id: string;
    title?: string;
    type: string;
    relevance: number;
    excerpt: string;
  }>;
  tokensUsed?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
}

// ContextRAGService: Provides retrieval‑augmented answering over the context repository.
// Simplified version with direct similarity search + prompt assembly.
// TODO(RAG-CHAIN): Introduce a proper retriever + answer synthesis RunnableSequence to leverage scores.
export class ContextRAGService {
  private model: ChatOpenAI | null = null; // Lazy-initialized on first query
  private chain: RunnableSequence | null = null; // Placeholder for future structured chain
  private credentialResolver = new AICredentialResolver();
  private activeAbortController: AbortController | null = null;

  constructor(
    private config: AIConfig,
    private embeddingService: ContextEmbeddingService
  ) {
    // Don't create model in constructor - defer until first query when credentials are resolved
    this.initializeChain();
  }

  // Create ChatOpenAI model instance. Supports Azure & Ollama providers.
  private createChatModel(apiKey?: string): ChatOpenAI {
    const finalKey = apiKey || (this.config.provider === 'ollama' ? 'ollama-no-key-required' : '');
    
    const baseURL = this.config.provider === 'azure-openai'
      ? `${this.config.endpoint.replace(/\/$/, '')}/openai/deployments/${this.config.model}`
      : undefined;
    
    logger.debug(
      { service: 'ContextRAGService', method: 'createChatModel' },
      `Creating ChatOpenAI with provider=${this.config.provider}, apiKey=${apiKey ? `present(${apiKey.length})` : 'MISSING'}, finalKey=${finalKey ? `present(${finalKey.length})` : 'MISSING'}, endpoint=${this.config.endpoint}, baseURL=${baseURL}`
    );
    
    const fetchImpl = createProxyAwareFetch(baseURL ?? this.config.endpoint, {
      signalProvider: () => this.activeAbortController?.signal,
    });
    
    return new ChatOpenAI({
      apiKey: finalKey, // Changed from openAIApiKey to apiKey for Azure OpenAI compatibility
      modelName: this.config.model,
      temperature: 1.0,
      maxTokens: 2000,
      timeout: 60000, // 60 second timeout
      maxRetries: 2,
      configuration: {
        baseURL,
        defaultQuery: this.config.provider === 'azure-openai'
          ? { 'api-version': '2024-12-01-preview' }
          : undefined,
        defaultHeaders: this.config.provider === 'azure-openai'
          ? { 'api-key': finalKey }
          : undefined,
        fetch: fetchImpl
      }
    });
  }

  private initializeChain(): void {
    if (!this.embeddingService.isIndexed()) {
      logger.warn({ service: 'ContextRAGService', method: 'initializeChain' }, 'Embeddings not indexed yet.');
      return;
    }
    // Chain will be created per query (for now).
    this.chain = null;
  }

  /**
   * Ensure the chat model is initialized with proper credentials.
   * Called lazily on first query to avoid constructor-time errors.
   */
  private async ensureModelInitialized(): Promise<void> {
    if (this.model) {
      logger.debug({ service: 'ContextRAGService', method: 'ensureModelInitialized' }, 'Model already initialized, skipping.');
      return; // Already initialized
    }

    logger.debug(
      { service: 'ContextRAGService', method: 'ensureModelInitialized' },
      `Starting model init - provider: ${this.config.provider}, hasApiKey: ${!!this.config.apiKey}, apiKeyLength: ${this.config.apiKey?.length || 0}`
    );

    // Resolve API key if missing (Azure only for now)
    if (this.config.provider === 'azure-openai' && (!this.config.apiKey || this.config.apiKey.length < 10)) {
      logger.debug({ service: 'ContextRAGService', method: 'ensureModelInitialized' }, 'API key missing or invalid, attempting to resolve from credential store.');
      const resolved = await this.credentialResolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });
      if (!resolved) {
        throw new Error('Missing Azure OpenAI API key for chat model. Configure credentials in AI Settings.');
      }
      this.config.apiKey = resolved;
      logger.debug({ service: 'ContextRAGService', method: 'ensureModelInitialized' }, 'Resolved API key from credentials store.');
    }

    // Create the model
    this.model = this.createChatModel(this.config.apiKey);
    logger.debug({ service: 'ContextRAGService', method: 'ensureModelInitialized' }, 'Chat model initialized successfully.');
  }

  async query(question: string, topK = 4): Promise<RAGQueryResult> {
    if (!this.embeddingService.isIndexed()) {
      throw new Error('Repository not indexed. Call embeddingService.indexRepository() first.');
    }

    // Ensure model is created with proper credentials
    if (!this.model) {
      await this.ensureModelInitialized();
    }

    return logger.logServiceCall(
      { service: 'ContextRAGService', method: 'query', question, topK },
      async () => {
        logger.debug({ service: 'ContextRAGService', method: 'query' }, 'Starting similarity search...');
        const docs = await this.embeddingService.similaritySearch(question, topK);
        logger.debug({ service: 'ContextRAGService', method: 'query' }, `Found ${docs.length} similar documents`);
        
        const context = docs.map(d => d.pageContent).join('\n\n');
        logger.debug({ service: 'ContextRAGService', method: 'query' }, `Context length: ${context.length} chars`);
        
        const prompt = ChatPromptTemplate.fromMessages([
          [
            'system',
            'You are a helpful assistant for a context repository.\n\nUse the provided context to answer. Cite entity IDs.\n\nContext:\n{context}'
          ],
          ['human', '{question}']
        ]);
        logger.debug({ service: 'ContextRAGService', method: 'query' }, 'Creating messages for streaming...');
        const formattedMessages = await prompt.formatMessages({ context, question });
        logger.debug({ service: 'ContextRAGService', method: 'query' }, 'Starting streamed completion...');

        const controller = this.startNewAbortScope();
        let aggregation;
        try {
          aggregation = await this.collectStreamedAnswer(formattedMessages, controller.signal);
        } finally {
          this.clearAbortScope(controller);
        }

        logger.debug({ service: 'ContextRAGService', method: 'query' }, `Received answer: ${aggregation.answer.length} chars`);
        
        const sources = docs.map((doc: Document<EmbeddingMetadata>) => ({
          id: doc.metadata.id,
          title: doc.metadata.title,
          type: doc.metadata.type,
          relevance: 100, // TODO(RELEVANCE-SCORE): Replace with actual similarity score.
          excerpt: doc.pageContent.slice(0, 150) + '...'
        }));
        const result: RAGQueryResult = {
          answer: aggregation.answer,
          sources,
        };

        if (aggregation.usage) {
          result.usage = aggregation.usage;
          result.tokensUsed = aggregation.usage.totalTokens ?? aggregation.usage.completionTokens ?? aggregation.usage.promptTokens;
        }

        if (aggregation.toolCalls.length > 0) {
          result.toolCalls = aggregation.toolCalls;
        }

        return result;
      }
    );
  }

  async queryWithDocs(question: string, topK = 4): Promise<{ answer: string; documents: Document<EmbeddingMetadata>[] }>{
    if (!this.embeddingService.isIndexed()) {
      throw new Error('Repository not indexed. Call embeddingService.indexRepository() first.');
    }
    
    // Ensure model is created with proper credentials
    if (!this.model) {
      await this.ensureModelInitialized();
    }
    
    return logger.logServiceCall(
      { service: 'ContextRAGService', method: 'queryWithDocs', question, topK },
      async () => {
        const documents = await this.embeddingService.similaritySearch(question, topK);
        const context = documents.map(d => d.pageContent).join('\n\n');
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', 'You are a helpful assistant for a context repository.\n\nContext:\n{context}'],
          ['human', '{question}']
        ]);
        const formattedMessages = await prompt.formatMessages({ context, question });
        const controller = this.startNewAbortScope();
        try {
          const aggregation = await this.collectStreamedAnswer(formattedMessages, controller.signal);
          return { answer: aggregation.answer, documents };
        } finally {
          this.clearAbortScope(controller);
        }
      }
    );
  }

  async* streamQuery(
    question: string,
    topK = 4,
    options?: { signal?: AbortSignal }
  ): AsyncIterableIterator<{ type: 'source' | 'token' | 'done'; data?: any }>{
    if (!this.embeddingService.isIndexed()) {
      throw new Error('Repository not indexed. Call embeddingService.indexRepository() first.');
    }
    
    // Ensure model is created with proper credentials
    if (!this.model) {
      await this.ensureModelInitialized();
    }
    
    const docs = await this.embeddingService.similaritySearch(question, topK);
    yield {
      type: 'source',
      data: docs.map(d => ({
        id: d.metadata.id,
        title: d.metadata.title,
        type: d.metadata.type,
        excerpt: d.pageContent.slice(0, 150)
      }))
    };
    const context = docs.map(d => d.pageContent).join('\n\n');
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', 'You are a helpful assistant for a context repository.\n\nContext:\n{context}'],
      ['human', '{question}']
    ]);
    const formatted = await prompt.formatMessages({ context, question });
    const controller = options?.signal ? null : this.startNewAbortScope();
    const signal = options?.signal ?? controller?.signal;
    const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
    let usage: RAGQueryResult['usage'] | undefined;

    try {
      const stream = await this.model!.stream(formatted as any, { signal });
      for await (const chunk of stream) {
        const { content, toolCall } = this.normalizeChunk(chunk);
        if (toolCall) {
          toolCalls.push(toolCall);
          yield { type: 'token', data: `\n[Tool: ${toolCall.name}]\n` };
        }

        if (content) {
          yield { type: 'token', data: content };
        }

        usage = this.mergeUsage(usage, this.extractUsage(chunk));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      throw err;
    } finally {
      if (controller) {
        this.clearAbortScope(controller);
      }
    }

    yield {
      type: 'done',
      data: {
        usage,
        toolCalls,
      },
    };
  }

  async getEntityContext(entityId: string): Promise<RAGQueryResult> {
    return this.query(`Provide a brief overview of ${entityId}, including its purpose and related entities.`, 5);
  }

  async findByTopic(topic: string, limit = 10): Promise<Array<{ id: string; title?: string; type: string; relevance: number; excerpt: string }>> {
    return this.embeddingService.search(topic, limit);
  }

  reinitialize(): void {
    // Reset chain and model when reinitializing so new credentials can be applied
    this.chain = null;
    this.model = null; // Force re-create with latest config/apiKey
    this.initializeChain();
  }

  /**
   * Update configuration (e.g., after resolving credentials) and reset model.
   */
  updateConfig(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Force model recreation on next query if apiKey was added/changed
    this.model = null;
    logger.debug({ service: 'ContextRAGService', method: 'updateConfig' }, 'Config updated; model will be recreated on next query.');
  }

  isReady(): boolean {
    return this.embeddingService.isIndexed();
  }

  ensureReady(): void {
    if (this.embeddingService.isIndexed() && !this.chain) {
      this.initializeChain();
    }
  }

  private async collectStreamedAnswer(
    messages: unknown,
    signal: AbortSignal
  ): Promise<{ answer: string; usage?: RAGQueryResult['usage']; toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> }> {
    if (!this.model) {
      throw new Error('Chat model not initialized');
    }

    const stream = await this.model.stream(messages as any, { signal });
    let answer = '';
    const toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
    let usage: RAGQueryResult['usage'] | undefined;

    for await (const chunk of stream) {
      const { content, toolCall } = this.normalizeChunk(chunk);
      if (toolCall) {
        toolCalls.push(toolCall);
      }

      if (content) {
        answer += content;
      }

      usage = this.mergeUsage(usage, this.extractUsage(chunk));
    }

    return {
      answer: answer.trim(),
      usage,
      toolCalls,
    };
  }

  private extractChunkText(content: unknown): string {
    if (!content) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map(part => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (typeof part === 'object' && 'text' in (part as Record<string, unknown>)) {
            const text = (part as Record<string, unknown>).text;
            return typeof text === 'string' ? text : '';
          }
          return '';
        })
        .join('');
    }

    if (typeof content === 'object' && 'text' in (content as Record<string, unknown>)) {
      const text = (content as Record<string, unknown>).text;
      return typeof text === 'string' ? text : '';
    }

    return '';
  }

  private normalizeChunk(chunk: unknown): {
    content: string;
    toolCall?: { id: string; name: string; args: Record<string, unknown> };
  } {
    const raw = chunk as { content?: unknown; additional_kwargs?: any } | undefined;
    const content = this.extractChunkText(raw?.content);
    const toolCall = this.extractToolCall(raw?.additional_kwargs);

    return { content, toolCall };
  }

  private extractToolCall(additional: unknown): { id: string; name: string; args: Record<string, unknown> } | undefined {
    if (!additional || typeof additional !== 'object') {
      return undefined;
    }

    const calls = (additional as { tool_calls?: any[] }).tool_calls;
    if (!Array.isArray(calls) || calls.length === 0) {
      return undefined;
    }

    const call = calls[0];
    if (!call?.function?.name) {
      return undefined;
    }

    let args: Record<string, unknown> = {};
    try {
      args = typeof call.function.arguments === 'string'
        ? JSON.parse(call.function.arguments)
        : call.function.arguments ?? {};
    } catch {
      // TODO(RAG-TOOLING): Surface argument parsing issues via telemetry once tool execution is wired up.
      args = {};
    }

    return {
      id: String(call.id ?? `tool-${Date.now()}`),
      name: call.function.name,
      args,
    };
  }

  private extractUsage(chunk: unknown): RAGQueryResult['usage'] | undefined {
    const metadataCandidate = chunk as { response_metadata?: any; usage_metadata?: any } | undefined;
    const metadata = metadataCandidate?.response_metadata ?? {};
    const usage = metadata.tokenUsage ?? metadataCandidate?.usage_metadata;

    if (!usage || typeof usage !== 'object') {
      return undefined;
    }

    const prompt = typeof usage.promptTokens === 'number' ? usage.promptTokens : usage.prompt_tokens;
    const completion = typeof usage.completionTokens === 'number' ? usage.completionTokens : usage.completion_tokens;
    const total = typeof usage.totalTokens === 'number' ? usage.totalTokens : usage.total_tokens;

    if (prompt === undefined && completion === undefined && total === undefined) {
      return undefined;
    }

    return {
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: total,
    };
  }

  private mergeUsage(
    existing: RAGQueryResult['usage'] | undefined,
    incoming: RAGQueryResult['usage'] | undefined
  ): RAGQueryResult['usage'] | undefined {
    if (!incoming) {
      return existing;
    }

    if (!existing) {
      return { ...incoming };
    }

    return {
      promptTokens: this.coalesceNumber(existing.promptTokens, incoming.promptTokens),
      completionTokens: this.coalesceNumber(existing.completionTokens, incoming.completionTokens),
      totalTokens: this.coalesceNumber(existing.totalTokens, incoming.totalTokens),
    };
  }

  private coalesceNumber(current?: number, update?: number): number | undefined {
    if (typeof update === 'number' && update > 0) {
      return update;
    }
    return typeof current === 'number' && current > 0 ? current : undefined;
  }

  cancelActiveQuery(): boolean {
    if (!this.activeAbortController) {
      return false;
    }
    this.activeAbortController.abort();
    this.activeAbortController = null;
    return true;
  }

  private startNewAbortScope(): AbortController {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();
    return this.activeAbortController;
  }

  private clearAbortScope(controller: AbortController): void {
    if (this.activeAbortController === controller) {
      this.activeAbortController = null;
    }
  }
}
