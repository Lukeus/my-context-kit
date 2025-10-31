import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import { parse as parseYAML } from 'yaml';
import { logger } from '../utils/logger';
import { AICredentialResolver } from './AICredentialResolver';
import { ContextService, type GraphResult } from './ContextService';
import type { AIConfig } from './LangChainAIService';

/**
 * Enhanced options for context-aware entity generation
 */
export interface ContextAwareEntityOptions {
  config: AIConfig;
  entityType: 'feature' | 'userstory' | 'spec' | 'task';
  userPrompt: string;
  linkedFeatureId?: string;
  repoPath: string;
}

/**
 * Impact analysis options
 */
export interface ImpactAnalysisOptions {
  config: AIConfig;
  entityId: string;
  proposedChange: string;
  repoPath: string;
}

/**
 * Impact analysis result with AI explanation
 */
export interface ImpactAnalysisResult {
  affectedEntities: Array<{
    id: string;
    type: string;
    relationship: string;
    suggestedAction: string;
  }>;
  explanation: string;
  estimatedEffort: string;
  risks: string[];
  recommendations: string[];
}

/**
 * Conversational validation options
 */
export interface ConversationalValidationOptions {
  config: AIConfig;
  yamlContent: string;
  entityType: string;
  schemaErrors: Array<{
    path: string;
    message: string;
  }>;
  conversationHistory: Array<{ role: string; content: string }>;
  repoPath: string;
}

/**
 * Validation refinement result
 */
export interface ValidationRefinementResult {
  fixedYaml: string;
  explanation: string;
  changesApplied: string[];
  isValid: boolean;
}

/**
 * Semantic search options
 */
export interface SemanticSearchOptions {
  config: AIConfig;
  query: string;
  entityTypes?: string[];
  limit?: number;
  repoPath: string;
}

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
  results: Array<{
    entityId: string;
    entityType: string;
    title: string;
    relevanceScore: number;
    explanation: string;
    content: any;
  }>;
}

/**
 * Multi-agent orchestration options
 */
export interface MultiAgentWorkflowOptions {
  config: AIConfig;
  instruction: string;
  repoPath: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

/**
 * Multi-agent workflow result
 */
export interface MultiAgentWorkflowResult {
  steps: Array<{
    tool: string;
    input: any;
    output: any;
    reasoning: string;
  }>;
  finalResult: string;
  entitiesCreated: string[];
  entitiesModified: string[];
}

/**
 * Enhanced LangChain AI Service with advanced features:
 * 1. Context-aware entity generation
 * 2. Intelligent impact analysis
 * 3. Conversational validation
 * 4. Semantic search across entities
 * 5. Multi-agent orchestration
 */
export class EnhancedLangChainService {
  private credentialResolver = new AICredentialResolver();
  private vectorStoreCache = new Map<string, FaissStore>();
  private modelCache = new Map<string, BaseChatModel>();

  // ============================================================================
  // 1. Context-Aware Entity Generation
  // ============================================================================

