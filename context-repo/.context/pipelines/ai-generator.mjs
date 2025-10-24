#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Call Ollama API
async function callOllama(endpoint, model, systemPrompt, userPrompt) {
  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}\n\nUser request: ${userPrompt}\n\nJSON output:`,
        stream: false,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ok: true,
      content: data.response,
      usage: {
        prompt_tokens: data.prompt_eval_count || 0,
        completion_tokens: data.eval_count || 0,
        total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

// Call Azure OpenAI API
async function callAzureOpenAI(endpoint, apiKey, model, systemPrompt, userPrompt) {
  try {
    const response = await fetch(`${endpoint}/openai/deployments/${model}/chat/completions?api-version=2023-05-15`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      ok: true,
      content: data.choices[0].message.content,
      usage: {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

// Main generation function
async function generateEntity(provider, endpoint, model, apiKey, entityType, userPrompt) {
  const systemPrompt = SYSTEM_PROMPTS[entityType] || SYSTEM_PROMPTS.feature;
  
  let result;
  if (provider === 'ollama') {
    result = await callOllama(endpoint, model, systemPrompt, userPrompt);
  } else if (provider === 'azure-openai') {
    result = await callAzureOpenAI(endpoint, apiKey, model, systemPrompt, userPrompt);
  } else {
    return { ok: false, error: 'Unknown provider' };
  }

  if (!result.ok) {
    return result;
  }

  // Parse JSON response
  try {
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

  generateEntity(provider, endpoint, model, apiKey, entityType, userPrompt)
    .then(result => {
      console.log(JSON.stringify(result));
      process.exit(result.ok ? 0 : 1);
    })
    .catch(error => {
      console.log(JSON.stringify({ ok: false, error: error.message }));
      process.exit(1);
    });
}

export { generateEntity, SYSTEM_PROMPTS };
