import { OpenAIEmbeddings } from '@langchain/openai';
import fetch from 'node-fetch';
import process from 'node:process';

// Usage: node scripts/diagnose-embedding.mjs <endpoint> <deployment> <apiKey>
// Example: node scripts/diagnose-embedding.mjs https://fceai.azure-api.net text-embedding-3-small sk-...

const [endpoint, deployment, apiKey] = process.argv.slice(2);
if (!endpoint || !deployment || !apiKey) {
  console.error('Usage: node scripts/diagnose-embedding.mjs <endpoint> <deployment> <apiKey>');
  process.exit(1);
}

(async () => {
  try {
    const baseURL = `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}`;
    console.log('Probing embedding endpoint:');
    console.log('  baseURL=', baseURL);

    const start = Date.now();

    // Direct HTTP probe for /embeddings or /openai/deployments/{deployment}/embeddings
    const url = `${baseURL}/embeddings?api-version=2024-12-01-preview`;
    const body = JSON.stringify({ input: ['hello world'], model: deployment });

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body
    });

    const duration = Date.now() - start;
    console.log(`Status: ${resp.status} (${duration}ms)`);
    const text = await resp.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
      console.log('Response JSON:', JSON.stringify(parsed, null, 2));
    } catch (err) {
      console.log('Response text:', text);
    }

    if (!resp.ok) process.exit(2);
    console.log('Embedding probe succeeded, now probing completions/chat endpoint on same host...');

    // Probe completions/chat endpoint using the same deployment as a deployment-based chat (if supported)
    const chatUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=2024-12-01-preview`;
    const chatBody = JSON.stringify({
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 10
    });

    const chatStart = Date.now();
    const chatResp = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: chatBody
    });

    const chatDuration = Date.now() - chatStart;
    console.log(`Chat Status: ${chatResp.status} (${chatDuration}ms)`);
    const chatText = await chatResp.text();
    try {
      console.log('Chat Response JSON:', JSON.stringify(JSON.parse(chatText), null, 2));
    } catch (err) {
      console.log('Chat Response text:', chatText);
    }

    if (!chatResp.ok) process.exit(4);
    process.exit(0);
  } catch (err) {
    console.error('Probe failed:', err instanceof Error ? err.stack : String(err));
    process.exit(3);
  }
})();
