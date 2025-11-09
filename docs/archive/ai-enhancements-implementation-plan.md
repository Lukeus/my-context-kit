# AI Enhancements Implementation Plan

## Overview
This document outlines the implementation of configurable AI prompts, model capability detection, and token probability viewing.

## Completed
✅ **Created AI types and defaults** (`app/src/renderer/types/ai-prompts.ts`)
- `AIPromptConfig` interface for system and quick prompts
- `ModelCapabilities` interface for capability detection
- `TokenProbability` interface for logprobs
- `detectModelCapabilities()` function for Azure OpenAI and Ollama
- `DEFAULT_PROMPTS` with sensible defaults

## Remaining Implementation Steps

### 1. Expand AI Settings Modal (Priority: HIGH)

**File:** `app/src/renderer/components/AISettingsModal.vue`

Add tabs for:
- **Connection** (existing)
- **Prompts** (new)
- **Capabilities** (new - read-only display)

**Prompts Tab UI:**
```vue
<!-- System Prompts Section -->
<div class="space-y-4">
  <h3>System Prompts</h3>
  <div>
    <label>General Mode</label>
    <textarea v-model="prompts.systemPrompts.general" rows="3"></textarea>
  </div>
  <div>
    <label>Improvement Mode</label>
    <textarea v-model="prompts.systemPrompts.improvement" rows="3"></textarea>
  </div>
  <div>
    <label>Clarification Mode</label>
    <textarea v-model="prompts.systemPrompts.clarification" rows="3"></textarea>
  </div>
</div>

<!-- Quick Prompts Section -->
<div class="space-y-4">
  <h3>Quick Prompts</h3>
  <p class="text-xs">Use {entityId} as placeholder for active entity</p>
  <div>
    <label>Improvement (Active Entity)</label>
    <input v-model="prompts.quickPrompts.improvementActive" />
  </div>
  <!-- ... other quick prompts -->
</div>

<!-- Example Questions -->
<div>
  <h3>Example Questions</h3>
  <div v-for="(q, i) in prompts.exampleQuestions" :key="i">
    <input v-model="prompts.exampleQuestions[i]" />
    <button @click="removeQuestion(i)">Remove</button>
  </div>
  <button @click="addQuestion">Add Question</button>
</div>

<!-- Reset to Defaults Button -->
<button @click="resetToDefaults">Reset to Defaults</button>
```

**Storage:**
- Save prompts to `context-repo/.context/ai-prompts.json`
- Load on mount, fall back to `DEFAULT_PROMPTS`

### 2. Update AI Backend for Token Probabilities (Priority: MEDIUM)

**File:** `context-repo/.context/pipelines/ai-common.mjs`

**Azure OpenAI Changes:**
```javascript
// In callAzureOpenAI request body:
body.logprobs = true;
body.top_logprobs = 3; // Return top 3 alternatives per token

// In response handling:
const logprobs = data.choices[0]?.logprobs?.content || [];
const tokenProbs = logprobs.map(lp => ({
  token: lp.token,
  logprob: lp.logprob,
  prob: Math.exp(lp.logprob),
  topLogprobs: lp.top_logprobs?.map(t => ({
    token: t.token,
    logprob: t.logprob,
    prob: Math.exp(t.logprob)
  }))
}));

return {
  ok: true,
  content: data.choices[0].message.content,
  usage: { ... },
  logprobs: tokenProbs // NEW
};
```

**Ollama Changes:**
```javascript
// Ollama doesn't support logprobs by default
// Return empty array or null
return {
  ok: true,
  content: data.response,
  usage: { ... },
  logprobs: null // or []
};
```

### 3. Create Token Probability Viewer Component (Priority: MEDIUM)

**File:** `app/src/renderer/components/TokenProbabilityViewer.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue';
import type { TokenProbability } from '../types/ai-prompts';

const props = defineProps<{
  logprobs: TokenProbability[] | null;
}>();

const isExpanded = ref(false);

function getConfidenceColor(prob: number): string {
  if (prob > 0.9) return 'text-green-700 bg-green-50';
  if (prob > 0.7) return 'text-blue-700 bg-blue-50';
  if (prob > 0.5) return 'text-yellow-700 bg-yellow-50';
  return 'text-orange-700 bg-orange-50';
}
</script>

<template>
  <div v-if="logprobs && logprobs.length" class="mt-2">
    <button
      @click="isExpanded = !isExpanded"
      class="text-xs text-secondary-600 hover:text-secondary-900 flex items-center gap-1"
    >
      <svg class="w-3 h-3" :class="isExpanded ? 'rotate-90' : ''" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
      </svg>
      Token Probabilities ({{ logprobs.length }} tokens)
    </button>
    
    <div v-if="isExpanded" class="mt-2 p-3 bg-surface-2 rounded-m3-md border border-surface-variant max-h-64 overflow-y-auto">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="(lp, i) in logprobs"
          :key="i"
          :class="getConfidenceColor(lp.prob)"
          class="px-2 py-1 rounded text-xs font-mono"
          :title="`Probability: ${(lp.prob * 100).toFixed(2)}%`"
        >
          {{ lp.token }}
          <span class="text-[10px] opacity-75">{{ (lp.prob * 100).toFixed(0) }}%</span>
        </span>
      </div>
      
      <div class="mt-3 text-xs text-secondary-600">
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 rounded bg-green-50 text-green-700">90%+</span>
          <span class="px-2 py-1 rounded bg-blue-50 text-blue-700">70-90%</span>
          <span class="px-2 py-1 rounded bg-yellow-50 text-yellow-700">50-70%</span>
          <span class="px-2 py-1 rounded bg-orange-50 text-orange-700">&lt;50%</span>
        </div>
      </div>
    </div>
  </div>
</template>
```

