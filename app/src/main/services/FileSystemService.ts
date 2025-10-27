import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify as stringifyYAML } from 'yaml';
import { FileSystemError, ValidationError } from '../errors/AppError';

/**
 * Service for file system operations
 */
export class FileSystemService {
  /**
   * Reads a file from the filesystem
   */
  async readFile(filePath: string): Promise<string> {
    if (!filePath || !filePath.trim()) {
      throw new ValidationError('File path is required');
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (error: unknown) {
      throw new FileSystemError(
        error instanceof Error ? error.message : 'Failed to read file',
        filePath
      );
    }
  }

  /**
   * Writes content to a file
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    if (!filePath || !filePath.trim()) {
      throw new ValidationError('File path is required');
    }

    if (content === undefined || content === null) {
      throw new ValidationError('File content is required');
    }

    try {
      await writeFile(filePath, content, 'utf-8');
    } catch (error: unknown) {
      throw new FileSystemError(
        error instanceof Error ? error.message : 'Failed to write file',
        filePath
      );
    }
  }

  /**
   * Creates a new entity file in the repository
   */
  async createEntity(dir: string, entity: any, entityType: string): Promise<string> {
    if (!dir || !dir.trim()) {
      throw new ValidationError('Directory path is required');
    }

    if (!entity || !entity.id) {
      throw new ValidationError('Entity with ID is required');
    }

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

    const entityDir = path.join(dir, 'contexts', typeDir);

    // Create filename from ID and title
    const sanitizedTitle = entity.title
      ? entity.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
      : 'untitled';
    const filename = `${entity.id}-${sanitizedTitle}.yaml`;
    const filePath = path.join(entityDir, filename);

    try {
      // Convert entity to YAML
      const yamlContent = stringifyYAML(entity);

      // Write file
      await writeFile(filePath, yamlContent, 'utf-8');

      return filePath;
    } catch (error: unknown) {
      throw new FileSystemError(
        error instanceof Error ? error.message : 'Failed to create entity file',
        filePath,
        { entityType, entityId: entity.id }
      );
    }
  }
}
