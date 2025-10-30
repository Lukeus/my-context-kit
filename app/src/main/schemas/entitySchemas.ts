import { z } from 'zod';

/**
 * Zod schemas for context repository entities.
 * 
 * These schemas are used with LangChain's StructuredOutputParser to guarantee
 * valid entity generation. The AI is instructed to match these schemas exactly,
 * with automatic retries if output doesn't conform.
 * 
 * @module entitySchemas
 */

/**
 * Feature entity schema (FEAT-###)
 * 
 * Represents a high-level capability or functionality.
 */
export const featureSchema = z.object({
  id: z.string()
    .regex(/^FEAT-\d{3}$/, 'Feature ID must be in format FEAT-001')
    .describe('Unique feature identifier (e.g., FEAT-001)'),
  
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must not exceed 100 characters')
    .describe('Concise feature title'),
  
  status: z.enum(['draft', 'in-progress', 'done', 'blocked', 'archived'])
    .describe('Current feature status'),
  
  domain: z.string()
    .min(1, 'Domain is required')
    .describe('Domain or area this feature belongs to (e.g., authentication, payments)'),
  
  objective: z.string()
    .min(10, 'Objective must be at least 10 characters')
    .describe('Clear statement of what this feature aims to achieve'),
  
  userStories: z.array(z.string())
    .default([])
    .describe('Related user story IDs (e.g., ["US-001", "US-002"])'),
  
  specs: z.array(z.string())
    .default([])
    .describe('Related specification IDs (e.g., ["SPEC-001"])'),
  
  tasks: z.array(z.string())
    .default([])
    .describe('Related task IDs (e.g., ["T-001", "T-002"])'),
  
  requires: z.array(z.string())
    .default([])
    .describe('Feature dependencies - other feature IDs required before this one'),
  
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional()
    .describe('Feature priority level'),
  
  tags: z.array(z.string())
    .default([])
    .describe('Tags for categorization'),
});

/**
 * User Story entity schema (US-###)
 * 
 * Represents a user-centric functionality requirement.
 */
export const userStorySchema = z.object({
  id: z.string()
    .regex(/^US-\d{3}$/, 'User story ID must be in format US-001')
    .describe('Unique user story identifier (e.g., US-001)'),
  
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must not exceed 100 characters')
    .describe('Concise user story title'),
  
  status: z.enum(['draft', 'in-progress', 'done', 'blocked', 'archived'])
    .describe('Current user story status'),
  
  asA: z.string()
    .min(3, 'User role must be specified')
    .describe('User role or persona (e.g., "registered user", "administrator")'),
  
  iWant: z.string()
    .min(5, 'Desired functionality must be specified')
    .describe('What the user wants to do'),
  
  soThat: z.string()
    .min(5, 'Benefit must be specified')
    .describe('Why the user wants this - the value or benefit'),
  
  acceptanceCriteria: z.array(z.string())
    .min(1, 'At least one acceptance criterion is required')
    .describe('List of criteria that must be met for story completion'),
  
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional()
    .describe('User story priority level'),
  
  estimatedEffort: z.enum(['xs', 's', 'm', 'l', 'xl']).optional()
    .describe('Story point or effort estimate'),
  
  tags: z.array(z.string())
    .default([])
    .describe('Tags for categorization'),
});

/**
 * Specification entity schema (SPEC-###)
 * 
 * Represents a technical specification or design document.
 */
export const specSchema = z.object({
  id: z.string()
    .regex(/^SPEC-\d{3}$/, 'Spec ID must be in format SPEC-001')
    .describe('Unique specification identifier (e.g., SPEC-001)'),
  
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must not exceed 100 characters')
    .describe('Concise specification title'),
  
  status: z.enum(['draft', 'review', 'approved', 'implemented', 'archived'])
    .describe('Current specification status'),
  
  type: z.enum(['api', 'ui', 'database', 'integration', 'architecture', 'security', 'other'])
    .describe('Type of specification'),
  
  summary: z.string()
    .min(20, 'Summary must be at least 20 characters')
    .describe('Brief overview of what this specification covers'),
  
  related: z.object({
    features: z.array(z.string()).default([]),
    userStories: z.array(z.string()).default([]),
    tasks: z.array(z.string()).default([]),
  })
    .default({ features: [], userStories: [], tasks: [] })
    .describe('Related entity IDs grouped by type'),
  
  owner: z.string().optional()
    .describe('Person or team responsible for this specification'),
  
  tags: z.array(z.string())
    .default([])
    .describe('Tags for categorization'),
});

/**
 * Task entity schema (T-###)
 * 
 * Represents an actionable work item.
 */
