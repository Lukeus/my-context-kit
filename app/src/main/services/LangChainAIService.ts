import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { z } from 'zod';
import { logger } from '../utils/logger';
import { AICredentialResolver } from './AICredentialResolver';

export interface AIConfig {
  provider: string;
  endpoint: string;
  model: string;
  enabled: boolean;
  embeddingModel?: string;
  apiKey?: string;
  [key: string]: unknown;
}

export interface TestConnectionOptions {
  provider: string;
  endpoint: string;
  model: string;
  apiKey?: string;
}

export interface GenerateEntityOptions {
  config: AIConfig;
  entityType: string;
  userPrompt: string;
  schema: z.ZodSchema;
}

export interface AssistStreamOptions {
  config: AIConfig;
  question: string;
  conversationHistory: Array<{ role: string; content: string }>;
  contextSnapshot: any;
}

/**
 * LangChain-powered AI service that provides unified interface for multiple providers.
 * 
 * This service replaces the custom ai-common.mjs implementation with battle-tested
 * LangChain abstractions for streaming, error handling, and provider management.
 * 
 * Features:
 * - Unified provider interface (Azure OpenAI, Ollama)
 * - Built-in streaming support with automatic error handling
 * - Structured output parsing with Zod schemas
 * - Automatic retry logic
 * - Model caching for performance
 * 
 * @example
 * ```typescript
 * const service = new LangChainAIService();
 * 
 * // Test connection
 * await service.testConnection({ provider: 'azure-openai', ... });
 * 
 * // Generate entity with guaranteed valid output
 * const entity = await service.generateEntity({
 *   config,
 *   entityType: 'feature',
 *   userPrompt: 'Create OAuth authentication feature',
 *   schema: featureSchema
 * });
 * 
 * // Stream assistant responses
 * for await (const token of service.assistStream({ config, question, ... })) {
 *   console.log(token);
 * }
 * ```
 */
export class LangChainAIService {
  private models: Map<string, BaseChatModel> = new Map();
  private credentialResolver = new AICredentialResolver();

  /**
   * Normalize proxy-related environment variables and return a copy to use when
   * constructing child clients or making network requests. This mirrors the
   * proxy wiring used by AIService (which sets HTTPS_PROXY/HTTP_PROXY/NO_PROXY
   * when spawning external processes).
   */
  private getProxyEnv(): Record<string, string> {
    return {
      HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
      HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
      NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
    };
  }

