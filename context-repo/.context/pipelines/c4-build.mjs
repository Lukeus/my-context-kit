#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { getAllYamlFiles, loadYamlFile } from './lib/file-utils.mjs';
import { withErrorHandling, PipelineError, ErrorCodes } from './lib/error-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// Load C4 schema
const c4Schema = JSON.parse(
  readFileSync(join(REPO_ROOT, '.context/schemas/c4.schema.json'), 'utf8')
);
ajv.addSchema(c4Schema, 'c4');

// Entity type to directory mapping
const entityDirs = {
  feature: 'features',
  userstory: 'userstories',
  spec: 'specs',
  service: 'services',
  package: 'packages'
};

/**
 * Load all entities from context repository
 */
function loadAllEntities() {
  const entities = {};
  
  for (const [entityType, dirName] of Object.entries(entityDirs)) {
    const entityDir = join(REPO_ROOT, 'contexts', dirName);
    const files = getAllYamlFiles(entityDir);
    
    for (const file of files) {
      try {
        const data = loadYamlFile(file);
        if (data && data.id) {
          entities[data.id] = { ...data, _type: entityType, _file: file };
        }
      } catch (error) {
        console.warn(`Warning: Failed to load ${file}: ${error.message}`);
      }
    }
  }
  
  return entities;
}

/**
 * Find all Markdown files with C4 diagrams
 */
function findC4Diagrams() {
  const c4Dir = join(REPO_ROOT, 'c4');
  if (!existsSync(c4Dir)) {
    return [];
  }
  
  return getAllYamlFiles(c4Dir, {
    extensions: ['.md', '.markdown'],
    recursive: true
  });
}

/**
 * Extract Mermaid blocks with C4 header from Markdown
 */
function extractC4Blocks(content, filePath) {
  const blocks = [];
  const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  let index = 0;
  
  while ((match = mermaidRegex.exec(content)) !== null) {
    const blockContent = match[1];
    
    // Check for C4 header directive
    const headerMatch = blockContent.match(/%%\s*c4:\s*([^\n]+)/);
    if (!headerMatch) {
      continue;
    }
    
    // Parse header attributes
    const headerStr = headerMatch[1];
    const attrs = {};
    
    // Extract key=value pairs
    const attrRegex = /(\w+)=([^,\s]+|(?:\[[^\]]*\]))/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(headerStr)) !== null) {
      const [, key, value] = attrMatch;
      
      // Handle arrays like [SPEC-123,SPEC-124]
      if (value.startsWith('[')) {
        attrs[key] = value.slice(1, -1).split(',').map(v => v.trim());
      } else {
        attrs[key] = value;
      }
    }
    
    blocks.push({
      index: index++,
      content: blockContent,
      attributes: attrs,
      file: filePath
    });
  }
  
  return blocks;
}

/**
 * Parse C4 nodes from Mermaid flowchart
 * Expected format: name :: kind :: tech
 */
function parseNodes(mermaidContent) {
  const nodes = [];
  const nodeRegex = /(\w+)\[([^\]]+)\]/g;
  let match;
  
  while ((match = nodeRegex.exec(mermaidContent)) !== null) {
    const [, id, label] = match;
    
    // Skip subgraph definitions
    if (id === 'subgraph') continue;
    
    // Parse label: "name :: kind :: tech"
    const parts = label.split('::').map(s => s.trim());
    
    if (parts.length >= 2) {
      nodes.push({
        id,
        name: parts[0],
        kind: parts[1],
        tech: parts[2] || undefined
      });
    } else {
      // Fallback: treat as simple node
      nodes.push({
        id,
        name: label,
        kind: 'external', // Default for unparseable nodes
        tech: undefined
      });
    }
  }
  
  return nodes;
}

/**
 * Parse relationships from Mermaid flowchart
 */
function parseRelationships(mermaidContent, nodes) {
  const relationships = [];
  
  // Match: A -->|label| B or A --> B
  const edgeRegex = /(\w+)\s*-->\s*(?:\|([^|]+)\|)?\s*(\w+)/g;
  let match;
  
  const nodeIds = new Set(nodes.map(n => n.id));
  
  while ((match = edgeRegex.exec(mermaidContent)) !== null) {
    const [, source, label, target] = match;
    
    // Only include edges where both nodes exist
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      continue;
    }
    
    const relationship = {
      source,
      target,
      description: label?.trim() || 'depends on'
    };
    
    // Extract REST paths
    if (label) {
      const restMatch = label.match(/REST\s+(\/[^\s]+)/i);
      if (restMatch) {
        relationship.restPath = restMatch[1];
      }
      
      // Extract emit/consume events
      const emitMatch = label.match(/emit\s+([a-z0-9._-]+)/i);
      if (emitMatch) {
        relationship.emit = [emitMatch[1]];
      }
      
      const consumeMatch = label.match(/consume\s+([a-z0-9._-]+)/i);
      if (consumeMatch) {
        relationship.consume = [consumeMatch[1]];
      }
    }
    
    relationships.push(relationship);
  }
  
  return relationships;
}

/**
 * Validate C4 diagram against existing entities
 */
