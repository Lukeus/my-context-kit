#!/usr/bin/env node

/**
 * Spec-to-Entity Pipeline
 * 
 * Converts SDD specifications into YAML entities (Feature, UserStory, Task)
 * Integrates specs with the existing context repository structure
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get repository root (two levels up from pipelines/)
const REPO_ROOT = path.resolve(__dirname, '../..');

/**
 * Convert a specification to YAML entities
 * 
 * @param {string} specPath - Path to spec.md file
 * @param {object} options - { createFeature?: boolean, createStories?: boolean, createTasks?: boolean }
 * @returns {object} - { ok: boolean, entities: { features: [], stories: [], tasks: [] }, created: string[] }
 */
async function convertSpecToEntities(specPath, options = {}) {
  try {
    const {
      createFeature = true,
      createStories = true,
      createTasks = false, // Tasks come from tasks.md, not spec.md
    } = options;

    const fullSpecPath = path.join(REPO_ROOT, specPath);
    
    // 1. Read specification
    const specContent = await fs.readFile(fullSpecPath, 'utf-8');
    
    // 2. Parse spec metadata and content
    const specInfo = parseSpecification(specContent);
    
    if (!specInfo.number) {
      return {
        ok: false,
        error: 'Specification number not found in spec.md',
      };
    }

    const createdFiles = [];
    const entities = {
      features: [],
      stories: [],
      tasks: [],
    };

    // 3. Create Feature entity if requested
    if (createFeature) {
      const featureId = `FEAT-${specInfo.number}`;
      const featureEntity = {
        id: featureId,
        title: specInfo.title || 'Untitled Feature',
        domain: inferDomain(specInfo.title, specInfo.description),
        status: 'proposed',
        owners: [],
        description: specInfo.description || specInfo.overview || '',
        userStories: [], // Will be populated if stories are created
        specs: [`SPEC-${specInfo.number}`],
        tasks: [],
        acceptance: specInfo.acceptanceCriteria || [],
        constraints: specInfo.constraints || [],
        outOfScope: specInfo.outOfScope || [],
        prompts: {
          instructions: specInfo.instructions || [],
          contextRefs: [],
        },
      };

      const featurePath = path.join(REPO_ROOT, 'contexts', 'features', `${featureId}.yaml`);
      await fs.mkdir(path.dirname(featurePath), { recursive: true });
      await fs.writeFile(featurePath, stringifyYAML(featureEntity), 'utf-8');
      
      createdFiles.push(`contexts/features/${featureId}.yaml`);
      entities.features.push(featureEntity);
    }

    // 4. Create UserStory entities if requested
    if (createStories && specInfo.userStories.length > 0) {
      let storyIndex = 1;
      for (const story of specInfo.userStories) {
        const storyId = `US-${specInfo.number}${String(storyIndex).padStart(2, '0')}`;
        const storyEntity = {
          id: storyId,
          feature: `FEAT-${specInfo.number}`,
          asA: story.asA || 'user',
          iWant: story.iWant || story.description || '',
          soThat: story.soThat || '',
          acceptanceCriteria: story.acceptance || [],
          impacts: {
            services: [],
            packages: [],
          },
        };

        const storyPath = path.join(REPO_ROOT, 'contexts', 'userstories', `${storyId}.yaml`);
        await fs.mkdir(path.dirname(storyPath), { recursive: true });
        await fs.writeFile(storyPath, stringifyYAML(storyEntity), 'utf-8');
        
        createdFiles.push(`contexts/userstories/${storyId}.yaml`);
        entities.stories.push(storyEntity);
        storyIndex++;
      }

      // Update feature with story IDs
      if (createFeature && entities.features.length > 0) {
        entities.features[0].userStories = entities.stories.map(s => s.id);
        const featureId = `FEAT-${specInfo.number}`;
        const featurePath = path.join(REPO_ROOT, 'contexts', 'features', `${featureId}.yaml`);
        await fs.writeFile(featurePath, stringifyYAML(entities.features[0]), 'utf-8');
      }
    }

    return {
      ok: true,
      entities,
      created: createdFiles,
      message: `Created ${createdFiles.length} entities from spec`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Convert tasks.md to Task entities
 * 
 * @param {string} tasksPath - Path to tasks.md file
 * @returns {object} - { ok: boolean, tasks: [], created: string[] }
 */
async function convertTasksToEntities(tasksPath) {
  try {
    const fullTasksPath = path.join(REPO_ROOT, tasksPath);
    const tasksContent = await fs.readFile(fullTasksPath, 'utf-8');
    
    // Parse tasks from tasks.md
    const tasksInfo = extractTasksFromMarkdown(tasksContent);
    
    const createdFiles = [];
    const taskEntities = [];

    for (const task of tasksInfo.tasks) {
      const taskEntity = {
        id: task.id,
        title: task.description,
        status: 'todo',
        related: {
          feature: tasksInfo.featureId || '',
          spec: tasksInfo.specId || '',
        },
        owner: '',
        steps: task.steps || [],
        doneCriteria: task.acceptance || [],
      };

      const taskPath = path.join(REPO_ROOT, 'contexts', 'tasks', `${task.id}.yaml`);
      await fs.mkdir(path.dirname(taskPath), { recursive: true });
      await fs.writeFile(taskPath, stringifyYAML(taskEntity), 'utf-8');
      
      createdFiles.push(`contexts/tasks/${task.id}.yaml`);
      taskEntities.push(taskEntity);
    }

    return {
      ok: true,
      tasks: taskEntities,
      created: createdFiles,
      message: `Created ${createdFiles.length} task entities`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

// ===== Helper Functions =====

/**
 * Parse specification markdown file
 */
function parseSpecification(content) {
  const info = {
    number: '',
    title: '',
    description: '',
    overview: '',
    userStories: [],
    acceptanceCriteria: [],
    constraints: [],
    outOfScope: [],
    instructions: [],
  };
  
  // Extract spec number
  const numberMatch = content.match(/\*\*Spec Number\*\*:\s*(\d{3})/);
  if (numberMatch) {
    info.number = numberMatch[1];
  }
  
  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(?:Feature Specification:\s*)?(.+)$/m);
  if (titleMatch) {
    info.title = titleMatch[1].trim();
  }
  
  // Extract overview
  const overviewSection = content.match(/##\s+Overview\s*\n([\s\S]*?)(?=\n##|$)/);
  if (overviewSection) {
    info.overview = overviewSection[1].trim().replace(/\[NEEDS CLARIFICATION.*?\]/g, '').trim();
  }

  // Extract user stories
  const storiesSection = content.match(/##\s+User Stories\s*\n([\s\S]*?)(?=\n##|$)/);
  if (storiesSection) {
    const storyLines = storiesSection[1].split('\n').filter(line => line.trim().startsWith('-'));
    info.userStories = storyLines.map(line => {
      const text = line.replace(/^-\s*/, '').trim();
      
      // Parse "As a X, I want Y, so that Z" format
      const asMatch = text.match(/As (?:a|an)\s+([^,]+),\s*I want\s+([^,]+)(?:,\s*so that\s+(.+))?/i);
      if (asMatch) {
        return {
          asA: asMatch[1].trim(),
          iWant: asMatch[2].trim(),
          soThat: asMatch[3]?.trim() || '',
        };
      }
      
      return { description: text };
    });
  }
  
  // Extract acceptance criteria
  const acceptanceSection = content.match(/##\s+Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|$)/);
  if (acceptanceSection) {
    info.acceptanceCriteria = acceptanceSection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => !line.includes('[NEEDS CLARIFICATION]'));
  }

  // Extract constraints
  const constraintsSection = content.match(/##\s+Constraints\s*(?:&|and)?\s*Assumptions\s*\n([\s\S]*?)(?=\n##|$)/);
  if (constraintsSection) {
    info.constraints = constraintsSection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => !line.includes('[NEEDS CLARIFICATION]'));
  }

  // Extract out of scope
  const outOfScopeSection = content.match(/##\s+Out of Scope\s*\n([\s\S]*?)(?=\n##|$)/);
  if (outOfScopeSection) {
    info.outOfScope = outOfScopeSection[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(line => !line.includes('[NEEDS CLARIFICATION]'));
  }
  
  return info;
}

/**
 * Extract tasks from tasks.md markdown
 */
function extractTasksFromMarkdown(content) {
  const info = {
    specId: '',
    featureId: '',
    tasks: [],
  };

  // Extract spec number from header
  const specMatch = content.match(/\*\*Spec\*\*:\s*(\d{3})/);
  if (specMatch) {
    info.specId = `SPEC-${specMatch[1]}`;
    info.featureId = `FEAT-${specMatch[1]}`;
  }

  // Extract task list items
  const taskPattern = /^\d+\.\s+\*\*([^*]+)\*\*(?:\s+\[P\])?\s*:\s*(.+)$/gm;
  let match;
  
  while ((match = taskPattern.exec(content)) !== null) {
    const taskId = match[1].trim();
    const description = match[2].trim();
    
    info.tasks.push({
      id: taskId,
      description,
      parallel: match[0].includes('[P]'),
      steps: [],
      acceptance: [],
    });
  }

  return info;
}

/**
 * Infer domain from title and description
 */
function inferDomain(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  
  const domainKeywords = {
    auth: ['auth', 'login', 'oauth', 'sso', 'authentication', 'authorization'],
    api: ['api', 'endpoint', 'rest', 'graphql', 'service'],
    ui: ['ui', 'component', 'interface', 'frontend', 'view', 'page'],
    data: ['data', 'database', 'storage', 'model', 'schema'],
    infra: ['infrastructure', 'deployment', 'ci/cd', 'pipeline', 'build'],
    security: ['security', 'encryption', 'vulnerability', 'audit'],
    performance: ['performance', 'optimization', 'caching', 'speed'],
  };

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return domain;
    }
  }

  return 'general';
}

/**
 * Simple YAML stringification (basic implementation)
 */
function stringifyYAML(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        yaml += `${spaces}${key}: []\n`;
      } else if (typeof value[0] === 'string') {
        yaml += `${spaces}${key}:\n`;
        value.forEach(item => {
          yaml += `${spaces}  - "${item.replace(/"/g, '\\"')}"\n`;
        });
      } else {
        yaml += `${spaces}${key}:\n`;
        value.forEach(item => {
          yaml += `${spaces}  -\n`;
          yaml += stringifyYAML(item, indent + 2);
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      yaml += `${spaces}${key}:\n`;
      yaml += stringifyYAML(value, indent + 1);
    } else if (typeof value === 'string') {
      // Escape special characters and use quotes if needed
      const needsQuotes = value.includes(':') || value.includes('#') || value.includes('\n');
      if (needsQuotes) {
        yaml += `${spaces}${key}: "${value.replace(/"/g, '\\"')}"\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

// ===== CLI Interface =====

async function main() {
  const [, , command, ...args] = process.argv;
  
  if (!command) {
    console.error('Usage: node spec-entity.mjs <command> [args]');
    console.error('Commands:');
    console.error('  spec <specPath>     - Convert spec.md to entities');
    console.error('  tasks <tasksPath>   - Convert tasks.md to task entities');
    process.exit(1);
  }
  
  let result;
  
  switch (command) {
    case 'spec':
      result = await convertSpecToEntities(args[0]);
      break;
    case 'tasks':
      result = await convertTasksToEntities(args[0]);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
  
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

export { convertSpecToEntities, convertTasksToEntities };
