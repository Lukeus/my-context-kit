/**
 * HTTP Client for Python Sidecar AI Operations
 * 
 * Provides type-safe communication with the Python FastAPI sidecar service.
 * All requests and responses are validated using Zod schemas.
 * 
 * @see schemas.ts for type definitions
 * @see docs/python-sidecar-migration-plan.md
 */

import { z } from 'zod';
import {
  AssistStreamRequest,
  AssistStreamRequestSchema,
  ErrorResponseSchema,
  GenerateEntityRequest,
  GenerateEntityRequestSchema,
  GenerateEntityResponse,
  GenerateEntityResponseSchema,
  HealthStatus,
  HealthStatusSchema,
  RAGQueryRequest,
  RAGQueryRequestSchema,
  RAGQueryResponse,
  RAGQueryResponseSchema,
  StreamEventSchema,
  ToolExecutionRequest,
  ToolExecutionRequestSchema,
  ToolExecutionResponse,
  ToolExecutionResponseSchema,
  validateSchema,
} from './schemas';

// =============================================================================
// Client Configuration
// =============================================================================

export interface SidecarClientConfig {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

const DEFAULT_CONFIG: Required<Omit<SidecarClientConfig, 'baseUrl'>> = {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

// =============================================================================
// Error Classes
// =============================================================================

export class SidecarError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SidecarError';
  }
}

export class SidecarValidationError extends SidecarError {
  constructor(message: string, public readonly validationErrors: z.ZodError) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'SidecarValidationError';
  }
}

export class SidecarConnectionError extends SidecarError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'SidecarConnectionError';
  }
}

export class SidecarTimeoutError extends SidecarError {
  constructor(message: string) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'SidecarTimeoutError';
  }
}

// =============================================================================
// Main Client
// =============================================================================

export class SidecarClient {
  private readonly config: Required<SidecarClientConfig>;

  constructor(config: SidecarClientConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  // ===========================================================================
  // Health Check
  // ===========================================================================

  /**
   * Check the health status of the sidecar service
   */
  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>(
      '/health',
      'GET',
      undefined,
      HealthStatusSchema
    );
  }

  // ===========================================================================
  // Entity Generation
  // ===========================================================================

  /**
   * Generate an entity (feature, spec, task, etc.) using AI
   */
  async generateEntity(
    request: GenerateEntityRequest
  ): Promise<GenerateEntityResponse> {
    // Validate request before sending
    validateSchema(GenerateEntityRequestSchema, request);

    return this.request<GenerateEntityResponse>(
      '/ai/generate-entity',
      'POST',
      request,
      GenerateEntityResponseSchema
    );
  }

  // ===========================================================================
  // Streaming Assistance
  // ===========================================================================

  /**
   * Stream AI assistance responses using Server-Sent Events
   * 
   * @param request - Assistance request with question and context
   * @param onToken - Callback for each token received
   * @param onComplete - Callback when streaming completes
   * @param onError - Callback for errors during streaming
   * @returns Cleanup function to close the stream
   */
  async streamAssist(
    request: AssistStreamRequest,
    onToken: (token: string, metadata?: { tokenIndex: number }) => void,
    onComplete: (fullContent: string, metadata: {
      totalTokens: number;
      durationMs: number;
      model?: string;
    }) => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    // Validate request before sending
    validateSchema(AssistStreamRequestSchema, request);

    const url = `${this.config.baseUrl}/ai/assist/stream`;
    
    // Use fetch with streaming response instead of EventSource for POST support
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        const error = validateSchema(ErrorResponseSchema, errorData);
        throw new SidecarError(
          error.message,
          error.code,
          response.status,
          error.details
        );
      }

      if (!response.body) {
        throw new SidecarError('No response body for streaming');
      }

      // Process SSE stream
      void this.processSSEStream(response.body, onToken, onComplete, onError);

      // Return cleanup function
      return () => {
        controller.abort();
      };
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          onError(new SidecarTimeoutError('Streaming request timed out'));
        } else {
          onError(err);
        }
      } else {
        onError(new SidecarError('Unknown streaming error'));
      }

      // Return no-op cleanup
      return () => {};
    }
  }

  /**
   * Process Server-Sent Events stream
   */
  private async processSSEStream(
    body: ReadableStream<Uint8Array>,
    onToken: (token: string, metadata?: { tokenIndex: number }) => void,
    onComplete: (fullContent: string, metadata: {
      totalTokens: number;
      durationMs: number;
      model?: string;
    }) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(data);
              const validatedEvent = validateSchema(StreamEventSchema, event);

              if (validatedEvent.type === 'token') {
                onToken(validatedEvent.token, validatedEvent.metadata);
              } else if (validatedEvent.type === 'complete') {
                onComplete(validatedEvent.fullContent, validatedEvent.metadata);
              } else if (validatedEvent.type === 'error') {
                onError(new SidecarError(
                  validatedEvent.message,
                  validatedEvent.code
                ));
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        onError(err);
      } else {
        onError(new SidecarError('Stream processing error'));
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ===========================================================================
  // Tool Execution
  // ===========================================================================

  /**
   * Execute an AI tool with given parameters
   */
  async executeTool(
    request: ToolExecutionRequest
  ): Promise<ToolExecutionResponse> {
    // Validate request before sending
    validateSchema(ToolExecutionRequestSchema, request);

    return this.request<ToolExecutionResponse>(
      '/ai/tools/execute',
      'POST',
      request,
      ToolExecutionResponseSchema
    );
  }

  // ===========================================================================
  // RAG Queries
  // ===========================================================================

  /**
   * Query the repository using Retrieval-Augmented Generation
   */
  async ragQuery(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    // Validate request before sending
    validateSchema(RAGQueryRequestSchema, request);

    return this.request<RAGQueryResponse>(
      '/ai/rag/query',
      'POST',
      request,
      RAGQueryResponseSchema
    );
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Make an HTTP request with validation and error handling
   */
  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body: unknown | undefined,
    responseSchema: z.ZodType<T>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Try to parse as error response
        try {
          const errorResponse = validateSchema(ErrorResponseSchema, data);
          throw new SidecarError(
            errorResponse.message,
            errorResponse.code,
            response.status,
            errorResponse.details
          );
        } catch {
          // Fallback error
          throw new SidecarError(
            `HTTP ${response.status}: ${response.statusText}`,
            undefined,
            response.status
          );
        }
      }

      // Validate response against schema
      try {
        return validateSchema(responseSchema, data);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          throw new SidecarValidationError(
            'Response validation failed',
            validationError
          );
        }
        throw validationError;
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof SidecarError) {
        throw err;
      }

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new SidecarTimeoutError('Request timed out');
        }

        // Network or connection errors
        throw new SidecarConnectionError(
          `Failed to connect to sidecar: ${err.message}`
        );
      }

      throw new SidecarError('Unknown request error');
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let clientInstance: SidecarClient | null = null;

/**
 * Get or create the singleton SidecarClient instance
 */
export function getSidecarClient(config?: SidecarClientConfig): SidecarClient {
  if (!clientInstance) {
    if (!config) {
      throw new Error(
        'SidecarClient must be initialized with config on first call'
      );
    }
    clientInstance = new SidecarClient(config);
  }
  return clientInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetSidecarClient(): void {
  clientInstance = null;
}
