# Using Sidecar with AI Settings (Option B)

**Status**: Implemented - Ready to use  
**Date**: 2025-11-07

---

## Overview

The Python sidecar now reads configuration from the "Legacy AI (Old)" settings tab. This means **you can configure Ollama/Azure OpenAI settings in the UI and the sidecar will use them automatically**.

---

## How to Configure

### Step 1: Open AI Settings

Press **Ctrl+K** → Type "AI Settings" → Press **Enter**

Or manually navigate to AI Settings in the app.

### Step 2: Configure Legacy AI Tab

Click on **"Legacy AI (Old)"** tab and configure:

**For Ollama (Local)**:
- Provider: `Ollama (Local)`
- Endpoint: `http://localhost:11434`
- Model: `llama2` (or `mistral`, `codellama`, etc.)

**For Azure OpenAI**:
- Provider: `Azure OpenAI`
- Endpoint: `https://your-resource.openai.azure.com`
- Model: `gpt-35-turbo` (your deployment name)
- API Key: (enter your key - stored securely)

### Step 3: Save Settings

Click **"Save Settings"** button.

### Step 4: Use the Sidecar

Switch to **"🐍 Sidecar"** tab and click **"Start Sidecar"**.

The sidecar will automatically use the settings you just saved!

---

## Using getSidecarConfig in Code

When calling sidecar operations from TypeScript, use the helper:

```typescript
import { useAssistantStore } from '@/stores/assistantStore';

const assistantStore = useAssistantStore();

// Get config from legacy AI settings
const config = await assistantStore.getSidecarConfig();

// Use it in sidecar calls
const result = await window.api.sidecar.generateEntity({
  entityType: 'feature',
  userPrompt: 'Create a login feature with OAuth2',
  config: config,  // ← Uses your saved settings!
});
```

---

## What getSidecarConfig Returns

```typescript
{
  provider: 'ollama' | 'azure-openai',
  endpoint: string,          // e.g., 'http://localhost:11434'
  model: string,             // e.g., 'llama2'
  apiKey?: string,           // Only for Azure OpenAI
  temperature: number,       // Default: 0.7
  maxTokens?: number,        // Optional
}
```

---

## Fallback Behavior

If no settings are configured, `getSidecarConfig()` returns safe defaults:

```typescript
{
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama2',
  temperature: 0.7,
}
```

This means **the sidecar will work out-of-the-box with Ollama defaults**.

---

## Configuration Flow

```
User configures in UI
       ↓
AI Settings Modal → "Legacy AI (Old)" tab
       ↓
window.api.ai.saveConfig(repoPath, config)
       ↓
Saved to: ~/.context-sync/ai-config.json (or similar)
       ↓
assistantStore.getSidecarConfig(repoPath)
       ↓
Reads saved config
       ↓
Passes to window.api.sidecar.generateEntity({ config })
       ↓
IPC → Python sidecar receives config
       ↓
LangChainService._get_llm(config) initializes LLM
       ↓
Uses Ollama/Azure OpenAI with your settings!
```

---

## Testing

### Test 1: Verify Config is Loaded

```typescript
// In DevTools console:
const store = Pinia.useStore('assistant-safe-tools');
const config = await store.getSidecarConfig();
console.log(config);
// Should show your saved settings
```

### Test 2: Generate Entity with Config

```typescript
const store = Pinia.useStore('assistant-safe-tools');
const config = await store.getSidecarConfig();

const result = await window.api.sidecar.generateEntity({
  entityType: 'feature',
  userPrompt: 'Test feature generation',
  config: config,
});

console.log(result);
// Should generate using your configured model
```

### Test 3: Verify Python Receives Config

Start sidecar and check logs:

```bash
cd context-kit-service
pnpm start
```

Then make a request from UI. You should see logs like:
```
INFO: Initializing LLM: provider=ollama, model=llama2, endpoint=http://localhost:11434
```

---

## Known Limitations

1. **API Key not passed**: For security, API keys are stored separately. Currently not integrated (Phase 5 task).

2. **No real-time sync**: If you change settings, you need to restart the sidecar for changes to take effect.

3. **Legacy tab required**: Users must go to "Legacy AI (Old)" tab to configure. Confusing UX until Phase 5 adds dedicated sidecar config UI.

---

## Next Steps (Phase 5)

1. **Add config fields to Sidecar tab** (remove dependency on Legacy AI tab)
2. **Integrate API key loading** for Azure OpenAI
3. **Real-time config updates** without restarting sidecar
4. **Config validation** before starting sidecar
5. **Remove Legacy AI tab** once sidecar has its own config

---

## Example: Full Workflow

### 1. Configure Settings

```typescript
// User sets in UI:
Provider: Ollama
Endpoint: http://localhost:11434
Model: llama2
```

### 2. Generate Entity

```typescript
const assistantStore = useAssistantStore();

// Automatically uses saved settings
const config = await assistantStore.getSidecarConfig();

const result = await window.api.sidecar.generateEntity({
  entityType: 'feature',
  userPrompt: 'Create user authentication feature',
  config: config,
});

console.log(result.entity);
// { id: 'FEAT-001', title: 'User Authentication', ... }
```

### 3. Stream Assistance

```typescript
const config = await assistantStore.getSidecarConfig();

const streamResult = await window.api.sidecar.assistStream({
  question: 'How should I implement OAuth2?',
  conversationHistory: [],
  config: config,
});

// Listen for tokens
window.api.sidecar.onStreamToken((event) => {
  console.log('Token:', event.token);
});
```

---

## Summary

✅ **Ollama settings ARE used** by the sidecar  
✅ **No Phase 5 needed** to start using it  
✅ **Configure in UI** via "Legacy AI (Old)" tab  
✅ **Use `getSidecarConfig()`** in your code  
❌ **API keys not integrated** (manual workaround needed for Azure)  
❌ **UX is confusing** (fixed in Phase 5)

**The sidecar is fully functional with configuration support right now!**
