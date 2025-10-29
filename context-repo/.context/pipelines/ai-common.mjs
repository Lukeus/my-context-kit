import fetch from 'node-fetch';
import httpsProxyAgentPkg from 'https-proxy-agent';
const { HttpsProxyAgent } = httpsProxyAgentPkg;

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

function applyAgent(options) {
  if (agent) {
    return { ...options, agent };
  }
  return options;
}

const AZURE_API_VERSION = '2024-12-01-preview';
const azureLogprobSupportCache = new Map();

function normaliseUsage(tokens) {
  if (!tokens) {
    return null;
  }

  const promptTokens = tokens.prompt_tokens ?? tokens.promptTokens ?? tokens.prompt_eval_count ?? 0;
  const completionTokens = tokens.completion_tokens ?? tokens.completionTokens ?? tokens.eval_count ?? 0;
  const totalTokens = tokens.total_tokens ?? tokens.totalTokens ?? promptTokens + completionTokens;

  return {
    promptTokens,
    completionTokens,
    totalTokens
  };
}

function getAzureLogprobKey(endpoint, model) {
  return `${endpoint}::${model}`;
}

function shouldRequestAzureLogprobs(endpoint, model) {
  const key = getAzureLogprobKey(endpoint, model);
  if (!azureLogprobSupportCache.has(key)) {
    return true;
  }
  return azureLogprobSupportCache.get(key);
}

function markAzureLogprobSupport(endpoint, model, supported) {
  azureLogprobSupportCache.set(getAzureLogprobKey(endpoint, model), supported);
}

function extractAzureErrorMessage(rawText) {
  if (!rawText) {
    return '';
  }
  try {
    const parsed = JSON.parse(rawText);
    return parsed?.error?.message || parsed?.message || rawText;
  } catch {
    return rawText;
  }
}

function isAzureLogprobUnsupported(message) {
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  return lower.includes('logprobs') && (lower.includes('unsupported parameter') || lower.includes('not supported'));
}

