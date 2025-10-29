import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ReadContextFileOptions {
  repoPath: string;
  path: string;
  encoding?: BufferEncoding;
  maxBytes?: number;
}

export interface ReadContextFileResult {
  absolutePath: string;
  repoRelativePath: string;
  content: string;
  encoding: BufferEncoding;
  size: number;
  lastModified: string;
  truncated: boolean;
}

const DEFAULT_MAX_BYTES = 64 * 1024; // 64 KB
const DEFAULT_ENCODING: BufferEncoding = 'utf-8';

export async function readContextFile(options: ReadContextFileOptions): Promise<ReadContextFileResult> {
  if (!options.repoPath) {
    throw new Error('Repository path is required to read context files.');
  }
  if (!options.path || typeof options.path !== 'string') {
    throw new Error('A relative file path is required to read context files.');
  }

  const trimmedPath = options.path.replace(/^\/+/, '');
  if (trimmedPath.length === 0) {
    throw new Error('File path cannot be empty.');
  }

  const repoRoot = path.resolve(options.repoPath);
  const resolvedPath = path.resolve(repoRoot, trimmedPath);

  if (!resolvedPath.startsWith(repoRoot)) {
    throw new Error('Requested file is outside the context repository.');
  }

  const stats = await fs.stat(resolvedPath);
  if (!stats.isFile()) {
    throw new Error('Requested path is not a file.');
  }

  const encoding = options.encoding ?? DEFAULT_ENCODING;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let buffer = await fs.readFile(resolvedPath);
  let truncated = false;
  if (buffer.length > maxBytes) {
    buffer = buffer.subarray(0, maxBytes);
    truncated = true;
  }

  let content = buffer.toString(encoding);
  if (truncated) {
    content += '\n\n---\n[Content truncated for safety. Download the file locally for the full contents.]';
  }

  return {
    absolutePath: resolvedPath,
    repoRelativePath: path.relative(repoRoot, resolvedPath).replace(/\\/g, '/'),
    content,
    encoding,
    size: stats.size,
    lastModified: stats.mtime.toISOString(),
    truncated
  };
}
