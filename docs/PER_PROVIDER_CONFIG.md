# Per-Provider Configuration

## Overview

Users can now maintain separate AI settings for each provider (Ollama and Azure OpenAI) and switch between them seamlessly **without losing configuration**.

## Problem Solved

**Before**: When switching from Ollama to Azure OpenAI (or vice versa), users had to:
1. Remember their previous settings
2. Manually re-enter endpoint and model name
3. Risk using wrong settings (e.g., "llama2" model with Azure OpenAI)

**After**: Each provider stores its own configuration independently. Switching providers automatically loads that provider's saved settings.

---

## How It Works

### Storage Structure

```
context-repo/.context/
├── ai-config.json              # Active configuration
└── ai-provider-configs.json    # Per-provider configurations (NEW)
```

**`ai-config.json`** (Active Config):
```json
{
  "provider": "azure-openai",
  "endpoint": "https://myinstance.openai.azure.com",
  "model": "gpt-4",
  "enabled": true
}
```

**`ai-provider-configs.json`** (Per-Provider Store):
```json
{
  "ollama": {
    "endpoint": "http://localhost:11434",
    "model": "llama3"
  },
  "azure-openai": {
    "endpoint": "https://myinstance.openai.azure.com",
    "model": "gpt-4"
  }
}
```

---

## API Reference

### Backend API (LangChainAIService)

#### `getProviderConfigs(dir: string): Promise<ProviderConfigs>`

Get all saved provider configurations.

```typescript
const configs = await service.getProviderConfigs('/path/to/repo');
console.log(configs['ollama']);      // { endpoint, model }
console.log(configs['azure-openai']); // { endpoint, model }
```

#### `saveProviderConfig(dir: string, provider: string, config: { endpoint: string; model: string }): Promise<void>`

Save configuration for a specific provider without switching to it.

```typescript
// Save Ollama config
await service.saveProviderConfig('/path/to/repo', 'ollama', {
  endpoint: 'http://localhost:11434',
  model: 'llama3'
});

// Save Azure OpenAI config
await service.saveProviderConfig('/path/to/repo', 'azure-openai', {
  endpoint: 'https://myinstance.openai.azure.com',
  model: 'gpt-4'
});
```

### IPC API (Preload/Renderer)

#### `window.api.ai.getProviderConfigs(dir: string)`

Frontend equivalent of `getProviderConfigs`.

```typescript
const result = await window.api.ai.getProviderConfigs(repoPath);
if (result.ok) {
  console.log(result.configs);
}
```

#### `window.api.ai.saveProviderConfig(dir: string, provider: string, config: { endpoint: string; model: string })`

Frontend equivalent of `saveProviderConfig`.

```typescript
await window.api.ai.saveProviderConfig(repoPath, 'ollama', {
  endpoint: 'http://localhost:11434',
  model: 'llama3'
});
```

---

## User Workflow

### Initial Setup

1. **Configure Ollama**:
   - User opens AI Settings
   - Selects "Ollama" provider
   - Enters endpoint: `http://localhost:11434`
   - Enters model: `llama3`
   - Clicks Save

2. **Configure Azure OpenAI**:
   - User changes provider dropdown to "Azure OpenAI"
   - UI automatically loads previous Azure settings (if any)
   - Enters endpoint: `https://myinstance.openai.azure.com`
   - Enters model: `gpt-4`
   - Enters API key (stored separately, encrypted)
   - Clicks Save

### Switching Providers

**Scenario**: User wants to switch from Azure OpenAI back to Ollama

1. User opens AI Settings
2. Changes provider dropdown from "Azure OpenAI" to "Ollama"
3. ✅ UI automatically populates:
   - Endpoint: `http://localhost:11434`
   - Model: `llama3`
4. User clicks Save
5. ✅ Active config (`ai-config.json`) updated to Ollama settings
6. ✅ Azure OpenAI settings remain saved for next switch

---

## Implementation Details

### When to Save Per-Provider Config

The UI should save per-provider config in two scenarios:

#### Scenario 1: User explicitly saves settings
```typescript
// User clicks "Save" button in AI Settings
async function handleSave() {
  const { provider, endpoint, model, apiKey } = formData;
  
  // 1. Save per-provider config (for this provider)
  await window.api.ai.saveProviderConfig(repoPath, provider, {
    endpoint,
    model
  });
  
  // 2. Save active config (makes this provider active)
  await window.api.ai.saveConfig(repoPath, {
    provider,
    endpoint,
    model,
    enabled: true
  });
  
  // 3. Save credentials if API key provided
  if (apiKey) {
    await window.api.ai.saveCredentials(provider, apiKey);
  }
}
```

#### Scenario 2: User switches provider dropdown
```typescript
// User changes provider dropdown
async function handleProviderChange(newProvider: string) {
  // 1. Save current provider's settings before switching
  await window.api.ai.saveProviderConfig(repoPath, currentProvider, {
    endpoint: currentEndpoint,
    model: currentModel
  });
  
  // 2. Load new provider's saved settings
  const configs = await window.api.ai.getProviderConfigs(repoPath);
  const newConfig = configs[newProvider];
  
  // 3. Update UI form with loaded settings
  setEndpoint(newConfig?.endpoint || '');
  setModel(newConfig?.model || '');
}
```

