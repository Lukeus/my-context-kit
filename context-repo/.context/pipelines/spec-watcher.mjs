#!/usr/bin/env node

/**
 * Spec File Watcher with Impact Analysis
 * 
 * Watches specs/ directory for changes and flags related entities as stale
 * Integrates with existing impact analysis pipeline
 */

import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * Parse spec file to extract related entity IDs
 */
function parseSpecForEntities(content) {
  const entities = {
    features: [],
    userStories: [],
    tasks: [],
    specs: [],
  };

  // Extract spec number
  const specNumberMatch = content.match(/\*\*Spec Number\*\*:\s*(\d{3})/);
  if (specNumberMatch) {
    entities.specs.push(`SPEC-${specNumberMatch[1]}`);
    entities.features.push(`FEAT-${specNumberMatch[1]}`);
  }

  // Extract user story references (US-XXX format)
  const userStoryMatches = content.matchAll(/US-(\d+)/g);
  for (const match of userStoryMatches) {
    entities.userStories.push(`US-${match[1]}`);
  }

  // Extract task references (T-XXXX format)
  const taskMatches = content.matchAll(/T-(\d+)/g);
  for (const match of taskMatches) {
    entities.tasks.push(`T-${match[1]}`);
  }

  return entities;
}

/**
 * Analyze impact of spec change
 */
async function analyzeSpecImpact(specPath) {
  try {
    const content = await fs.readFile(specPath, 'utf-8');
    const entities = parseSpecForEntities(content);
    
    // Get spec file path relative to repo root
    const relativeSpecPath = path.relative(REPO_ROOT, specPath);
    
    // Extract spec directory name
    const specDirMatch = relativeSpecPath.match(/specs[/\\](\d{3}-[^/\\]+)/);
    const specDir = specDirMatch ? specDirMatch[1] : null;

    return {
      ok: true,
      specPath: relativeSpecPath,
      specDir,
      relatedEntities: entities,
      staleItems: [
        ...entities.features,
        ...entities.userStories,
        ...entities.tasks,
      ],
      timestamp: new Date().toISOString(),
      message: `Spec changed: ${relativeSpecPath}. ${entities.features.length + entities.userStories.length + entities.tasks.length} entities may be stale.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      specPath,
    };
  }
}

/**
 * Mark entities as stale in their YAML files
 */
async function markEntitiesAsStale(entityIds, reason) {
  const results = [];

  for (const entityId of entityIds) {
    try {
      // Determine entity type and path
      let entityPath;
      let entityType;

      if (entityId.startsWith('FEAT-')) {
        entityType = 'feature';
        entityPath = path.join(REPO_ROOT, 'contexts', 'features', `${entityId}.yaml`);
      } else if (entityId.startsWith('US-')) {
        entityType = 'userstory';
        entityPath = path.join(REPO_ROOT, 'contexts', 'userstories', `${entityId}.yaml`);
      } else if (entityId.startsWith('T-')) {
        entityType = 'task';
        entityPath = path.join(REPO_ROOT, 'contexts', 'tasks', `${entityId}.yaml`);
      } else {
        continue;
      }

      // Check if entity file exists
      try {
        await fs.access(entityPath);
      } catch {
        // Entity file doesn't exist yet, skip
        continue;
      }

      // Read entity file
      let content = await fs.readFile(entityPath, 'utf-8');

      // Check if already has stale status
      if (content.includes('status: needs-review') || content.includes('stale: true')) {
        results.push({ entityId, action: 'already-stale' });
        continue;
      }

      // Add stale marker and reason
      const now = new Date().toISOString();
      const staleComment = `# STALE: Spec changed on ${now}\n# Reason: ${reason}\n`;

      // Insert at the beginning of file
      content = staleComment + content;

      // Update status field if it exists
      if (content.includes('status:')) {
        content = content.replace(/status:\s*\w+/, 'status: needs-review');
      } else {
        // Add status field after id
        content = content.replace(/(id:\s*.+\n)/, `$1status: needs-review\n`);
      }

      // Write updated content
      await fs.writeFile(entityPath, content, 'utf-8');

      results.push({ entityId, action: 'marked-stale' });
    } catch (error) {
      results.push({ entityId, action: 'error', error: error.message });
    }
  }

  return results;
}

/**
 * Watch specs directory for changes
 */
function watchSpecs(callback) {
  const specsDir = path.join(REPO_ROOT, 'specs');

  const watcher = chokidar.watch(specsDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 3,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher
    .on('add', async (filePath) => {
      if (path.basename(filePath) === 'spec.md') {
        const result = await analyzeSpecImpact(filePath);
        callback({ event: 'add', result });
      }
    })
    .on('change', async (filePath) => {
      if (path.basename(filePath) === 'spec.md') {
        const result = await analyzeSpecImpact(filePath);
        
        // Mark related entities as stale
        if (result.ok && result.staleItems.length > 0) {
          const markResults = await markEntitiesAsStale(
            result.staleItems,
            `Specification ${result.specDir} was modified`
          );
          result.markResults = markResults;
        }
        
        callback({ event: 'change', result });
      }
    })
    .on('unlink', (filePath) => {
      if (path.basename(filePath) === 'spec.md') {
        callback({
          event: 'delete',
          result: {
            ok: true,
            specPath: path.relative(REPO_ROOT, filePath),
            message: 'Spec deleted',
          },
        });
      }
    })
    .on('error', (error) => {
      callback({
        event: 'error',
        result: {
          ok: false,
          error: error.message,
        },
      });
    });

  return watcher;
}

/**
 * Get impact report for a specific spec
 */
async function getSpecImpact(specPath) {
  const fullPath = path.join(REPO_ROOT, specPath);
  return await analyzeSpecImpact(fullPath);
}

// ===== CLI Interface =====

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command) {
    console.error('Usage: node spec-watcher.mjs <command> [args]');
    console.error('Commands:');
    console.error('  watch           - Watch specs directory for changes');
    console.error('  impact <path>   - Get impact report for a spec');
    console.error('  mark <entityId> - Mark entity as stale');
    process.exit(1);
  }

  let result;

  switch (command) {
    case 'watch':
      console.log('Watching specs directory for changes...');
      watchSpecs((data) => {
        console.log(JSON.stringify(data, null, 2));
      });
      // Keep process alive
      await new Promise(() => {});
      break;

    case 'impact':
      result = await getSpecImpact(args[0]);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.ok ? 0 : 1);
      break;

    case 'mark':
      const entityIds = args;
      result = await markEntitiesAsStale(entityIds, 'Manual marking via CLI');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

export { watchSpecs, analyzeSpecImpact, markEntitiesAsStale, getSpecImpact };
