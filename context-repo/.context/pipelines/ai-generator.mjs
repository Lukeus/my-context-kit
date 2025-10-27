#!/usr/bin/env node

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callProvider } from './ai-common.mjs';
import { withErrorHandling, assert, ErrorCodes } from './lib/error-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

// System prompts for each entity type
const SYSTEM_PROMPTS = {
  feature: `You are an expert software architect. Generate a feature specification in JSON format.
Output MUST be valid JSON with these exact fields:
{
  "title": "Feature title",
  "domain": "domain name (auth, ui, data, api)",
  "objective": "Clear goal of the feature",
  "acceptance": ["criterion 1", "criterion 2", "criterion 3"],
  "constraints": ["constraint 1", "constraint 2"]
}
Be specific and actionable. Domain should be one of: auth, ui, data, api, or a clear technical domain.`,

  userstory: `You are a product manager. Generate a user story in JSON format.
Output MUST be valid JSON with these exact fields:
{
  "asA": "user role",
  "iWant": "capability or action",
  "soThat": "benefit or outcome",
  "acceptanceCriteria": ["criterion 1", "criterion 2", "criterion 3"]
}
Follow the "As a... I want... So that..." format. Be user-focused.`,

  task: `You are a tech lead. Generate a development task in JSON format.
Output MUST be valid JSON with these exact fields:
{
  "title": "Task title",
  "description": "Detailed description",
  "steps": ["step 1", "step 2", "step 3"],
  "doneCriteria": ["criterion 1", "criterion 2"]
}
Be specific about implementation steps.`,

  spec: `You are a technical writer. Generate a specification in JSON format.
Output MUST be valid JSON with these exact fields:
{
  "title": "Specification title",
  "type": "technical, api, ui, or data",
  "content": "Detailed markdown content of the spec"
}
Use markdown formatting in content. Be thorough.`
};

// Main generation function
async function generateEntity(provider, endpoint, model, apiKey, entityType, userPrompt) {
  const systemPrompt = SYSTEM_PROMPTS[entityType] || SYSTEM_PROMPTS.feature;
  
  let result;
  const formattedUserPrompt = `User request: ${userPrompt}\n\nJSON output:`;
  result = await callProvider({
    provider,
    endpoint,
    model,
    apiKey,
    systemPrompt,
    userPrompt: formattedUserPrompt,
    responseFormat: 'json',
    temperature: 1.0,
    maxTokens: 2000
  });

  if (!result.ok) {
    return result;
  }

  // Parse JSON response
  try {
    if (!result.content || !result.content.trim()) {
      throw new Error('AI returned an empty response');
    }

    // Try to extract JSON if wrapped in markdown code blocks
    let content = result.content.trim();
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }

    const parsed = JSON.parse(content);
    return {
      ok: true,
      entity: parsed,
      usage: result.usage
    };
  } catch (parseError) {
    return {
      ok: false,
      error: `Failed to parse AI response: ${parseError.message}`,
      rawContent: result.content
    };
  }
}

// CLI interface
if (process.argv[2] === 'generate') {
  const provider = process.argv[3];
  const endpoint = process.argv[4];
  const model = process.argv[5];
  const apiKey = process.argv[6] || '';
  const entityType = process.argv[7];
  const userPrompt = process.argv[8];

  withErrorHandling(async () => {
    const result = await generateEntity(provider, endpoint, model, apiKey, entityType, userPrompt);
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  })();
}

export { generateEntity, SYSTEM_PROMPTS };
