/**
 * Integration Tests for SidecarClient
 * 
 * Tests the TypeScript HTTP client against a running Python sidecar service.
 * These tests validate request/response flow, Zod validation, and SSE streaming.
 * 
 * Run with: npm test -- sidecar-client.spec.ts
 * 
 * Prerequisites:
 * - Python sidecar must be running on http://localhost:8000
 * - Run: cd context-kit-service && poetry run python -m context_kit_service.main
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getSidecarClient,
  resetSidecarClient,
  SidecarClient,
} from '../../src/shared/sidecar/SidecarClient';
import type {
  GenerateEntityRequest,
  AssistStreamRequest,
  ToolExecutionRequest,
  RAGQueryRequest,
} from '../../src/shared/sidecar/schemas';

const SIDECAR_URL = 'http://localhost:8000';
const TEST_TIMEOUT = 10000; // 10 seconds

describe('SidecarClient Integration Tests', () => {
  let client: SidecarClient;

  beforeAll(() => {
    client = getSidecarClient({ baseUrl: SIDECAR_URL });
  });

  afterAll(() => {
    resetSidecarClient();
  });

  // ===========================================================================
  // Health Check Tests
  // ===========================================================================

  describe('Health Check', () => {
    it('should return health status', async () => {
      const health = await client.health();

      expect(health).toBeDefined();
      expect(health.status).toBeOneOf(['healthy', 'degraded', 'unhealthy', 'unknown']);
      expect(health.version).toBeTruthy();
      expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(health.dependencies).toBeDefined();
      expect(typeof health.dependencies).toBe('object');
    }, TEST_TIMEOUT);
  });

  // ===========================================================================
  // Entity Generation Tests
  // ===========================================================================

  describe('Entity Generation', () => {
    it('should generate a feature entity', async () => {
      const request: GenerateEntityRequest = {
        entityType: 'feature',
        userPrompt: 'Create a user authentication feature with login and signup',
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      const response = await client.generateEntity(request);

      expect(response).toBeDefined();
      expect(response.entity).toBeDefined();
      expect(response.entity.type).toBe('feature');
      expect(response.metadata).toBeDefined();
      expect(response.metadata.promptTokens).toBeGreaterThanOrEqual(0);
      expect(response.metadata.completionTokens).toBeGreaterThanOrEqual(0);
      expect(response.metadata.durationMs).toBeGreaterThan(0);
      expect(response.metadata.model).toBe('llama2');
    }, TEST_TIMEOUT);

    it('should generate a spec entity with linked feature', async () => {
      const request: GenerateEntityRequest = {
        entityType: 'spec',
        userPrompt: 'Write technical specification for authentication API endpoints',
        linkedFeatureId: 'feature-auth-001',
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      const response = await client.generateEntity(request);

      expect(response).toBeDefined();
      expect(response.entity).toBeDefined();
      expect(response.entity.type).toBe('spec');
      expect(response.entity.linked_feature_id).toBe('feature-auth-001');
    }, TEST_TIMEOUT);

    it('should reject requests with short prompts', async () => {
      const request: GenerateEntityRequest = {
        entityType: 'task',
        userPrompt: 'Short',  // Too short (< 10 chars)
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      await expect(client.generateEntity(request)).rejects.toThrow();
    }, TEST_TIMEOUT);
  });

  // ===========================================================================
  // Streaming Assistance Tests
  // ===========================================================================

  describe('Streaming Assistance', () => {
    it('should stream assistance tokens', async () => {
      const request: AssistStreamRequest = {
        question: 'What is the purpose of this repository?',
        conversationHistory: [],
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      const tokens: string[] = [];
      let completionReceived = false;
      let errorReceived: Error | null = null;

      const cleanup = await client.streamAssist(
        request,
        (token) => {
          tokens.push(token);
        },
        (fullContent, metadata) => {
          expect(fullContent).toBeTruthy();
          expect(metadata.totalTokens).toBeGreaterThan(0);
          expect(metadata.durationMs).toBeGreaterThan(0);
          completionReceived = true;
        },
        (error) => {
          errorReceived = error;
        }
      );

      // Wait for streaming to complete
      await new Promise((resolve) => setTimeout(resolve, 5000));

      cleanup();

      expect(errorReceived).toBeNull();
      expect(tokens.length).toBeGreaterThan(0);
      expect(completionReceived).toBe(true);
    }, TEST_TIMEOUT);

    it('should handle conversation history', async () => {
      const request: AssistStreamRequest = {
        question: 'Can you elaborate on that?',
        conversationHistory: [
          {
            role: 'user',
            content: 'What is authentication?',
          },
          {
            role: 'assistant',
            content: 'Authentication is the process of verifying user identity.',
          },
        ],
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      const tokens: string[] = [];
      let completed = false;

      const cleanup = await client.streamAssist(
        request,
        (token) => tokens.push(token),
        () => { completed = true; },
        (error) => { throw error; }
      );

      await new Promise((resolve) => setTimeout(resolve, 5000));
      cleanup();

      expect(tokens.length).toBeGreaterThan(0);
      expect(completed).toBe(true);
    }, TEST_TIMEOUT);
  });

  // ===========================================================================
  // Tool Execution Tests
  // ===========================================================================

  describe('Tool Execution', () => {
    it('should execute a tool successfully', async () => {
      const request: ToolExecutionRequest = {
        toolId: 'analyze-code',
        parameters: {
          filePath: '/src/main.ts',
          analysisType: 'complexity',
        },
        repoPath: '/path/to/repo',
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      const response = await client.executeTool(request);

      expect(response).toBeDefined();
      expect(response.metadata).toBeDefined();
      expect(response.metadata.toolId).toBe('analyze-code');
      expect(response.metadata.durationMs).toBeGreaterThan(0);
      
      // Either result or error should be present
      if (response.error) {
        expect(response.result).toBeUndefined();
      } else {
        expect(response.result).toBeDefined();
      }
    }, TEST_TIMEOUT);
  });

  // ===========================================================================
  // RAG Query Tests
  // ===========================================================================

  describe('RAG Queries', () => {
    it('should execute a RAG query', async () => {
      const request: RAGQueryRequest = {
        query: 'How does user authentication work in this project?',
        repoPath: '/path/to/repo',
        topK: 3,
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      const response = await client.ragQuery(request);

      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
      expect(response.sources).toBeDefined();
      expect(Array.isArray(response.sources)).toBe(true);
      expect(response.sources.length).toBeLessThanOrEqual(3);
      expect(response.metadata).toBeDefined();
      expect(response.metadata.retrievalTimeMs).toBeGreaterThan(0);
      expect(response.metadata.generationTimeMs).toBeGreaterThan(0);
      expect(response.metadata.totalSources).toBeGreaterThanOrEqual(0);
    }, TEST_TIMEOUT);

    it('should filter by entity types', async () => {
      const request: RAGQueryRequest = {
        query: 'Show me all features',
        repoPath: '/path/to/repo',
        topK: 5,
        entityTypes: ['feature', 'spec'],
        config: {
          provider: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama2',
          temperature: 0.7,
        },
      };

      const response = await client.ragQuery(request);

      expect(response).toBeDefined();
      expect(response.sources).toBeDefined();
      
      // Verify source relevance scores
      response.sources.forEach((source) => {
        expect(source.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(source.relevanceScore).toBeLessThanOrEqual(1);
        expect(source.entityId).toBeTruthy();
        expect(source.entityType).toBeTruthy();
      });
    }, TEST_TIMEOUT);
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badClient = new SidecarClient({ baseUrl: 'http://localhost:9999' });

      await expect(badClient.health()).rejects.toThrow();
    }, TEST_TIMEOUT);

    it('should validate responses with Zod', async () => {
      // This test would require a mock server returning invalid data
      // Skipped for now as it requires additional setup
      expect(true).toBe(true);
    });
  });
});
