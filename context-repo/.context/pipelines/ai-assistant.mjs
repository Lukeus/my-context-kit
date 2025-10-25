#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYAML } from 'yaml';
import { callProvider, callProviderStream } from './ai-common.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

const ENTITY_DIRS = {
  governance: 'governance',
  feature: 'features',
  userstory: 'userstories',
  spec: 'specs',
  task: 'tasks',
  service: 'services',
  package: 'packages'
};

const DEFAULT_MODE = 'general';

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
    // Directory missing is acceptable
  }
  return files;
}

function loadEntities() {
  const byType = {
    governance: [],
    feature: [],
    userstory: [],
    spec: [],
    task: [],
    service: [],
    package: []
  };

  const byId = {};

  for (const [type, dirName] of Object.entries(ENTITY_DIRS)) {
    const dir = join(REPO_ROOT, 'contexts', dirName);
    const files = getAllYamlFiles(dir);

    for (const file of files) {
      try {
        const raw = readFileSync(file, 'utf8');
        const data = parseYAML(raw);
        if (!data || !data.id) {
          continue;
        }

        const relativePath = file.startsWith(REPO_ROOT)
          ? file.slice(REPO_ROOT.length + 1)
          : file;

        const entity = {
          ...data,
          _type: type,
          _file: relativePath
        };

        byType[type].push(entity);
        byId[entity.id] = entity;
      } catch (error) {
        // Skip malformed files but keep note in summary to surface later
        byType[type].push({
          _type: type,
          id: `${type.toUpperCase()}::PARSE_ERROR`,
          _file: file,
          parseError: error.message
        });
      }
    }
  }

  return { byType, byId };
}

function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/\s+/g, ' ').trim();
}

function mapFeature(entity, entitiesById) {
  const userStories = Array.isArray(entity.userStories) ? entity.userStories : [];
  const specs = Array.isArray(entity.specs) ? entity.specs : [];
  const tasks = Array.isArray(entity.tasks) ? entity.tasks : [];
  const requires = Array.isArray(entity.requires) ? entity.requires : [];

  return {
    id: entity.id,
    title: entity.title || entity.name || '',
    status: entity.status || '',
    domain: entity.domain || '',
    objective: sanitizeString(entity.objective || ''),
    userStories,
    specs,
    tasks,
    requires,
    filePath: entity._file,
    linkedUserStories: userStories.map(id => ({
      id,
      title: entitiesById[id]?.title || entitiesById[id]?.iWant || '',
      status: entitiesById[id]?.status || ''
    })),
    linkedSpecs: specs.map(id => ({
      id,
      title: entitiesById[id]?.title || '',
      type: entitiesById[id]?.type || ''
    })),
    linkedTasks: tasks.map(id => ({
      id,
      title: entitiesById[id]?.title || entitiesById[id]?.description || '',
      status: entitiesById[id]?.status || '',
      owner: entitiesById[id]?.owner || ''
    }))
  };
}

function mapUserStory(entity) {
  return {
    id: entity.id,
    title: entity.title || entity.iWant || '',
    status: entity.status || '',
    asA: entity.asA || '',
    iWant: entity.iWant || '',
    soThat: entity.soThat || '',
    acceptanceCriteria: Array.isArray(entity.acceptanceCriteria) ? entity.acceptanceCriteria : [],
    filePath: entity._file
  };
}

function mapSpec(entity) {
  return {
    id: entity.id,
    title: entity.title || '',
    status: entity.status || '',
    type: entity.type || '',
    related: entity.related || {},
    filePath: entity._file
  };
}

function mapTask(entity) {
  return {
    id: entity.id,
    title: entity.title || entity.description || '',
    status: entity.status || '',
    owner: entity.owner || '',
    doneCriteria: Array.isArray(entity.doneCriteria) ? entity.doneCriteria : [],
    acceptanceCriteria: Array.isArray(entity.acceptanceCriteria) ? entity.acceptanceCriteria : [],
    filePath: entity._file
  };
}

