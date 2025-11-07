// build-embeddings.mjs
// Deterministic embeddings pipeline per FR-039 / FR-040.
// Scans configured corpus directories, generates sorted text chunks, writes
// normalized embeddings input + metadata, and emits deterministic checksum.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { withErrorHandling, ErrorCodes, assert } from './lib/error-utils.mjs';
import { getAllYamlFiles } from './lib/file-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, 'generated', 'embeddings');
const DEFAULT_METADATA_FILE = join(DEFAULT_OUTPUT_DIR, 'metadata.json');
const DEFAULT_VECTOR_FILE = join(DEFAULT_OUTPUT_DIR, 'corpus.jsonl');

const DEFAULT_OPTIONS = {
  corpusDirs: [
    join(REPO_ROOT, 'contexts', 'features'),
    join(REPO_ROOT, 'contexts', 'tasks'),
    join(REPO_ROOT, 'contexts', 'services'),
    join(REPO_ROOT, 'contexts', 'specs'),
    join(REPO_ROOT, 'contexts', 'governance')
  ],
  outputDir: DEFAULT_OUTPUT_DIR,
  metadataFile: DEFAULT_METADATA_FILE,
  vectorFile: DEFAULT_VECTOR_FILE,
  chunkSize: 512,
  chunkOverlap: 32,
  includeYaml: true,
  includeMarkdown: true
};

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function getCorpusFiles(options) {
  const files = new Set();
  const exts = [];
  if (options.includeYaml) exts.push('.yaml', '.yml');
  if (options.includeMarkdown) exts.push('.md');

  for (const dir of options.corpusDirs) {
    const absolute = resolve(dir);
    if (!existsSync(absolute)) continue;
    if (statSync(absolute).isDirectory()) {
      const dirFiles = getAllYamlFiles(absolute, { recursive: true, extensions: exts, filter: file => exts.some(ext => file.endsWith(ext)) });
      dirFiles.forEach(file => files.add(file));
      if (options.includeMarkdown) {
        // Fallback manual search for markdown since getAllYamlFiles defaults to yaml extensions.
        const stack = [absolute];
        while (stack.length) {
          const current = stack.pop();
          if (!current) continue;
          const entries = readdirSync(current, { withFileTypes: true });
          for (const entry of entries) {
            const full = join(current, entry.name);
            if (entry.isDirectory()) {
              stack.push(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
              files.add(full);
            }
          }
        }
      }
    }
  }

  return Array.from(files).sort();
}

function normalizeText(content) {
  // Remove trailing spaces, collapse multiple blank lines to two, and ensure
  // consistent newline format for deterministic hashing.
  const unix = content.replace(/\r\n?/g, '\n');
  return unix
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function extractChunks(filePath, options) {
  const content = readFileSync(filePath, 'utf8');
  const normalized = normalizeText(content);
  const tokens = normalized.split(/\s+/);
  const chunks = [];
  const window = options.chunkSize;
  const stride = Math.max(1, window - options.chunkOverlap);

  for (let start = 0; start < tokens.length; start += stride) {
    const slice = tokens.slice(start, start + window);
    if (!slice.length) continue;
    chunks.push({
      text: slice.join(' '),
      tokenCount: slice.length,
      span: { start, end: Math.min(tokens.length, start + window) }
    });
  }

  if (!chunks.length && normalized.trim().length > 0) {
    chunks.push({ text: normalized, tokenCount: tokens.length, span: { start: 0, end: tokens.length } });
  }

  return { chunks, original: normalized };
}

function createCorpusEntries(files, options) {
  const entries = [];
  for (const file of files) {
    const relativePath = relative(REPO_ROOT, file).replace(/\\/g, '/');
    const { chunks } = extractChunks(file, options);
    chunks.forEach((chunk, index) => {
      entries.push({
        id: `${relativePath}#${index}`,
        file: relativePath,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        span: chunk.span
      });
    });
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

// TODO(T028A-SidecarIntegration): Replace local chunk token concatenation with sidecar embeddings call once service contract finalized.

function writeCorpus(entries, options) {
  ensureDir(options.outputDir);
  const lines = entries.map(entry => JSON.stringify(entry));
  writeFileSync(options.vectorFile, lines.join('\n') + '\n', 'utf8');
  return options.vectorFile;
}

function buildMetadata(entries, checksum, options, vectorPath) {
  const sourceFiles = Array.from(new Set(entries.map(entry => entry.file))).sort();
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
    totalEntries: entries.length,
    totalFiles: sourceFiles.length,
    sourceFiles,
    vectorFile: relative(REPO_ROOT, vectorPath).replace(/\\/g, '/'),
    options: {
      corpusDirs: options.corpusDirs.map(dir => relative(REPO_ROOT, dir).replace(/\\/g, '/')),
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      includeYaml: options.includeYaml,
      includeMarkdown: options.includeMarkdown
    },
    checksum
  };
}

function checksumEntries(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(entry.id);
    hash.update('\n');
    hash.update(entry.text);
    hash.update('\n');
  }
  return hash.digest('hex');
}

async function buildEmbeddingsInternal(options = {}) {
  const effectiveOptions = { ...DEFAULT_OPTIONS, ...options };
  assert(Array.isArray(effectiveOptions.corpusDirs) && effectiveOptions.corpusDirs.length > 0, 'No corpus directories configured', ErrorCodes.VALIDATION_ERROR, { options: effectiveOptions });

  const files = getCorpusFiles(effectiveOptions);
  assert(files.length > 0, 'No corpus files discovered; embeddings build cannot proceed', ErrorCodes.FILE_NOT_FOUND, { corpusDirs: effectiveOptions.corpusDirs });

  const entries = createCorpusEntries(files, effectiveOptions);
  assert(entries.length > 0, 'No embeddings entries generated; verify corpus configuration', ErrorCodes.VALIDATION_ERROR, { files });

  const checksum = checksumEntries(entries);
  const vectorPath = writeCorpus(entries, effectiveOptions);
  const metadata = buildMetadata(entries, checksum, effectiveOptions, vectorPath);
  writeFileSync(effectiveOptions.metadataFile, JSON.stringify(metadata, null, 2));

  return {
    checksum,
    fileCount: new Set(entries.map(entry => entry.file)).size,
    entryCount: entries.length,
    vectorPath,
    metadataPath: effectiveOptions.metadataFile
  };
}

export const buildEmbeddings = async (options = {}) => buildEmbeddingsInternal(options);

const run = withErrorHandling(async () => {
  const result = await buildEmbeddingsInternal();
  console.log(JSON.stringify({ event: 'embeddings.pipeline.completed', ...result }));
  return result;
});

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(() => process.exit(1));
}