  /**
   * Get or create a cached chat model instance for the given configuration.
   * Models are cached by provider:endpoint:model key to avoid recreation.
   * 
   * @param config - AI configuration including provider, endpoint, and model
   * @returns Configured LangChain chat model instance
   * @throws {Error} If provider is unknown or configuration is invalid
   */
  private async getModel(config: AIConfig): Promise<BaseChatModel> {
    const key = `${config.provider}:${config.endpoint}:${config.model}`;
    
    if (this.models.has(key)) {
      logger.debug({ service: 'LangChainAIService', method: 'getModel' }, `Using cached model: ${key}`);
      return this.models.get(key)!;
    }

    let model: BaseChatModel;

    if (config.provider === 'azure-openai') {
      logger.info({ service: 'LangChainAIService', method: 'getModel' }, `Creating Azure OpenAI model: ${config.model}`);
      const proxyEnv = this.getProxyEnv();

      // Mirror AIService: ensure proxy environment variables are set before
      // constructing HTTP clients so underlying libraries pick them up.
      // Set both uppercase and lowercase variants and always set the keys
      // (use empty string when unset) to match AIService child-process env.
      process.env.HTTPS_PROXY = proxyEnv.HTTPS_PROXY;
      process.env.https_proxy = proxyEnv.HTTPS_PROXY;
      process.env.HTTP_PROXY = proxyEnv.HTTP_PROXY;
      process.env.http_proxy = proxyEnv.HTTP_PROXY;
      process.env.NO_PROXY = proxyEnv.NO_PROXY;
      process.env.no_proxy = proxyEnv.NO_PROXY;

      // Resolve API key using unified resolver (explicit → stored → env)
      const resolvedKey = await this.credentialResolver.resolveApiKey({
        provider: config.provider,
        explicitKey: config.apiKey as string | undefined,
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      if (!resolvedKey) {
        throw new Error('No API key found for Azure OpenAI. Please configure credentials in settings.');
      }

      // Azure OpenAI uses 'api-key' header, not 'Authorization: Bearer'
      // We must pass the key in defaultHeaders for Azure endpoints
      model = new ChatOpenAI({
        // Don't pass openAIApiKey - it sets Authorization header which Azure doesn't use
        configuration: {
          baseURL: `${config.endpoint}/openai/deployments/${config.model}`,
          defaultQuery: { 'api-version': '2024-12-01-preview' },
          defaultHeaders: {
            'api-key': resolvedKey,
            'Content-Type': 'application/json'
          },
        },
        modelName: config.model,
        temperature: 0.7,
        maxTokens: 4000,
        timeout: 60000, // 60 second timeout
        maxRetries: 2, // Automatic retry on failure
      });
    } else if (config.provider === 'ollama') {
      logger.info({ service: 'LangChainAIService', method: 'getModel' }, `Creating Ollama model: ${config.model}`);
      
      const proxyEnv = this.getProxyEnv();
      // Same proxy parity as above
      process.env.HTTPS_PROXY = proxyEnv.HTTPS_PROXY;
      process.env.https_proxy = proxyEnv.HTTPS_PROXY;
      process.env.HTTP_PROXY = proxyEnv.HTTP_PROXY;
      process.env.http_proxy = proxyEnv.HTTP_PROXY;
      process.env.NO_PROXY = proxyEnv.NO_PROXY;
      process.env.no_proxy = proxyEnv.NO_PROXY;

      model = new ChatOpenAI({
        configuration: {
          baseURL: config.endpoint,
        },
        modelName: config.model,
        temperature: 0.7,
      }) as unknown as BaseChatModel;
    } else {
      throw new Error(`Unknown provider: ${config.provider}. Supported: azure-openai, ollama`);
    }

    this.models.set(key, model);
    return model;
  }

  /**
   * Extract Azure instance name from endpoint URL.
   * 
   * @param endpoint - Azure OpenAI endpoint URL
   * @returns Instance name extracted from URL
   * 
   * @example
   * extractAzureInstanceName('https://myinstance.openai.azure.com') // => 'myinstance'
   */
  private extractAzureInstanceName(endpoint: string): string {
    const match = endpoint.match(/https?:\/\/([^.]+)\.openai\.azure\.com/);
    return match ? match[1] : 'default';
  }

  /**
   * Test connection to the AI provider.
   * 
   * Validates that the provider is accessible and credentials are correct by
   * sending a simple test message and verifying the response.
   * 
   * @param options - Connection test options
   * @returns Success message confirming connection
   * @throws {Error} If connection fails or credentials are invalid
   * 
   * @example
   * ```typescript
   * const result = await service.testConnection({
   *   provider: 'azure-openai',
   *   endpoint: 'https://myinstance.openai.azure.com',
   *   model: 'gpt-4',
   *   apiKey: 'sk-...'
   * });
   * console.log(result); // "Connection successful to Azure OpenAI model gpt-4"
   * ```
   */
  async testConnection(options: TestConnectionOptions): Promise<string> {
    return logger.logServiceCall(
      { service: 'LangChainAIService', method: 'testConnection', provider: options.provider },
      async () => {
        const model = await this.getModel({
          provider: options.provider,
          endpoint: options.endpoint,
          model: options.model,
          apiKey: options.apiKey,
          enabled: true
        });

        try {
          const response = await model.invoke([
            new HumanMessage('Respond with "Connection successful" if you can see this message.')
          ]);

          const content = typeof response.content === 'string' 
            ? response.content 
            : JSON.stringify(response.content);

          logger.info(
            { service: 'LangChainAIService', method: 'testConnection' }, 
            `Connection test successful: ${content.substring(0, 100)}`
          );

          return `Connection successful to ${options.provider} model ${options.model}`;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(
            { service: 'LangChainAIService', method: 'testConnection' },
            new Error(`Connection test failed: ${message}`)
          );
          throw new Error(`Connection test failed: ${message}`);
        }
      }
    );
  }

  /**
   * Generate a context entity with structured output validation.
   * 
   * Uses LangChain's StructuredOutputParser with Zod schemas to guarantee
   * the generated entity matches the expected structure. Automatically retries
   * if the AI generates invalid output.
   * 
   * @param options - Entity generation options
   * @returns Generated entity matching the provided Zod schema
   * @throws {Error} If AI is disabled, generation fails, or max retries exceeded
   * 
   * @example
   * ```typescript
   * const entity = await service.generateEntity({
   *   config: { provider: 'azure-openai', ... },
   *   entityType: 'feature',
   *   userPrompt: 'Create a feature for OAuth authentication with Google and GitHub',
   *   schema: z.object({
   *     id: z.string().regex(/^FEAT-\d{3}$/),
   *     title: z.string(),
   *     status: z.enum(['draft', 'in-progress', 'done']),
   *     objective: z.string()
   *   })
   * });
   * // entity is guaranteed to match schema
   * ```
   */
  async generateEntity(options: GenerateEntityOptions): Promise<any> {
    return logger.logServiceCall(
      { service: 'LangChainAIService', method: 'generateEntity', entityType: options.entityType },
      async () => {
        if (!options.config.enabled) {
          throw new Error('AI assistance is disabled in configuration');
        }

        const model = await this.getModel(options.config);
        const parser = StructuredOutputParser.fromZodSchema(options.schema);

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', this.getEntityGenerationSystemPrompt()],
          ['human', 'Entity type: {entityType}\n\nRequirements: {userPrompt}\n\n{format_instructions}']
        ]);

        const chain = RunnableSequence.from([
          prompt,
          model,
          parser
        ]);

        try {
          const result = await chain.invoke({
            entityType: options.entityType,
            userPrompt: options.userPrompt,
            format_instructions: parser.getFormatInstructions()
          });

          logger.info(
            { service: 'LangChainAIService', method: 'generateEntity' },
            `Successfully generated ${options.entityType} entity`
          );

          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(
            { service: 'LangChainAIService', method: 'generateEntity' },
            new Error(`Entity generation failed: ${message}`)
          );
          throw new Error(`Entity generation failed: ${message}`);
        }
      }
    );
  }