function validateDiagram(diagram, entities, errors) {
  const { nodes, attributes, file } = diagram;
  
  // Validate feature reference
  if (attributes.feature) {
    if (!entities[attributes.feature]) {
      errors.push({
        file,
        field: 'feature',
        reference: attributes.feature,
        error: `Referenced feature ${attributes.feature} does not exist`
      });
    }
  }
  
  // Validate spec references
  if (attributes.specs) {
    for (const specId of attributes.specs) {
      if (!entities[specId]) {
        errors.push({
          file,
          field: 'specs',
          reference: specId,
          error: `Referenced spec ${specId} does not exist`
        });
      }
    }
  }
  
  // Validate story references
  if (attributes.stories) {
    for (const storyId of attributes.stories) {
      if (!entities[storyId]) {
        errors.push({
          file,
          field: 'stories',
          reference: storyId,
          error: `Referenced user story ${storyId} does not exist`
        });
      }
    }
  }
  
  // Validate service nodes (containers ending with -svc or matching service IDs)
  for (const node of nodes) {
    if (node.kind === 'external') {
      // External nodes don't need to exist in contexts
      continue;
    }
    
    // Check if node name matches a service ID
    const serviceName = node.name.toLowerCase().replace(/\s+/g, '-');
    const potentialIds = [
      serviceName,
      `svc-${serviceName}`,
      serviceName.replace('-svc', ''),
      node.id
    ];
    
    // If it ends with -svc or is kind=container, validate it exists
    if (node.kind === 'container' && (serviceName.endsWith('-svc') || serviceName.includes('service'))) {
      const found = potentialIds.some(id => entities[id]);
      
      if (!found) {
        errors.push({
          file,
          node: node.name,
          error: `Service node "${node.name}" (kind=${node.kind}) does not match any service in contexts/services/`,
          hint: `Expected one of: ${potentialIds.join(', ')}`
        });
      }
    }
  }
}

/**
 * Build C4 projection from Mermaid block
 */
function buildProjection(block) {
  const { content, attributes, file, index } = block;
  
  const nodes = parseNodes(content);
  const relationships = parseRelationships(content, nodes);
  
  const projection = {
    system: attributes.system || 'Unknown',
    level: attributes.level || 'C2',
    nodes,
    relationships,
    sourceDiagram: relative(REPO_ROOT, file)
  };
  
  // Add optional fields
  if (attributes.feature) projection.feature = attributes.feature;
  if (attributes.specs) projection.specs = attributes.specs;
  if (attributes.stories) projection.stories = attributes.stories;
  
  return projection;
}

/**
 * Main build function
 */
async function build() {
  const entities = loadAllEntities();
  const diagrams = findC4Diagrams();
  
  console.error(`Found ${diagrams.length} C4 diagram files`);
  
  const errors = [];
  const projections = [];
  const stats = {
    totalDiagrams: 0,
    totalBlocks: 0,
    totalNodes: 0,
    totalRelationships: 0,
    nodesByKind: {},
    validationErrors: 0
  };
  
  for (const diagramFile of diagrams) {
    try {
      const content = readFileSync(diagramFile, 'utf8');
      const blocks = extractC4Blocks(content, diagramFile);
      
      if (blocks.length === 0) {
        console.warn(`Warning: No C4 blocks found in ${diagramFile}`);
        continue;
      }
      
      stats.totalDiagrams++;
      
      for (const block of blocks) {
        stats.totalBlocks++;
        
        const projection = buildProjection(block);
        
        // Validate projection against schema
        const validate = ajv.getSchema('c4');
        const valid = validate(projection);
        
        if (!valid) {
          errors.push({
            file: diagramFile,
            block: block.index,
            schemaErrors: validate.errors
          });
          stats.validationErrors++;
          continue;
        }
        
        // Cross-validate against entities
        validateDiagram({ ...block, nodes: projection.nodes }, entities, errors);
        
        // Update stats
        stats.totalNodes += projection.nodes.length;
        stats.totalRelationships += projection.relationships.length;
        
        for (const node of projection.nodes) {
          stats.nodesByKind[node.kind] = (stats.nodesByKind[node.kind] || 0) + 1;
        }
        
        projections.push(projection);
        
        // Write individual projection
        const outDir = join(REPO_ROOT, 'c4', 'out');
        mkdirSync(outDir, { recursive: true });
        
        const relPath = relative(join(REPO_ROOT, 'c4'), diagramFile);
        const baseName = relPath.replace(/\.(md|markdown)$/i, '');
        const outFile = join(outDir, `${baseName}.${block.index}.json`);
        
        mkdirSync(dirname(outFile), { recursive: true });
        writeFileSync(outFile, JSON.stringify(projection, null, 2));
      }
    } catch (error) {
      errors.push({
        file: diagramFile,
        error: `Failed to process diagram: ${error.message}`
      });
      stats.validationErrors++;
    }
  }
  
  // Output results
  const result = {
    ok: errors.length === 0,
    stats,
    projections,
    errors: errors.length > 0 ? errors : undefined
  };
  
  console.log(JSON.stringify(result, null, 2));
  
  return result;
}

// Run with error handling
withErrorHandling(build)()
  .then((result) => process.exit(result.ok ? 0 : 1))
  .catch(() => process.exit(1));