async function azureChatRequest({
  endpoint,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  responseFormat,
  temperature,
  maxTokens
}, includeLogprobs, { stream }) {
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

  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }

  if (includeLogprobs) {
    body.logprobs = true;
    body.top_logprobs = 3;
  }

  const baseUrl = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=${AZURE_API_VERSION}`;
  const url = stream ? `${baseUrl}&stream=true` : baseUrl;

  const response = await fetch(url, applyAgent({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(body)
  }));

  if (!response.ok) {
    const rawText = await response.text().catch(() => response.statusText);
    const message = extractAzureErrorMessage(rawText);
    if (response.status === 400 && includeLogprobs && isAzureLogprobUnsupported(message)) {
      markAzureLogprobSupport(endpoint, model, false);
      return { retry: true };
    }
    throw new Error(`Azure OpenAI error (${response.status}): ${message}`);
  }

  markAzureLogprobSupport(endpoint, model, includeLogprobs);
  return { response, includeLogprobs };
}

function mapLogprobEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const topLogprobs = Array.isArray(entry.top_logprobs)
    ? entry.top_logprobs.map(item => ({
        token: item.token ?? '',
        logprob: typeof item.logprob === 'number' ? item.logprob : Number.NEGATIVE_INFINITY,
        prob: typeof item.logprob === 'number' ? Math.exp(item.logprob) : 0
      }))
    : [];

  const logprob = typeof entry.logprob === 'number' ? entry.logprob : Number.NEGATIVE_INFINITY;

  return {
    token: entry.token ?? '',
    logprob,
    prob: Math.exp(logprob),
    topLogprobs
  };
}

function createAzureOpenAIStream({ endpoint, apiKey, model, systemPrompt, userPrompt, responseFormat, temperature, maxTokens }) {
  const metadata = {
    logprobs: null,
    usage: null
  };

  const iterator = (async function* () {
    const params = {
      endpoint,
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      responseFormat,
      temperature,
      maxTokens
    };

    let includeLogprobs = shouldRequestAzureLogprobs(endpoint, model);
    let requestResult;

    // Retry once without logprobs if the model does not support it
    // TODO: Persist capability detection between runs via configuration if needed
    while (true) {
      requestResult = await azureChatRequest(params, includeLogprobs, { stream: true });
      if (requestResult?.retry) {
        includeLogprobs = false;
        continue;
      }
      break;
    }

    const { response, includeLogprobs: logprobEnabled } = requestResult;
    if (logprobEnabled) {
      metadata.logprobs = [];
    }

    const decoder = new TextDecoder();
    let buffer = '';

    const extractTextDelta = choice => {
      try {
        const delta = choice.delta || choice.message?.delta || {};
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
      } catch {
        return '';
      }
    };

    const collectLogprobs = choice => {
      if (!Array.isArray(metadata.logprobs)) {
        return;
      }
      const candidates = [];
      if (Array.isArray(choice.logprobs?.content)) {
        candidates.push(...choice.logprobs.content);
      }
      if (Array.isArray(choice.delta?.logprobs?.content)) {
        candidates.push(...choice.delta.logprobs.content);
      }

      for (const entry of candidates) {
        const mapped = mapLogprobEntry(entry);
        if (mapped) {
          metadata.logprobs.push(mapped);
        }
      }
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
            const choice = (obj.choices && obj.choices[0]) || {};
            collectLogprobs(choice);
            if (obj.usage) {
              metadata.usage = normaliseUsage(obj.usage);
            }
            const text = extractTextDelta(choice);
            if (text) {
              yield text;
            }
          } catch {
            // ignore line parse errors
          }
        }
      }
    }
  })();

  return Object.assign(iterator, { metadata });
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

export function callProviderStream({
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
    return createOllamaStream({ endpoint, model, systemPrompt, userPrompt, responseFormat });
  }
  if (provider === 'azure-openai') {
    return createAzureOpenAIStream({ endpoint, apiKey, model, systemPrompt, userPrompt, temperature, maxTokens, responseFormat });
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
      usage: normaliseUsage({
        prompt_eval_count: data.prompt_eval_count || 0,
        eval_count: data.eval_count || 0
      }),
      logprobs: null // Ollama doesn't support logprobs by default
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

function createOllamaStream({ endpoint, model, systemPrompt, userPrompt, responseFormat }) {
  const metadata = {
    logprobs: null,
    usage: null
  };

  const iterator = (async function* () {
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
          if (obj.done && obj.total_duration) {
            metadata.usage = normaliseUsage({
              prompt_eval_count: obj.prompt_eval_count || 0,
              eval_count: obj.eval_count || 0
            });
          }
        } catch {
          // ignore malformed line
        }
      }
    }
    const tail = buffer.trim();
    if (tail) {
      try {
        const obj = JSON.parse(tail);
        if (typeof obj.response === 'string' && obj.response) {
          yield obj.response;
        }
        if (obj.done && obj.total_duration) {
          metadata.usage = {
            prompt_tokens: obj.prompt_eval_count || 0,
            completion_tokens: obj.eval_count || 0,
            total_tokens: (obj.prompt_eval_count || 0) + (obj.eval_count || 0)
          };
        }
      } catch {
        // ignore
      }
    }
  })();

  return Object.assign(iterator, { metadata });
}

async function callAzureOpenAI({ endpoint, apiKey, model, systemPrompt, userPrompt, responseFormat, temperature, maxTokens }) {
  try {
    const params = {
      endpoint,
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      responseFormat,
      temperature,
      maxTokens
    };

    let includeLogprobs = shouldRequestAzureLogprobs(endpoint, model);
    let requestResult;

    while (true) {
      requestResult = await azureChatRequest(params, includeLogprobs, { stream: false });
      if (requestResult?.retry) {
        includeLogprobs = false;
        continue;
      }
      break;
    }

    const { response, includeLogprobs: logprobEnabled } = requestResult;
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

    // Process logprobs if available
    const logprobsContent = logprobEnabled && Array.isArray(choice.logprobs?.content)
      ? choice.logprobs.content
      : [];
    const tokenProbs = logprobsContent
      .map(mapLogprobEntry)
      .filter(Boolean);

    return {
      ok: true,
      content: contentText,
      usage: normaliseUsage(data.usage),
      logprobs: tokenProbs.length > 0 ? tokenProbs : null
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
