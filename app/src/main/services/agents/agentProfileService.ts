/**
 * Agent Profile Storage Service
 * 
 * Manages reading, writing, and validating agent profiles from context repositories
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { 
  AgentProfile, 
  AgentProfileDocument, 
  AgentOperationResult,
  AgentSearchCriteria 
} from '@shared/agents/types';
import { getAllBuiltInAgents, isBuiltInAgent } from './builtInAgents';

const AGENTS_FILE_NAME = 'agents.json';
const AGENTS_DIR = '.context';
const DEFAULT_DOCUMENT_VERSION = '1.0.0';

/**
 * Validation result for agent profiles
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Agent Profile Service
 */
export class AgentProfileService {
  /**
   * Get the path to the agents file for a repository
   */
  private getAgentsFilePath(repoPath: string): string {
    return path.join(repoPath, AGENTS_DIR, AGENTS_FILE_NAME);
  }

  /**
   * Check if agents file exists
   */
  async agentsFileExists(repoPath: string): Promise<boolean> {
    try {
      const filePath = this.getAgentsFilePath(repoPath);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load agents file from context repository
   */
  async loadAgentsFile(repoPath: string): Promise<AgentProfileDocument> {
    const filePath = this.getAgentsFilePath(repoPath);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const document = JSON.parse(content) as AgentProfileDocument;
      
      // Validate document structure
      if (!document.version) {
        document.version = DEFAULT_DOCUMENT_VERSION;
      }
      
      if (!Array.isArray(document.agents)) {
        document.agents = [];
      }
      
      return document;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, return empty document
        return {
          version: DEFAULT_DOCUMENT_VERSION,
          agents: [],
          metadata: {
            description: 'Custom AI agent profiles for this context repository',
            lastModified: new Date().toISOString()
          }
        };
      }
      
      throw new Error(`Failed to load agents file: ${(error as Error).message}`);
    }
  }

  /**
   * Save agents file to context repository
   */
  async saveAgentsFile(repoPath: string, document: AgentProfileDocument): Promise<void> {
    const filePath = this.getAgentsFilePath(repoPath);
    const dirPath = path.dirname(filePath);
    
    try {
      // Ensure .context directory exists
      await fs.mkdir(dirPath, { recursive: true });
      
      // Update metadata
      if (!document.metadata) {
        document.metadata = {};
      }
      document.metadata.lastModified = new Date().toISOString();
      
      // Write file with pretty formatting
      const content = JSON.stringify(document, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save agents file: ${(error as Error).message}`);
    }
  }

  /**
   * List all available agents (built-in + custom)
   */
  async listAgents(repoPath: string, criteria?: AgentSearchCriteria): Promise<AgentProfile[]> {
    const builtIn = getAllBuiltInAgents();
    
    let custom: AgentProfile[] = [];
    if (await this.agentsFileExists(repoPath)) {
      const document = await this.loadAgentsFile(repoPath);
      custom = document.agents;
    }
    
    let allAgents = [...builtIn, ...custom];
    
    // Apply filters if criteria provided
    if (criteria) {
      allAgents = this.filterAgents(allAgents, criteria);
    }
    
    return allAgents;
  }

  /**
   * Get specific agent by ID
   */
  async getAgent(repoPath: string, agentId: string): Promise<AgentProfile | null> {
    const agents = await this.listAgents(repoPath);
    return agents.find(agent => agent.id === agentId) ?? null;
  }

  /**
   * Create new custom agent
   */
  async createAgent(repoPath: string, agent: AgentProfile): Promise<AgentOperationResult> {
    // Validate agent
    const validation = this.validateAgent(agent);
    if (!validation.valid) {
      return {
        ok: false,
        error: `Agent validation failed: ${validation.errors.join(', ')}`
      };
    }
    
    // Check if agent ID already exists
    const existing = await this.getAgent(repoPath, agent.id);
    if (existing) {
      return {
        ok: false,
        error: `Agent with ID '${agent.id}' already exists`
      };
    }
    
    // Prevent overwriting built-in agents
    if (isBuiltInAgent(agent.id)) {
      return {
        ok: false,
        error: `Cannot create agent with built-in ID '${agent.id}'`
      };
    }
    
    try {
      // Load existing document
      const document = await this.loadAgentsFile(repoPath);
      
      // Add new agent
      const timestamp = new Date().toISOString();
      agent.metadata.createdAt = timestamp;
      agent.metadata.updatedAt = timestamp;
      agent.metadata.isBuiltIn = false;
      
      document.agents.push(agent);
      
      // Save document
      await this.saveAgentsFile(repoPath, document);
      
      return {
        ok: true,
        agent
      };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to create agent: ${(error as Error).message}`
      };
    }
  }

