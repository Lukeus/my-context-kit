import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readContextFile } from '../../../src/main/services/tools/readContextFile';

const SUFFIX = 'context-read-';

let repoDir: string;

beforeEach(async () => {
  repoDir = await mkdtemp(path.join(os.tmpdir(), SUFFIX));
});

afterEach(async () => {
  if (repoDir) {
    await rm(repoDir, { recursive: true, force: true });
  }
});

describe('readContextFile', () => {
  it('reads file content with metadata', async () => {
    const targetPath = path.join(repoDir, 'docs', 'spec.md');
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, '# Spec\nHello', { encoding: 'utf-8', flag: 'w' });

    const result = await readContextFile({ repoPath: repoDir, path: 'docs/spec.md' });

    expect(result.repoRelativePath).toBe('docs/spec.md');
    expect(result.size).toBeGreaterThan(0);
    expect(result.content).toContain('# Spec');
    expect(result.encoding).toBe('utf-8');
    expect(result.truncated).toBe(false);
  });

  it('truncates content that exceeds the max byte limit', async () => {
    const targetPath = path.join(repoDir, 'logs', 'long.txt');
    const longContent = 'x'.repeat(1024);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, longContent, { encoding: 'utf-8', flag: 'w' });

    const result = await readContextFile({ repoPath: repoDir, path: 'logs/long.txt', maxBytes: 64 });

    expect(result.truncated).toBe(true);
    expect(result.content).toContain('Content truncated for safety');
    expect(result.content.length).toBeGreaterThan(64);
  });

  it('rejects attempts to read outside the repository root', async () => {
    await expect(readContextFile({ repoPath: repoDir, path: '../outside.txt' })).rejects.toThrow(
      'Requested file is outside the context repository.'
    );
  });
});