  /**
   * Generate an entity with full awareness of the context repository structure.
   * Validates IDs, suggests relationships, and auto-links to existing entities.
   */
  async generateContextAwareEntity(options: ContextAwareEntityOptions): Promise<any> {
    return logger.logServiceCall(
      { service: 'EnhancedLangChainService', method: 'generateContextAwareEntity', entityType: options.entityType },
      async () => {
        const model = await this.getModel(options.config);

        // Gather context: existing entities, schema, graph
        const context = await this.gatherEntityContext(options.repoPath, options.entityType, options.linkedFeatureId);

        // Build context-aware prompt
        const systemPrompt = this.buildContextAwareSystemPrompt(options.entityType, context);

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', systemPrompt],
          ['human', 'User request: {userPrompt}\n\nGenerate a valid YAML entity following the schema and context provided.']
        ]);

        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        const yamlContent = await chain.invoke({
          userPrompt: options.userPrompt
        });

        // Parse and validate
        const entity = parseYAML(yamlContent);

        // Enhance with context-aware suggestions
        const enhanced = await this.enhanceEntityWithContext(entity, context, options.entityType);

        logger.info(
          { service: 'EnhancedLangChainService', method: 'generateContextAwareEntity' },
          `Generated context-aware ${options.entityType} entity: ${enhanced.id}`
        );

        return enhanced;
      }
    );
  }

  /**
   * Gather relevant context for entity generation
   */
  private async gatherEntityContext(
    repoPath: string,
    entityType: string,
    linkedFeatureId?: string
  ): Promise<any> {
    const context: any = {
      existingIds: [],
      relatedEntities: [],
      schema: {},
      suggestions: {}
    };

    try {
      // Read schema
      const schemaPath = path.join(repoPath, '.context', 'schemas', `${entityType}.schema.json`);
      if (existsSync(schemaPath)) {
        const schemaContent = await readFile(schemaPath, 'utf-8');
        context.schema = JSON.parse(schemaContent);
      }

      // Get existing entity IDs for validation
      const contextsPath = path.join(repoPath, 'contexts');
      const entityDirs = await readdir(contextsPath, { withFileTypes: true });

      for (const dir of entityDirs) {
        if (dir.isDirectory()) {
          const dirPath = path.join(contextsPath, dir.name);
          const files = await readdir(dirPath);

          for (const file of files) {
            if (file.endsWith('.yaml') || file.endsWith('.yml')) {
              const filePath = path.join(dirPath, file);
              const content = await readFile(filePath, 'utf-8');
              const entity = parseYAML(content);

              if (entity.id) {
                context.existingIds.push(entity.id);

                // If linked to a feature, load related entities
                if (linkedFeatureId && entity.id === linkedFeatureId) {
                  context.relatedEntities.push(entity);
                }
              }
            }
          }
        }
      }

      // Generate next ID suggestion
      context.suggestions.nextId = this.generateNextId(context.existingIds, entityType);

    } catch (error) {
      logger.warn(
        { service: 'EnhancedLangChainService', method: 'gatherEntityContext' },
        `Failed to gather context: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return context;
  }

  /**
   * Build context-aware system prompt with schema and existing entities
   */
  private buildContextAwareSystemPrompt(entityType: string, context: any): string {
    const entityPrefixes = {
      feature: 'FEAT',
      userstory: 'US',
      spec: 'SPEC',
      task: 'T'
    };

    const prefix = entityPrefixes[entityType as keyof typeof entityPrefixes] || 'ENT';

    return `You are an expert at generating context repository entities that follow strict JSON schemas.

**Entity Type**: ${entityType}
**ID Pattern**: ${prefix}-XXX (where XXX is a 3+ digit number)
**Suggested Next ID**: ${context.suggestions.nextId}

**Schema Requirements**:
${JSON.stringify(context.schema, null, 2)}

**Existing Entity IDs** (avoid duplicates):
${context.existingIds.slice(-10).join(', ')}

**Related Context**:
${context.relatedEntities.length > 0 ? JSON.stringify(context.relatedEntities, null, 2) : 'None'}

**Instructions**:
1. Generate a valid YAML entity that matches the schema EXACTLY
2. Use the suggested next ID unless user specifies one
3. Link to related entities using their IDs (feature, specs, tasks, etc.)
4. Include realistic and detailed content based on user request
5. Follow YAML syntax strictly (proper indentation, no tabs, valid strings)
6. For arrays, use the "- " prefix for each item
7. Ensure all required fields are present

**Output only valid YAML, nothing else.**`;
  }

  /**
   * Enhance entity with context-aware suggestions
   */
  private async enhanceEntityWithContext(entity: any, context: any, entityType: string): Promise<any> {
    // Auto-link to related entities if not specified
    if (entityType === 'userstory' && !entity.feature && context.relatedEntities.length > 0) {
      entity.feature = context.relatedEntities[0].id;
    }

    // Ensure ID follows pattern
    if (!entity.id && context.suggestions.nextId) {
      entity.id = context.suggestions.nextId;
    }

    return entity;
  }

  /**
   * Generate next available ID for entity type
   */
  private generateNextId(existingIds: string[], entityType: string): string {
    const prefixes = {
      feature: 'FEAT',
      userstory: 'US',
      spec: 'SPEC',
      task: 'T'
    };

    const prefix = prefixes[entityType as keyof typeof prefixes] || 'ENT';
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);

    const numbers = existingIds
      .filter(id => pattern.test(id))
      .map(id => parseInt(id.match(pattern)![1], 10));

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = maxNum + 1;

    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  }

  // ============================================================================
  // 2. Intelligent Impact Analysis
  // ============================================================================

  /**
   * Analyze impact of proposed changes with AI-powered explanation
   */
  async analyzeImpact(options: ImpactAnalysisOptions): Promise<ImpactAnalysisResult> {
    return logger.logServiceCall(
      { service: 'EnhancedLangChainService', method: 'analyzeImpact', entityId: options.entityId },
      async () => {
        const model = await this.getModel(options.config);
        const contextService = new ContextService(options.repoPath);

        // Build dependency graph
        const graph = await contextService.buildGraph();

        // Find affected entities
        const affected = this.findAffectedEntities(options.entityId, graph);

        // Load entity content for context
        const entityContent = await this.loadEntityContent(options.repoPath, options.entityId);

        // Generate AI explanation
        const prompt = ChatPromptTemplate.fromMessages([
          ['system', this.buildImpactAnalysisSystemPrompt()],
          ['human', `Entity ID: {entityId}
Entity Content:
{entityContent}

Proposed Change:
{proposedChange}

Affected Entities:
{affectedEntities}

Provide a detailed impact analysis with explanations, effort estimate, risks, and recommendations.`]
        ]);

        const parser = StructuredOutputParser.fromZodSchema(
          z.object({
            explanation: z.string().describe('Detailed explanation of the impact'),
            estimatedEffort: z.string().describe('Estimated effort (e.g., "2-4 hours", "1-2 days")'),
            risks: z.array(z.string()).describe('Potential risks and concerns'),
            recommendations: z.array(z.string()).describe('Recommended actions to take')
          })
        );

        const chain = prompt.pipe(model).pipe(parser);

        const analysis = await chain.invoke({
          entityId: options.entityId,
          entityContent: JSON.stringify(entityContent, null, 2),
          proposedChange: options.proposedChange,
          affectedEntities: JSON.stringify(affected, null, 2)
        });

        return {
          affectedEntities: affected,
          ...analysis
        };
      }
    );
  }

  /**
   * Find entities affected by changes to a specific entity
   */
  private findAffectedEntities(entityId: string, graph: GraphResult): Array<{
    id: string;
    type: string;
    relationship: string;
    suggestedAction: string;
  }> {
    const affected: Array<{
      id: string;
      type: string;
      relationship: string;
      suggestedAction: string;
    }> = [];

    // Find all edges where this entity is involved
    for (const edge of graph.edges) {
      if (edge.from === entityId) {
        const targetNode = graph.nodes.find(n => n.id === edge.to);
        if (targetNode) {
          affected.push({
            id: targetNode.id,
            type: targetNode.kind,
            relationship: edge.rel,
            suggestedAction: this.suggestActionForRelationship(edge.rel, targetNode.kind)
          });
        }
      }
      if (edge.to === entityId) {
        const sourceNode = graph.nodes.find(n => n.id === edge.from);
        if (sourceNode) {
          affected.push({
            id: sourceNode.id,
            type: sourceNode.kind,
            relationship: `inverse_${edge.rel}`,
            suggestedAction: this.suggestActionForRelationship(`inverse_${edge.rel}`, sourceNode.kind)
          });
        }
      }
    }

    return affected;
  }

  /**
   * Suggest action based on relationship type
   */
  private suggestActionForRelationship(relationship: string, _entityType: string): string {
    const actionMap: Record<string, string> = {
      'has_userstory': 'Review and update acceptance criteria',
      'has_spec': 'Mark as needs-review',
      'has_task': 'Verify task is still valid and update status',
      'requires': 'Check for breaking changes',
      'produces': 'Update dependent packages',
      'inverse_feature': 'Update parent feature status'
    };

    return actionMap[relationship] || 'Review for potential impact';
  }

  /**
   * Build impact analysis system prompt
   */
  private buildImpactAnalysisSystemPrompt(): string {
    return `You are an expert at analyzing the impact of changes in software development context repositories.

Your goal is to explain in clear, actionable terms:
1. What downstream entities will be affected by the proposed change
2. How significant the impact is (minor tweak vs. major rework)
3. What risks exist (breaking changes, inconsistencies, etc.)
4. What actions should be taken (status changes, reviews, etc.)

Be specific, practical, and developer-friendly. Provide realistic effort estimates.

Output your analysis in the requested structured format.`;
  }

  /**
   * Load entity content from file
   */
  private async loadEntityContent(repoPath: string, entityId: string): Promise<any> {
    try {
      const contextsPath = path.join(repoPath, 'contexts');
      const dirs = await readdir(contextsPath, { withFileTypes: true });

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const files = await readdir(path.join(contextsPath, dir.name));

          for (const file of files) {
            if (file.endsWith('.yaml') || file.endsWith('.yml')) {
              const filePath = path.join(contextsPath, dir.name, file);
              const content = await readFile(filePath, 'utf-8');
              const entity = parseYAML(content);

              if (entity.id === entityId) {
                return entity;
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn(
        { service: 'EnhancedLangChainService', method: 'loadEntityContent' },
        `Failed to load entity ${entityId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return null;
  }

  // ============================================================================
  // 3. Conversational Validation
  // ============================================================================

  /**
   * Refine invalid YAML through conversational iteration
   */
  async refineEntityConversationally(options: ConversationalValidationOptions): Promise<ValidationRefinementResult> {
    return logger.logServiceCall(
      { service: 'EnhancedLangChainService', method: 'refineEntityConversationally' },
      async () => {
        const model = await this.getModel(options.config);

        // Build conversation history
        const messages = options.conversationHistory.map(msg => {
          if (msg.role === 'user') return new HumanMessage(msg.content);
          if (msg.role === 'assistant') return new AIMessage(msg.content);
          return new SystemMessage(msg.content);
        });

        // Add system prompt and current refinement request
        const systemPrompt = this.buildValidationRefinementSystemPrompt(options.entityType);

        const refinementRequest = `The following YAML has validation errors:

\`\`\`yaml
${options.yamlContent}
\`\`\`

**Validation Errors**:
${options.schemaErrors.map((err, i) => `${i + 1}. Path: ${err.path} - ${err.message}`).join('\n')}

Please:
1. Explain what's wrong in simple terms
2. Fix the YAML to make it valid
3. List the changes you applied

Output your response in this exact JSON format:
{
  "explanation": "What was wrong and why",
  "fixedYaml": "The corrected YAML content",
  "changesApplied": ["Change 1", "Change 2"]
}`;

        const allMessages = [
          new SystemMessage(systemPrompt),
          ...messages,
          new HumanMessage(refinementRequest)
        ];

        const response = await model.invoke(allMessages);
        const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

        // Parse response (extract JSON from markdown if needed)
        const jsonMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/\{[\s\S]+\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

        const parsed = JSON.parse(jsonStr);

        // Validate the fixed YAML
        let isValid = false;
        try {
          const entity = parseYAML(parsed.fixedYaml);
          // Basic validation - could integrate with schema validation here
          isValid = !!entity && typeof entity === 'object';
        } catch {
          isValid = false;
        }

        return {
          fixedYaml: parsed.fixedYaml,
          explanation: parsed.explanation,
          changesApplied: parsed.changesApplied || [],
          isValid
        };
      }
    );
  }

  /**
   * Build validation refinement system prompt
   */
  private buildValidationRefinementSystemPrompt(entityType: string): string {
    return `You are an expert at debugging and fixing YAML validation errors for ${entityType} entities.

Your role is to:
1. Understand JSON Schema validation errors in the context of YAML structure
2. Explain errors in clear, non-technical language
3. Fix the YAML while preserving the user's intent
4. Ensure proper YAML syntax (indentation, strings, arrays)

Common issues:
- Missing required fields
- Invalid enum values (use only allowed values from schema)
- Incorrect ID patterns (must match regex)
- Malformed arrays (use "- " prefix for items)
- Invalid nesting or indentation

Be helpful, educational, and precise. Always output valid YAML.`;
  }

  // ============================================================================
  // 4. Semantic Search
  // ============================================================================

  /**
   * Perform semantic search across context repository entities
   */
  async semanticSearch(options: SemanticSearchOptions): Promise<SemanticSearchResult> {
    return logger.logServiceCall(
      { service: 'EnhancedLangChainService', method: 'semanticSearch', query: options.query },
      async () => {
        // Get or build vector store
        const vectorStore = await this.getOrBuildVectorStore(options.repoPath, options.config);

        // Perform similarity search
        const limit = options.limit || 5;
        const results = await vectorStore.similaritySearchWithScore(options.query, limit);

        const model = await this.getModel(options.config);

        // Generate explanations for each result
        const enrichedResults = await Promise.all(
          results.map(async ([doc, score]: [Document, number]) => {
            const explanation = await this.generateSearchExplanation(
              model,
              options.query,
              doc.pageContent,
              doc.metadata
            );

            return {
              entityId: doc.metadata.id as string,
              entityType: doc.metadata.type as string,
              title: (doc.metadata.title as string) || 'Untitled',
              relevanceScore: score,
              explanation,
              content: doc.metadata.content
            };
          })
        );

        return { results: enrichedResults };
      }
    );
  }

  /**
   * Get or build vector store for repository
   */
  private async getOrBuildVectorStore(repoPath: string, config: AIConfig): Promise<FaissStore> {
    const cacheKey = repoPath;

    if (this.vectorStoreCache.has(cacheKey)) {
      return this.vectorStoreCache.get(cacheKey)!;
    }

    // Build embeddings
    const apiKey = await this.credentialResolver.resolveApiKey({
      provider: config.provider,
      explicitKey: config.apiKey as string | undefined,
      useStoredCredentials: true,
      useEnvironmentVars: true
    });

    if (!apiKey) {
      throw new Error('API key required for semantic search with Azure OpenAI');
    }

    const embeddingDeployment = config.embeddingModel?.trim();
    if (!embeddingDeployment) {
      throw new Error('Embedding model deployment is not configured. Set "embeddingModel" in ai-config.json.');
    }

    const embeddingApiVersion = (config.embeddingApiVersion && config.embeddingApiVersion.trim()) || this.resolveAzureApiVersion(config);

    const embeddings = new OpenAIEmbeddings({
      apiKey,
      configuration: {
        baseURL: `${config.endpoint.replace(/\/$/, '')}/openai/deployments/${embeddingDeployment}`,
        defaultHeaders: {
          'api-key': apiKey
        },
        defaultQuery: {
          'api-version': embeddingApiVersion
        }
      }
    });

    // Load all entities
    const documents = await this.loadAllEntitiesAsDocuments(repoPath);

    // Create Faiss vector store (enterprise-grade, production-ready)
    const vectorStore = await FaissStore.fromDocuments(documents, embeddings);

    this.vectorStoreCache.set(cacheKey, vectorStore);

    logger.info(
      { service: 'EnhancedLangChainService', method: 'getOrBuildVectorStore' },
      `Built Faiss vector store with ${documents.length} documents`
    );

    return vectorStore;
  }

  /**
   * Load all entities as LangChain documents
   */
  private async loadAllEntitiesAsDocuments(repoPath: string): Promise<Document[]> {
    const documents: Document[] = [];
    const contextsPath = path.join(repoPath, 'contexts');

    try {
      const dirs = await readdir(contextsPath, { withFileTypes: true });

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const dirPath = path.join(contextsPath, dir.name);
          const files = await readdir(dirPath);

          for (const file of files) {
            if (file.endsWith('.yaml') || file.endsWith('.yml')) {
              const filePath = path.join(dirPath, file);
              const content = await readFile(filePath, 'utf-8');
              const entity = parseYAML(content);

              if (entity.id) {
                // Create searchable text from entity
                const searchText = this.createSearchableText(entity);

                documents.push(
                  new Document({
                    pageContent: searchText,
                    metadata: {
                      id: entity.id,
                      type: dir.name,
                      title: entity.title || entity.id,
                      content: entity,
                      filePath
                    }
                  })
                );
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error(
        { service: 'EnhancedLangChainService', method: 'loadAllEntitiesAsDocuments' },
        error instanceof Error ? error : new Error(String(error))
      );
    }

    return documents;
  }

  /**
   * Create searchable text from entity
   */
  private createSearchableText(entity: any): string {
    const parts: string[] = [];

    if (entity.id) parts.push(`ID: ${entity.id}`);
    if (entity.title) parts.push(`Title: ${entity.title}`);
    if (entity.objective) parts.push(`Objective: ${entity.objective}`);
    if (entity.asA) parts.push(`As a: ${entity.asA}`);
    if (entity.iWant) parts.push(`I want: ${entity.iWant}`);
    if (entity.soThat) parts.push(`So that: ${entity.soThat}`);
    if (entity.acceptanceCriteria) parts.push(`Acceptance: ${entity.acceptanceCriteria.join(', ')}`);
    if (entity.steps) parts.push(`Steps: ${entity.steps.join(', ')}`);

    return parts.join('\n');
  }

  /**
   * Generate explanation for search result
   */
  private async generateSearchExplanation(
    model: BaseChatModel,
    query: string,
    content: string,
    metadata: any
  ): Promise<string> {
    const prompt = `Query: "${query}"

Entity: ${metadata.id} - ${metadata.title}
Content: ${content.substring(0, 300)}

Explain in one sentence why this entity is relevant to the query.`;

    const response = await model.invoke([new HumanMessage(prompt)]);
    return typeof response.content === 'string' ? response.content : '';
  }

  /**
   * Resolve the Azure OpenAI API version using config fallback logic.
   */
  private resolveAzureApiVersion(config: AIConfig): string {
    const explicit = typeof config.apiVersion === 'string' ? config.apiVersion.trim() : '';
    if (explicit) {
      return explicit;
    }

    const envVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();
    if (envVersion) {
      return envVersion;
    }

    return '2024-12-01-preview';
  }

  /**
   * Extract Azure instance name from endpoint
   */
  private extractAzureInstance(endpoint: string): string {
    const match = endpoint.match(/https?:\/\/([^.]+)\.openai\.azure\.com/);
    return match ? match[1] : 'default';
  }

  // ============================================================================
  // 5. Multi-Agent Orchestration (Simplified)
  // ============================================================================

  /**
   * Execute complex workflows using multi-agent orchestration
   * This is a simplified version - full ReAct agent would require more tooling
   */
  async executeMultiAgentWorkflow(options: MultiAgentWorkflowOptions): Promise<MultiAgentWorkflowResult> {
    return logger.logServiceCall(
      { service: 'EnhancedLangChainService', method: 'executeMultiAgentWorkflow' },
      async () => {
        const model = await this.getModel(options.config);

        // Build orchestration prompt
        const systemPrompt = `You are an orchestration agent that breaks down complex tasks into steps.

Available tools:
1. createEntity - Generate a new context entity (feature, userstory, spec, task)
2. validateSchema - Validate YAML against schema
3. buildGraph - Build dependency graph
4. analyzeImpact - Analyze impact of changes

Given a user instruction, decide which tools to use in sequence and provide the plan.

Output your response as JSON:
{
  "plan": [
    {
      "tool": "createEntity",
      "input": { "entityType": "feature", "prompt": "..." },
      "reasoning": "Why this step is needed"
    }
  ],
  "summary": "Overall approach"
}`;

        const prompt = ChatPromptTemplate.fromMessages([
          ['system', systemPrompt],
          ['human', 'User instruction: {instruction}\n\nCreate an execution plan.']
        ]);

        const response = await prompt.pipe(model).pipe(new StringOutputParser()).invoke({
          instruction: options.instruction
        });

        // Parse plan (extract JSON)
        const jsonMatch = response.match(/```json\n([\s\S]+?)\n```/) || response.match(/\{[\s\S]+\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
        const plan = JSON.parse(jsonStr);

        // For MVP, return the plan without execution
        // Full implementation would execute each tool
        return {
          steps: plan.plan || [],
          finalResult: plan.summary || 'Plan created',
          entitiesCreated: [],
          entitiesModified: []
        };
      }
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get or create cached chat model
   */
  private async getModel(config: AIConfig): Promise<BaseChatModel> {
    const key = `${config.provider}:${config.endpoint}:${config.model}`;

    if (this.modelCache.has(key)) {
      return this.modelCache.get(key)!;
    }

    if (config.provider !== 'azure-openai') {
      throw new Error('Enhanced features currently only support Azure OpenAI');
    }

    const apiKey = await this.credentialResolver.resolveApiKey({
      provider: config.provider,
      explicitKey: config.apiKey as string | undefined,
      useStoredCredentials: true,
      useEnvironmentVars: true
    });

    if (!apiKey) {
      throw new Error('No API key found for Azure OpenAI');
    }

    const model = new ChatOpenAI({
      apiKey,
      configuration: {
        baseURL: `${config.endpoint}/openai/deployments/${config.model}`,
        defaultQuery: { 'api-version': '2024-12-01-preview' },
        defaultHeaders: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        }
      },
      modelName: config.model,
      temperature: 1,
      maxTokens: 4000,
      timeout: 60000,
      maxRetries: 2
    });

    this.modelCache.set(key, model);
    return model;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.modelCache.clear();
    this.vectorStoreCache.clear();
    logger.info({ service: 'EnhancedLangChainService', method: 'clearCache' }, 'Cleared all caches');
  }
}