  /**
   * Update existing agent
   */
  async updateAgent(repoPath: string, agent: AgentProfile): Promise<AgentOperationResult> {
    // Validate agent
    const validation = this.validateAgent(agent);
    if (!validation.valid) {
      return {
        ok: false,
        error: `Agent validation failed: ${validation.errors.join(', ')}`
      };
    }
    
    // Prevent updating built-in agents
    if (isBuiltInAgent(agent.id)) {
      return {
        ok: false,
        error: `Cannot update built-in agent '${agent.id}'`
      };
    }
    
    try {
      // Load existing document
      const document = await this.loadAgentsFile(repoPath);
      
      // Find agent index
      const index = document.agents.findIndex(a => a.id === agent.id);
      if (index === -1) {
        return {
          ok: false,
          error: `Agent '${agent.id}' not found`
        };
      }
      
      // Update agent
      agent.metadata.updatedAt = new Date().toISOString();
      agent.metadata.isBuiltIn = false;
      
      // Preserve creation timestamp
      if (document.agents[index].metadata.createdAt) {
        agent.metadata.createdAt = document.agents[index].metadata.createdAt;
      }
      
      document.agents[index] = agent;
      
      // Save document
      await this.saveAgentsFile(repoPath, document);
      
      return {
        ok: true,
        agent
      };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to update agent: ${(error as Error).message}`
      };
    }
  }

  /**
   * Delete custom agent
   */
  async deleteAgent(repoPath: string, agentId: string): Promise<AgentOperationResult> {
    // Prevent deleting built-in agents
    if (isBuiltInAgent(agentId)) {
      return {
        ok: false,
        error: `Cannot delete built-in agent '${agentId}'`
      };
    }
    
    try {
      // Load existing document
      const document = await this.loadAgentsFile(repoPath);
      
      // Find agent
      const agent = document.agents.find(a => a.id === agentId);
      if (!agent) {
        return {
          ok: false,
          error: `Agent '${agentId}' not found`
        };
      }
      
      // Remove agent
      document.agents = document.agents.filter(a => a.id !== agentId);
      
      // Save document
      await this.saveAgentsFile(repoPath, document);
      
      return {
        ok: true,
        agent
      };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to delete agent: ${(error as Error).message}`
      };
    }
  }

  /**
   * Validate agent profile
   */
  validateAgent(agent: AgentProfile): ValidationResult {
    const errors: string[] = [];
    
    // Validate ID
    if (!agent.id || typeof agent.id !== 'string') {
      errors.push('Agent ID is required and must be a string');
    } else if (!/^[a-z0-9-]+$/.test(agent.id)) {
      errors.push('Agent ID must be kebab-case (lowercase letters, numbers, and hyphens only)');
    }
    
    // Validate metadata
    if (!agent.metadata) {
      errors.push('Agent metadata is required');
    } else {
      if (!agent.metadata.name || typeof agent.metadata.name !== 'string') {
        errors.push('Agent name is required and must be a string');
      }
      
      if (!agent.metadata.description || typeof agent.metadata.description !== 'string') {
        errors.push('Agent description is required and must be a string');
      }
      
      if (!Array.isArray(agent.metadata.tags)) {
        errors.push('Agent tags must be an array');
      }
    }
    
    // Validate system prompt
    if (!agent.systemPrompt || typeof agent.systemPrompt !== 'string') {
      errors.push('System prompt is required and must be a string');
    } else if (agent.systemPrompt.trim().length < 10) {
      errors.push('System prompt must be at least 10 characters');
    }
    
    // Validate tools if provided
    if (agent.tools) {
      if (!Array.isArray(agent.tools)) {
        errors.push('Tools must be an array');
      } else {
        agent.tools.forEach((tool, index) => {
          if (!tool.toolId || typeof tool.toolId !== 'string') {
            errors.push(`Tool ${index}: toolId is required and must be a string`);
          }
          if (typeof tool.required !== 'boolean') {
            errors.push(`Tool ${index}: required must be a boolean`);
          }
          if (!Array.isArray(tool.capabilities)) {
            errors.push(`Tool ${index}: capabilities must be an array`);
          }
        });
      }
    }
    
    // Validate config if provided
    if (agent.config) {
      if (agent.config.temperature !== undefined) {
        const temp = agent.config.temperature;
        if (typeof temp !== 'number' || temp < 0 || temp > 2) {
          errors.push('Temperature must be a number between 0 and 2');
        }
      }
      
      if (agent.config.maxTokens !== undefined) {
        const max = agent.config.maxTokens;
        if (typeof max !== 'number' || max < 1) {
          errors.push('Max tokens must be a positive number');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Filter agents based on search criteria
   */
  private filterAgents(agents: AgentProfile[], criteria: AgentSearchCriteria): AgentProfile[] {
    let filtered = [...agents];
    
    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      filtered = filtered.filter(agent =>
        criteria.tags!.some(tag => agent.metadata.tags.includes(tag))
      );
    }
    
    // Filter by complexity
    if (criteria.complexity) {
      filtered = filtered.filter(agent =>
        agent.metadata.complexity === criteria.complexity
      );
    }
    
    // Filter by provider compatibility
    if (criteria.provider) {
      filtered = filtered.filter(agent =>
        !agent.providers || agent.providers.includes(criteria.provider!)
      );
    }
    
    // Filter by search query (name or description)
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.metadata.name.toLowerCase().includes(query) ||
        agent.metadata.description.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query)
      );
    }
    
    // Filter built-in only
    if (criteria.builtInOnly === true) {
      filtered = filtered.filter(agent => agent.metadata.isBuiltIn === true);
    }
    
    return filtered;
  }

  /**
   * Export agent profile to JSON string
   */
  exportAgent(agent: AgentProfile): string {
    return JSON.stringify(agent, null, 2);
  }

  /**
   * Import agent profile from JSON string
   */
  importAgent(json: string): AgentOperationResult {
    try {
      const agent = JSON.parse(json) as AgentProfile;
      
      const validation = this.validateAgent(agent);
      if (!validation.valid) {
        return {
          ok: false,
          error: `Invalid agent profile: ${validation.errors.join(', ')}`
        };
      }
      
      return {
        ok: true,
        agent
      };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to parse agent JSON: ${(error as Error).message}`
      };
    }
  }
}

// Export singleton instance
export const agentProfileService = new AgentProfileService();