### Default Values

If no per-provider config exists, defaults are returned:

```typescript
{
  'ollama': {
    endpoint: 'http://localhost:11434',
    model: 'llama2'
  },
  'azure-openai': {
    endpoint: '',
    model: 'gpt-4'
  }
}
```

---

## UI Integration Example

### Vue Component Pseudo-Code

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useContextStore } from '@/stores/contextStore';

const contextStore = useContextStore();
const provider = ref('ollama');
const endpoint = ref('');
const model = ref('');
const apiKey = ref('');

// Load per-provider configs on mount
async function loadConfigs() {
  const result = await window.api.ai.getProviderConfigs(contextStore.repoPath);
  if (result.ok) {
    const config = result.configs[provider.value];
    endpoint.value = config?.endpoint || '';
    model.value = config?.model || '';
  }
}

// Watch for provider changes and load that provider's config
watch(provider, async (newProvider, oldProvider) => {
  // Save current provider's config before switching
  if (oldProvider) {
    await window.api.ai.saveProviderConfig(
      contextStore.repoPath,
      oldProvider,
      { endpoint: endpoint.value, model: model.value }
    );
  }
  
  // Load new provider's config
  const result = await window.api.ai.getProviderConfigs(contextStore.repoPath);
  if (result.ok) {
    const config = result.configs[newProvider];
    endpoint.value = config?.endpoint || '';
    model.value = config?.model || '';
  }
});

async function handleSave() {
  // Save per-provider config
  await window.api.ai.saveProviderConfig(
    contextStore.repoPath,
    provider.value,
    { endpoint: endpoint.value, model: model.value }
  );
  
  // Save active config
  await window.api.ai.saveConfig(contextStore.repoPath, {
    provider: provider.value,
    endpoint: endpoint.value,
    model: model.value,
    enabled: true
  });
  
  // Save credentials if provided
  if (apiKey.value) {
    await window.api.ai.saveCredentials(provider.value, apiKey.value);
  }
}
</script>

<template>
  <div>
    <select v-model="provider">
      <option value="ollama">Ollama</option>
      <option value="azure-openai">Azure OpenAI</option>
    </select>
    
    <input v-model="endpoint" placeholder="Endpoint" />
    <input v-model="model" placeholder="Model" />
    <input v-model="apiKey" type="password" placeholder="API Key" />
    
    <button @click="handleSave">Save</button>
  </div>
</template>
```

---

## Benefits

### For Users
- ✅ No more re-entering settings when switching providers
- ✅ Reduces errors (wrong model for provider)
- ✅ Faster workflow when testing different providers
- ✅ Settings persist per repository

### For Developers
- ✅ Clean API separation
- ✅ Backward compatible (existing repos work fine)
- ✅ Easy to extend for new providers
- ✅ Type-safe configuration storage

---

## Testing

### Manual Test Script

```typescript
// 1. Save Ollama config
await window.api.ai.saveProviderConfig('/path/to/repo', 'ollama', {
  endpoint: 'http://localhost:11434',
  model: 'llama3'
});

// 2. Save Azure config
await window.api.ai.saveProviderConfig('/path/to/repo', 'azure-openai', {
  endpoint: 'https://test.openai.azure.com',
  model: 'gpt-4'
});

// 3. Verify both saved
const configs = await window.api.ai.getProviderConfigs('/path/to/repo');
console.assert(configs.ollama.model === 'llama3');
console.assert(configs['azure-openai'].model === 'gpt-4');

// 4. Switch to Ollama
await window.api.ai.saveConfig('/path/to/repo', {
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama3',
  enabled: true
});

// 5. Verify active config
const activeConfig = await window.api.ai.getConfig('/path/to/repo');
console.assert(activeConfig.provider === 'ollama');
console.assert(activeConfig.model === 'llama3');
```

---

## Migration Notes

### Existing Repositories

Repos with existing `ai-config.json` will continue to work:
- First load: Creates `ai-provider-configs.json` with defaults
- User saves settings: Per-provider config populated
- No data loss, fully backward compatible

### New Repositories

Fresh repos get both files on first AI configuration:
- `ai-config.json` - Current active config
- `ai-provider-configs.json` - Provider-specific history

---

## Future Enhancements

Potential improvements for future releases:

1. **More Providers**: Add OpenAI, Anthropic Claude, etc.
2. **Named Profiles**: Allow multiple configs per provider
   - "Ollama - Fast (llama2)"
   - "Ollama - Quality (llama3-70b)"
3. **Cloud Sync**: Sync configs across machines
4. **Import/Export**: Share configs between repos

---

## API Summary

| Method | Location | Purpose |
|--------|----------|---------|
| `getProviderConfigs()` | `LangChainAIService` | Retrieve all provider configs |
| `saveProviderConfig()` | `LangChainAIService` | Save config for one provider |
| `window.api.ai.getProviderConfigs()` | Preload/Renderer | Frontend API |
| `window.api.ai.saveProviderConfig()` | Preload/Renderer | Frontend API |

---

**Status**: ✅ Implemented and Ready to Use  
**Version**: 1.0  
**Date**: 2025-10-30
