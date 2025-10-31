#!/usr/bin/env node
// Lightweight ping script for Azure OpenAI deployments (CommonJS)
// Usage: node ping-azure.cjs <endpoint> <model> <apiKey>
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

  // If HTTPS proxy is configured, use a proxy agent so requests are tunneled
  // through the corporate proxy. This mirrors the child-process env wiring.
  let agent;
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || '';
  if (proxy) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
      const proxyMod = require('https-proxy-agent');
      // Support different module shapes (constructor or factory)
      let AgentCtor = proxyMod && (proxyMod.HttpsProxyAgent || proxyMod.default || proxyMod);
      if (typeof AgentCtor === 'function') {
        try {
          agent = new AgentCtor(proxy);
        } catch (ctorErr) {
          // fallback: some versions export a factory function
          agent = AgentCtor(proxy);
        }
      } else {
        throw new Error('https-proxy-agent export is not a function');
      }
      opts.agent = agent;
    } catch (e) {
      // If package isn't installed or shape is unexpected, print a helpful error
      console.error(JSON.stringify({ ok: false, error: `https-proxy-agent not available or invalid: ${e instanceof Error ? e.message : String(e)}` }));
      process.exit(4);
    }
  }

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
