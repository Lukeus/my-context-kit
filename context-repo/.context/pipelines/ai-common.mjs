import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

function applyAgent(options) {
  if (agent) {
    return { ...options, agent };
  }
  return options;
}

async function* callAzureOpenAIStream({ endpoint, apiKey, model, systemPrompt, userPrompt, responseFormat, temperature, maxTokens }) {
  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_completion_tokens: maxTokens
  };
  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }
  if (typeof temperature === 'number' && temperature === 1) {
    body.temperature = temperature;
  }
  const url = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-12-01-preview&stream=true`;
  const response = await fetch(url, applyAgent({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(body)
  }));
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Azure OpenAI error (${response.status}): ${errorText}`);
  }
  const decoder = new TextDecoder();
  let buffer = '';
  const extractTextDelta = (obj) => {
    try {
      const choice = (obj.choices && obj.choices[0]) || {};
      const delta = choice.delta || choice.message?.delta || {};
      // text may be in various shapes
      if (typeof delta.content === 'string') return delta.content;
      if (Array.isArray(delta.content)) {
        return delta.content
          .map(part => (typeof part === 'string' ? part : (part.text || part.content || '')))
          .join('');
      }
      if (typeof choice.content === 'string') return choice.content;
      if (Array.isArray(choice.content)) {
        return choice.content
          .map(part => (typeof part === 'string' ? part : (part.text || part.content || '')))
          .join('');
      }
      return '';
    } catch { return ''; }
  };
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let sepIndex;
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, sepIndex).trim();
      buffer = buffer.slice(sepIndex + 2);
      if (!block) continue;
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!line.toLowerCase().startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const obj = JSON.parse(data);
          const text = extractTextDelta(obj);
          if (text) {
            yield text;
          }
        } catch {
          // ignore line parse errors
        }
      }
    }
  }
}

export async function callProvider({
  provider,
  endpoint,
  model,
  apiKey = '',
  systemPrompt = '',
  userPrompt = '',
  responseFormat = 'text',
  temperature = 1.0,
  maxTokens = 4000
}) {
  if (!provider) {
    return { ok: false, error: 'Provider is required' };
  }

  if (!endpoint) {
    return { ok: false, error: 'Endpoint is required' };
  }

  if (!model) {
    return { ok: false, error: 'Model is required' };
  }

  if (!userPrompt.trim() && !systemPrompt.trim()) {
    return { ok: false, error: 'Prompt content is required' };
  }

  if (provider === 'ollama') {
    return callOllama({ endpoint, model, systemPrompt, userPrompt, responseFormat });
  }

  if (provider === 'azure-openai') {
    if (!apiKey) {
      return { ok: false, error: 'Azure OpenAI requires an API key' };
    }

    const azureOpts = {
      endpoint,
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      responseFormat,
      maxTokens
    };

    if (typeof temperature === 'number' && temperature === 1) {
      azureOpts.temperature = temperature;
    }

    return callAzureOpenAI(azureOpts);
  }

  return { ok: false, error: `Unknown provider: ${provider}` };
}

export async function* callProviderStream({
  provider,
  endpoint,
  model,
  apiKey = '',
  systemPrompt = '',
  userPrompt = '',
  temperature = 1.0,
  maxTokens = 4000,
  responseFormat = 'text'
}) {
  if (provider === 'ollama') {
    yield* callOllamaStream({ endpoint, model, systemPrompt, userPrompt, responseFormat });
    return;
  }
  if (provider === 'azure-openai') {
    yield* callAzureOpenAIStream({ endpoint, apiKey, model, systemPrompt, userPrompt, temperature, maxTokens, responseFormat });
    return;
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function callOllama({ endpoint, model, systemPrompt, userPrompt, responseFormat }) {
  try {
    const body = {
      model,
      prompt: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt,
      stream: false
    };

    if (responseFormat === 'json') {
      body.format = 'json';
    }

    const response = await fetch(`${endpoint}/api/generate`, applyAgent({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }));

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

async function* callOllamaStream({ endpoint, model, systemPrompt, userPrompt, responseFormat }) {
  const body = {
    model,
    prompt: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt,
    stream: true
  };
  if (responseFormat === 'json') {
    body.format = 'json';
  }
  const response = await fetch(`${endpoint}/api/generate`, applyAgent({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Ollama API error (${response.status}): ${errorText}`);
  }
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (typeof obj.response === 'string' && obj.response) {
          yield obj.response;
        }
      } catch {
        // ignore malformed line
      }
    }
  }
  // flush any remaining
  const tail = buffer.trim();
  if (tail) {
    try {
      const obj = JSON.parse(tail);
      if (typeof obj.response === 'string' && obj.response) {
        yield obj.response;
      }
    } catch {
      // ignore
    }
  }
}

async function callAzureOpenAI({ endpoint, apiKey, model, systemPrompt, userPrompt, responseFormat, temperature, maxTokens }) {
  try {
    const body = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: maxTokens
    };

    if (responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    if (typeof temperature === 'number' && temperature === 1) {
      body.temperature = temperature;
    }

    const response = await fetch(`${endpoint}/openai/deployments/${model}/chat/completions?api-version=2024-12-01-preview`, applyAgent({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(body)
    }));

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
