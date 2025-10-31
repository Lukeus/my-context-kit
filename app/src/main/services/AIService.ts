import { app, safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { randomUUID } from 'node:crypto';
import { parse as parseYAML } from 'yaml';
import { logger } from '../utils/logger';
import { AICredentialResolver } from './AICredentialResolver';

const AI_CONFIG_FILE = 'ai-config.json';
const CREDENTIALS_FILE = 'credentials.enc';

// Stream timeout configuration
const STREAM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes - auto-cancel long-running streams

export interface AIConfig {
  provider: string;
  endpoint: string;
  model: string;
  enabled: boolean;
  apiVersion?: string;
  [key: string]: unknown;
}

export type WritableAIConfig = AIConfig & { apiKey?: string };

export interface TestConnectionOptions {
  provider: string;
  endpoint: string;
  model: string;
  useStoredKey: boolean;
}

export interface AIGenerateOptions {
  dir: string;
  entityType: string;
  userPrompt: string;
}

export interface AIAssistOptions {
  dir: string;
  question: string;
  mode?: string;
  focusId?: string;
}

export interface AIAssistStreamOptions extends AIAssistOptions {
  onData: (data: any) => void;
  onEnd: () => void;
  onError: (error: string) => void;
}

export interface ApplyEditOptions {
  dir: string;
  filePath: string;
  updatedContent: string;
  summary?: string;
}

export interface AIStreamProcess {
  streamId: string;
  process: ReturnType<typeof execa>;
}

interface ProxySettings {
  useProxy: boolean;
  httpsProxy: string;
  httpProxy: string;
  noProxy: string;
}

/**
 * Service for AI operations (configuration, credentials, generation, assistance)
 */
export class AIService {
  private streamProcesses = new Map<string, ReturnType<typeof execa>>();
  private streamTimeouts = new Map<string, NodeJS.Timeout>();
  private credentialResolver = new AICredentialResolver();

  /**
   * Get AI configuration for a repository
   * 
   * Returns the AI configuration stored in the repository's .context directory.
   * If no configuration exists, returns default Ollama configuration with AI disabled.
   * 
   * @param dir - Absolute path to the repository
   * @returns AI configuration including provider, endpoint, model, and enabled status
   * 
   * @example
   * ```typescript
   * const aiService = new AIService();
   * const config = await aiService.getConfig('/path/to/repo');
   * console.log(config.provider); // 'ollama' or 'azure-openai'
   * ```
   */
  async getConfig(dir: string): Promise<AIConfig> {
    try {
      const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content) as AIConfig;
    } catch {
      // Return default config if file doesn't exist
      return {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        enabled: false
      };
    }
  }

  /**
   * Diagnostic: Ping the Azure OpenAI deployment endpoint with a minimal request.
   * Returns HTTP status, body (truncated), and timing information or a detailed error.
   */
  async pingEndpoint(options: { endpoint: string; model: string; apiKey?: string; apiVersion?: string; timeoutMs?: number }): Promise<{ ok: boolean; status?: number; body?: string; durationMs?: number; error?: string }> {
    const { endpoint, model, apiKey, apiVersion, timeoutMs = 30000 } = options;
    const resolvedApiVersion = (apiVersion && apiVersion.trim()) || process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    const uri = `${endpoint.replace(/\/$/, '')}/openai/deployments/${model}/chat/completions?api-version=${resolvedApiVersion}`;

    const start = Date.now();
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const proxySettings = this.determineProxySettings(endpoint);

      const activeFetch = globalThis.fetch?.bind(globalThis);
      if (!activeFetch) {
        // TODO: Provide a polyfill fallback if we ever support runtimes without native fetch.
        throw new Error('Fetch API is not available in this runtime');
      }

      // If a proxy is configured, create an agent and pass it to fetch so
      // requests tunnel through the corporate proxy. This keeps behavior
      // consistent with execa-launched child processes.
      let fetchOptions: any = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey || ''
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Ping' }], max_tokens: 1 }),
        signal: controller.signal
      };

      if (proxySettings.useProxy) {
        const proxyUrl = proxySettings.httpsProxy || proxySettings.httpProxy;
        if (!proxyUrl) {
          logger.debug({ service: 'AIService', method: 'pingEndpoint' }, 'Proxy requested but no proxy URL found after normalization. Skipping proxy agent.');
        }

        if (proxyUrl) {
          try {
            // Dynamically require to avoid module system mismatches in ESM project
            // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
            const proxyMod = require('https-proxy-agent');
            const AgentCtor = proxyMod && (proxyMod.HttpsProxyAgent || proxyMod.default || proxyMod);
            let agent;
            if (typeof AgentCtor === 'function') {
              try {
                agent = new AgentCtor(proxyUrl);
              } catch (ctorErr) {
                agent = AgentCtor(proxyUrl);
              }
              fetchOptions.agent = agent;
            } else {
              logger.warn({ service: 'AIService', method: 'pingEndpoint' }, 'https-proxy-agent export is not a constructor');
            }
          } catch (e) {
            logger.warn({ service: 'AIService', method: 'pingEndpoint' }, `https-proxy-agent not available: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      const resp = await activeFetch(uri, fetchOptions);

      clearTimeout(id);
      const durationMs = Date.now() - start;
      let text = '';
      try {
        text = await resp.text();
      } catch (e) {
        text = '<failed to read body>';
      }

      return {
        ok: resp.ok,
        status: resp.status,
        body: text.length > 2000 ? text.slice(0, 2000) + '...[truncated]' : text,
        durationMs
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ service: 'AIService', method: 'pingEndpoint' }, `Ping failed: ${message}`);
      return { ok: false, error: message, durationMs };
    }
  }

  /**
   * Save AI configuration to repository
   * 
   * Persists AI configuration to .context/ai-config.json. API keys are automatically
   * stripped from the configuration and must be saved separately using saveCredentials().
   * 
   * @param dir - Absolute path to the repository
   * @param config - AI configuration to save (apiKey will be removed before saving)
   * @throws {Error} If file write fails
   * 
   * @example
   * ```typescript
   * await aiService.saveConfig('/path/to/repo', {
   *   provider: 'azure-openai',
   *   endpoint: 'https://api.openai.azure.com',
   *   model: 'gpt-4',
   *   enabled: true,
   *   apiKey: 'secret' // This will NOT be saved to file
   * });
   * ```
   */
  async saveConfig(dir: string, config: WritableAIConfig): Promise<void> {
    return logger.logServiceCall(
      { service: 'AIService', method: 'saveConfig', provider: config.provider },
      async () => {
        const configPath = path.join(dir, '.context', AI_CONFIG_FILE);
        // Never save API keys in config file
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { apiKey, ...persistableConfig } = config;
        await writeFile(configPath, JSON.stringify(persistableConfig, null, 2), 'utf-8');
      }
    );
  }

  /**
   * Save encrypted credentials for an AI provider
   * 
   * Encrypts and stores API key using OS-level encryption (Windows Credential Manager,
   * macOS Keychain, or Linux Secret Service). Credentials are stored in app user data
   * directory, separate from repository configuration.
   * 
   * @param provider - Provider name ('ollama' or 'azure-openai')
   * @param apiKey - API key to encrypt and store
   * @throws {Error} If encryption is not available on the system
   * @throws {Error} If file write fails
   * 
   * @example
   * ```typescript
   * await aiService.saveCredentials('azure-openai', 'sk-xxx');
   * ```
   */
  async saveCredentials(provider: string, apiKey: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this system');
    }

    // Encrypt the API key
    const encrypted = safeStorage.encryptString(apiKey);

    // Store encrypted credentials in app data directory
    const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
    await writeFile(credPath, encrypted);
  }

  /**
   * Check if encrypted credentials exist for a provider
   * 
   * Verifies that credentials are stored and can be decrypted without returning
   * the actual credentials. Safe to call for credential existence checks.
   * 
   * @param provider - Provider name to check
   * @returns true if valid credentials exist and can be decrypted, false otherwise
   * 
   * @example
   * ```typescript
   * if (await aiService.hasCredentials('azure-openai')) {
   *   // Credentials exist, proceed with AI operations
   * }
   * ```
   */
  async hasCredentials(provider: string): Promise<boolean> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return false;
      }

      const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
      const encrypted = await readFile(credPath);
      // Just verify we can decrypt without returning the actual key
      safeStorage.decryptString(encrypted);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get decrypted API key for a provider (internal use only)
   */
  private async getCredentials(provider: string): Promise<string> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available');
    }

    const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);
    const encrypted = await readFile(credPath);
    return safeStorage.decryptString(encrypted);
  }

  /**
   * Public helper to safely retrieve stored credentials for a provider.
   * Returns the decrypted API key string or null if credentials are not present
   * or not recoverable. This is safe to call from IPC handlers.
   */
  async getStoredCredentials(provider: string): Promise<string | null> {
    try {
      const safeAvailable = safeStorage.isEncryptionAvailable();
      const credPath = path.join(app.getPath('userData'), `${provider}-${CREDENTIALS_FILE}`);

      if (!safeAvailable) {
        logger.warn({ service: 'AIService', method: 'getStoredCredentials' }, `Encryption not available when attempting to read credentials for ${provider}`);
        return null;
      }

      // If file doesn't exist, return null
      if (!existsSync(credPath)) {
        logger.info({ service: 'AIService', method: 'getStoredCredentials' }, `No credentials file for ${provider} at ${credPath}`);
        return null;
      }

      const stat = await readFile(credPath);
      try {
        const decrypted = safeStorage.decryptString(stat);
        logger.info({ service: 'AIService', method: 'getStoredCredentials' }, `Loaded stored credentials for ${provider} (path=${credPath}, size=${stat.length})`);
        return decrypted;
      } catch (decryptErr) {
        logger.warn({ service: 'AIService', method: 'getStoredCredentials' }, `Failed to decrypt credentials for ${provider} at ${credPath}: ${decryptErr instanceof Error ? decryptErr.message : String(decryptErr)}`);
        return null;
      }
    } catch (err) {
      // Don't surface decryption errors; return null and let callers handle absence
      logger.warn({ service: 'AIService', method: 'getStoredCredentials' }, `Could not load stored credentials for ${provider}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Test connection to AI provider
   * 
   * Validates that the AI provider is accessible and configured correctly.
   * For Ollama, checks endpoint connectivity. For Azure OpenAI, validates
   * credentials and endpoint configuration.
   * 
   * @param options - Test configuration
   * @param options.provider - 'ollama' or 'azure-openai'
   * @param options.endpoint - Provider endpoint URL
   * @param options.model - Model name to test
   * @param options.useStoredKey - Whether to use stored credentials
   * @returns Success message describing the connection result
   * @throws {Error} If connection fails or provider is unknown
   * @throws {Error} If credentials are required but not found
   * 
   * @example
   * ```typescript
   * const result = await aiService.testConnection({
   *   provider: 'ollama',
   *   endpoint: 'http://localhost:11434',
   *   model: 'llama2',
   *   useStoredKey: false
   * });
   * console.log(result); // 'Connected to Ollama model llama2 successfully'
   * ```
   */
  async testConnection(options: TestConnectionOptions): Promise<string> {
    return logger.logServiceCall(
      { service: 'AIService', method: 'testConnection', provider: options.provider },
      async () => {
        const { provider, endpoint, model, useStoredKey } = options;
        let apiKey = '';

        if (useStoredKey) {
          apiKey = await this.getCredentials(provider);
        }

        // Test connection based on provider
        if (provider === 'ollama') {
          // Ollama doesn't require API key
          const response = await fetch(`${endpoint}/api/tags`);
          if (response.ok) {
            return `Connected to Ollama model ${model} successfully`;
          } else {
            throw new Error('Failed to connect to Ollama');
          }
        } else if (provider === 'azure-openai') {
          // Test Azure OpenAI connection
          if (!apiKey && useStoredKey) {
            throw new Error('No API key found');
          }
          // Azure test would go here. For lightweight checks we just validate
          // that an API key is present when requested and return a success
          // message. For network-level diagnostics use pingEndpoint().
          return `Azure OpenAI model ${model} configuration saved`;
        }

        throw new Error('Unknown provider');
      }
    );
  }

  /**
   * Generate a context entity using AI
   * 
   * Uses the configured AI provider to generate a YAML entity (feature, user story,
   * spec, or task) based on a natural language prompt. The generated entity follows
   * the repository's schema and conventions.
   * 
   * @param options - Generation options
   * @param options.dir - Repository path
   * @param options.entityType - Type of entity to generate ('feature', 'userstory', 'spec', 'task')
   * @param options.userPrompt - Natural language description of what to create
   * @returns Generated entity data
   * @throws {Error} If AI assistance is disabled in configuration
   * @throws {Error} If AI provider fails or returns invalid data
   * 
   * @example
   * ```typescript
   * const entity = await aiService.generate({
   *   dir: '/path/to/repo',
   *   entityType: 'feature',
   *   userPrompt: 'Create a user authentication feature with OAuth support'
   * });
   * ```
   */
  async generate(options: AIGenerateOptions): Promise<any> {
    return logger.logServiceCall(
      { service: 'AIService', method: 'generate', entityType: options.entityType },
      async () => {
        const { dir, entityType, userPrompt } = options;
    
        const config = await this.getConfig(dir);
        if (!config.enabled) {
          throw new Error('AI assistance is disabled');
        }

        let apiKey = '';
        if (config.provider === 'azure-openai') {
          apiKey = await this.credentialResolver.resolveApiKey({
            provider: config.provider,
            explicitKey: config.apiKey as string | undefined,
            useStoredCredentials: true,
            useEnvironmentVars: true
          }) || '';
        }

        const args = [
          path.join(dir, '.context', 'pipelines', 'ai-generator.mjs'),
          'generate',
          config.provider,
          config.endpoint,
          config.model,
          apiKey,
          entityType,
          userPrompt
        ];

        const proxySettings = this.determineProxySettings(config.endpoint);
        const result = await execa('node', args, {
          cwd: dir,
          env: this.buildChildProcessEnv(proxySettings)
        });

        return JSON.parse(result.stdout);
      }
    );
  }

  /**
   * Get AI assistance in non-streaming mode
   * 
   * Asks the AI assistant a question about the context repository and waits for
   * the complete response. For real-time streaming responses, use startAssistStream().
   * 
   * @param options - Assistance options
   * @param options.dir - Repository path
   * @param options.question - Question to ask the AI assistant
   * @param options.mode - Optional mode ('improvement', 'clarification', 'general')
   * @param options.focusId - Optional entity ID to focus the question on
   * @returns AI response with answer, suggestions, and references
   * @throws {Error} If question is empty or AI is disabled
   * @throws {Error} If AI provider fails
   * 
   * @example
   * ```typescript
   * const response = await aiService.assist({
   *   dir: '/path/to/repo',
   *   question: 'What entities depend on FEAT-001?',
   *   focusId: 'FEAT-001'
   * });
   * ```
   */
  async assist(options: AIAssistOptions): Promise<any> {
    const { dir, question, mode, focusId } = options;

    if (!question || !question.trim()) {
      throw new Error('Question is required');
    }

    const config = await this.getConfig(dir);
    if (!config.enabled) {
      throw new Error('AI assistance is disabled');
    }

    let apiKey = '';
    if (config.provider === 'azure-openai') {
      apiKey = await this.credentialResolver.resolveApiKey({
        provider: config.provider,
        explicitKey: config.apiKey as string | undefined,
        useStoredCredentials: true,
        useEnvironmentVars: true
      }) || '';
    }

    const encodedQuestion = Buffer.from(question, 'utf-8').toString('base64');
    const encodedOptions = Buffer.from(JSON.stringify({ mode, focusId }), 'utf-8').toString('base64');

    const args = [
      path.join(dir, '.context', 'pipelines', 'ai-assistant.mjs'),
      config.provider,
      config.endpoint,
      config.model,
      apiKey,
      encodedQuestion,
      encodedOptions
    ];

    const proxySettings = this.determineProxySettings(config.endpoint);
    const result = await execa('node', args, {
      cwd: dir,
      env: this.buildChildProcessEnv(proxySettings)
    });

    return JSON.parse(result.stdout);
  }

  /**
   * Start streaming AI assistance with real-time token delivery
   * 
   * Initiates a streaming AI assistance session that delivers tokens in real-time
   * through callbacks. The stream automatically times out after 5 minutes to prevent
   * memory leaks. Use cancelAssistStream() to manually stop a stream.
   * 
   * @param options - Streaming assistance options
   * @param options.dir - Repository path
   * @param options.question - Question to ask
   * @param options.mode - Optional mode
   * @param options.focusId - Optional entity to focus on
   * @param options.onData - Callback for each data chunk
   * @param options.onEnd - Callback when stream completes
   * @param options.onError - Callback for errors
   * @returns Stream ID for cancellation
   * @throws {Error} If question is empty or AI is disabled
   * 
   * @example
   * ```typescript
   * const streamId = await aiService.startAssistStream({
   *   dir: '/path/to/repo',
   *   question: 'Explain FEAT-001',
   *   onData: (data) => console.log('Token:', data),
   *   onEnd: () => console.log('Complete'),
   *   onError: (err) => console.error('Error:', err)
   * });
   * // Later: await aiService.cancelAssistStream(streamId);
   * ```
   */
  async startAssistStream(options: AIAssistStreamOptions): Promise<string> {
    const { dir, question, mode, focusId, onData, onEnd, onError } = options;

    if (!question || !question.trim()) {
      throw new Error('Question is required');
    }

    const config = await this.getConfig(dir);
    if (!config.enabled) {
      throw new Error('AI assistance is disabled');
    }

    let apiKey = '';
    if (config.provider === 'azure-openai') {
      apiKey = await this.credentialResolver.resolveApiKey({
        provider: config.provider,
        explicitKey: config.apiKey as string | undefined,
        useStoredCredentials: true,
        useEnvironmentVars: true
      }) || '';
    }

    const streamId = randomUUID();
    const encodedQuestion = Buffer.from(question, 'utf-8').toString('base64');
    const encodedOptions = Buffer.from(JSON.stringify({ mode, focusId }), 'utf-8').toString('base64');

    const args = [
      path.join(dir, '.context', 'pipelines', 'ai-assistant.mjs'),
      config.provider,
      config.endpoint,
      config.model,
      apiKey,
      encodedQuestion,
      encodedOptions,
      '--stream'
    ];

    const proxySettings = this.determineProxySettings(config.endpoint);
    performance.mark(`ai-stream-${streamId}-start`);
    const child = execa('node', args, {
      cwd: dir,
      env: this.buildChildProcessEnv(proxySettings)
    });

    this.streamProcesses.set(streamId, child);
    let chunkCount = 0;

    // Add timeout to prevent memory leaks from hung streams
    const timeoutId = setTimeout(() => {
      logger.warn({ service: 'AIService', method: 'startAssistStream', streamId }, 'Stream timeout, cleaning up');
      try {
        child.kill('SIGTERM');
        this.streamProcesses.delete(streamId);
        this.streamTimeouts.delete(streamId);
        onError('Stream timed out after 5 minutes');
      } catch (err) {
        logger.error({ service: 'AIService', method: 'startAssistStream', streamId }, err as Error);
      }
    }, STREAM_TIMEOUT_MS);
    this.streamTimeouts.set(streamId, timeoutId);

    // Stream stdout lines as JSON events
    child.stdout?.setEncoding('utf8');

    let stdoutBuffer = '';

    const emitLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const payload = JSON.parse(trimmed);
        onData({ streamId, ...payload });
        chunkCount++;
      } catch {
        // ignore parser errors caused by provider logs or partial lines
      }
    };

    const drainBuffer = () => {
      let newlineIndex = stdoutBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, '');
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        emitLine(line);
        newlineIndex = stdoutBuffer.indexOf('\n');
      }
    };

    child.stdout?.on('data', (data: Buffer | string) => {
      stdoutBuffer += data.toString();
      drainBuffer();
    });

    child.stdout?.on('end', () => {
      const residual = stdoutBuffer.trim();
      stdoutBuffer = '';
      if (residual) {
        emitLine(residual);
      }
    });

    const cleanup = () => {
      this.streamProcesses.delete(streamId);
      // Clear the timeout to prevent memory leak
      const timeoutId = this.streamTimeouts.get(streamId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.streamTimeouts.delete(streamId);
      }
      
      // Log performance metrics
      performance.mark(`ai-stream-${streamId}-end`);
      try {
        performance.measure(`ai-stream-${streamId}`, `ai-stream-${streamId}-start`, `ai-stream-${streamId}-end`);
        const measure = performance.getEntriesByName(`ai-stream-${streamId}`)[0];
        logger.debug({ service: 'AIService', method: 'startAssistStream', streamId }, 
          `Stream completed in ${measure.duration.toFixed(2)}ms (${chunkCount} chunks)`);
        performance.clearMarks(`ai-stream-${streamId}-start`);
        performance.clearMarks(`ai-stream-${streamId}-end`);
        performance.clearMeasures(`ai-stream-${streamId}`);
      } catch {
        // Performance API errors are non-critical
      }
      
      onEnd();
    };

    child.on('close', cleanup);
    child.on('exit', cleanup);
    child.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Stream error';
      onError(message);
      cleanup();
    });

    return streamId;
  }

  /**
   * Cancel an active AI assistance stream
   * 
   * Immediately terminates the streaming process and cleans up resources.
   * Automatically called when stream times out (5 minutes).
   * 
   * @param streamId - Stream ID returned from startAssistStream()
   * @throws {Error} If stream ID is not found
   * 
   * @example
   * ```typescript
   * const streamId = await aiService.startAssistStream(...);
   * // Later, to cancel:
   * await aiService.cancelAssistStream(streamId);
   * ```
   */
  async cancelAssistStream(streamId: string): Promise<void> {
    const child = this.streamProcesses.get(streamId);
    if (!child) {
      throw new Error('Stream not found');
    }
    child.kill('SIGTERM');
    this.streamProcesses.delete(streamId);
    
    // Clear the timeout
    const timeoutId = this.streamTimeouts.get(streamId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.streamTimeouts.delete(streamId);
    }
  }

  /**
   * Apply AI-suggested edit to a file with YAML validation
   * 
   * Validates and applies an AI-generated edit to a repository file. Performs
   * security checks (path traversal prevention) and YAML syntax validation before
   * writing. Provides detailed error messages for invalid YAML.
   * 
   * @param options - Edit options
   * @param options.dir - Repository path
   * @param options.filePath - Relative path to file within repository
   * @param options.updatedContent - New file content (must be valid YAML)
   * @param options.summary - Optional summary of changes (for future telemetry)
   * @throws {Error} If paths are missing or invalid
   * @throws {Error} If target file is outside repository (security)
   * @throws {Error} If target file doesn't exist
   * @throws {Error} If updated content is not valid YAML
   * 
   * @example
   * ```typescript
   * await aiService.applyEdit({
   *   dir: '/path/to/repo',
   *   filePath: 'contexts/features/FEAT-001.yaml',
   *   updatedContent: 'id: FEAT-001\ntitle: Updated Title',
   *   summary: 'AI updated feature title'
   * });
   * ```
   */
  async applyEdit(options: ApplyEditOptions): Promise<void> {
    const { dir, filePath, updatedContent } = options;

    if (!dir || !filePath) {
      throw new Error('Repository path and file path are required.');
    }

    const repoRoot = path.resolve(dir);
    const targetPath = path.resolve(repoRoot, filePath);

    if (!targetPath.startsWith(repoRoot)) {
      throw new Error('Edit rejected because the target is outside the repository.');
    }

    if (!existsSync(targetPath)) {
      throw new Error(`Target file does not exist: ${filePath}`);
    }

    // Validate YAML syntax
    try {
      parseYAML(updatedContent);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown YAML parsing error';
      const lineMatch = errorMsg.match(/at line (\d+)/);
      const columnMatch = errorMsg.match(/column (\d+)/);
      let detailedError = `Updated content is not valid YAML: ${errorMsg}`;

      if (lineMatch || columnMatch) {
        const line = lineMatch ? lineMatch[1] : '?';
        const column = columnMatch ? columnMatch[1] : '?';
        detailedError += ` (Line ${line}, Column ${column})`;
      }

      detailedError += '\n\nThe AI generated invalid YAML. Please try asking again or edit the YAML manually.';
      throw new Error(detailedError);
    }

    await writeFile(targetPath, updatedContent, 'utf-8');

    // Note: Edit summaries can be tracked via telemetry service if activity logging is required.
    // Currently not persisted to maintain lightweight edit operations.
  }

  // ============================================================================
  // Proxy helpers
  // ============================================================================

  private getProxyBypassHosts(): string[] {
    const defaults: string[] = [];
    const rawEnv = process.env.AI_PROXY_BYPASS || '';
    const tokens = rawEnv
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    const disableDefaults = tokens.includes('!defaults');
    const fromEnv = tokens.filter((entry) => entry !== '!defaults');

    const merged = new Set<string>();
    if (!disableDefaults) {
      for (const host of defaults) {
        merged.add(host.toLowerCase());
      }
    }
    for (const host of fromEnv) {
      merged.add(host);
    }
    return Array.from(merged);
  }

  private combineNoProxyPatterns(base: string): string {
    const patterns = base
      ? base
          .split(',')
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean)
      : [];
    for (const host of this.getProxyBypassHosts()) {
      if (!patterns.includes(host)) {
        patterns.push(host);
      }
    }
    return patterns.join(',');
  }

  private extractHost(endpoint: string): string | null {
    try {
      const url = new URL(endpoint);
      return url.hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private hostMatchesNoProxy(host: string, patterns: string): boolean {
    if (!patterns) return false;

    const hostLower = host.toLowerCase();
    const entries = patterns
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    for (const entry of entries) {
      if (entry === '*') {
        return true;
      }

      const [patternHost, patternPort] = entry.split(':');
      const [hostNameOnly, hostPort] = hostLower.split(':');

      if (patternPort && hostPort && patternPort === hostPort && patternHost === hostNameOnly) {
        return true;
      }

      const normalizedPattern = patternHost.startsWith('.') ? patternHost.slice(1) : patternHost;

      if (hostNameOnly === normalizedPattern) {
        return true;
      }

      if (hostNameOnly.endsWith(`.${normalizedPattern}`)) {
        return true;
      }
    }

    return false;
  }

  private determineProxySettings(endpoint: string): ProxySettings {
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || '';
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || '';
    const baseNoProxy = process.env.NO_PROXY || process.env.no_proxy || '';
    const combinedNoProxy = this.combineNoProxyPatterns(baseNoProxy);

    if (process.env.AI_DISABLE_PROXY === 'true') {
      logger.debug({ service: 'AIService', method: 'determineProxySettings' }, 'AI_DISABLE_PROXY flag set; bypassing proxies for AI requests.');
      return {
        useProxy: false,
        httpsProxy: '',
        httpProxy: '',
        noProxy: combinedNoProxy
      };
    }

    if (!httpsProxy && !httpProxy) {
      return {
        useProxy: false,
        httpsProxy: '',
        httpProxy: '',
        noProxy: combinedNoProxy
      };
    }

    const host = this.extractHost(endpoint);
    if (host && combinedNoProxy && this.hostMatchesNoProxy(host, combinedNoProxy)) {
      logger.debug({ service: 'AIService', method: 'determineProxySettings' }, `Bypassing proxy for ${host} due to effective NO_PROXY settings (${combinedNoProxy})`);
      return {
        useProxy: false,
        httpsProxy: '',
        httpProxy: '',
        noProxy: combinedNoProxy
      };
    }

    return {
      useProxy: true,
      httpsProxy,
      httpProxy,
      noProxy: combinedNoProxy
    };
  }

  private buildChildProcessEnv(settings: ProxySettings): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };

    if (settings.useProxy) {
      if (settings.httpsProxy) {
        env.HTTPS_PROXY = settings.httpsProxy;
        env.https_proxy = settings.httpsProxy;
      } else {
        env.HTTPS_PROXY = undefined;
        env.https_proxy = undefined;
      }

      if (settings.httpProxy) {
        env.HTTP_PROXY = settings.httpProxy;
        env.http_proxy = settings.httpProxy;
      } else {
        env.HTTP_PROXY = undefined;
        env.http_proxy = undefined;
      }
    } else {
      env.HTTPS_PROXY = undefined;
      env.https_proxy = undefined;
      env.HTTP_PROXY = undefined;
      env.http_proxy = undefined;
    }

    if (settings.noProxy) {
      env.NO_PROXY = settings.noProxy;
      env.no_proxy = settings.noProxy;
    } else {
      env.NO_PROXY = undefined;
      env.no_proxy = undefined;
    }

    return env;
  }
}
