import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execa } from 'execa';
import { parse as parseYAML } from 'yaml';
import { PipelineError, ValidationError } from '../errors/AppError';

export interface ValidationResult {
  ok: boolean;
  message?: string;
  error?: string;
  stats?: {
    totalEntities: number;
    byType: Record<string, number>;
  };
  errors?: Array<{
    file: string;
    entity?: string;
    error?: string;
    errors?: unknown;
  }>;
}

export interface GraphResult {
  ok?: boolean;
  error?: string;
  nodes: Array<{
    id: string;
    kind: string;
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    rel: string;
  }>;
  stats?: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByRel: Record<string, number>;
  };
}

export interface ImpactResult {
  ok: boolean;
  error?: string;
  changed: string[];
  directImpact: string[];
  indirectImpact: string[];
  totalImpact: number;
}

export interface GenerateResult {
  ok: boolean;
  error?: string;
  generated: string[];
  paths: Record<string, string>;
}

export interface EmbeddingsBuildResult {
  checksum: string;
  fileCount: number;
  entryCount: number;
  metadataPath: string;
  vectorPath: string;
}

/**
 * Service for managing context repository operations
 */
export class ContextService {
  constructor(private readonly repoPath: string) {
    if (!repoPath || !repoPath.trim()) {
      throw new ValidationError('Repository path is required');
    }
  }

  /**
   * Validates all entities in the context repository
   */
  async validate(): Promise<ValidationResult> {
    const pipelinePath = path.join(this.repoPath, '.context', 'pipelines', 'validate.mjs');
    
    if (!existsSync(pipelinePath)) {
      throw new PipelineError(
        'Validation pipeline not found',
        'validate',
        { pipelinePath }
      );
    }

    try {
      const result = await execa('node', [pipelinePath], {
        cwd: this.repoPath
      });
      return JSON.parse(result.stdout) as ValidationResult;
    } catch (error: unknown) {
      const execError = error as { stdout?: string; message?: string };
      
      // Try to parse error output (pipeline may return JSON even on error)
      if (execError.stdout) {
        try {
          return JSON.parse(execError.stdout) as ValidationResult;
        } catch {
          // Fall through to throw PipelineError
        }
      }

      throw new PipelineError(
        execError.message || 'Validation pipeline failed to execute',
        'validate'
      );
    }
  }

  /**
   * Builds dependency graph from entities
   */
  async buildGraph(): Promise<GraphResult> {
    const pipelinePath = path.join(this.repoPath, '.context', 'pipelines', 'build-graph.mjs');

    if (!existsSync(pipelinePath)) {
      throw new PipelineError(
        'Graph building pipeline not found',
        'build-graph',
        { pipelinePath }
      );
    }

    try {
      const result = await execa('node', [pipelinePath], {
        cwd: this.repoPath
      });
      return JSON.parse(result.stdout) as GraphResult;
    } catch (error: unknown) {
      const execError = error as { stdout?: string; message?: string };

      // Try to parse error output
      if (execError.stdout) {
        try {
          return JSON.parse(execError.stdout) as GraphResult;
        } catch {
          // Fall through
        }
      }

      const message = execError.message || 'Failed to build dependency graph';
      
      // Provide helpful error for missing dependencies
      if (message.includes('Cannot find module')) {
        throw new PipelineError(
          'Pipeline dependencies not installed',
          'build-graph',
          { hint: 'Run "pnpm install" in the context repository' }
        );
      }

      throw new PipelineError(message, 'build-graph');
    }
  }

  /**
   * Analyzes impact of changed entities
   */
  async calculateImpact(changedIds: string[]): Promise<ImpactResult> {
    if (!changedIds || changedIds.length === 0) {
      throw new ValidationError('At least one changed entity ID is required');
    }

    const pipelinePath = path.join(this.repoPath, '.context', 'pipelines', 'impact.mjs');

    if (!existsSync(pipelinePath)) {
      throw new PipelineError(
        'Impact analysis pipeline not found',
        'impact',
        { pipelinePath }
      );
    }

    try {
      const result = await execa('node', [pipelinePath, ...changedIds], {
        cwd: this.repoPath
      });
      return JSON.parse(result.stdout) as ImpactResult;
    } catch (error: unknown) {
      const execError = error as { stdout?: string; message?: string };

      if (execError.stdout) {
        try {
          return JSON.parse(execError.stdout) as ImpactResult;
        } catch {
          // Fall through
        }
      }

      throw new PipelineError(
        execError.message || 'Impact analysis failed',
        'impact'
      );
    }
  }

