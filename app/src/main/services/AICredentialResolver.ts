import { app, safeStorage } from 'electron';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger';

const CREDENTIALS_FILE = 'credentials.enc';

export interface CredentialOptions {
  provider: string;
  explicitKey?: string;
  useStoredCredentials?: boolean;
  useEnvironmentVars?: boolean;
}

/**
 * Unified credential resolution for all AI services.
 * 
 * This resolver provides consistent API key resolution across AIService and
 * LangChainAIService, eliminating duplicate credential logic and ensuring
 * both services use the same endpoint and API key.
 * 
 * Priority order:
 * 1. Explicit key passed in options
 * 2. Stored encrypted credentials (via safeStorage)
 * 3. Environment variables (OPENAI_API_KEY, AZURE_OPENAI_KEY)
 * 
 * @example
 * ```typescript
 * const resolver = new AICredentialResolver();
 * const apiKey = await resolver.resolveApiKey({
 *   provider: 'azure-openai',
 *   explicitKey: config.apiKey,
 *   useStoredCredentials: true,
 *   useEnvironmentVars: true
 * });
 * ```
 */
export class AICredentialResolver {
  /**
   * Resolve API key using consistent priority chain.
   * 
   * @param options - Resolution options
   * @param options.provider - Provider name ('ollama', 'azure-openai')
   * @param options.explicitKey - Explicit API key (highest priority)
   * @param options.useStoredCredentials - Check stored encrypted credentials (default: true)
   * @param options.useEnvironmentVars - Check environment variables (default: true)
   * @returns Resolved API key or null if not found
   * 
   * @example
   * ```typescript
   * // Try all sources
   * const key = await resolver.resolveApiKey({
   *   provider: 'azure-openai',
   *   useStoredCredentials: true,
   *   useEnvironmentVars: true
   * });
   * 
   * // Only use explicit key
   * const key = await resolver.resolveApiKey({
   *   provider: 'azure-openai',
   *   explicitKey: 'sk-...',
   *   useStoredCredentials: false,
   *   useEnvironmentVars: false
   * });
   * ```
   */
  async resolveApiKey(options: CredentialOptions): Promise<string | null> {
    // 1. Explicit key has highest priority
    if (options.explicitKey) {
      logger.debug(
        { service: 'AICredentialResolver', method: 'resolveApiKey' },
        `Using explicit API key for ${options.provider}`
      );
      return options.explicitKey;
    }

    // 2. Stored encrypted credentials
    if (options.useStoredCredentials !== false) {
      const stored = await this.getStoredCredentials(options.provider);
      if (stored) {
        logger.debug(
          { service: 'AICredentialResolver', method: 'resolveApiKey' },
          `Using stored credentials for ${options.provider}`
        );
        return stored;
      }
    }

    // 3. Environment variables (only for providers that need it)
    if (options.useEnvironmentVars !== false && this.providerNeedsApiKey(options.provider)) {
      const envKey = this.getEnvironmentApiKey(options.provider);
      if (envKey) {
        logger.debug(
          { service: 'AICredentialResolver', method: 'resolveApiKey' },
          `Using environment variable for ${options.provider}`
        );
        return envKey;
      }
    }

    logger.debug(
      { service: 'AICredentialResolver', method: 'resolveApiKey' },
      `No credentials found for ${options.provider}`
    );
    return null;
  }

  /**
   * Get stored encrypted credentials for a provider.
   * 
   * @param provider - Provider name
   * @returns Decrypted API key or null if not found
   */
  private async getStoredCredentials(provider: string): Promise<string | null> {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.debug(
          { service: 'AICredentialResolver', method: 'getStoredCredentials' },
          'Encryption not available'
        );
        return null;
      }

      const credPath = path.join(
        app.getPath('userData'),
        `${provider}-${CREDENTIALS_FILE}`
      );

      if (!existsSync(credPath)) {
        logger.debug(
          { service: 'AICredentialResolver', method: 'getStoredCredentials' },
          `No credentials file for ${provider}`
        );
        return null;
      }

      const encrypted = await readFile(credPath);
      const decrypted = safeStorage.decryptString(encrypted);
      
      logger.info(
        { service: 'AICredentialResolver', method: 'getStoredCredentials' },
        `Loaded stored credentials for ${provider}`
      );
      
      return decrypted;
    } catch (err) {
      logger.warn(
        { service: 'AICredentialResolver', method: 'getStoredCredentials' },
        `Could not load stored credentials for ${provider}: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /**
   * Get API key from environment variables.
   * 
   * @param provider - Provider name
   * @returns API key from environment or null
   */
  private getEnvironmentApiKey(provider: string): string | null {
    if (provider === 'azure-openai') {
      // Check both OPENAI_API_KEY and AZURE_OPENAI_KEY
      return process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY || null;
    }
    return null;
  }

  /**
   * Check if provider requires API key.
   * 
   * @param provider - Provider name
   * @returns true if provider needs API key
   */
  private providerNeedsApiKey(provider: string): boolean {
    // Ollama doesn't need API key, Azure OpenAI does
    return provider === 'azure-openai';
  }

  /**
   * Check if credentials exist for a provider.
   * 
   * This checks all sources (stored, environment) and returns true if any are available.
   * 
   * @param provider - Provider name
   * @returns true if credentials are available from any source
   * 
   * @example
   * ```typescript
   * if (await resolver.hasCredentials('azure-openai')) {
   *   // Proceed with AI operations
   * }
   * ```
   */
  async hasCredentials(provider: string): Promise<boolean> {
    const key = await this.resolveApiKey({
      provider,
      useStoredCredentials: true,
      useEnvironmentVars: true
    });
    return key !== null;
  }
}