function mapService(entity) {
  return {
    id: entity.id,
    name: entity.name || '',
    status: entity.status || '',
    dependencies: Array.isArray(entity.dependencies) ? entity.dependencies : [],
    consumers: Array.isArray(entity.consumers) ? entity.consumers : [],
    filePath: entity._file
  };
}

function mapPackage(entity) {
  return {
    id: entity.id,
    name: entity.name || '',
    status: entity.status || '',
    uses: entity.uses || {},
    filePath: entity._file
  };
}

function mapGovernance(entity) {
  return {
    id: entity.id,
    name: entity.name || '',
    status: entity.status || '',
    version: entity.version || '',
    principles: Array.isArray(entity.principles)
      ? entity.principles.map(principle => ({
          id: principle.id,
          title: principle.title,
          nonNegotiable: Boolean(principle.nonNegotiable),
          appliesTo: principle.appliesTo || []
        }))
      : [],
    complianceRules: entity.compliance?.rules || [],
    filePath: entity._file
  };
}

function buildSnapshot(entities, focusId = '') {
  const { byType, byId } = entities;

  const features = byType.feature.map(feature => mapFeature(feature, byId));
  const userStories = byType.userstory.map(mapUserStory);
  const specs = byType.spec.map(mapSpec);
  const tasks = byType.task.map(mapTask);
  const services = byType.service.map(mapService);
  const packages = byType.package.map(mapPackage);
  const governance = byType.governance.map(mapGovernance);

  const totals = {
    features: features.length,
    userStories: userStories.length,
    specs: specs.length,
    tasks: tasks.length,
    services: services.length,
    packages: packages.length,
    governance: governance.length
  };

  const parseErrors = Object.values(byType).flat().filter(entity => entity.parseError);

  // Focus entity enrichment (raw YAML + neighbors) if provided
  let focus = null;
  if (focusId && byId[focusId]) {
    try {
      const rawYaml = readFileSync(join(REPO_ROOT, byId[focusId]._file), 'utf8');
      const type = byId[focusId]._type;
      const mapped =
        type === 'feature' ? mapFeature(byId[focusId], byId)
        : type === 'userstory' ? mapUserStory(byId[focusId])
        : type === 'spec' ? mapSpec(byId[focusId])
        : type === 'task' ? mapTask(byId[focusId])
        : type === 'service' ? mapService(byId[focusId])
        : type === 'package' ? mapPackage(byId[focusId])
        : byId[focusId];
      focus = {
        id: focusId,
        type,
        filePath: byId[focusId]._file,
        yaml: rawYaml,
        mapped
      };
    } catch {}
  }

  return {
    generatedAt: new Date().toISOString(),
    totals,
    governance,
    features,
    userStories,
    specs,
    tasks,
    services,
    packages,
    parseErrors,
    focus
  };
}

function extractJSON(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Not direct JSON, try to extract
  }

  // Try to extract JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue to next strategy
    }
  }

  // Try to find JSON object by looking for first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {
      // Continue to next strategy
    }
  }

  // All strategies failed
  throw new Error('Could not extract valid JSON from response');
}

