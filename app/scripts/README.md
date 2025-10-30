Diagnostic script for Azure OpenAI embeddings

Usage (PowerShell):

```powershell
cd app
node .\scripts\diagnose-embedding.mjs https://fceai.azure-api.net text-embedding-3-small <API_KEY>
```

What it does:
- Sends a single POST to the Azure embeddings endpoint for the given deployment
- Prints HTTP status, timing, and response body (JSON or text)

Notes:
- Use an API key stored in your AI credential store or paste a test key for diagnostics.
- The script is intentionally minimal; treat API keys like secrets and don't commit them to logs or repo files.