  /**
   * Stream conversational AI assistance with message history.
   * 
   * Provides real-time token-by-token streaming responses using LangChain's
   * built-in streaming capabilities. Handles conversation history automatically
   * and includes repository context in the system prompt.
   * 
   * @param options - Streaming assistance options
   * @yields Individual tokens from the AI response
   * @throws {Error} If AI is disabled or streaming fails
   * 
   * @example
   * ```typescript
   * for await (const token of service.assistStream({
   *   config,
   *   question: 'What features depend on FEAT-001?',
   *   conversationHistory: [
   *     { role: 'user', content: 'Show me all features' },
   *     { role: 'assistant', content: 'Here are the features...' }
   *   ],
   *   contextSnapshot: { features: [...], userStories: [...] }
   * })) {
   *   process.stdout.write(token);
   * }
   * ```
   */
  async* assistStream(options: AssistStreamOptions): AsyncIterableIterator<string> {
    if (!options.config.enabled) {
      throw new Error('AI assistance is disabled in configuration');
    }

    // Verify credentials are available before creating model
    // Note: We check if we can resolve a key, including explicit keys passed in config
    if (options.config.provider === 'azure-openai') {
      logger.debug(
        { service: 'LangChainAIService', method: 'assistStream' },
        `Resolving API key - has config.apiKey: ${!!options.config.apiKey}, provider: ${options.config.provider}`
      );
      
      const resolvedKey = await this.credentialResolver.resolveApiKey({
        provider: options.config.provider,
        explicitKey: options.config.apiKey as string | undefined,
        useStoredCredentials: true,
        useEnvironmentVars: true
      });
      
      logger.debug(
        { service: 'LangChainAIService', method: 'assistStream' },
        `API key resolution result: ${resolvedKey ? 'Found' : 'Not found'}`
      );
      
      if (!resolvedKey) {
        const msg = 'No API key found for provider azure-openai. Please save credentials or set OPENAI_API_KEY/AZURE_OPENAI_KEY.';
        logger.error({ service: 'LangChainAIService', method: 'assistStream' }, new Error(msg));
        throw new Error(msg);
      }
    }

    const model = await this.getModel(options.config);

    // Build message history
    const messages: BaseMessage[] = [
      new SystemMessage(this.buildSystemPrompt(options.contextSnapshot))
    ];

    // Add conversation history
    for (const msg of options.conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      }
    }