function buildAssistantPrompts({ snapshot, question, mode, focusId }) {
  const modeText = mode || DEFAULT_MODE;
  const focusText = focusId ? `Focus on entity: ${focusId}` : 'No specific focus entity.';
  const snapshotJson = JSON.stringify(snapshot, null, 2);

  const systemPrompt = `You are the Context-Sync assistant. You help teams maintain a spec-driven context repository.
You receive a full repository snapshot as JSON. Use ONLY information from the snapshot when answering.

CRITICAL: You MUST respond with valid JSON only. Do not include any text before or after the JSON object.

Respond using this exact JSON shape:
{
  "answer": "Summarized response string",
  "improvements": [
    {"target": "entity id or area", "suggestion": "specific improvement", "impact": "expected outcome"}
  ],
  "clarifications": ["questions or open points for the team"],
  "followUps": ["recommended next actions"],
  "references": [
    {"type": "feature|userstory|spec|task|service|package|governance", "id": "entity id", "note": "short justification"}
  ],
  "edits": [
    {
      "targetId": "optional entity id",
      "filePath": "relative path under repo root, e.g. contexts/features/FEAT-001.yaml",
      "summary": "short description of the change",
      "updatedContent": "complete YAML document to overwrite the file with"
    }
  ]
}

IMPORTANT RULES:
- Always include all keys (answer, improvements, clarifications, followUps, references, edits) even if arrays are empty
- Output ONLY the JSON object, no additional text or explanation
- Do not invent entities or assumptions beyond the snapshot
- When suggesting edits, use the exact filePath provided in the snapshot metadata
- Only include edits when you are confident in the full YAML replacement

YAML SYNTAX RULES FOR EDITS (CRITICAL - FAILURE TO FOLLOW WILL CAUSE ERRORS):
- NEVER EVER use compact/flow mapping syntax
- NEVER use commas to separate key-value pairs
- Each property MUST be on its own line
- Use proper indentation (2 spaces per level)
- Arrays use "- " prefix for each item

INCORRECT YAML (DO NOT DO THIS):
id: US-002, title: "my title", status: "active"

CORRECT YAML (ALWAYS DO THIS):
id: US-002
title: "my title"
status: "active"

The updatedContent MUST be syntactically valid YAML that can be parsed without errors.`;

  const userPrompt = `Repository snapshot (trimmed to relevant details):

\`\`\`json
${snapshotJson}
\`\`\`

Interaction mode: ${modeText}.
${focusText}

User question: ${question.trim()}`;

  return { systemPrompt, userPrompt };
}

async function assistWithContext(provider, endpoint, model, apiKey, question, options = {}) {
  if (!question || !question.trim()) {
    return { ok: false, error: 'Question is required' };
  }

  const entities = loadEntities();
  const snapshot = buildSnapshot(entities, options.focusId || '');

  const { systemPrompt, userPrompt } = buildAssistantPrompts({
    snapshot,
    question,
    mode: options.mode || DEFAULT_MODE,
    focusId: options.focusId || ''
  });

  const response = await callProvider({
    provider,
    endpoint,
    model,
    apiKey,
    systemPrompt,
    userPrompt,
    responseFormat: 'json',
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 4000
  });

  if (!response.ok) {
    return response;
  }

  try {
    const parsed = extractJSON(response.content);
    
    // Validate YAML in edits
    const validatedEdits = [];
    const clarifications = Array.isArray(parsed.clarifications) ? [...parsed.clarifications] : [];
    
    if (Array.isArray(parsed.edits)) {
      for (const edit of parsed.edits) {
        if (edit.updatedContent) {
          try {
            parseYAML(edit.updatedContent);
            validatedEdits.push(edit);
          } catch (yamlError) {
            clarifications.push(
              `Warning: Proposed edit for ${edit.filePath || 'unknown file'} contains invalid YAML and was removed. Error: ${yamlError.message}`
            );
          }
        } else {
          validatedEdits.push(edit);
        }
      }
    }
    
    const result = {
      ok: true,
      answer: typeof parsed.answer === 'string' ? parsed.answer : '',
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      clarifications,
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
      references: Array.isArray(parsed.references) ? parsed.references : [],
      edits: validatedEdits,
      snapshot,
      usage: response.usage
    };
    return result;
  } catch (error) {
    // Fallback: If the model returned plain text instead of JSON, wrap it in a valid response structure
    console.warn('Model returned non-JSON response. Wrapping in fallback structure.');
    return {
      ok: true,
      answer: response.content || 'No response content received.',
      improvements: [],
      clarifications: [
        'Note: The AI model did not return a structured response. Please try again or use a model that better supports JSON formatting.'
      ],
      followUps: [],
      references: [],
      edits: [],
      snapshot,
      usage: response.usage
    };
  }
}

