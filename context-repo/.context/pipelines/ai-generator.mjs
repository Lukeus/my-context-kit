#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../..');

// Configure proxy agent from environment variables
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 
                 process.env.https_proxy || process.env.http_proxy;
const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

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
    const url = `${endpoint}/api/generate`;
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}\n\nUser request: ${userPrompt}\n\nJSON output:`,
        stream: false,
        format: 'json'
      })
    };
    
    // Add agent if proxy is configured
    if (agent) {
      options.agent = agent;
    }
    
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
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
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.cause?.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to Ollama at ${endpoint}. Is Ollama running?`;
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = `Network error: ${error.message}. Check if Ollama is accessible.`;
    }
    return {
      ok: false,
      error: errorMessage
    };
  }
}

// Call Azure OpenAI API
async function callAzureOpenAI(endpoint, apiKey, model, systemPrompt, userPrompt) {
  try {
    const url = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-12-01-preview`;
    const options = {
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
        temperature: 1.0,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    };
    
    // Add agent if proxy is configured
    if (agent) {
      options.agent = agent;
    }
    
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Azure OpenAI error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    const choice = data.choices && data.choices[0];

    if (!choice) {
      return {
        ok: false,
        error: 'Azure response did not include any choices',
        rawContent: JSON.stringify(data)
      };
    }

    if (choice.finish_reason === 'length') {
      return {
        ok: false,
        error: 'Azure response was truncated (hit max completion token limit). Try increasing the limit or simplifying the prompt.',
        rawContent: JSON.stringify(data)
      };
    }

    if (choice.message?.refusal) {
      return {
        ok: false,
        error: `Azure content filter refusal: ${choice.message.refusal}`,
        rawContent: JSON.stringify(data)
      };
    }

    let contentText = '';

    const extractContentArray = contents =>
      contents
        .filter(part => part?.type === 'text' || !part?.type)
        .map(part => (typeof part === 'string' ? part : part.text || part.content || ''))
        .join('\n')
        .trim();

    if (choice.message?.parsed !== undefined) {
      const parsed = choice.message.parsed;
      if (typeof parsed === 'string') {
        contentText = parsed;
      } else {
        contentText = JSON.stringify(parsed);
      }
    } else if (typeof choice.message?.content === 'string') {
      contentText = choice.message.content;
    } else if (Array.isArray(choice.message?.content)) {
      contentText = extractContentArray(choice.message.content);
    } else if (typeof choice.content === 'string') {
      contentText = choice.content;
    } else if (Array.isArray(choice.content)) {
      contentText = extractContentArray(choice.content);
    }

    if (!contentText && choice.message?.tool_calls?.length) {
      const toolNames = choice.message.tool_calls.map(t => t?.function?.name).filter(Boolean).join(', ');
      return {
        ok: false,
        error: toolNames ? `Azure response requested tool calls (${toolNames}), which is not supported by this workflow.` : 'Azure response only returned tool calls, which is not supported by this workflow.',
        rawContent: JSON.stringify(data)
      };
    }

    if (!contentText) {
      return {
        ok: false,
        error: 'Azure response did not include any text content',
        rawContent: JSON.stringify(data)
      };
    }

    return {
      ok: true,
      content: contentText,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens ?? 0,
        completion_tokens: data.usage?.completion_tokens ?? 0,
        total_tokens: data.usage?.total_tokens ?? 0
      }
    };
  } catch (error) {
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.cause?.code === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to Azure OpenAI at ${endpoint}. Check endpoint URL.`;
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMessage = `Network error: ${error.message}`;
    }
    return {
      ok: false,
      error: errorMessage
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
