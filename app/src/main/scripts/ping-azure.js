#!/usr/bin/env node
// Lightweight ping script for Azure OpenAI deployments
// Usage: node ping-azure.js <endpoint> <model> <apiKey>
const https = require('https');
const { URL } = require('url');

async function run() {
  const [,, endpoint, model, apiKey] = process.argv;
  if (!endpoint || !model) {
    console.error(JSON.stringify({ ok: false, error: 'endpoint and model required' }));
    process.exit(2);
  }

  const uri = `${endpoint.replace(/\/$/, '')}/openai/deployments/${model}/chat/completions?api-version=2024-02-15-preview`;
  const url = new URL(uri);
  const payload = JSON.stringify({ messages: [{ role: 'user', content: 'Ping' }], max_tokens: 1 });

  const opts = {
    method: 'POST',
    hostname: url.hostname,
    path: url.pathname + url.search,
    port: url.port || 443,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'api-key': apiKey || ''
    }
  };

  const start = Date.now();
  const req = https.request(opts, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      const duration = Date.now() - start;
      const out = { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: body.slice(0, 2000), durationMs: duration };
      console.log(JSON.stringify(out));
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    const duration = Date.now() - start;
    console.error(JSON.stringify({ ok: false, error: err.message, durationMs: duration }));
    process.exit(3);
  });

  req.write(payload);
  req.end();
}

run();