export const taskSchema = z.object({
  id: z.string()
    .regex(/^T-\d{3}$/, 'Task ID must be in format T-001')
    .describe('Unique task identifier (e.g., T-001)'),
  
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must not exceed 100 characters')
    .describe('Concise task title or description'),
  
  status: z.enum(['todo', 'in-progress', 'review', 'done', 'blocked', 'cancelled'])
    .describe('Current task status'),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .describe('Detailed description of what needs to be done'),
  
  owner: z.string().optional()
    .describe('Person or team assigned to this task'),
  
  doneCriteria: z.array(z.string())
    .min(1, 'At least one completion criterion is required')
    .describe('Criteria that must be met for task to be considered done'),
  
  acceptanceCriteria: z.array(z.string())
    .default([])
    .describe('Additional acceptance criteria for task completion'),
  
  relatedTo: z.object({
    features: z.array(z.string()).default([]),
    userStories: z.array(z.string()).default([]),
    specs: z.array(z.string()).default([]),
  })
    .default({ features: [], userStories: [], specs: [] })
    .describe('Related entity IDs this task contributes to'),
  
  estimatedHours: z.number().positive().optional()
    .describe('Estimated hours to complete'),
  
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional()
    .describe('Task priority level'),
  
  tags: z.array(z.string())
    .default([])
    .describe('Tags for categorization'),
});

/**
 * Service entity schema
 * 
 * Represents a backend service or microservice.
 */
export const serviceSchema = z.object({
  id: z.string()
    .min(2, 'Service ID must be at least 2 characters')
    .describe('Unique service identifier (e.g., auth-service, payment-api)'),
  
  name: z.string()
    .min(3, 'Service name is required')
    .describe('Human-readable service name'),
  
  status: z.enum(['planned', 'development', 'staging', 'production', 'deprecated'])
    .describe('Current service lifecycle status'),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .describe('What this service does and its responsibilities'),
  
  type: z.enum(['api', 'worker', 'scheduler', 'gateway', 'database', 'cache', 'other'])
    .describe('Type of service'),
  
  dependencies: z.array(z.string())
    .default([])
    .describe('Other service IDs this service depends on'),
  
  consumers: z.array(z.string())
    .default([])
    .describe('Service IDs that consume this service'),
  
  owner: z.string().optional()
    .describe('Team or person responsible for this service'),
  
  repository: z.string().optional()
    .describe('Git repository URL'),
  
  tags: z.array(z.string())
    .default([])
    .describe('Tags for categorization'),
});

/**
 * Package entity schema
 * 
 * Represents a software package or library.
 */
export const packageSchema = z.object({
  id: z.string()
    .min(2, 'Package ID must be at least 2 characters')
    .describe('Unique package identifier (e.g., common-utils, api-client)'),
  
  name: z.string()
    .min(2, 'Package name is required')
    .describe('Package name as it appears in package manager'),
  
  status: z.enum(['planned', 'development', 'published', 'deprecated'])
    .describe('Current package lifecycle status'),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .describe('What this package provides'),
  
  version: z.string().optional()
    .describe('Current version (semver format)'),
  
  uses: z.object({
    language: z.string().optional(),
    framework: z.string().optional(),
    dependencies: z.array(z.string()).default([]),
  })
    .default({ dependencies: [] })
    .describe('Technology and dependency information'),
  
  owner: z.string().optional()
    .describe('Team or person responsible for this package'),
  
  repository: z.string().optional()
    .describe('Git repository URL'),
  
  tags: z.array(z.string())
    .default([])
    .describe('Tags for categorization'),
});

/**
 * Get schema by entity type name.
 * 
 * @param entityType - Entity type (feature, userstory, spec, task, service, package)
 * @returns Corresponding Zod schema
 * @throws {Error} If entity type is unknown
 * 
 * @example
 * ```typescript
 * const schema = getSchemaForEntityType('feature');
 * const entity = await generateEntity({ schema, ... });
 * ```
 */
export function getSchemaForEntityType(entityType: string): z.ZodSchema {
  const normalizedType = entityType.toLowerCase();
  
  switch (normalizedType) {
    case 'feature':
      return featureSchema;
    case 'userstory':
    case 'user-story':
    case 'user_story':
      return userStorySchema;
    case 'spec':
    case 'specification':
      return specSchema;
    case 'task':
      return taskSchema;
    case 'service':
      return serviceSchema;
    case 'package':
      return packageSchema;
    default:
      throw new Error(`Unknown entity type: ${entityType}. Supported: feature, userstory, spec, task, service, package`);
  }
}

/**
 * TypeScript types inferred from schemas
 */
export type Feature = z.infer<typeof featureSchema>;
export type UserStory = z.infer<typeof userStorySchema>;
export type Spec = z.infer<typeof specSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Package = z.infer<typeof packageSchema>;
