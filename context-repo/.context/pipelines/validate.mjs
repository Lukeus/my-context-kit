#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse as parseYAML } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// Load all schemas
const schemaDir = join(REPO_ROOT, '.context/schemas');
const schemas = {};

try {
  const schemaFiles = readdirSync(schemaDir).filter(f => f.endsWith('.schema.json'));
  
  for (const file of schemaFiles) {
    const schemaPath = join(schemaDir, file);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const entityType = file.replace('.schema.json', '');
    schemas[entityType] = schema;
    ajv.addSchema(schema, entityType);
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: `Failed to load schemas: ${error.message}` }));
  process.exit(1);
}

// Entity type to directory mapping
const entityDirs = {
  feature: 'features',
  userstory: 'userstories',
  spec: 'specs',
  task: 'tasks',
  service: 'services',
  package: 'packages'
};

// Validate all YAML files
const errors = [];
const entities = {}; // Store all entities by ID for cross-reference validation

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

// Load and validate entities
for (const [entityType, dirName] of Object.entries(entityDirs)) {
  const entityDir = join(REPO_ROOT, 'contexts', dirName);
  const files = getAllYamlFiles(entityDir);
  
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf8');
      const data = parseYAML(content);
      
      // Validate against schema
      const validate = ajv.getSchema(entityType);
      if (!validate) {
        errors.push({
          file,
          error: `No schema found for entity type: ${entityType}`
        });
        continue;
      }
      
      const valid = validate(data);
      if (!valid) {
        errors.push({
          file,
          entity: data.id || 'unknown',
          errors: validate.errors
        });
      } else {
        // Store entity for cross-reference validation
        if (data.id) {
          entities[data.id] = { ...data, _type: entityType, _file: file };
        }
      }
    } catch (error) {
      errors.push({
        file,
        error: `Failed to parse YAML: ${error.message}`
      });
    }
  }
}

// Cross-reference validation
const crossRefErrors = [];

for (const [id, entity] of Object.entries(entities)) {
  // Check feature references
  if (entity.userStories) {
    for (const storyId of entity.userStories) {
      if (!entities[storyId]) {
        crossRefErrors.push({
          entity: id,
          field: 'userStories',
          reference: storyId,
          error: 'Referenced user story does not exist'
        });
      }
    }
  }
  
  if (entity.specs) {
    for (const specId of entity.specs) {
      if (!entities[specId]) {
        crossRefErrors.push({
          entity: id,
          field: 'specs',
          reference: specId,
          error: 'Referenced spec does not exist'
        });
      }
    }
  }
  
  if (entity.tasks) {
    for (const taskId of entity.tasks) {
      if (!entities[taskId]) {
        crossRefErrors.push({
          entity: id,
          field: 'tasks',
          reference: taskId,
          error: 'Referenced task does not exist'
        });
      }
    }
  }
  
  // Check user story feature reference
  if (entity._type === 'userstory' && entity.feature) {
    if (!entities[entity.feature]) {
      crossRefErrors.push({
        entity: id,
        field: 'feature',
        reference: entity.feature,
        error: 'Referenced feature does not exist'
      });
    }
  }
}

// Output results
if (errors.length === 0 && crossRefErrors.length === 0) {
  console.log(JSON.stringify({ 
    ok: true, 
    message: 'All validations passed',
    stats: {
      totalEntities: Object.keys(entities).length,
      byType: Object.values(entities).reduce((acc, e) => {
        acc[e._type] = (acc[e._type] || 0) + 1;
        return acc;
      }, {})
    }
  }));
  process.exit(0);
} else {
  console.log(JSON.stringify({ 
    ok: false, 
    schemaErrors: errors,
    crossReferenceErrors: crossRefErrors,
    totalErrors: errors.length + crossRefErrors.length
  }));
  process.exit(1);
}
