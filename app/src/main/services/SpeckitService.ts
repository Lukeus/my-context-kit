import { randomUUID } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import type {
  SpecKitEntityPreview,
  SpecKitEntityType,
  SpecKitFetchPipelineResult,
  SpecKitFetchPipelineSuccess,
  SpecKitFetchPipelineInProgress,
  SpecKitPreviewCollection,
  SpecKitPipelineReport,
  SpecKitPipelineEntityResult,
  SpecKitPipelineRun,
} from '@shared/speckit';
import { logger } from '../utils/logger';
import { ContextService } from './ContextService';
import type { ValidationResult, ImpactResult, GenerateResult } from './ContextService';

export interface SpecifyOptions {
  repoPath: string;
  description: string;
}

export interface PlanOptions {
  repoPath: string;
  specPath: string;
  techStack?: string[];
}

export interface TasksOptions {
  repoPath: string;
  planPath: string;
}

export interface FetchOptions {
  repoPath: string;
  releaseTag?: string;
  forceRefresh?: boolean;
}

export interface ToEntityOptions {
  repoPath: string;
  specPath: string;
  options?: {
    createFeature?: boolean;
    createStories?: boolean;
    sourcePreviewPaths?: string[];
  };
}

export interface TasksToEntityOptions {
  repoPath: string;
  tasksPath: string;
}

export interface AIGenerateSpecOptions {
  repoPath: string;
  description: string;
}

export interface AIRefineSpecOptions {
  repoPath: string;
  specPath: string;
  feedback: string;
}

export interface RunPipelinesOptions {
  repoPath: string;
  createdPaths?: string[];
  entityMetadata?: Array<{ id: string; type: SpecKitEntityType; path?: string; sourcePath?: string }>;
  sourcePreviewPaths?: string[];
  contextService?: ContextService;
}

// Constants
const SPECKIT_STALE_THRESHOLD_DAYS = 7; // Cache considered stale after 7 days
const SPECKIT_STALE_THRESHOLD_MS = SPECKIT_STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Service for Speckit (Specification-Driven Development) workflow operations
 */
export class SpeckitService {
  private readonly staleThresholdMs = SPECKIT_STALE_THRESHOLD_MS;
  private readonly previewEntityOrder: SpecKitEntityType[] = [
    'feature',
    'userstory',
    'spec',
    'governance',
    'template',
  ];

  /**
   * Check if a pipeline exists in the repository
   */
  private checkPipelineExists(repoPath: string, pipelineFile: string): void {
    const pipelinePath = path.join(repoPath, '.context', 'pipelines', pipelineFile);
    if (!existsSync(pipelinePath)) {
      throw new Error(`${pipelineFile} pipeline not found. Please ensure the pipeline is installed.`);
    }
  }

  /**
   * Execute a pipeline and return parsed JSON output
   */
  private async executePipeline(repoPath: string, pipelineFile: string, args: string[]): Promise<any> {
    const pipelinePath = path.join(repoPath, '.context', 'pipelines', pipelineFile);
    const result = await execa('node', [pipelinePath, ...args], {
      cwd: repoPath
    });
    return JSON.parse(result.stdout);
  }

  /**
   * Generate a specification from a description
   * Creates a structured specification document using the SDD workflow
   */
  async specify(options: SpecifyOptions): Promise<any> {
    const { repoPath, description } = options;
    this.checkPipelineExists(repoPath, 'speckit.mjs');
    return await this.executePipeline(repoPath, 'speckit.mjs', ['specify', description]);
  }

  /**
   * Create an implementation plan from a specification
   * Generates a step-by-step plan for implementing the specification
   */
  async plan(options: PlanOptions): Promise<any> {
    const { repoPath, specPath } = options;
    this.checkPipelineExists(repoPath, 'speckit.mjs');
    return await this.executePipeline(repoPath, 'speckit.mjs', ['plan', specPath]);
  }

