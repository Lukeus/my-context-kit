#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

// Get entity IDs from command line arguments
const entityIds = process.argv.slice(2);

if (entityIds.length === 0) {
  console.error(JSON.stringify({ 
    error: 'No entity IDs provided. Usage: node generate.mjs <entity-id1> [entity-id2] ...' 
  }));
  process.exit(1);
}

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

const supportedPromptTypes = new Set(['feature', 'userstory', 'spec']);

// Helper function to get all YAML files
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
    // Directory doesn't exist - skip it
  }
  return files;
}

// Load all entities
const entities = {};

try {
  for (const [entityType, dirName] of Object.entries(entityDirs)) {
    const entityDir = join(REPO_ROOT, 'contexts', dirName);
    const files = getAllYamlFiles(entityDir);
    
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        const data = parseYAML(content);
        
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
  
  const templateFiles = ['feature.hbs', 'userstory.hbs', 'spec.hbs'];
  
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
      
      // Write to file
      const outputFile = join(outputDir, `${entityId}.md`);
      writeFileSync(outputFile, prompt, 'utf8');
      
      generated.push({
        id: entityId,
        type: entity._type,
        outputFile,
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
