#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import { loadYamlFile, getAllYamlFiles } from './lib/file-utils.mjs';
import { withErrorHandling, PipelineError, ErrorCodes, assert } from './lib/error-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

Handlebars.registerHelper('padTaskId', index => `T${String((index ?? 0) + 1).padStart(3, '0')}`);
Handlebars.registerHelper('increment', value => (Number.isFinite(value) ? value + 1 : value));
Handlebars.registerHelper('hasItems', value => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
});

// Get entity IDs from command line arguments
const entityIds = process.argv.slice(2);

assert(
  entityIds.length > 0,
  'No entity IDs provided. Usage: node generate.mjs <entity-id1> [entity-id2] ...',
  ErrorCodes.VALIDATION_ERROR
);

// Entity type to directory mapping
const entityDirs = {
  governance: 'governance',
  feature: 'features',
  userstory: 'userstories',
  spec: 'specs',
  task: 'tasks',
  service: 'services',
  package: 'packages'
};

const supportedPromptTypes = new Set(['feature', 'userstory', 'spec', 'governance', 'task']);


// Load all entities
const entities = {};

try {
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
        console.error(`Error parsing ${file}: ${error.message}`);
      }
    }
  }
  
  // Load templates
  const templateDir = join(REPO_ROOT, '.context/templates/prompts');
  const templates = {};
  
  const templateFiles = ['feature.hbs', 'userstory.hbs', 'spec.hbs', 'governance.hbs', 'task.hbs', 'checklist.hbs'];
  
  for (const templateFile of templateFiles) {
    try {
      const templatePath = join(templateDir, templateFile);
      const templateContent = readFileSync(templatePath, 'utf8');
      const templateName = templateFile.replace('.hbs', '');
      templates[templateName] = Handlebars.compile(templateContent);
    } catch (error) {
      console.error(`Error loading template ${templateFile}: ${error.message}`);
    }
  }
  
  // Ensure output directory exists
  const outputDir = join(REPO_ROOT, 'generated/prompts');
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
  
  // Generate prompts for each entity
  const generated = [];
  const errors = [];
  
  for (const entityId of entityIds) {
    const entity = entities[entityId];
    
    if (!entity) {
      errors.push({
        id: entityId,
        error: 'Entity not found'
      });
      continue;
    }
    
    // Determine template based on entity type
    let templateName = entity._type;
    
    if (!supportedPromptTypes.has(entity._type)) {
      errors.push({
        id: entityId,
        error: `Prompt generation not supported for entity type: ${entity._type}`
      });
      continue;
    }
    
    if (!templates[templateName]) {
      errors.push({
        id: entityId,
        error: `Template not found for type: ${templateName}`
      });
      continue;
    }
    
    try {
      // Add timestamp to entity data
      const entityData = {
        ...entity,
        timestamp: new Date().toISOString()
      };
      
      // Generate prompt from template
      const prompt = templates[templateName](entityData);

      const outputFile = join(outputDir, `${entityId}.md`);
      writeFileSync(outputFile, prompt, 'utf8');

      let checklistFile = null;
      if (templates.checklist) {
        const checklistContent = templates.checklist({
          entity: entityData,
          entityType: entity._type,
          timestamp: entityData.timestamp,
          outputFile
        });
        checklistFile = join(outputDir, `${entityId}.checklist.md`);
        writeFileSync(checklistFile, checklistContent, 'utf8');
      }

      generated.push({
        id: entityId,
        type: entity._type,
        outputFile,
        checklistFile,
        content: prompt
      });
    } catch (error) {
      errors.push({
        id: entityId,
        error: `Failed to generate prompt: ${error.message}`
      });
    }
  }
  
  // Output results
  const result = {
    ok: errors.length === 0,
    generated,
    errors,
    stats: {
      requested: entityIds.length,
      generated: generated.length,
      failed: errors.length
    }
  };
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
  
} catch (error) {
  console.error(JSON.stringify({ 
    error: `Failed to generate prompts: ${error.message}`,
    stack: error.stack
  }));
  process.exit(1);
}
