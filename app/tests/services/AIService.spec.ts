import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from '../../src/main/services/AIService';
import { safeStorage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execa } from 'execa';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(tmpdir(), 'context-kit-tests')),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((text: string) => Buffer.from(`encrypted:${text}`)),
    decryptString: vi.fn((buffer: Buffer) => buffer.toString().replace('encrypted:', '')),
  },
}));

// Mock file system
vi.mock('node:fs/promises', () => {
  const mocks = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  };
  return {
    ...mocks,
    default: mocks,
  };
});

vi.mock('node:fs', () => {
  const mocks = {
    existsSync: vi.fn(),
  };
  return {
    ...mocks,
    default: mocks,
  };
});

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock yaml parser
vi.mock('yaml', () => ({
  parse: vi.fn((content: string) => {
    if (content.includes('invalid')) {
      const error: any = new Error('Invalid YAML at line 5');
      error.message = 'Invalid YAML at line 5';
      throw error;
    }
    return { parsed: true };
  }),
}));

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    vi.clearAllMocks();
    // Set default mock behavior
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConfig', () => {
    it('should return config from file if it exists', async () => {
      const mockConfig = {
        provider: 'azure-openai',
        endpoint: 'https://api.openai.com',
        model: 'gpt-4',
        enabled: true,
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const result = await aiService.getConfig('/test/repo');

      expect(result).toEqual(mockConfig);
      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining('.context'),
        'utf-8'
      );
    });

    it('should return default config if file does not exist', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await aiService.getConfig('/test/repo');

      expect(result).toEqual({
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        enabled: false,
      });
    });
  });

  describe('saveConfig', () => {
    it('should save config without API key', async () => {
      const config = {
        provider: 'azure-openai',
        endpoint: 'https://api.openai.com',
        model: 'gpt-4',
        enabled: true,
        apiKey: 'secret-key-123',
      };

      vi.mocked(writeFile).mockResolvedValue();

      await aiService.saveConfig('/test/repo', config);

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.context'),
        expect.not.stringContaining('secret-key-123'),
        'utf-8'
      );

      const savedConfig = JSON.parse(vi.mocked(writeFile).mock.calls[0][1] as string);
      expect(savedConfig.apiKey).toBeUndefined();
    });
  });

  describe('saveCredentials', () => {
    it('should encrypt and save credentials', async () => {
      vi.mocked(writeFile).mockResolvedValue();

      await aiService.saveCredentials('azure-openai', 'test-api-key');

      expect(safeStorage.encryptString).toHaveBeenCalledWith('test-api-key');
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('azure-openai-credentials.enc'),
        expect.any(Buffer)
      );
    });

    it('should throw error if encryption is not available', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

      await expect(
        aiService.saveCredentials('azure-openai', 'test-key')
      ).rejects.toThrow('Encryption not available');
    });
  });

  describe('hasCredentials', () => {
    it('should return true if credentials exist and can be decrypted', async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from('encrypted:test-key'));
      vi.mocked(safeStorage.decryptString).mockReturnValue('test-key');

      const result = await aiService.hasCredentials('azure-openai');

      expect(result).toBe(true);
    });

    it('should return false if credentials do not exist', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await aiService.hasCredentials('azure-openai');

      expect(result).toBe(false);
    });

    it('should return false if encryption is not available', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

      const result = await aiService.hasCredentials('azure-openai');

      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should test Ollama connection successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const result = await aiService.testConnection({
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        useStoredKey: false,
      });

      expect(result).toContain('Connected to Ollama');
      expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
    });

    it('should throw error if Ollama connection fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      await expect(
        aiService.testConnection({
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          useStoredKey: false,
        })
      ).rejects.toThrow('Failed to connect to Ollama');
    });

    it('should test Azure OpenAI connection', async () => {
      const result = await aiService.testConnection({
        provider: 'azure-openai',
        endpoint: 'https://api.openai.com',
        model: 'gpt-4',
        useStoredKey: false,
      });

      expect(result).toContain('Azure OpenAI');
    });
  });

  describe('generate', () => {
    it('should generate entity using AI', async () => {
      const mockConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        enabled: true,
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));
      vi.mocked(execa).mockResolvedValue({
        stdout: JSON.stringify({ ok: true, entity: { id: 'FEAT-001' } }),
      } as any);

      const result = await aiService.generate({
        dir: '/test/repo',
        entityType: 'feature',
        userPrompt: 'Create a login feature',
      });

      expect(result).toEqual({ ok: true, entity: { id: 'FEAT-001' } });
      expect(execa).toHaveBeenCalledWith(
        'node',
        expect.arrayContaining(['generate', 'ollama']),
        expect.any(Object)
      );
    });

    it('should throw error if AI is disabled', async () => {
      const mockConfig = {
        provider: 'ollama',
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        enabled: false,
      };

      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockConfig));

      await expect(
        aiService.generate({
          dir: '/test/repo',
          entityType: 'feature',
          userPrompt: 'Create a login feature',
        })
      ).rejects.toThrow('AI assistance is disabled');
    });
  });

  describe('applyEdit', () => {
    it('should apply valid YAML edit to file', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockResolvedValue();

      const validYaml = 'id: FEAT-001\nname: Login Feature';

      await aiService.applyEdit({
        dir: '/test/repo',
        filePath: 'contexts/features/feat-001.yaml',
        updatedContent: validYaml,
      });

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('feat-001.yaml'),
        validYaml,
        'utf-8'
      );
    });

    it('should throw error if file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(
        aiService.applyEdit({
          dir: '/test/repo',
          filePath: 'contexts/features/feat-001.yaml',
          updatedContent: 'id: FEAT-001',
        })
      ).rejects.toThrow('Target file does not exist');
    });

    it('should throw error if YAML is invalid', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      await expect(
        aiService.applyEdit({
          dir: '/test/repo',
          filePath: 'contexts/features/feat-001.yaml',
          updatedContent: 'invalid yaml content',
        })
      ).rejects.toThrow('not valid YAML');
    });

    it('should throw error if target path is outside repository', async () => {
      await expect(
        aiService.applyEdit({
          dir: '/test/repo',
          filePath: '../../../etc/passwd',
          updatedContent: 'malicious content',
        })
      ).rejects.toThrow('outside the repository');
    });
  });

  describe('cancelAssistStream', () => {
    it('should throw error if stream does not exist', async () => {
      await expect(
        aiService.cancelAssistStream('non-existent-stream-id')
      ).rejects.toThrow('Stream not found');
    });
  });
});