  /**
   * Builds deterministic embeddings artifacts for the repository corpus.
   */
  async buildEmbeddings(): Promise<EmbeddingsBuildResult> {
    const pipelinePath = path.join(this.repoPath, '.context', 'pipelines', 'build-embeddings.mjs');

    if (!existsSync(pipelinePath)) {
      throw new PipelineError(
        'Embeddings pipeline not found',
        'build-embeddings',
        { pipelinePath }
      );
    }

    try {
      const result = await execa('node', [pipelinePath], {
        cwd: this.repoPath
      });
      const parsed = JSON.parse(result.stdout) as Partial<EmbeddingsBuildResult> & Record<string, unknown>;
      if (!parsed.checksum || typeof parsed.checksum !== 'string') {
        throw new PipelineError('Embeddings pipeline did not return checksum.', 'build-embeddings', { payload: parsed });
      }
      return {
        checksum: parsed.checksum,
        fileCount: Number(parsed.fileCount ?? 0),
        entryCount: Number(parsed.entryCount ?? 0),
        metadataPath: typeof parsed.metadataPath === 'string' ? parsed.metadataPath : path.join(this.repoPath, 'generated', 'embeddings', 'metadata.json'),
        vectorPath: typeof parsed.vectorPath === 'string' ? parsed.vectorPath : path.join(this.repoPath, 'generated', 'embeddings', 'corpus.jsonl')
      };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; message?: string };
      let message = execError.message || 'Embeddings pipeline failed';

      if (execError.stdout) {
        try {
          const parsed = JSON.parse(execError.stdout) as { error?: string };
          if (parsed?.error) {
            message = parsed.error;
          }
        } catch {
          // ignore parse failures
        }
      }

      throw new PipelineError(
        message,
        'build-embeddings'
      );
    }
  }

  /**
   * Generates content for specified entity IDs
   */
  async generate(ids: string[]): Promise<GenerateResult> {
    if (!ids || ids.length === 0) {
      throw new ValidationError('At least one entity ID is required for generation');
    }

    const pipelinePath = path.join(this.repoPath, '.context', 'pipelines', 'generate.mjs');

    if (!existsSync(pipelinePath)) {
      throw new PipelineError(
        'Content generation pipeline not found',
        'generate',
        { pipelinePath }
      );
    }

    try {
      const result = await execa('node', [pipelinePath, ...ids], {
        cwd: this.repoPath
      });
      return JSON.parse(result.stdout) as GenerateResult;
    } catch (error: unknown) {
      const execError = error as { stdout?: string; message?: string };

      if (execError.stdout) {
        try {
          return JSON.parse(execError.stdout) as GenerateResult;
        } catch {
          // Fall through
        }
      }

      throw new PipelineError(
        execError.message || 'Content generation failed',
        'generate'
      );
    }
  }

  /**
   * Gets the next available ID for an entity type
   */
  async getNextId(entityType: string): Promise<string> {
    const typeDirMap: Record<string, string> = {
      governance: 'governance',
      feature: 'features',
      userstory: 'userstories',
      spec: 'specs',
      task: 'tasks',
      service: 'services',
      package: 'packages'
    };

    const typeDir = typeDirMap[entityType];
    if (!typeDir) {
      throw new ValidationError(`Unknown entity type: ${entityType}`);
    }

    const entityDir = path.join(this.repoPath, 'contexts', typeDir);

    try {
      const files = await readdir(entityDir);

      // Extract numeric IDs from existing files
      const idPattern = entityType === 'feature' ? /FEAT-(\d+)/ :
        entityType === 'userstory' ? /US-(\d+)/ :
          entityType === 'spec' ? /SPEC-(\d+)/ :
            entityType === 'task' ? /T-(\d+)/ :
              entityType === 'service' ? /svc-(.+)/ :
                /pkg-(.+)/;

      const numericIds: number[] = [];

      for (const file of files) {
        const match = file.match(idPattern);
        if (match && match[1]) {
          const numId = parseInt(match[1], 10);
          if (!isNaN(numId)) {
            numericIds.push(numId);
          }
        }
      }

      // Find next available ID
      const maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      const nextId = maxId + 1;

      // Format based on entity type
      switch (entityType) {
        case 'feature':
          return `FEAT-${String(nextId).padStart(3, '0')}`;
        case 'userstory':
          return `US-${String(nextId).padStart(3, '0')}`;
        case 'spec':
          return `SPEC-${String(nextId).padStart(3, '0')}`;
        case 'task':
          return `T-${String(nextId).padStart(4, '0')}`;
        case 'service':
          return `svc-new-${nextId}`;
        case 'package':
          return `pkg-new-${nextId}`;
        default:
          return `${entityType}-${nextId}`;
      }
    } catch {
      // Directory might not exist yet - return first ID
      switch (entityType) {
        case 'feature':
          return 'FEAT-001';
        case 'userstory':
          return 'US-001';
        case 'spec':
          return 'SPEC-001';
        case 'task':
          return 'T-0001';
        case 'service':
          return 'svc-new-1';
        case 'package':
          return 'pkg-new-1';
        default:
          return `${entityType}-1`;
      }
    }
  }

  /**
   * Lists all entities of a given type
   */
  async listEntities(entityType: string): Promise<Array<{id: string; title?: string; _type: string; _file: string; status?: string; [key: string]: any}>> {
    const typeDirMap: Record<string, string> = {
      governance: 'governance',
      feature: 'features',
      userstory: 'userstories',
      spec: 'specs',
      task: 'tasks',
      service: 'services',
      package: 'packages'
    };

    const typeDir = typeDirMap[entityType] || entityType + 's';
    const entityDir = path.join(this.repoPath, 'contexts', typeDir);
    
    try {
      const files = await readdir(entityDir);
      const entities = [];

      for (const fileName of files) {
        if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
          continue;
        }

        try {
          const filePath = path.join(entityDir, fileName);
          const content = await readFile(filePath, 'utf-8');
          const data = parseYAML(content) as Record<string, unknown>;
          
          if (data && data.id) {
            entities.push({
              ...data,
              _type: entityType,
              _file: filePath
            } as any);
          }
        } catch (error) {
          // Skip files that can't be parsed
          console.warn(`Failed to parse ${fileName}:`, error);
        }
      }

      return entities;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory doesn't exist - return empty array
        return [];
      }
      throw error;
    }
  }

  /**
   * Finds the file path for a given entity
   */
  async findEntityFile(entityType: string, entityId: string): Promise<string> {
    const typeDirMap: Record<string, string> = {
      governance: 'governance',
      feature: 'features',
      userstory: 'userstories',
      spec: 'specs',
      task: 'tasks',
      service: 'services',
      package: 'packages'
    };

    const typeDir = typeDirMap[entityType] || entityType + 's';
    const entityDir = path.join(this.repoPath, 'contexts', typeDir);
    
    try {
      const files = await readdir(entityDir);

      // Find file that starts with the entity ID
      let matchingFile = files.find(f =>
        (f.endsWith('.yaml') || f.endsWith('.yml')) &&
        (f === `${entityId}.yaml` || f === `${entityId}.yml` || f.startsWith(`${entityId}-`))
      );

      if (!matchingFile) {
        // Fallback: parse YAML files to match entities whose filenames omit the ID
        for (const fileName of files) {
          if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
            continue;
          }

          try {
            const content = await readFile(path.join(entityDir, fileName), 'utf-8');
            const data = parseYAML(content) as Record<string, unknown>;
            if (data && data.id === entityId) {
              matchingFile = fileName;
              break;
            }
          } catch {
            // Ignore parse errors and keep searching
          }
        }
      }

      if (matchingFile) {
        return path.join(entityDir, matchingFile);
      }

      throw new ValidationError(`File not found for entity ${entityId}`);
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to find entity file: ${entityId}`);
    }
  }
}
