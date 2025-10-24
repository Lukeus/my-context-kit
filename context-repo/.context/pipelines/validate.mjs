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
const constitutionErrors = [];
const complianceErrors = [];
let constitution = null;

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

function resolvePath(obj, path) {
  if (!path) return undefined;
  const segments = path.split('.');
  let current = obj;

  for (const segment of segments) {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (segment === 'length') {
      if (Array.isArray(current) || typeof current === 'string') {
        current = current.length;
      } else {
        return undefined;
      }
      continue;
    }

    const indexMatch = segment.match(/(.+)\[(\d+)\]$/);
    if (indexMatch) {
      const [, prop, indexStr] = indexMatch;
      const index = Number.parseInt(indexStr, 10);
      current = current?.[prop];
      if (!Array.isArray(current) || Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    current = current?.[segment];
  }

  return current;
}

function evaluateCondition(value, operator, expected) {
  switch (operator) {
    case 'exists': {
      if (value === undefined || value === null) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return true;
    }
    case 'equals':
      return value === expected;
    case 'notEquals':
      return value !== expected;
    case 'includes':
      if (Array.isArray(value)) return value.includes(expected);
      if (typeof value === 'string') return value.includes(expected);
      return false;
    case 'matches':
      if (typeof value !== 'string') return false;
      try {
        const regex = new RegExp(expected);
        return regex.test(value);
      } catch (error) {
        return false;
      }
    case 'greaterThan': {
      let comparable = value;
      if (Array.isArray(comparable) || typeof comparable === 'string') {
        comparable = comparable.length;
      }
      if (typeof comparable !== 'number') {
        const parsed = Number(comparable);
        if (Number.isNaN(parsed)) return false;
        comparable = parsed;
      }
      return comparable > expected;
    }
    case 'lessThan': {
      let comparable = value;
      if (Array.isArray(comparable) || typeof comparable === 'string') {
        comparable = comparable.length;
      }
      if (typeof comparable !== 'number') {
        const parsed = Number(comparable);
        if (Number.isNaN(parsed)) return false;
        comparable = parsed;
      }
      return comparable < expected;
    }
    default:
      return false;
  }
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

// Load constitution
const constitutionPath = join(REPO_ROOT, 'contexts', 'governance', 'constitution.yaml');
try {
  const constitutionSchema = ajv.getSchema('constitution');
  if (!constitutionSchema) {
    constitutionErrors.push({
      file: constitutionPath,
      error: 'Constitution schema not registered'
    });
  } else {
    const constitutionContent = readFileSync(constitutionPath, 'utf8');
    const constitutionData = parseYAML(constitutionContent);
    const valid = constitutionSchema(constitutionData);
    if (!valid) {
      constitutionErrors.push({
        file: constitutionPath,
        errors: constitutionSchema.errors
      });
    } else {
      constitution = constitutionData;
    }
  }
} catch (error) {
  constitutionErrors.push({
    file: constitutionPath,
    error: `Failed to load constitution: ${error.message}`
  });
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

let evaluatedRuleCount = 0;

if (
  constitution &&
  constitution.compliance &&
  Array.isArray(constitution.compliance.rules)
) {
  const supportedTargets = new Set([
    'feature',
    'userstory',
    'spec',
    'task',
    'service',
    'package'
  ]);

  for (const rule of constitution.compliance.rules) {
    if (!rule || !Array.isArray(rule.targets) || !Array.isArray(rule.conditions)) {
      continue;
    }

    const matchedEntities = Object.values(entities).filter(entity =>
      rule.targets.some(target => supportedTargets.has(target) && target === entity._type)
    );

    if (matchedEntities.length === 0) {
      continue;
    }

    evaluatedRuleCount += 1;

    for (const entity of matchedEntities) {
      for (const condition of rule.conditions) {
        const path = condition.path;
        const operator = condition.operator;
        const expected = condition.value;
        const value = resolvePath(entity, path);
        const passed = evaluateCondition(value, operator, expected);

        if (!passed) {
          complianceErrors.push({
            ruleId: rule.id,
            entity: entity.id,
            entityType: entity._type,
            path,
            severity: rule.severity || 'medium',
            message:
              condition.message ||
              rule.description ||
              `Entity ${entity.id} failed rule ${rule.id}`
          });
        }
      }
    }
  }
}

// Output results
if (
  errors.length === 0 &&
  crossRefErrors.length === 0 &&
  constitutionErrors.length === 0 &&
  complianceErrors.length === 0
) {
  console.log(JSON.stringify({ 
    ok: true, 
    message: 'All validations passed',
    stats: {
      totalEntities: Object.keys(entities).length,
      byType: Object.values(entities).reduce((acc, e) => {
        acc[e._type] = (acc[e._type] || 0) + 1;
        return acc;
      }, {})
    },
    constitution: constitution
      ? {
          id: constitution.id,
          version: constitution.version,
          checksum: constitution.checksum,
          evaluatedRules: evaluatedRuleCount
        }
      : null
  }));
  process.exit(0);
} else {
  console.log(JSON.stringify({ 
    ok: false, 
    schemaErrors: errors,
    crossReferenceErrors: crossRefErrors,
    constitutionErrors,
    complianceErrors,
    totalErrors:
      errors.length +
      crossRefErrors.length +
      constitutionErrors.length +
      complianceErrors.length
  }));
  process.exit(1);
}
