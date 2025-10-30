import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AICredentialResolver } from '../../src/main/services/AICredentialResolver';
import { app, safeStorage } from 'electron';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Mock electron modules
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    decryptString: vi.fn()
  }
}));

// Mock file system
vi.mock('node:fs/promises', () => {
  const mocks = {
    readFile: vi.fn()
  };
  return {
    ...mocks,
    default: mocks
  };
});

vi.mock('node:fs', () => {
  const mocks = {
    existsSync: vi.fn()
  };
  return {
    ...mocks,
    default: mocks
  };
});

describe('AICredentialResolver', () => {
  let resolver: AICredentialResolver;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    resolver = new AICredentialResolver();
    originalEnv = { ...process.env };
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(app.getPath).mockReturnValue('/mock/user/data');
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('resolveApiKey - priority order', () => {
    it('should prioritize explicit key over all other sources', async () => {
      // Setup stored credentials and env vars
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from('encrypted'));
      vi.mocked(safeStorage.decryptString).mockReturnValue('stored-key');
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        explicitKey: 'explicit-key',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('explicit-key');
      // Should not even check stored credentials or env
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should use stored credentials when no explicit key', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from('encrypted'));
      vi.mocked(safeStorage.decryptString).mockReturnValue('stored-key');
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('stored-key');
      expect(readFile).toHaveBeenCalledWith(expect.stringContaining('azure-openai-credentials.enc'));
    });

    it('should use environment variable when no explicit key or stored credentials', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('env-key');
    });

    it('should return null when no credentials found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      delete process.env.OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_KEY;

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBeNull();
    });
  });

  describe('resolveApiKey - environment variables', () => {
    it('should check OPENAI_API_KEY for azure-openai', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'openai-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('openai-key');
    });

    it('should check AZURE_OPENAI_KEY for azure-openai', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      delete process.env.OPENAI_API_KEY;
      process.env.AZURE_OPENAI_KEY = 'azure-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('azure-key');
    });

    it('should prefer OPENAI_API_KEY over AZURE_OPENAI_KEY', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.AZURE_OPENAI_KEY = 'azure-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('openai-key');
    });

    it('should not check environment variables for ollama', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'should-not-use';

      const result = await resolver.resolveApiKey({
        provider: 'ollama',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBeNull();
    });
  });

  describe('resolveApiKey - stored credentials', () => {
    it('should skip stored credentials when useStoredCredentials is false', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from('encrypted'));
      vi.mocked(safeStorage.decryptString).mockReturnValue('stored-key');
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: false,
        useEnvironmentVars: true
      });

      expect(result).toBe('env-key');
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should handle missing encryption availability', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('env-key');
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should handle missing credentials file', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('env-key');
      expect(readFile).not.toHaveBeenCalled();
    });

    it('should handle decryption errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from('encrypted'));
      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('env-key');
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockRejectedValue(new Error('File read failed'));
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('env-key');
    });
  });

  describe('resolveApiKey - options', () => {
    it('should skip environment variables when useEnvironmentVars is false', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        useStoredCredentials: true,
        useEnvironmentVars: false
      });

      expect(result).toBeNull();
    });

    it('should work with all sources disabled if explicit key provided', async () => {
      const result = await resolver.resolveApiKey({
        provider: 'azure-openai',
        explicitKey: 'explicit-key',
        useStoredCredentials: false,
        useEnvironmentVars: false
      });

      expect(result).toBe('explicit-key');
    });
  });

  describe('hasCredentials', () => {
    it('should return true when credentials exist', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from('encrypted'));
      vi.mocked(safeStorage.decryptString).mockReturnValue('stored-key');

      const result = await resolver.hasCredentials('azure-openai');

      expect(result).toBe(true);
    });

    it('should return true when environment variable exists', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'env-key';

      const result = await resolver.hasCredentials('azure-openai');

      expect(result).toBe(true);
    });

    it('should return false when no credentials exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      delete process.env.OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_KEY;

      const result = await resolver.hasCredentials('azure-openai');

      expect(result).toBe(false);
    });
  });

  describe('provider-specific behavior', () => {
    it('should handle ollama provider (no credentials needed)', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      process.env.OPENAI_API_KEY = 'should-not-use';

      const result = await resolver.resolveApiKey({
        provider: 'ollama',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBeNull();
    });

    it('should still check stored credentials for ollama', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from('encrypted'));
      vi.mocked(safeStorage.decryptString).mockReturnValue('ollama-key');

      const result = await resolver.resolveApiKey({
        provider: 'ollama',
        useStoredCredentials: true,
        useEnvironmentVars: true
      });

      expect(result).toBe('ollama-key');
    });
  });
});
