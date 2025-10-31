import type { ToolDescriptor, AssistantProvider } from '@shared/assistant/types';

/**
 * RAG Tool Descriptors
 * 
 * These tools enable the assistant to perform semantic search and entity retrieval
 * using the RAG (Retrieval-Augmented Generation) system with vector embeddings.
 */

const ALL_PROVIDERS: AssistantProvider[] = ['azure-openai', 'ollama'];

export const RAG_SEARCH_TOOL: ToolDescriptor = {
  id: 'rag.search',
  title: 'Search Context Repository',
  description: 'Perform semantic search across the context repository to find relevant entities. Uses vector embeddings for similarity matching.',
  capability: 'read',
  requiresApproval: false,
  allowedProviders: ALL_PROVIDERS,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find relevant entities',
        minLength: 1,
        maxLength: 500
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (1-20)',
        minimum: 1,
        maximum: 20,
        default: 10
      }
    },
    required: ['query'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Entity ID (e.g., FEAT-001)' },
            title: { type: 'string', description: 'Entity title' },
            type: { type: 'string', description: 'Entity type (feature, task, etc.)' },
            relevance: { type: 'number', description: 'Relevance score (0-100)' },
            excerpt: { type: 'string', description: 'Content excerpt' }
          }
        }
      },
      count: {
        type: 'number',
        description: 'Number of results returned'
      }
    }
  }
};

export const RAG_GET_ENTITY_TOOL: ToolDescriptor = {
  id: 'rag.getEntity',
  title: 'Get Entity Details',
  description: 'Retrieve complete details for a specific entity by ID (e.g., FEAT-001, US-042). Returns full entity data including relationships and metadata.',
  capability: 'read',
  requiresApproval: false,
  allowedProviders: ALL_PROVIDERS,
  inputSchema: {
    type: 'object',
    properties: {
      entityId: {
        type: 'string',
        description: 'The entity ID to retrieve (e.g., FEAT-001, US-042, T-015)',
        pattern: '^(FEAT|US|SPEC|T|SERVICE|PKG)-\\d{3,}$'
      }
    },
    required: ['entityId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: { type: 'string' },
      title: { type: 'string' },
      status: { type: 'string' },
      description: { type: 'string' },
      objective: { type: 'string' },
      dependencies: {
        type: 'array',
        items: { type: 'string' }
      },
      metadata: { type: 'object' },
      raw: { type: 'object', description: 'Complete entity data' }
    }
  }
};

export const RAG_FIND_SIMILAR_TOOL: ToolDescriptor = {
  id: 'rag.findSimilar',
  title: 'Find Similar Entities',
  description: 'Find entities semantically similar to a given entity using vector embeddings. Useful for discovering related features, tasks, or dependencies.',
  capability: 'read',
  requiresApproval: false,
  allowedProviders: ALL_PROVIDERS,
  inputSchema: {
    type: 'object',
    properties: {
      entityId: {
        type: 'string',
        description: 'The source entity ID to find similar entities for',
        pattern: '^(FEAT|US|SPEC|T|SERVICE|PKG)-\\d{3,}$'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of similar entities to return (1-15)',
        minimum: 1,
        maximum: 15,
        default: 5
      }
    },
    required: ['entityId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      sourceEntity: { type: 'string', description: 'The source entity ID' },
      similar: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string' },
            relevance: { type: 'number' },
            excerpt: { type: 'string' }
          }
        }
      },
      count: { type: 'number' }
    }
  }
};

/**
 * All RAG tools for easy registration
 */
export const RAG_TOOLS: ToolDescriptor[] = [
  RAG_SEARCH_TOOL,
  RAG_GET_ENTITY_TOOL,
  RAG_FIND_SIMILAR_TOOL
];
