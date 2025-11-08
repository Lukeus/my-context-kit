/**
 * AIService - Unified AI interface wrapping LangChainAIService
 * 
 * Provides simplified API for AI operations with integrated prompt template loading.
 * Wraps existing LangChainAIService to maintain compatibility while adding new features.
 */

import { LangChainAIService, type AIConfig as LangChainAIConfig } from './LangChainAIService';
import { PromptRegistry } from '../../../domain/prompts/PromptRegistry';

export interface AIServiceConfig {
  azureEndpoint?: string;
  azureKey?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
  ollamaEndpoint?: string;
  defaultProvider: 'azure' | 'ollama';
  promptsPath: string;
}

export interface CompletionOptions {
  provider?: 'azure' | 'ollama';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface CompletionResult {
  text: string;
  tokensUsed?: number;
  provider: 'azure' | 'ollama';
  model: string;
  finishReason: string;
}

/**
 * AI Service providing unified interface for multiple providers
 */
export class AIService {
  private langChainService: LangChainAIService;
  private promptRegistry: PromptRegistry;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.langChainService = new LangChainAIService();
    this.promptRegistry = new PromptRegistry(config.promptsPath);
  }

  /**
   * Complete a prompt (non-streaming)
   */
  async complete(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    const aiConfig = this.buildAIConfig(options);
    
    // For non-streaming, we'll use a simple approach:
    // Collect all streamed tokens into a single result
    const tokens: string[] = [];
    
    for await (const token of this.langChainService.assistStream({
      config: aiConfig,
      question: prompt,
      conversationHistory: [],
      contextSnapshot: {},
    })) {
      tokens.push(token);
    }

    const text = tokens.join('');

    return {
      text,
      tokensUsed: this.estimateTokens(text),
      provider: aiConfig.provider === 'azure-openai' ? 'azure' : 'ollama',
      model: aiConfig.model,
      finishReason: 'stop',
    };
  }

  /**
   * Stream completion tokens
   */
  async *streamComplete(prompt: string, options?: CompletionOptions): AsyncGenerator<string> {
    const aiConfig = this.buildAIConfig(options);

    for await (const token of this.langChainService.assistStream({
      config: aiConfig,
      question: prompt,
      conversationHistory: [],
      contextSnapshot: {},
    })) {
      yield token;
    }
  }

  /**
   * Load a prompt template and render with variables
   */
  async loadPrompt(name: string, variables?: Record<string, string>): Promise<string> {
    const template = await this.promptRegistry.loadPrompt(name);
    return variables 
      ? this.promptRegistry.renderPrompt(template, variables) 
      : template.content;
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<string[]> {
    return await this.promptRegistry.listAvailablePrompts();
  }

  /**
   * Test provider connection
   */
  async testProvider(provider: 'azure' | 'ollama'): Promise<boolean> {
    const testConfig = this.buildAIConfig({ provider });
    
    try {
      await this.langChainService.testConnection({
        provider: testConfig.provider,
        endpoint: testConfig.endpoint,
        model: testConfig.model,
        apiKey: testConfig.apiKey,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available providers based on configuration
   */
  getAvailableProviders(): Array<'azure' | 'ollama'> {
    const providers: Array<'azure' | 'ollama'> = [];
    
    if (this.config.azureEndpoint && this.config.azureKey) {
      providers.push('azure');
    }
    
    if (this.config.ollamaEndpoint) {
      providers.push('ollama');
    }

    return providers;
  }

  /**
   * Estimate tokens (rough heuristic: ~4 chars = 1 token)
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Build LangChainAIService config from options
   */
  private buildAIConfig(options?: CompletionOptions): LangChainAIConfig {
    const provider = options?.provider || this.config.defaultProvider;

    if (provider === 'azure') {
      return {
        provider: 'azure-openai',
        endpoint: this.config.azureEndpoint || '',
        model: options?.model || this.config.azureDeployment || 'gpt-4',
        apiKey: this.config.azureKey,
        apiVersion: this.config.azureApiVersion || '2024-02-15-preview',
        enabled: true,
      };
    } else {
      // ollama
      return {
        provider: 'ollama',
        endpoint: this.config.ollamaEndpoint || 'http://localhost:11434',
        model: options?.model || 'llama2',
        enabled: true,
      };
    }
  }
}