### 4. Update AI Store (Priority: HIGH)

**File:** `app/src/renderer/stores/aiStore.ts`

**Add to state:**
```typescript
const prompts = ref<AIPromptConfig>(DEFAULT_PROMPTS);
const capabilities = ref<ModelCapabilities | null>(null);
```

**Add actions:**
```typescript
async function loadPrompts() {
  const repoPath = contextStore.repoPath;
  if (!repoPath) return;
  
  const result = await window.api.fs.readFile(`${repoPath}/.context/ai-prompts.json`);
  if (result.ok && result.content) {
    try {
      prompts.value = JSON.parse(result.content);
    } catch {
      prompts.value = DEFAULT_PROMPTS;
    }
  }
}

async function savePrompts(newPrompts: AIPromptConfig) {
  const repoPath = contextStore.repoPath;
  if (!repoPath) return;
  
  await window.api.fs.writeFile(
    `${repoPath}/.context/ai-prompts.json`,
    JSON.stringify(newPrompts, null, 2)
  );
  prompts.value = newPrompts;
}

function detectCapabilities(provider: string, model: string) {
  capabilities.value = detectModelCapabilities(provider, model);
}

function getSystemPrompt(mode: 'general' | 'improvement' | 'clarification'): string {
  return prompts.value.systemPrompts[mode];
}

function getQuickPrompt(type: 'improvement' | 'clarification', hasActiveEntity: boolean, entityId?: string): string {
  const key = hasActiveEntity
    ? `${type}Active` as const
    : `${type}General` as const;
  
  let prompt = prompts.value.quickPrompts[key];
  if (entityId) {
    prompt = prompt.replace('{entityId}', entityId);
  }
  return prompt;
}
```

**Update message interface:**
```typescript
interface Message {
  // ... existing fields
  logprobs?: TokenProbability[] | null;
}
```

### 5. Update AIAssistantPanel (Priority: HIGH)

**File:** `app/src/renderer/components/AIAssistantPanel.vue`

**Import and use:**
```vue
<script setup lang="ts">
import TokenProbabilityViewer from './TokenProbabilityViewer.vue';
import { useAIStore } from '../stores/aiStore';

const aiStore = useAIStore();

// Replace hardcoded prompts with:
function quickPrompt(type: 'improvement' | 'clarification') {
  const entityId = activeEntity.value?.id;
  question.value = aiStore.getQuickPrompt(type, !!entityId, entityId);
  mode.value = type;
  if (entityId) {
    focusActive.value = true;
  }
}

// Update example questions
const exampleQuestions = computed(() => aiStore.prompts.exampleQuestions);
</script>

<template>
  <!-- In message display -->
  <div v-for="message in aiStore.conversation" :key="message.id">
    <!-- ... existing message content -->
    
    <!-- Add token probability viewer -->
    <TokenProbabilityViewer :logprobs="message.logprobs" />
  </div>
  
  <!-- Update example questions -->
  <ul class="list-disc list-inside space-y-1">
    <li v-for="(q, i) in exampleQuestions" :key="i">{{ q }}</li>
  </ul>
</template>
```

### 6. Update Main Process IPC Handlers (Priority: MEDIUM)

**File:** `app/src/main/index.ts`

**Add handlers:**
```typescript
ipcMain.handle('ai:get-prompts', async (_event, repoPath) => {
  try {
    const content = await fs.readFile(`${repoPath}/.context/ai-prompts.json`, 'utf-8');
    return { ok: true, prompts: JSON.parse(content) };
  } catch {
    return { ok: true, prompts: null }; // Will use defaults
  }
});

ipcMain.handle('ai:save-prompts', async (_event, repoPath, prompts) => {
  try {
    await fs.writeFile(
      `${repoPath}/.context/ai-prompts.json`,
      JSON.stringify(prompts, null, 2),
      'utf-8'
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});
```

**Add to preload:**
```typescript
ai: {
  // ... existing
  getPrompts: (repoPath: string) => ipcRenderer.invoke('ai:get-prompts', repoPath),
  savePrompts: (repoPath: string, prompts: any) => ipcRenderer.invoke('ai:save-prompts', repoPath, prompts),
}
```

## Testing Plan

1. **Prompt Configuration**
   - Open AI Settings → Prompts tab
   - Modify system prompts
   - Modify quick prompts
   - Save and verify persistence
   - Reset to defaults

2. **Capabilities Detection**
   - Test with different models (GPT-4, GPT-3.5, Ollama models)
   - Verify capabilities display correctly
   - Confirm streaming/non-streaming behavior matches

3. **Token Probabilities**
   - Use Azure OpenAI model with logprobs support
   - Send query and verify token probabilities appear
   - Test expand/collapse functionality
   - Verify color coding by confidence level
   - Test with Ollama (should show nothing or disabled state)

## Migration Notes

- Existing installations will use `DEFAULT_PROMPTS` automatically
- No breaking changes to existing functionality
- Prompts file created on first save in settings
- Falls back gracefully if prompts file is corrupted

## Future Enhancements

- **Prompt Templates**: Save and load multiple prompt presets
- **Capability Testing**: Auto-detect capabilities by testing model
- **Advanced Logprobs**: Show alternative token choices on hover
- **Prompt Variables**: Support more variables beyond {entityId}
- **Reasoning Traces**: Display step-by-step reasoning for o1 models
