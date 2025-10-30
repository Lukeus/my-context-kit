import { app, safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
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

const AI_CONFIG_FILE = 'ai-config.json';
const CREDENTIALS_FILE = 'credentials.enc';
const PROVIDER_CONFIGS_FILE = 'ai-provider-configs.json';

export interface AIConfig {
  provider: string;
  endpoint: string;
  model: string;
  enabled: boolean;
  embeddingModel?: string;
  apiKey?: string;
  [key: string]: unknown;
}

export type WritableAIConfig = AIConfig & { apiKey?: string };

/**
 * Per-provider configuration storage.
 * Allows users to save different settings for each provider and switch without losing configuration.
 */
export interface ProviderConfigs {
  'ollama'?: {
    endpoint: string;
    model: string;
  };
  'azure-openai'?: {
    endpoint: string;
    model: string;
  };
  [key: string]: {
    endpoint: string;
    model: string;
  } | undefined;
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

  // ============================================================================
  // Configuration & Credential Management
  // ============================================================================

  /**
   * Get AI configuration for a repository.
   * 
   * Returns the AI configuration stored in the repository's .context directory.
   * If no configuration exists, returns default Ollama configuration with AI disabled.
   * 
   * @param dir - Absolute path to the repository
   * @returns AI configuration including provider, endpoint, model, and enabled status
   * @throws Never throws - returns default config on error
   * 
   * @example
   * ```typescript
   * const service = new LangChainAIService();
   * const config = await service.getConfig('/path/to/repo');
   * console.log(config.provider); // 'ollama' or 'azure-openai'
   * ```
   */
  async getConfig(dir: string): Promise<AIConfig> {
    return logger.logServiceCall(
      { service: 'LangChainAIService', method: 'getConfig' },
      async () => {
        try {
          const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
          const content = await readFile(configPath, 'utf-8');
          const parsed = JSON.parse(content) as AIConfig;
          logger.debug({ service: 'LangChainAIService', method: 'getConfig' }, `Loaded config for provider: ${parsed.provider}`);
          return parsed;
        } catch {
          // Return default config if file doesn't exist or is invalid
          logger.debug({ service: 'LangChainAIService', method: 'getConfig' }, 'No config found, returning defaults');
          return {
            provider: 'ollama',
            endpoint: 'http://localhost:11434',
            model: 'llama2',
            enabled: false
          };
        }
      }
    );
  }

  /**
   * Save AI configuration to repository.
   * 
   * Persists AI configuration to .context/ai-config.json. API keys are automatically
   * stripped from the configuration and must be saved separately using saveCredentials().
   * This ensures sensitive credentials are never committed to version control.
   * 
   * @param dir - Absolute path to the repository
   * @param config - AI configuration to save (apiKey will be removed before saving)
   * @throws {Error} If file write fails or directory doesn't exist
   * 
   * @example
   * ```typescript
   * await service.saveConfig('/path/to/repo', {
   *   provider: 'azure-openai',
   *   endpoint: 'https://myinstance.openai.azure.com',
   *   model: 'gpt-4',
   *   enabled: true,
   *   apiKey: 'sk-xxx' // This will NOT be saved to file
   * });
   * ```
   */
  async saveConfig(dir: string, config: WritableAIConfig): Promise<void> {
    return logger.logServiceCall(
      { service: 'LangChainAIService', method: 'saveConfig', provider: config.provider },
      async () => {
        const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
        
        // Security: Never save API keys in config file
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKey, ...persistableConfig } = config;
        
        await writeFile(configPath, JSON.stringify(persistableConfig, null, 2), 'utf-8');
        logger.info({ service: 'LangChainAIService', method: 'saveConfig' }, `Saved config for provider: ${config.provider}`);
      }
    );
  }

  /**
   * Save encrypted credentials for an AI provider.
   * 
   * Encrypts and stores API key using OS-level encryption:
   * - Windows: Credential Manager (DPAPI)
   * - macOS: Keychain
   * - Linux: Secret Service API (libsecret)
   * 
   * Credentials are stored in the app user data directory, separate from
   * repository configuration, ensuring they're never committed to Git.
   * 
   * @param provider - Provider name ('ollama' or 'azure-openai')
   * @param apiKey - API key to encrypt and store
   * @throws {Error} If encryption is not available on the system
   * @throws {Error} If file write fails
   * 
   * @example
   * ```typescript
   * await service.saveCredentials('azure-openai', 'sk-xxx...');
   * ```
   */
  async saveCredentials(provider: string, apiKey: string): Promise<void> {
    return logger.logServiceCall(
      { service: 'LangChainAIService', method: 'saveCredentials', provider },
      async () => {
        if (!safeStorage.isEncryptionAvailable()) {
          throw new Error('OS-level encryption not available. Cannot securely store credentials.');
        }

        // Encrypt the API key using OS-level encryption
        const encrypted = safeStorage.encryptString(apiKey);

        // Store encrypted credentials in app data directory (not in repository)
        const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
        await writeFile(credPath, encrypted);
        
        logger.info({ service: 'LangChainAIService', method: 'saveCredentials' }, `Saved encrypted credentials for provider: ${provider}`);
      }
    );
  }

  /**
   * Check if encrypted credentials exist for a provider.
   * 
   * Verifies that credentials are stored and can be decrypted without returning
   * the actual credentials. Safe to call for credential existence checks.
   * 
   * @param provider - Provider name to check
   * @returns true if valid credentials exist and can be decrypted, false otherwise
   * 
   * @example
   * ```typescript
   * if (await service.hasCredentials('azure-openai')) {
   *   // Credentials exist, proceed with AI operations
   * }
   * ```
   */
  async hasCredentials(provider: string): Promise<boolean> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.debug({ service: 'LangChainAIService', method: 'hasCredentials' }, 'Encryption not available');
        return false;
      }

      const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
      
      if (!existsSync(credPath)) {
        logger.debug({ service: 'LangChainAIService', method: 'hasCredentials' }, `No credentials file for ${provider}`);
        return false;
      }
      
      const encrypted = await readFile(credPath);
      // Just verify we can decrypt without returning the actual key
      safeStorage.decryptString(encrypted);
      
      logger.debug({ service: 'LangChainAIService', method: 'hasCredentials' }, `Valid credentials found for ${provider}`);
      return true;
    } catch (err) {
      logger.debug({ service: 'LangChainAIService', method: 'hasCredentials' }, `Credential check failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Get stored credentials for a provider (safe public API).
   * 
   * Returns the decrypted API key string or null if credentials are not present
   * or not recoverable. This is safe to call from IPC handlers.
   * 
   * @param provider - Provider name
   * @returns Decrypted API key or null if not available
   * 
   * @example
   * ```typescript
   * const apiKey = await service.getStoredCredentials('azure-openai');
   * if (apiKey) {
   *   // Use apiKey for API calls
   * }
   * ```
   */
  async getStoredCredentials(provider: string): Promise<string | null> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.warn({ service: 'LangChainAIService', method: 'getStoredCredentials' }, 'Encryption not available');
        return null;
      }

      const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);

      if (!existsSync(credPath)) {
        logger.debug({ service: 'LangChainAIService', method: 'getStoredCredentials' }, `No credentials file for ${provider}`);
        return null;
      }

      const encrypted = await readFile(credPath);
      const decrypted = safeStorage.decryptString(encrypted);
      
      logger.info({ service: 'LangChainAIService', method: 'getStoredCredentials' }, `Retrieved credentials for ${provider} (${encrypted.length} bytes encrypted)`);
      return decrypted;
    } catch (err) {
      logger.warn({ service: 'LangChainAIService', method: 'getStoredCredentials' }, `Failed to load credentials: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Get per-provider configurations (stored separately from active config).
   * 
   * This allows users to maintain different settings for each provider
   * (e.g., different models for Ollama vs Azure OpenAI) and switch between
   * them without losing configuration.
   * 
   * @param dir - Repository path
   * @returns Provider-specific configurations
   * 
   * @example
   * ```typescript
   * const configs = await service.getProviderConfigs('/path/to/repo');
   * console.log(configs['ollama']); // { endpoint, model }
   * console.log(configs['azure-openai']); // { endpoint, model }
   * ```
   */
  async getProviderConfigs(dir: string): Promise<ProviderConfigs> {
    return logger.logServiceCall(
      { service: 'LangChainAIService', method: 'getProviderConfigs' },
      async () => {
        try {
          const configPath = path.join(dir, '.context', PROVIDER_CONFIGS_FILE);
          const content = await readFile(configPath, 'utf-8');
          const parsed = JSON.parse(content) as ProviderConfigs;
          logger.debug({ service: 'LangChainAIService', method: 'getProviderConfigs' }, 'Loaded provider configs');
          return parsed;
        } catch {
          // Return default configs for both providers
          logger.debug({ service: 'LangChainAIService', method: 'getProviderConfigs' }, 'No provider configs found, returning defaults');
          return {
            'ollama': {
              endpoint: 'http://localhost:11434',
              model: 'llama2'
            },
            'azure-openai': {
              endpoint: '',
              model: 'gpt-4'
            }
          };
        }
      }
    );
  }

  /**
   * Save configuration for a specific provider (without switching to it).
   * 
   * This updates the provider-specific config store, allowing users to
   * maintain separate settings for each provider.
   * 
   * @param dir - Repository path
   * @param provider - Provider name ('ollama' or 'azure-openai')
   * @param config - Provider-specific configuration
   * 
   * @example
   * ```typescript
   * // Save Ollama config without switching to it
   * await service.saveProviderConfig('/path/to/repo', 'ollama', {
   *   endpoint: 'http://localhost:11434',
   *   model: 'llama3'
   * });
   * 
   * // Later, user can switch to Ollama and these settings will be used
   * ```
   */
  async saveProviderConfig(
    dir: string,
    provider: string,
    config: { endpoint: string; model: string }
  ): Promise<void> {
    return logger.logServiceCall(
      { service: 'LangChainAIService', method: 'saveProviderConfig', provider },
      async () => {
        const configPath = path.join(dir, '.context', PROVIDER_CONFIGS_FILE);
        
        // Load existing configs
        let allConfigs: ProviderConfigs = {};
        try {
          const content = await readFile(configPath, 'utf-8');
          allConfigs = JSON.parse(content) as ProviderConfigs;
        } catch {
          // File doesn't exist yet, start fresh
          allConfigs = {};
        }
        
        // Update specific provider config
        allConfigs[provider] = config;
        
        await writeFile(configPath, JSON.stringify(allConfigs, null, 2), 'utf-8');
        logger.info({ service: 'LangChainAIService', method: 'saveProviderConfig' }, `Saved config for provider: ${provider}`);
      }
    );
  }

  // ============================================================================
  // AI Operations
  // ============================================================================

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
      // Note: apiKey parameter is still required by ChatOpenAI constructor even though
      // Azure uses the 'api-key' header instead
      model = new ChatOpenAI({
        apiKey: resolvedKey, // Required by ChatOpenAI constructor
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

      // Ollama doesn't require an API key, but LangChain's ChatOpenAI expects one
      // Pass a dummy key to satisfy the library (Ollama ignores it)
      model = new ChatOpenAI({
        apiKey: 'ollama-does-not-need-a-key',
        configuration: {
          // Use OpenAI-compatible endpoint for Ollama
          // Recommend including /v1 for some SDKs; allow user-provided full URL
          baseURL: config.endpoint.endsWith('/v1') ? config.endpoint : `${config.endpoint.replace(/\/$/, '')}/v1`,
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