  /**
   * Generate tasks from an implementation plan
   * Breaks down the plan into actionable development tasks
   */
  async tasks(options: TasksOptions): Promise<any> {
    const { repoPath, planPath } = options;
    this.checkPipelineExists(repoPath, 'speckit.mjs');
    return await this.executePipeline(repoPath, 'speckit.mjs', ['tasks', planPath]);
  }

  /**
   * Fetch Spec Kit release and update cache snapshot
   */
  async fetch(options: FetchOptions): Promise<SpecKitFetchPipelineResult> {
    const { repoPath, releaseTag, forceRefresh } = options;
    this.checkPipelineExists(repoPath, 'speckit-fetch.mjs');

    const pipelinePath = path.join(repoPath, '.context', 'pipelines', 'speckit-fetch.mjs');
    const args = ['--repoPath', repoPath];
    if (releaseTag) {
      args.push('--releaseTag', releaseTag);
    }
    if (forceRefresh) {
      args.push('--forceRefresh');
    }

    return await logger.logServiceCall({
      service: 'SpeckitService',
      method: 'fetch',
      repoPath,
      releaseTag: releaseTag ?? 'latest',
      forceRefresh: !!forceRefresh,
    }, async () => {
      const result = await execa('node', [pipelinePath, ...args], {
        cwd: repoPath,
        reject: false,
      });

      const parsed = this.parseFetchPayload(result.stdout);

      if (result.exitCode === 202) {
        return this.toInProgressPayload(parsed);
      }

      if (result.exitCode !== 0) {
        const errorMessage = this.resolveFetchError(parsed, result.stderr, result.exitCode ?? 1);
        throw new Error(errorMessage);
      }

      if (!this.isFetchSuccess(parsed)) {
        const errorMessage = this.resolveFetchError(parsed, result.stderr, result.exitCode ?? 1);
        throw new Error(errorMessage);
      }

      const stale = this.computeStale(parsed.timing?.finishedAt ?? parsed.fetchedAt ?? null);

      return {
        ...parsed,
        status: {
          ...parsed.status,
          stale,
        },
        warnings: parsed.warnings ?? [],
      } satisfies SpecKitFetchPipelineSuccess;
    });
  }

  /**
   * Enumerate cached markdown previews grouped by entity type
   */
  async listPreviews(options: { repoPath: string }): Promise<SpecKitPreviewCollection> {
    const { repoPath } = options;
    const summaryPath = path.join(repoPath, '.context', 'state', 'speckit-fetch.json');

    if (!existsSync(summaryPath)) {
      throw new Error('Spec Kit cache has not been fetched yet. Run speckit:fetch first.');
    }

    const rawSummary = await this.readSummary(summaryPath);

    if (!rawSummary.status || rawSummary.status.ok !== true) {
      const reason = typeof rawSummary.status?.error === 'string' && rawSummary.status.error.length > 0
        ? rawSummary.status.error
        : 'Spec Kit cache summary is incomplete. Run speckit:fetch again.';
      throw new Error(reason);
    }

    const cachePath = this.resolveCachePath(rawSummary.cachePath, repoPath, rawSummary.releaseTag);

    if (!cachePath || !existsSync(cachePath)) {
      throw new Error('Spec Kit cache directory not found. Refresh the cache and try again.');
    }

    const relativeFiles = await this.collectMarkdownFiles(cachePath);
    if (relativeFiles.length === 0) {
      throw new Error('No markdown previews available in the Spec Kit cache. Fetch a release with templates.');
    }

    const warnings = Array.isArray(rawSummary.warnings)
      ? rawSummary.warnings.filter((warning): warning is string => typeof warning === 'string')
      : [];

    const groups = new Map<SpecKitEntityType, SpecKitEntityPreview[]>();
    this.previewEntityOrder.forEach((entityType) => {
      groups.set(entityType, []);
    });

    for (const relativePath of relativeFiles) {
      const entityType = this.classifyPreview(relativePath);
      const absolutePath = path.join(cachePath, relativePath);

      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch (error) {
        warnings.push(`Failed to read ${relativePath}: ${(error as Error).message}`);
        continue;
      }

      const id = relativePath.replace(/\\/g, '/');
      const fileName = path.basename(relativePath, path.extname(relativePath));
      const displayName = this.extractHeading(content) ?? this.normalizeDisplayName(fileName);

      const preview: SpecKitEntityPreview = {
        id,
        displayName,
        entityType,
        content,
        source: {
          releaseTag: rawSummary.releaseTag,
          commit: rawSummary.commit,
          path: id,
        },
      };

      const bucket = groups.get(entityType);
      if (!bucket) {
        groups.set(entityType, [preview]);
      } else {
        bucket.push(preview);
      }
    }

    const orderedGroups = this.previewEntityOrder.map((entityType) => {
      const items = groups.get(entityType) ?? [];
      items.sort((a, b) => a.displayName.localeCompare(b.displayName, 'en'));
      return { entityType, items };
    });

    const totalCount = orderedGroups.reduce((sum, group) => sum + group.items.length, 0);

    if (totalCount === 0) {
      warnings.push('Spec Kit cache is present but contains no markdown previews.');
    }

    return {
      releaseTag: rawSummary.releaseTag,
      commit: rawSummary.commit,
      fetchedAt: rawSummary.fetchedAt,
      generatedAt: new Date().toISOString(),
      totalCount,
      groups: orderedGroups,
      warnings,
    } satisfies SpecKitPreviewCollection;
  }

