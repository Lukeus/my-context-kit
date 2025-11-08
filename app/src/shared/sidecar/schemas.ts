/**
 * Zod Schema Contracts for Python Sidecar AI Operations
 * 
 * These schemas define the type-safe contract between TypeScript (Electron)
 * and Python (FastAPI sidecar) for all AI operations.
 * 
 * Mirrors: context-kit-service/src/context_kit_service/models/ai_requests.py
 * 
 * @see docs/python-sidecar-migration-plan.md
 */

import { z } from 'zod';

// =============================================================================
// Provider Configuration
// =============================================================================

export const ProviderConfigSchema = z.object({
  provider: z.enum(['azure-openai', 'ollama']),
  endpoint: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  apiVersion: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// =============================================================================
// Entity Generation
// =============================================================================

export const EntityTypeSchema = z.enum([
  'feature',
  'userstory',
  'spec',
  'task',
  'governance',
]);

export type EntityType = z.infer<typeof EntityTypeSchema>;

export const GenerateEntityRequestSchema = z.object({
  entityType: EntityTypeSchema,
  userPrompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  linkedFeatureId: z.string().optional(),
  config: ProviderConfigSchema,
});

export type GenerateEntityRequest = z.infer<typeof GenerateEntityRequestSchema>;

export const GenerateEntityResponseSchema = z.object({
  entity: z.record(z.string(), z.unknown()), // Will be validated against entity-specific schema
  metadata: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
    model: z.string(),
    provider: z.string().optional(),
  }),
});

export type GenerateEntityResponse = z.infer<typeof GenerateEntityResponseSchema>;

// =============================================================================
// Streaming Assistance
// =============================================================================

export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const ConversationMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.string().optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const AssistStreamRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  conversationHistory: z.array(ConversationMessageSchema).default([]),
  contextSnapshot: z.record(z.string(), z.unknown()).optional(),
  config: ProviderConfigSchema,
});

export type AssistStreamRequest = z.infer<typeof AssistStreamRequestSchema>;

// Streaming response types (Server-Sent Events)

export const StreamTokenSchema = z.object({
  type: z.literal('token'),
  token: z.string(),
  metadata: z.object({
    tokenIndex: z.number().int().nonnegative(),
  }).optional(),
});

export type StreamToken = z.infer<typeof StreamTokenSchema>;

export const StreamCompleteSchema = z.object({
  type: z.literal('complete'),
  fullContent: z.string(),
  metadata: z.object({
    totalTokens: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
    model: z.string().optional(),
  }),
});

export type StreamComplete = z.infer<typeof StreamCompleteSchema>;

export const StreamErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  code: z.string().optional(),
});

export type StreamError = z.infer<typeof StreamErrorSchema>;

// Union type for all stream events
export const StreamEventSchema = z.discriminatedUnion('type', [
  StreamTokenSchema,
  StreamCompleteSchema,
  StreamErrorSchema,
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;

// =============================================================================
// Tool Execution
// =============================================================================

export const ToolExecutionRequestSchema = z.object({
  toolId: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
  repoPath: z.string(),
  config: ProviderConfigSchema,
});

export type ToolExecutionRequest = z.infer<typeof ToolExecutionRequestSchema>;

export const ToolExecutionResponseSchema = z.object({
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.object({
    durationMs: z.number().nonnegative(),
    toolId: z.string(),
  }),
});

export type ToolExecutionResponse = z.infer<typeof ToolExecutionResponseSchema>;

// =============================================================================
// RAG (Retrieval-Augmented Generation)
// =============================================================================

export const RAGQueryRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  repoPath: z.string(),
  topK: z.number().int().positive().default(5),
  entityTypes: z.array(z.string()).optional(),
  config: ProviderConfigSchema,
});

export type RAGQueryRequest = z.infer<typeof RAGQueryRequestSchema>;

export const RAGSourceSchema = z.object({
  entityId: z.string(),
  entityType: z.string(),
  relevanceScore: z.number().min(0).max(1),
  excerpt: z.string(),
  filePath: z.string().optional(),
});

export type RAGSource = z.infer<typeof RAGSourceSchema>;

export const RAGQueryResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(RAGSourceSchema),
  metadata: z.object({
    retrievalTimeMs: z.number().nonnegative(),
    generationTimeMs: z.number().nonnegative(),
    totalSources: z.number().int().nonnegative(),
    model: z.string().optional(),
  }),
});

export type RAGQueryResponse = z.infer<typeof RAGQueryResponseSchema>;

// =============================================================================
// Health & Status
// =============================================================================

export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  dependencies: z.record(z.string(), z.string()),
  timestamp: z.string().optional(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// =============================================================================
// Error Response
// =============================================================================

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  type: z.string().optional(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Safely parse and validate data with a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed data or throws ZodError
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Safely parse and validate data, returning null on error
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed data or null if validation fails
 */
export function safeValidateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Get validation error messages from ZodError
 * 
 * @param error - ZodError from failed validation
 * @returns Array of error messages
 */
export function getValidationErrors(error: z.ZodError<unknown>): string[] {
  return error.issues.map(
    (err) => `${err.path.join('.')}: ${err.message}`
  );
}
