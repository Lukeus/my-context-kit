/**
 * Agent Profile Types
 * 
 * Based on the AGENTS.md specification: https://agents.md/
 * Defines custom AI agent configurations for context-aware assistance
 */

import type { AssistantProvider, ToolCapability } from '../assistant/types';

/**
 * Agent profile identifier format
 * Examples: "code-reviewer", "doc-writer", "test-generator"
 */
export type AgentId = string;

/**
 * Agent capability tags for filtering and discovery
 */
export type AgentCapabilityTag = 
  | 'code-review'
  | 'documentation'
  | 'testing'
  | 'refactoring'
  | 'architecture'
  | 'security'
  | 'performance'
  | 'debugging'
  | 'generation'
  | 'validation'
  | 'analysis';

/**
 * Agent complexity level
 */
export type AgentComplexity = 'simple' | 'moderate' | 'advanced';

/**
 * Tool requirement specification for an agent
 */
export interface AgentToolRequirement {
  /**
   * Tool ID that must be available
   */
  toolId: string;
  
  /**
   * Whether this tool is required or optional
   */
  required: boolean;
  
  /**
   * Capabilities this tool provides
   */
  capabilities: ToolCapability[];
  
  /**
   * Custom configuration for this tool when used by the agent
   */
  config?: Record<string, unknown>;
}

/**
 * Example interaction demonstrating agent behavior
 */
export interface AgentExample {
  /**
   * User input
   */
  input: string;
  
  /**
   * Expected agent response or behavior
   */
  output: string;
  
  /**
   * Optional explanation of the interaction
   */
  explanation?: string;
}

/**
 * Agent profile metadata
 */
export interface AgentMetadata {
  /**
   * Agent display name
   */
  name: string;
  
  /**
   * Brief description of agent's purpose
   */
  description: string;
  
  /**
   * Agent author or organization
   */
  author?: string;
  
  /**
   * Agent version (semver)
   */
  version?: string;
  
  /**
   * Agent capability tags
   */
  tags: AgentCapabilityTag[];
  
  /**
   * Complexity level
   */
  complexity?: AgentComplexity;
  
  /**
   * Icon or emoji for UI display
   */
  icon?: string;
  
  /**
   * Whether this is a built-in or user-created agent
   */
  isBuiltIn?: boolean;
  
  /**
   * Creation timestamp
   */
  createdAt?: string;
  
  /**
   * Last updated timestamp
   */
  updatedAt?: string;
}

/**
 * Complete agent profile definition
 */
export interface AgentProfile {
  /**
   * Unique identifier for the agent
   */
  id: AgentId;
  
  /**
   * Agent metadata
   */
  metadata: AgentMetadata;
  
  /**
   * System prompt that defines the agent's behavior and personality
   */
  systemPrompt: string;
  
  /**
   * Tools this agent requires or recommends
   */
  tools?: AgentToolRequirement[];
  
  /**
   * Supported AI providers (if restricted)
   */
  providers?: AssistantProvider[];
  
  /**
   * Example interactions to demonstrate agent capabilities
   */
  examples?: AgentExample[];
  
  /**
   * Additional configuration options
   */
  config?: {
    /**
     * Preferred temperature setting (0-2)
     */
    temperature?: number;
    
    /**
     * Maximum tokens for responses
     */
    maxTokens?: number;
    
    /**
     * Enable logprobs for analysis
     */
    enableLogprobs?: boolean;
    
    /**
     * Custom prompt templates by mode
     */
    promptTemplates?: {
      improvement?: string;
      clarification?: string;
      general?: string;
    };
    
    /**
     * Additional provider-specific settings
     */
    [key: string]: unknown;
  };
}

/**
 * Agent profile storage format (AGENTS.md file)
 */
export interface AgentProfileDocument {
  /**
   * Document version for schema evolution
   */
  version: string;
  
  /**
   * Collection of agent profiles
   */
  agents: AgentProfile[];
  
  /**
   * Document metadata
   */
  metadata?: {
    description?: string;
    repository?: string;
    lastModified?: string;
  };
}

/**
 * Agent selection criteria for filtering
 */
export interface AgentSearchCriteria {
  /**
   * Filter by capability tags
   */
  tags?: AgentCapabilityTag[];
  
  /**
   * Filter by complexity
   */
  complexity?: AgentComplexity;
  
  /**
   * Filter by provider compatibility
   */
  provider?: AssistantProvider;
  
  /**
   * Search by name or description
   */
  query?: string;
  
  /**
   * Show only built-in agents
   */
  builtInOnly?: boolean;
}

/**
 * Result from agent operations
 */
export interface AgentOperationResult {
  ok: boolean;
  error?: string;
  agent?: AgentProfile;
  agents?: AgentProfile[];
}
