import path from 'node:path';
import { promises as fs } from 'node:fs';
import YAML from 'yaml';

export interface GetEntityDetailsOptions {
  repoPath: string;
  entityId: string;
}

export interface GetEntityDetailsResult {
  id: string;
  type: string;
  title?: string;
  status?: string;
  description?: string;
  objective?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

/**
 * Retrieve full details for a specific entity by ID.
 * 
 * @param options - Entity ID and repository path
 * @returns Complete entity data including relationships
 */
export async function getEntityDetails(
  options: GetEntityDetailsOptions
): Promise<GetEntityDetailsResult> {
  if (!options.repoPath) {
    throw new Error('Repository path is required to retrieve entity details.');
  }
  
  if (!options.entityId || typeof options.entityId !== 'string') {
    throw new Error('Entity ID is required.');
  }

  const entityId = options.entityId.trim().toUpperCase();
  
  // Determine entity type and folder from ID prefix
  const typeMap: Record<string, { folder: string; type: string }> = {
    'FEAT': { folder: 'features', type: 'feature' },
    'US': { folder: 'user-stories', type: 'userstory' },
    'SPEC': { folder: 'specs', type: 'spec' },
    'T': { folder: 'tasks', type: 'task' },
    'SERVICE': { folder: 'services', type: 'service' },
    'PKG': { folder: 'packages', type: 'package' }
  };

  let entityInfo: { folder: string; type: string } | undefined;
  for (const [prefix, info] of Object.entries(typeMap)) {
    if (entityId.startsWith(prefix + '-')) {
      entityInfo = info;
      break;
    }
  }

  if (!entityInfo) {
    throw new Error(`Unable to determine entity type from ID: ${entityId}. Expected format: FEAT-001, US-042, etc.`);
  }

  // Construct file path
  const entityFilePath = path.join(
    options.repoPath,
    'contexts',
    entityInfo.folder,
    `${entityId}.yaml`
  );

  try {
    const fileContent = await fs.readFile(entityFilePath, 'utf-8');
    const entity = YAML.parse(fileContent) as Record<string, unknown>;

    if (!entity) {
      throw new Error(`Entity ${entityId} has invalid YAML content.`);
    }

    return {
      id: (entity.id as string) || entityId,
      type: entityInfo.type,
      title: entity.title as string | undefined,
      status: entity.status as string | undefined,
      description: entity.description as string | undefined,
      objective: entity.objective as string | undefined,
      dependencies: entity.dependencies as string[] | undefined,
      metadata: entity.metadata as Record<string, unknown> | undefined,
      raw: entity
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Entity ${entityId} not found at path: ${entityFilePath}`);
    }
    throw new Error(`Failed to retrieve entity ${entityId}: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