async function assistWithContextStream(provider, endpoint, model, apiKey, question, options = {}) {
  if (!question || !question.trim()) {
    console.log(JSON.stringify({ type: 'error', ok: false, error: 'Question is required' }));
    return;
  }
  const entities = loadEntities();
  const snapshot = buildSnapshot(entities);
  const { systemPrompt, userPrompt } = buildAssistantPrompts({
    snapshot,
    question,
    mode: options.mode || DEFAULT_MODE,
    focusId: options.focusId || ''
  });

  let contentBuffer = '';
  try {
    for await (const chunk of callProviderStream({
      provider,
      endpoint,
      model,
      apiKey,
      systemPrompt,
      userPrompt,
      responseFormat: 'json',
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4000
    })) {
      contentBuffer += chunk;
      console.log(JSON.stringify({ type: 'delta', data: chunk }));
    }

    // Try to parse final content
    let finalResult;
    try {
      const parsed = extractJSON(contentBuffer);
      
      // Validate YAML in edits
      const validatedEdits = [];
      const clarifications = Array.isArray(parsed.clarifications) ? [...parsed.clarifications] : [];
      
      if (Array.isArray(parsed.edits)) {
        for (const edit of parsed.edits) {
          if (edit.updatedContent) {
            try {
              parseYAML(edit.updatedContent);
              validatedEdits.push(edit);
            } catch (yamlError) {
              clarifications.push(
                `Warning: Proposed edit for ${edit.filePath || 'unknown file'} contains invalid YAML and was removed. Error: ${yamlError.message}`
              );
            }
          } else {
            validatedEdits.push(edit);
          }
        }
      }
      
      finalResult = {
        ok: true,
        answer: typeof parsed.answer === 'string' ? parsed.answer : '',
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        clarifications,
        followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
        references: Array.isArray(parsed.references) ? parsed.references : [],
        edits: validatedEdits,
        snapshot
      };
    } catch (error) {
      finalResult = {
        ok: true,
        answer: contentBuffer || 'No response content received.',
        improvements: [],
        clarifications: [
          'Note: The AI model did not return a structured response. Please try again or use a model that better supports JSON formatting.'
        ],
        followUps: [],
        references: [],
        edits: [],
        snapshot
      };
    }

    console.log(JSON.stringify({ type: 'final', result: finalResult }));
  } catch (error) {
    console.log(JSON.stringify({ type: 'error', ok: false, error: error.message }));
  }
}

if (process.argv.length >= 6) {
  const provider = process.argv[2];
  const endpoint = process.argv[3];
  const model = process.argv[4];
  const apiKey = process.argv[5] || '';
  const question = Buffer.from(process.argv[6], 'base64').toString('utf8');
  const optionsArg = process.argv[7] ? Buffer.from(process.argv[7], 'base64').toString('utf8') : '{}';
  const isStream = process.argv.includes('--stream');

  let options;
  try {
    options = JSON.parse(optionsArg);
  } catch (error) {
    options = { rawOptions: optionsArg };
  }

  if (isStream) {
    assistWithContextStream(provider, endpoint, model, apiKey, question, options)
      .then(() => {
        process.exit(0);
      })
      .catch(error => {
        console.log(JSON.stringify({ type: 'error', ok: false, error: error.message }));
        process.exit(1);
      });
  } else {
    assistWithContext(provider, endpoint, model, apiKey, question, options)
      .then(result => {
        console.log(JSON.stringify(result));
        process.exit(result.ok ? 0 : 1);
      })
      .catch(error => {
        console.log(JSON.stringify({ ok: false, error: error.message }));
        process.exit(1);
      });
  }
}

export { assistWithContext };