    // Add current question
    messages.push(new HumanMessage(options.question));

    logger.info(
      { service: 'LangChainAIService', method: 'assistStream' },
      `Starting stream with ${messages.length} messages`
    );

    try {
      const stream = await model.stream(messages);
      let tokenCount = 0;

      for await (const chunk of stream) {
        if (chunk.content) {
          const content = typeof chunk.content === 'string' 
            ? chunk.content 
            : JSON.stringify(chunk.content);
          
          tokenCount++;
          yield content;
        }
      }

      logger.info(
        { service: 'LangChainAIService', method: 'assistStream' },
        `Stream completed: ${tokenCount} tokens`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Normalize common SDK/provider credential errors into a clearer message
      const lower = message.toLowerCase();
      if (lower.includes('missing credentials') || lower.includes('openaierror') || lower.includes('missing api key') || lower.includes('no api key')) {
        const credMsg = 'No API key found for provider azure-openai. Please save credentials or set OPENAI_API_KEY/AZURE_OPENAI_KEY.';
        logger.error({ service: 'LangChainAIService', method: 'assistStream' }, new Error(credMsg));
        throw new Error(credMsg);
      }

      logger.error(
        { service: 'LangChainAIService', method: 'assistStream' },
        new Error(`Streaming failed: ${message}`)
      );
      throw new Error(`AI assistance streaming failed: ${message}`);
    }
  }

  /**
   * Get system prompt for entity generation.
   */
  private getEntityGenerationSystemPrompt(): string {
    return `You are an expert at creating context repository entities.

Your task is to generate well-structured, valid entities that follow the provided schema exactly.

Guidelines:
- Ensure all required fields are present
- Use appropriate ID formats (FEAT-001, US-042, SPEC-123, T-456)
- Create meaningful, descriptive titles and objectives
- Suggest realistic relationships to other entities when applicable
- Set appropriate status values (draft, in-progress, done, blocked)
- Follow domain naming conventions

Generate only the entity data in JSON format matching the schema. Do not include explanations or markdown.`;
  }

  /**
   * Build system prompt for conversational assistance.
   */
  private buildSystemPrompt(contextSnapshot: any): string {
    const summary = this.buildRepositorySummary(contextSnapshot);

    return `You are an AI assistant for a context repository used in spec-driven software development.

${summary}

Your role is to:
- Answer questions about entities, relationships, and dependencies
- Suggest improvements to entity structures
- Help navigate the repository
- Explain entity relationships and impact
- Identify potential issues or inconsistencies

When answering:
- Reference specific entity IDs when relevant (e.g., FEAT-001, US-042)
- Explain relationships between entities clearly
- Suggest next steps or follow-up questions
- Be concise but informative

If you don't have enough information, ask clarifying questions.`;
  }

  /**
   * Build repository summary from context snapshot.
   */
  private buildRepositorySummary(contextSnapshot: any): string {
    if (!contextSnapshot) {
      return 'Repository context: Not available';
    }

    const parts: string[] = ['Repository Summary:'];

    if (contextSnapshot.features?.length > 0) {
      parts.push(`- Features: ${contextSnapshot.features.length}`);
    }
    if (contextSnapshot.userStories?.length > 0) {
      parts.push(`- User Stories: ${contextSnapshot.userStories.length}`);
    }
    if (contextSnapshot.specs?.length > 0) {
      parts.push(`- Specs: ${contextSnapshot.specs.length}`);
    }
    if (contextSnapshot.tasks?.length > 0) {
      parts.push(`- Tasks: ${contextSnapshot.tasks.length}`);
    }
    if (contextSnapshot.services?.length > 0) {
      parts.push(`- Services: ${contextSnapshot.services.length}`);
    }
    if (contextSnapshot.packages?.length > 0) {
      parts.push(`- Packages: ${contextSnapshot.packages.length}`);
    }

    return parts.length > 1 ? parts.join('\n') : 'Repository context: Empty repository';
  }

  /**
   * Clear cached models (useful for testing or configuration changes).
   */
  clearCache(): void {
    this.models.clear();
    logger.info({ service: 'LangChainAIService', method: 'clearCache' }, 'Model cache cleared');
  }
}
