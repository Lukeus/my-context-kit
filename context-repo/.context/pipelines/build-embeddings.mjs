// build-embeddings.mjs
// Deterministic embeddings pipeline per FR-039.
// TODO: Implement vector index construction; currently stub producing checksum of input files.
import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function collectSourceFiles(baseDir) {
  // Placeholder: examine contexts directory
  const contextsDir = join(baseDir, 'contexts');
  try {
    const entries = readdirSync(contextsDir, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => join(contextsDir, e.name));
  } catch {
    return [];
  }
}

function computeChecksum(files) {
  const hash = createHash('sha256');
  for (const f of files) {
    try { hash.update(readFileSync(f)); } catch { /* ignore */ }
  }
  return hash.digest('hex');
}

export async function buildEmbeddings(baseDir = process.cwd()) {
  const files = collectSourceFiles(baseDir);
  const checksum = computeChecksum(files);
  // TODO: produce actual embeddings index artifact
  console.log(JSON.stringify({ event: 'embeddings.pipeline.completed', checksum, fileCount: files.length }));
  return { checksum, fileCount: files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildEmbeddings().catch(e => { console.error('[build-embeddings] FAILED', e); process.exit(1); });
}