  /**
   * Convert a specification to context entities (feature, stories, etc.)
   * Transforms a spec document into structured YAML entities
   */
  async toEntity(options: ToEntityOptions): Promise<any> {
    const { repoPath, specPath, options: commandOptions } = options;
    this.checkPipelineExists(repoPath, 'spec-entity.mjs');
    const createFeature = commandOptions?.createFeature ?? true;
    const createStories = commandOptions?.createStories ?? true;
    const sourcePreviewPaths = commandOptions?.sourcePreviewPaths ?? [];

    return await logger.logServiceCall({
      service: 'SpeckitService',
      method: 'toEntity',
      repoPath,
      specPath,
      createFeature,
      createStories,
      sourcePreviewPaths,
    }, async () => {
      return await this.executePipeline(repoPath, 'spec-entity.mjs', ['spec', specPath]);
    });
  }

  /**
   * Convert tasks to context entities
   * Transforms task documents into structured YAML task entities
   */
  async tasksToEntity(options: TasksToEntityOptions): Promise<any> {
    const { repoPath, tasksPath } = options;
    this.checkPipelineExists(repoPath, 'spec-entity.mjs');
    return await this.executePipeline(repoPath, 'spec-entity.mjs', ['tasks', tasksPath]);
  }

  async runPipelines(options: RunPipelinesOptions): Promise<SpecKitPipelineReport> {
    const {
      repoPath,
      createdPaths = [],
      entityMetadata = [],
      sourcePreviewPaths = [],
      contextService,
    } = options;

    if (!repoPath || repoPath.trim().length === 0) {
      throw new Error('Repository path is required to run Spec Kit pipelines.');
    }

    this.checkPipelineExists(repoPath, 'validate.mjs');
    this.checkPipelineExists(repoPath, 'build-graph.mjs');
    this.checkPipelineExists(repoPath, 'impact.mjs');
    this.checkPipelineExists(repoPath, 'generate.mjs');

    const normalizedCreatedPaths = createdPaths.map((filePath) => this.normalizePath(filePath));
    const normalizedSourcePaths = sourcePreviewPaths.map((filePath) => this.normalizePath(filePath));

    const entities = this.preparePipelineEntities(normalizedCreatedPaths, entityMetadata, normalizedSourcePaths);
    const entityMap = new Map(entities.map((entity) => [entity.id, entity]));

    const service = contextService ?? new ContextService(repoPath);
    const entityIds = entities.map((entity) => entity.id);

    const pipelines: SpecKitPipelineReport['pipelines'] = {
      validate: { status: 'pending' },
      buildGraph: { status: 'pending' },
      impact: { status: 'pending' },
      generate: { status: 'pending' },
    };

    let canProceed = true;

    try {
      const validationResult = await service.validate();
      const validationErrors = this.collectValidationErrors(validationResult);
      this.applyValidationErrors(entityMap, validationErrors);

      const ok = validationResult.ok !== false && validationErrors.size === 0;
      pipelines.validate = {
        status: ok ? 'succeeded' : 'failed',
        error: ok ? undefined : validationResult.error ?? 'Validation pipeline reported failures.',
        details: validationResult,
      } satisfies SpecKitPipelineRun;

      if (!ok) {
        canProceed = false;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Validation pipeline failed.';
      pipelines.validate = {
        status: 'failed',
        error: message,
      } satisfies SpecKitPipelineRun;
      canProceed = false;
    }

    if (!canProceed) {
      pipelines.buildGraph = this.skippedPipelineRun('validate');
      pipelines.impact = this.skippedPipelineRun('validate');
      pipelines.generate = this.skippedPipelineRun('validate');
      return {
        batchId: randomUUID(),
        entities: Array.from(entityMap.values()),
        generatedFiles: normalizedCreatedPaths,
        sourcePreviews: normalizedSourcePaths,
        pipelines,
      } satisfies SpecKitPipelineReport;
    }

    try {
      const graphResult = await service.buildGraph();
      pipelines.buildGraph = {
        status: graphResult.ok === false ? 'failed' : 'succeeded',
        error: graphResult.ok === false ? graphResult.error ?? 'Graph pipeline reported failures.' : undefined,
        details: graphResult,
      } satisfies SpecKitPipelineRun;

      if (graphResult.ok === false) {
        canProceed = false;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Dependency graph pipeline failed.';
      pipelines.buildGraph = {
        status: 'failed',
        error: message,
      } satisfies SpecKitPipelineRun;
      canProceed = false;
    }

    if (!canProceed) {
      pipelines.impact = this.skippedPipelineRun('build-graph');
      pipelines.generate = this.skippedPipelineRun('build-graph');
      return {
        batchId: randomUUID(),
        entities: Array.from(entityMap.values()),
        generatedFiles: normalizedCreatedPaths,
        sourcePreviews: normalizedSourcePaths,
        pipelines,
      } satisfies SpecKitPipelineReport;
    }

    if (entityIds.length === 0) {
      const emptyImpact: ImpactResult = {
        ok: true,
        changed: [],
        directImpact: [],
        indirectImpact: [],
        totalImpact: 0,
      };
      pipelines.impact = {
        status: 'succeeded',
        details: emptyImpact,
      } satisfies SpecKitPipelineRun;
    } else {
      try {
        const impactResult = await service.calculateImpact(entityIds);
        pipelines.impact = {
          status: impactResult.ok ? 'succeeded' : 'failed',
          error: impactResult.ok ? undefined : impactResult.error ?? 'Impact analysis reported failures.',
          details: impactResult,
        } satisfies SpecKitPipelineRun;

        if (!impactResult.ok) {
          canProceed = false;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Impact analysis pipeline failed.';
        pipelines.impact = {
          status: 'failed',
          error: message,
        } satisfies SpecKitPipelineRun;
        canProceed = false;
      }
    }

    if (!canProceed) {
      pipelines.generate = this.skippedPipelineRun('impact');
      return {
        batchId: randomUUID(),
        entities: Array.from(entityMap.values()),
        generatedFiles: normalizedCreatedPaths,
        sourcePreviews: normalizedSourcePaths,
        pipelines,
      } satisfies SpecKitPipelineReport;
    }

    if (entityIds.length === 0) {
      const emptyGenerate: GenerateResult = {
        ok: true,
        generated: [],
        paths: {},
      };
      pipelines.generate = {
        status: 'succeeded',
        details: emptyGenerate,
      } satisfies SpecKitPipelineRun;
    } else {
      try {
        const generateResult = await service.generate(entityIds);
        this.applyGenerateResults(entityMap, generateResult);

        pipelines.generate = {
          status: generateResult.ok ? 'succeeded' : 'failed',
          error: generateResult.ok ? undefined : generateResult.error ?? 'Generate pipeline reported failures.',
          details: generateResult,
        } satisfies SpecKitPipelineRun;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Generate pipeline failed.';
        pipelines.generate = {
          status: 'failed',
          error: message,
        } satisfies SpecKitPipelineRun;
      }
    }

    return {
      batchId: randomUUID(),
      entities: Array.from(entityMap.values()),
      generatedFiles: normalizedCreatedPaths,
      sourcePreviews: normalizedSourcePaths,
      pipelines,
    } satisfies SpecKitPipelineReport;
  }

  /**
   * DEPRECATED: aiGenerateSpec has been removed.
   * TODO: Migrate to Python sidecar for AI spec generation.
   */
  async aiGenerateSpec(_options: AIGenerateSpecOptions): Promise<any> {
    throw new Error('AI spec generation has been migrated to Python sidecar. Use the sidecar service instead.');
  }

  /**
   * DEPRECATED: aiRefineSpec has been removed.
   * TODO: Migrate to Python sidecar for AI spec refinement.
   */
  async aiRefineSpec(_options: AIRefineSpecOptions): Promise<any> {
    throw new Error('AI spec refinement has been migrated to Python sidecar. Use the sidecar service instead.');
  }

  private preparePipelineEntities(
    createdPaths: string[],
    metadata: Array<{ id: string; type: SpecKitEntityType; path?: string; sourcePath?: string }>,
    sourcePreviewPaths: string[],
  ): SpecKitPipelineEntityResult[] {
    const entityMap = new Map<string, SpecKitPipelineEntityResult>();

    metadata.forEach(({ id, type, path: entityPath, sourcePath }) => {
      if (!id || !type) {
        return;
      }

      entityMap.set(id, {
        id,
        type,
        status: 'succeeded',
        errors: [],
        path: entityPath ? this.normalizePath(entityPath) : undefined,
        sourcePath: sourcePath ? this.normalizePath(sourcePath) : undefined,
      });
    });

    for (const createdPath of createdPaths) {
      const parsed = this.parseEntityFromCreatedPath(createdPath);
      if (!parsed || !parsed.id || !parsed.type) {
        continue;
      }

      const existing = entityMap.get(parsed.id);
      if (existing) {
        existing.path = existing.path ?? createdPath;
        existing.type = parsed.type;
      } else {
        entityMap.set(parsed.id, {
          id: parsed.id,
          type: parsed.type,
          status: 'succeeded',
          errors: [],
          path: createdPath,
        });
      }
    }

    const entities = Array.from(entityMap.values());
    if (sourcePreviewPaths.length > 0) {
      this.assignSourcePreviewPaths(entities, sourcePreviewPaths);
    }

    entities.sort((a, b) => {
      const orderDiff = this.getEntityOrder(a.type) - this.getEntityOrder(b.type);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return a.id.localeCompare(b.id, 'en');
    });

    return entities;
  }

  private collectValidationErrors(validation: ValidationResult): Map<string, string[]> {
    const errorMap = new Map<string, string[]>();
    const entries = Array.isArray(validation.errors) ? validation.errors : [];

    for (const entry of entries) {
      if (!entry) {
        continue;
      }

      const candidateId = typeof entry.entity === 'string' && entry.entity.length > 0
        ? entry.entity
        : this.inferEntityIdFromFile(entry.file);

      if (!candidateId) {
        continue;
      }

      const messages: string[] = [];
      if (typeof entry.error === 'string' && entry.error.trim().length > 0) {
        messages.push(entry.error.trim());
      }

      if (Array.isArray(entry.errors)) {
        for (const nested of entry.errors) {
          if (typeof nested === 'string' && nested.trim().length > 0) {
            messages.push(nested.trim());
          } else if (nested && typeof nested === 'object') {
            messages.push(JSON.stringify(nested));
          }
        }
      }

      if (messages.length === 0) {
        messages.push('Validation reported an unspecified error.');
      }

      const existing = errorMap.get(candidateId) ?? [];
      existing.push(...messages);
      errorMap.set(candidateId, existing);
    }

    return errorMap;
  }

  private applyValidationErrors(
    entityMap: Map<string, SpecKitPipelineEntityResult>,
    validationErrors: Map<string, string[]>,
  ): void {
    validationErrors.forEach((messages, entityId) => {
      const entity = entityMap.get(entityId);
      if (!entity) {
        return;
      }

      entity.status = 'failed';
      messages.forEach((message) => this.recordEntityError(entity, message));
    });
  }

  private applyGenerateResults(
    entityMap: Map<string, SpecKitPipelineEntityResult>,
    generateResult: GenerateResult,
  ): void {
    if (!generateResult.ok) {
      const failureMessage = generateResult.error ?? 'Generate pipeline failed to complete successfully.';
      entityMap.forEach((entity) => {
        entity.status = 'failed';
        this.recordEntityError(entity, failureMessage);
      });
      return;
    }

    const generatedIds = new Set<string>(Array.isArray(generateResult.generated) ? generateResult.generated : []);
    const generatedPaths = generateResult.paths ?? {};

    entityMap.forEach((entity, entityId) => {
      const generatedPath = generatedPaths[entityId];
      if (typeof generatedPath === 'string' && generatedPath.length > 0) {
        entity.path = this.normalizePath(generatedPath);
      }

      if (!generatedIds.has(entityId)) {
        this.recordEntityError(entity, 'Entity was not regenerated by the generate pipeline.');
        entity.status = 'failed';
        return;
      }

      if (entity.status !== 'failed') {
        entity.status = 'succeeded';
      }
    });
  }

  private assignSourcePreviewPaths(
    entities: SpecKitPipelineEntityResult[],
    sourcePreviewPaths: string[],
  ): void {
    const normalizedSources = sourcePreviewPaths.map((source) => this.normalizePath(source));

    entities.forEach((entity) => {
      if (entity.sourcePath) {
        return;
      }

      const match = this.matchPreviewForEntity(entity.type, normalizedSources);
      if (match) {
        entity.sourcePath = match;
      }
    });
  }

  private matchPreviewForEntity(entityType: SpecKitEntityType, sources: string[]): string | undefined {
    if (sources.length === 0) {
      return undefined;
    }

    const heuristics: Partial<Record<SpecKitEntityType, RegExp[]>> = {
      feature: [/feature/i],
      userstory: [/story/i, /user/i],
      spec: [/spec/i],
      governance: [/govern/i, /policy/i, /constitution/i],
      template: [/template/i],
    };

    const patterns = heuristics[entityType] ?? [];
    for (const pattern of patterns) {
      const matched = sources.find((source) => pattern.test(source));
      if (matched) {
        return matched;
      }
    }

    return sources[0];
  }

  private skippedPipelineRun(reason: string): SpecKitPipelineRun {
    return {
      status: 'failed',
      error: `Skipped because ${reason} pipeline failed.`,
    } satisfies SpecKitPipelineRun;
  }

  private parseEntityFromCreatedPath(createdPath: string): { id: string | null; type: SpecKitEntityType | null } | null {
    if (!createdPath) {
      return null;
    }

    const segments = this.normalizePath(createdPath).split('/');
    const fileName = segments.at(-1);
    const directory = segments.at(-2);

    if (!fileName || !directory) {
      return null;
    }

    const id = fileName.replace(/\.ya?ml$/i, '');
    const type = this.resolveEntityTypeFromDirectory(directory);
    return { id, type };
  }

  private resolveEntityTypeFromDirectory(directory: string): SpecKitEntityType | null {
    const normalized = directory.toLowerCase();
    if (normalized.includes('feature')) {
      return 'feature';
    }
    if (normalized.includes('story')) {
      return 'userstory';
    }
    if (normalized.includes('govern')) {
      return 'governance';
    }
    if (normalized.includes('template')) {
      return 'template';
    }
    if (normalized.includes('spec')) {
      return 'spec';
    }
    return null;
  }

  private inferEntityIdFromFile(filePath: unknown): string | null {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return null;
    }
    const segments = this.normalizePath(filePath).split('/');
    const fileName = segments.at(-1);
    if (!fileName) {
      return null;
    }
    return fileName.replace(/\.ya?ml$/i, '');
  }

  private recordEntityError(entity: SpecKitPipelineEntityResult, message: string): void {
    if (!entity.errors.includes(message)) {
      entity.errors.push(message);
    }
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  private getEntityOrder(entityType: SpecKitEntityType): number {
    const index = this.previewEntityOrder.indexOf(entityType);
    return index === -1 ? this.previewEntityOrder.length : index;
  }

  private parseFetchPayload(stdout: string | undefined): unknown {
    if (!stdout) {
      return {};
    }

    try {
      // Pipelines emit a single JSON line, but guard against stray logging
      const line = stdout.trim().split('\n').pop() ?? '';
      return line ? JSON.parse(line) : {};
    } catch {
      return {};
    }
  }

  private toInProgressPayload(parsed: unknown): SpecKitFetchPipelineInProgress {
    const normalized: Record<string, unknown> = (typeof parsed === 'object' && parsed !== null)
      ? (parsed as Record<string, unknown>)
      : {};

    const startedAt = typeof normalized.startedAt === 'string' ? normalized.startedAt : null;
    const error = typeof normalized.error === 'string' ? normalized.error : 'Spec Kit fetch already in progress';

    return {
      ok: false,
      inProgress: true,
      startedAt,
      error,
    };
  }

  private isFetchSuccess(parsed: unknown): parsed is SpecKitFetchPipelineSuccess {
    if (!parsed || typeof parsed !== 'object') {
      return false;
    }

    if ((parsed as { ok?: unknown }).ok !== true) {
      return false;
    }

    const cachePath = (parsed as { cachePath?: unknown }).cachePath;
    const commit = (parsed as { commit?: unknown }).commit;
    const releaseTag = (parsed as { releaseTag?: unknown }).releaseTag;
    const fetchedAt = (parsed as { fetchedAt?: unknown }).fetchedAt;
    const durationMs = (parsed as { durationMs?: unknown }).durationMs;
    const source = (parsed as { source?: unknown }).source;
    const timing = (parsed as { timing?: unknown }).timing;
    const artifacts = (parsed as { artifacts?: unknown }).artifacts;
    const status = (parsed as { status?: unknown }).status;

    return typeof cachePath === 'string'
      && typeof commit === 'string'
      && typeof releaseTag === 'string'
      && typeof fetchedAt === 'string'
      && typeof durationMs === 'number'
      && source !== null && typeof source === 'object'
      && timing !== null && typeof timing === 'object'
      && artifacts !== null && typeof artifacts === 'object'
      && status !== null && typeof status === 'object';
  }

  private resolveFetchError(parsed: unknown, stderr: string | undefined, exitCode: number): string {
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const errorValue = (parsed as { error?: unknown }).error;
      if (typeof errorValue === 'string' && errorValue.trim().length > 0) {
        return errorValue;
      }
    }

    if (stderr && stderr.trim().length > 0) {
      return stderr.trim();
    }

    return `Spec Kit fetch failed (exit code ${exitCode})`;
  }

  private computeStale(timestamp: string | null | undefined): boolean {
    if (!timestamp) {
      return true;
    }

    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) {
      return true;
    }

    return Date.now() - parsed > this.staleThresholdMs;
  }

  private async readSummary(summaryPath: string): Promise<{
    cachePath: string | null;
    releaseTag: string;
    commit: string;
    fetchedAt: string | null;
    status?: { ok?: boolean; error?: string | null };
    warnings?: unknown;
  }> {
    const rawContent = await fs.readFile(summaryPath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      throw new Error(`Invalid Spec Kit summary JSON: ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Spec Kit summary is empty or malformed.');
    }

    const cachePath = this.readSummaryString(parsed, 'cachePath');
    const releaseTag = this.readSummaryString(parsed, 'releaseTag')
      ?? this.readSummaryString(parsed, ['source', 'releaseTag'])
      ?? 'latest';
    const commit = this.readSummaryString(parsed, 'commit')
      ?? this.readSummaryString(parsed, ['source', 'commit'])
      ?? 'unknown';
    const fetchedAt = this.readSummaryString(parsed, 'fetchedAt')
      ?? this.readSummaryString(parsed, ['timing', 'finishedAt'])
      ?? null;
    const status = this.readSummaryObject(parsed, 'status');
    const warnings = (parsed as Record<string, unknown>).warnings;

    return {
      cachePath,
      releaseTag,
      commit,
      fetchedAt,
      status: status as { ok?: boolean; error?: string | null } | undefined,
      warnings,
    };
  }

  private readSummaryString(source: unknown, keys: string | string[]): string | null {
    const segments = Array.isArray(keys) ? keys : [keys];
    let cursor: unknown = source;

    for (const segment of segments) {
      if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
        return null;
      }
      cursor = (cursor as Record<string, unknown>)[segment];
    }

    return typeof cursor === 'string' ? cursor : null;
  }

  private readSummaryObject(source: unknown, key: string): Record<string, unknown> | null {
    if (!source || typeof source !== 'object' || !(key in source)) {
      return null;
    }
    const value = (source as Record<string, unknown>)[key];
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  }

  private resolveCachePath(cachePath: string | null, repoPath: string, releaseTag: string): string {
    if (cachePath && path.isAbsolute(cachePath)) {
      return cachePath;
    }

    if (cachePath) {
      return path.resolve(repoPath, cachePath);
    }

    return path.join(repoPath, '.context', 'speckit-cache', releaseTag);
  }

  private async collectMarkdownFiles(currentPath: string, rootPath: string = currentPath): Promise<string[]> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        const childFiles = await this.collectMarkdownFiles(entryPath, rootPath);
        files.push(...childFiles);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const relative = path.relative(rootPath, entryPath).replace(/\\/g, '/');
        files.push(relative);
      }
    }

    return files;
  }

  private classifyPreview(relativePath: string): SpecKitEntityType {
    const normalized = relativePath.replace(/\\/g, '/').toLowerCase();

    if (normalized.startsWith('templates/')) {
      return 'template';
    }

    if (normalized.startsWith('memory/')) {
      return 'governance';
    }

    if (normalized.startsWith('docs/')) {
      const segments = normalized.split('/');
      const category = segments[1] ?? '';

      if (category.includes('feature')) {
        return 'feature';
      }

      if (category.includes('story')) {
        return 'userstory';
      }

      if (category.includes('govern') || category.includes('policy') || category.includes('constitution')) {
        return 'governance';
      }

      if (category.includes('template')) {
        return 'template';
      }

      if (category.includes('spec')) {
        return 'spec';
      }
    }

    if (normalized.includes('user-story') || normalized.includes('userstory')) {
      return 'userstory';
    }

    if (normalized.includes('feature')) {
      return 'feature';
    }

    if (normalized.includes('govern') || normalized.includes('policy') || normalized.includes('constitution')) {
      return 'governance';
    }

    if (normalized.includes('template')) {
      return 'template';
    }

    return 'spec';
  }

  private extractHeading(markdown: string): string | null {
    const headingMatch = markdown.match(/^#\s+(.+)$/m)
      ?? markdown.match(/^##\s+(.+)$/m);
    return headingMatch ? headingMatch[1].trim() : null;
  }

  private normalizeDisplayName(fileName: string): string {
    return fileName
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }
}
