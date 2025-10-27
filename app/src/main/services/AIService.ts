import { app, safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { randomUUID } from 'node:crypto';
import { parse as parseYAML } from 'yaml';
import { logger } from '../utils/logger';

const AI_CONFIG_FILE = 'ai-config.json';
const CREDENTIALS_FILE = 'credentials.enc';

export interface AIConfig {
  provider: string;
  endpoint: string;
  model: string;
  enabled: boolean;
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

/**
 * Service for AI operations (configuration, credentials, generation, assistance)
 */
export class AIService {
  private streamProcesses = new Map<string, ReturnType<typeof execa>>();

  /**
   * Get AI configuration for a repository
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
   * Save AI configuration (excluding API keys)
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
   * Save encrypted credentials for a provider
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
   * Check if credentials exist for a provider
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
   * Test connection to AI provider
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
          // Azure test would go here
          return `Azure OpenAI model ${model} configuration saved`;
        }

        throw new Error('Unknown provider');
      }
    );
  }

  /**
   * Generate entity using AI
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
          apiKey = await this.getCredentials(config.provider);
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

        const result = await execa('node', args, {
          cwd: dir,
          env: {
            ...process.env,
            HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
            HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
            NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
          }
        });

        return JSON.parse(result.stdout);
      }
    );
  }

  /**
   * Get AI assistance (non-streaming)
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
      apiKey = await this.getCredentials(config.provider);
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

    const result = await execa('node', args, {
      cwd: dir,
      env: {
        ...process.env,
        HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
        HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
        NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
      }
    });

    return JSON.parse(result.stdout);
  }

  /**
   * Start streaming AI assistance
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
      apiKey = await this.getCredentials(config.provider);
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

    const child = execa('node', args, {
      cwd: dir,
      env: {
        ...process.env,
        HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy || '',
        HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy || '',
        NO_PROXY: process.env.NO_PROXY || process.env.no_proxy || ''
      }
    });

    this.streamProcesses.set(streamId, child);

    // Stream stdout lines as JSON events
    child.stdout?.setEncoding('utf8');

    let stdoutBuffer = '';

    const emitLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const payload = JSON.parse(trimmed);
        onData({ streamId, ...payload });
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
   * Cancel streaming AI assistance
   */
  async cancelAssistStream(streamId: string): Promise<void> {
    const child = this.streamProcesses.get(streamId);
    if (!child) {
      throw new Error('Stream not found');
    }
    child.kill('SIGTERM');
    this.streamProcesses.delete(streamId);
  }

  /**
   * Apply AI-suggested edit to a file with YAML validation
   */
  async applyEdit(options: ApplyEditOptions): Promise<void> {
    const { dir, filePath, updatedContent, summary } = options;

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

    if (summary && summary.trim()) {
      // TODO: capture summary in an activity log once telemetry module is available.
    }
  }
}
