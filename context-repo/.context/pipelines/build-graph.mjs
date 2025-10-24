#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

// Entity type to directory mapping
const entityDirs = {
  feature: 'features',
  userstory: 'userstories',
  spec: 'specs',
  task: 'tasks',
  service: 'services',
  package: 'packages'
};

// Helper function to get all YAML files in a directory
function getAllYamlFiles(dir) {
  const files = [];
  try {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...getAllYamlFiles(fullPath));
      } else if (item.endsWith('.yaml') || item.endsWith('.yml')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - skip it
  }
  return files;
}

// Build the graph
const nodes = [];
const edges = [];
const entities = {};

try {
  // Load all entities
  for (const [entityType, dirName] of Object.entries(entityDirs)) {
    const entityDir = join(REPO_ROOT, 'contexts', dirName);
    const files = getAllYamlFiles(entityDir);
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const data = parseYAML(content);
        
        if (data && data.id) {
          // Create node
          nodes.push({
            id: data.id,
            kind: entityType,
            data: data
          });
          
          // Store for edge creation
          entities[data.id] = { ...data, _type: entityType };
        }
      } catch (error) {
        console.error(`Error parsing ${file}: ${error.message}`);
      }
    }
  }
  
  // Build edges based on relationships
  for (const [id, entity] of Object.entries(entities)) {
    // Feature relationships
    if (entity._type === 'feature') {
      if (entity.userStories) {
        for (const storyId of entity.userStories) {
          edges.push({ from: id, to: storyId, rel: 'has-story' });
        }
      }
      if (entity.specs) {
        for (const specId of entity.specs) {
          edges.push({ from: id, to: specId, rel: 'has-spec' });
        }
      }
      if (entity.tasks) {
        for (const taskId of entity.tasks) {
          edges.push({ from: id, to: taskId, rel: 'has-task' });
        }
      }
      if (entity.requires) {
        for (const depId of entity.requires) {
          edges.push({ from: id, to: depId, rel: 'requires' });
        }
      }
      if (entity.produces) {
        for (const prodId of entity.produces) {
          edges.push({ from: id, to: prodId, rel: 'produces' });
        }
      }
    }
    
    // User story relationships
    if (entity._type === 'userstory') {
      if (entity.feature) {
        edges.push({ from: entity.feature, to: id, rel: 'has-story' });
      }
      if (entity.impacts) {
        if (entity.impacts.services) {
          for (const svcId of entity.impacts.services) {
            edges.push({ from: id, to: svcId, rel: 'impacts' });
          }
        }
        if (entity.impacts.packages) {
          for (const pkgId of entity.impacts.packages) {
            edges.push({ from: id, to: pkgId, rel: 'impacts' });
          }
        }
      }
    }
    
    // Spec relationships
    if (entity._type === 'spec' && entity.related) {
      if (entity.related.features) {
        for (const featId of entity.related.features) {
          edges.push({ from: featId, to: id, rel: 'has-spec' });
        }
      }
      if (entity.related.services) {
        for (const svcId of entity.related.services) {
          edges.push({ from: id, to: svcId, rel: 'relates-to' });
        }
      }
      if (entity.related.packages) {
        for (const pkgId of entity.related.packages) {
          edges.push({ from: id, to: pkgId, rel: 'relates-to' });
        }
      }
    }
    
    // Task relationships
    if (entity._type === 'task' && entity.related) {
      if (entity.related.feature) {
        edges.push({ from: entity.related.feature, to: id, rel: 'has-task' });
      }
      if (entity.related.spec) {
        edges.push({ from: entity.related.spec, to: id, rel: 'implements' });
      }
      if (entity.related.service) {
        edges.push({ from: id, to: entity.related.service, rel: 'modifies' });
      }
    }
    
    // Service relationships
    if (entity._type === 'service') {
      if (entity.dependencies) {
        for (const dep of entity.dependencies) {
          // Extract service ID from version string (e.g., "svc-user-api@^2.0.0" -> "svc-user-api")
          const depId = dep.split('@')[0];
          edges.push({ from: id, to: depId, rel: 'depends-on' });
        }
      }
      if (entity.consumers) {
        for (const consumerId of entity.consumers) {
          edges.push({ from: consumerId, to: id, rel: 'uses' });
        }
      }
    }
    
    // Package relationships
    if (entity._type === 'package' && entity.uses) {
      if (entity.uses.services) {
        for (const svcId of entity.uses.services) {
          edges.push({ from: id, to: svcId, rel: 'uses' });
        }
      }
    }
  }
  
  // Output the graph
  const graph = {
    nodes,
    edges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesByType: nodes.reduce((acc, n) => {
        acc[n.kind] = (acc[n.kind] || 0) + 1;
        return acc;
      }, {}),
      edgesByRel: edges.reduce((acc, e) => {
        acc[e.rel] = (acc[e.rel] || 0) + 1;
        return acc;
      }, {})
    }
  };
  
  console.log(JSON.stringify(graph, null, 2));
  process.exit(0);
  
} catch (error) {
  console.error(JSON.stringify({ 
    error: `Failed to build graph: ${error.message}`,
    stack: error.stack
  }));
  process.exit(1);
}
