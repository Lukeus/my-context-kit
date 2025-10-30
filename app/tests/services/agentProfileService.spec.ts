import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentProfileService } from '../../src/main/services/agents/agentProfileService';
import { getAllBuiltInAgents } from '../../src/main/services/agents/builtInAgents';
import type { AgentProfile } from '../../src/shared/agents/types';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');

describe('AgentProfileService', () => {
  let service: AgentProfileService;
  const testRepoPath = '/test/repo';

  beforeEach(() => {
    service = new AgentProfileService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadAgentsFile', () => {
    it('should load and parse agents file successfully', async () => {
      const mockDocument = {
        version: '1.0.0',
        agents: [
          {
            id: 'test-agent',
            metadata: {
              name: 'Test Agent',
              description: 'A test agent',
              tags: ['testing'],
              isBuiltIn: false
            },
            systemPrompt: 'You are a test agent'
          }
        ]
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockDocument));

      const result = await service.loadAgentsFile(testRepoPath);

      expect(result.version).toBe('1.0.0');
      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('test-agent');
    });

    it('should return empty document when file does not exist', async () => {
      const error: any = new Error('ENOENT');
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await service.loadAgentsFile(testRepoPath);

      expect(result.version).toBe('1.0.0');
      expect(result.agents).toEqual([]);
      expect(result.metadata?.description).toBeTruthy();
    });

    it('should throw error for other file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      await expect(service.loadAgentsFile(testRepoPath)).rejects.toThrow('Failed to load agents file');
    });

    it('should normalize document with missing version', async () => {
      const mockDocument = {
        agents: []
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockDocument));

      const result = await service.loadAgentsFile(testRepoPath);

      expect(result.version).toBe('1.0.0');
    });

    it('should normalize document with non-array agents', async () => {
      const mockDocument = {
        version: '1.0.0',
        agents: null as any
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockDocument));

      const result = await service.loadAgentsFile(testRepoPath);

      expect(result.agents).toEqual([]);
    });
  });

  describe('saveAgentsFile', () => {
    it('should save agents file with metadata', async () => {
      const mockDocument: any = {
        version: '1.0.0',
        agents: [],
        metadata: {}
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.saveAgentsFile(testRepoPath, mockDocument);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.context'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalled();
      expect(mockDocument.metadata?.lastModified).toBeTruthy();
    });

    it('should create directory if not exists', async () => {
      const mockDocument = { version: '1.0.0', agents: [] };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.saveAgentsFile(testRepoPath, mockDocument);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true }
      );
    });

    it('should format JSON with indentation', async () => {
      const mockDocument = { version: '1.0.0', agents: [] };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.saveAgentsFile(testRepoPath, mockDocument);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const content = writeCall[1] as string;
      
      expect(content).toContain('\n');
      expect(content).toContain('  ');
    });
  });

  describe('listAgents', () => {
    it('should return built-in agents when no custom agents exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.listAgents(testRepoPath);

      const builtInCount = getAllBuiltInAgents().length;
      expect(result).toHaveLength(builtInCount);
      expect(result.every(a => a.metadata.isBuiltIn)).toBe(true);
    });

    it('should merge built-in and custom agents', async () => {
      const customAgent: AgentProfile = {
        id: 'custom-agent',
        metadata: {
          name: 'Custom Agent',
          description: 'Custom',
          tags: ['testing'],
          isBuiltIn: false
        },
        systemPrompt: 'Custom prompt'
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: [customAgent]
      }));

      const result = await service.listAgents(testRepoPath);

      const builtInCount = getAllBuiltInAgents().length;
      expect(result).toHaveLength(builtInCount + 1);
      expect(result.find(a => a.id === 'custom-agent')).toBeTruthy();
    });

    it('should filter agents by search criteria', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.listAgents(testRepoPath, {
        tags: ['code-review']
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result.every(a => a.metadata.tags.includes('code-review'))).toBe(true);
    });
  });

  describe('getAgent', () => {
    it('should return built-in agent by ID', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.getAgent(testRepoPath, 'context-assistant');

      expect(result).toBeTruthy();
      expect(result?.id).toBe('context-assistant');
      expect(result?.metadata.isBuiltIn).toBe(true);
    });

    it('should return custom agent by ID', async () => {
      const customAgent: AgentProfile = {
        id: 'custom-agent',
        metadata: {
          name: 'Custom Agent',
          description: 'Custom',
          tags: ['testing']
        },
        systemPrompt: 'Custom prompt'
      };

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: [customAgent]
      }));

      const result = await service.getAgent(testRepoPath, 'custom-agent');

      expect(result).toBeTruthy();
      expect(result?.id).toBe('custom-agent');
    });

    it('should return null for non-existent agent', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await service.getAgent(testRepoPath, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('createAgent', () => {
    const validAgent: AgentProfile = {
      id: 'new-agent',
      metadata: {
        name: 'New Agent',
        description: 'A new agent',
        tags: ['testing']
      },
      systemPrompt: 'You are a new agent for testing purposes'
    };

    beforeEach(() => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: []
      }));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should create valid agent successfully', async () => {
      const result = await service.createAgent(testRepoPath, validAgent);

      expect(result.ok).toBe(true);
      expect(result.agent?.id).toBe('new-agent');
      expect(result.agent?.metadata.createdAt).toBeTruthy();
      expect(result.agent?.metadata.updatedAt).toBeTruthy();
      expect(result.agent?.metadata.isBuiltIn).toBe(false);
    });

    it('should reject invalid agent', async () => {
      const invalidAgent: any = {
        id: 'INVALID_ID',  // Should be kebab-case
        metadata: {
          name: 'Test',
          description: 'Test',
          tags: []
        },
        systemPrompt: 'Short'  // Too short
      };

      const result = await service.createAgent(testRepoPath, invalidAgent);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('should reject duplicate agent ID', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: [validAgent]
      }));

      const result = await service.createAgent(testRepoPath, validAgent);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should prevent creating agent with built-in ID', async () => {
      // Mock an empty agents list so we don't get "already exists" error
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: []
      }));

      const agentWithBuiltInId: AgentProfile = {
        ...validAgent,
        id: 'context-assistant'  // Built-in ID
      };

      const result = await service.createAgent(testRepoPath, agentWithBuiltInId);

      expect(result.ok).toBe(false);
      // The service checks existence first, so built-in agents will fail with "already exists"
      expect(result.error).toContain('already exists');
    });
  });

  describe('updateAgent', () => {
    const existingAgent: AgentProfile = {
      id: 'existing-agent',
      metadata: {
        name: 'Existing Agent',
        description: 'Existing',
        tags: ['testing'],
        createdAt: '2024-01-01T00:00:00Z'
      },
      systemPrompt: 'Original prompt'
    };

    beforeEach(() => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: [existingAgent]
      }));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should update existing agent', async () => {
      const updatedAgent: AgentProfile = {
        ...existingAgent,
        systemPrompt: 'Updated prompt'
      };

      const result = await service.updateAgent(testRepoPath, updatedAgent);

      expect(result.ok).toBe(true);
      expect(result.agent?.systemPrompt).toBe('Updated prompt');
      expect(result.agent?.metadata.updatedAt).toBeTruthy();
      expect(result.agent?.metadata.createdAt).toBe(existingAgent.metadata.createdAt);
    });

    it('should reject invalid agent', async () => {
      const invalidAgent: any = {
        ...existingAgent,
        systemPrompt: '' // Empty prompt
      };

      const result = await service.updateAgent(testRepoPath, invalidAgent);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('validation failed');
    });

    it('should prevent updating built-in agent', async () => {
      // Mock the file to contain a valid custom agent (not the built-in one we're trying to update)
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: [existingAgent]  // Keep the existing agent, not a built-in one
      }));

      const builtInAgent: AgentProfile = {
        id: 'context-assistant',  // This is a built-in ID
        metadata: {
          name: 'Context Assistant',
          description: 'Built-in',
          tags: [],
          isBuiltIn: true
        },
        systemPrompt: 'Modified system prompt for testing purposes'
      };

      const result = await service.updateAgent(testRepoPath, builtInAgent);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('built-in');
    });

    it('should return error for non-existent agent', async () => {
      const nonExistent: AgentProfile = {
        id: 'non-existent',
        metadata: {
          name: 'Non-existent',
          description: 'Does not exist',
          tags: []
        },
        systemPrompt: 'Test prompt'
      };

      const result = await service.updateAgent(testRepoPath, nonExistent);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('deleteAgent', () => {
    const customAgent: AgentProfile = {
      id: 'custom-agent',
      metadata: {
        name: 'Custom Agent',
        description: 'Custom',
        tags: []
      },
      systemPrompt: 'Custom prompt'
    };

    beforeEach(() => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        version: '1.0.0',
        agents: [customAgent]
      }));
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should delete custom agent', async () => {
      const result = await service.deleteAgent(testRepoPath, 'custom-agent');

      expect(result.ok).toBe(true);
      expect(result.agent?.id).toBe('custom-agent');
    });

    it('should prevent deleting built-in agent', async () => {
      const result = await service.deleteAgent(testRepoPath, 'context-assistant');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('built-in');
    });

    it('should return error for non-existent agent', async () => {
      const result = await service.deleteAgent(testRepoPath, 'non-existent');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('validateAgent', () => {
    it('should validate correct agent', () => {
      const validAgent: AgentProfile = {
        id: 'test-agent',
        metadata: {
          name: 'Test Agent',
          description: 'A test agent',
          tags: ['testing']
        },
        systemPrompt: 'You are a test agent with a valid prompt'
      };

      const result = service.validateAgent(validAgent);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid ID format', () => {
      const agent: any = {
        id: 'Invalid_ID',  // Underscore not allowed
        metadata: {
          name: 'Test',
          description: 'Test',
          tags: []
        },
        systemPrompt: 'Valid prompt here'
      };

      const result = service.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('kebab-case'))).toBe(true);
    });

    it('should reject missing required fields', () => {
      const agent: any = {
        id: 'test-agent',
        metadata: {
          name: 'Test'
          // Missing description and tags
        },
        systemPrompt: 'Valid prompt'
      };

      const result = service.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject too-short system prompt', () => {
      const agent: any = {
        id: 'test-agent',
        metadata: {
          name: 'Test',
          description: 'Test',
          tags: []
        },
        systemPrompt: 'Short'  // Less than 10 characters
      };

      const result = service.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('10 characters'))).toBe(true);
    });

    it('should validate temperature range', () => {
      const agent: any = {
        id: 'test-agent',
        metadata: {
          name: 'Test',
          description: 'Test',
          tags: []
        },
        systemPrompt: 'Valid prompt here',
        config: {
          temperature: 3.0  // Too high
        }
      };

      const result = service.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Temperature'))).toBe(true);
    });

    it('should validate tool structure', () => {
      const agent: any = {
        id: 'test-agent',
        metadata: {
          name: 'Test',
          description: 'Test',
          tags: []
        },
        systemPrompt: 'Valid prompt here',
        tools: [
          {
            // Missing toolId and other fields
            required: true
          }
        ]
      };

      const result = service.validateAgent(agent);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('exportAgent', () => {
    it('should export agent as JSON string', () => {
      const agent: AgentProfile = {
        id: 'test-agent',
        metadata: {
          name: 'Test Agent',
          description: 'Test',
          tags: []
        },
        systemPrompt: 'Test prompt'
      };

      const result = service.exportAgent(agent);

      expect(typeof result).toBe('string');
      expect(JSON.parse(result)).toEqual(agent);
    });
  });

  describe('importAgent', () => {
    it('should import valid agent JSON', () => {
      const agent: AgentProfile = {
        id: 'test-agent',
        metadata: {
          name: 'Test Agent',
          description: 'Test',
          tags: []
        },
        systemPrompt: 'Test prompt for import'
      };

      const json = JSON.stringify(agent);
      const result = service.importAgent(json);

      expect(result.ok).toBe(true);
      expect(result.agent?.id).toBe('test-agent');
    });

    it('should reject invalid JSON', () => {
      const result = service.importAgent('invalid json {');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('parse');
    });

    it('should reject invalid agent profile', () => {
      const invalidAgent = {
        id: 'INVALID',
        // Missing required fields
      };

      const json = JSON.stringify(invalidAgent);
      const result = service.importAgent(json);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });
});
