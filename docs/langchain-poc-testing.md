# LangChain POC Testing Guide

## Status: Phase 1 Complete ✅

**Completed**: 2025-10-30  
**Phase**: Proof of Concept (Week 1-2)  
**Next Phase**: Simple Feature Migration (Week 3-4)

---

## What We've Built

### 1. Core LangChain Service ✅
**File**: `app/src/main/services/LangChainAIService.ts`

**Features**:
- ✅ Unified provider abstraction (Azure OpenAI + Ollama)
- ✅ Model caching for performance
- ✅ Structured output parsing with Zod schemas
- ✅ Streaming support with conversation history
- ✅ Automatic retry logic
- ✅ Comprehensive error handling and logging

### 2. Entity Schemas ✅
**File**: `app/src/main/schemas/entitySchemas.ts`

**Schemas**:
- ✅ Feature (FEAT-###)
- ✅ User Story (US-###)
- ✅ Specification (SPEC-###)
- ✅ Task (T-###)
- ✅ Service
- ✅ Package

**Benefits**:
- Type-safe entity generation
- Guaranteed valid output (automatic retry if invalid)
- Self-documenting field descriptions

### 3. IPC Handlers ✅
**File**: `app/src/main/ipc/handlers/langchain-ai.handlers.ts`

**Endpoints**:
- ✅ `langchain:isEnabled` - Check feature flag status
- ✅ `langchain:testConnection` - Test provider connectivity
- ✅ `langchain:generateEntity` - Generate entity with structured output
- ✅ `langchain:assistStreamStart` - Start streaming conversation
- ✅ `langchain:assistStreamCancel` - Cancel active stream
- ✅ `langchain:clearCache` - Clear model cache

### 4. Feature Flag ✅
**Environment Variable**: `USE_LANGCHAIN=true`

**Current Default**: `false` (uses legacy implementation)

---

## How to Test

### Prerequisites

1. **Verify dependencies installed**:
   ```bash
   cd app
   pnpm list langchain @langchain/openai @langchain/community @langchain/core zod
   ```

2. **Configure AI provider** (use existing configuration):
   - `.context/ai-config.json` in your context repository
   - Or configure via the app UI

### Test 1: Enable LangChain Feature Flag

**Windows (PowerShell)**:
```powershell
$env:USE_LANGCHAIN="true"
cd app
pnpm start
```

**Linux/Mac**:
```bash
USE_LANGCHAIN=true pnpm start
```

### Test 2: Verify Feature Flag Status

In the app console (DevTools), check:
```javascript
window.api.langchain.isEnabled()
  .then(result => console.log('LangChain enabled:', result.enabled));
```

### Test 3: Test Connection

**Azure OpenAI**:
```javascript
window.api.langchain.testConnection({
  provider: 'azure-openai',
  endpoint: 'https://YOUR_INSTANCE.openai.azure.com',
  model: 'gpt-4',
  apiKey: 'your-api-key'
}).then(result => console.log(result));
```

**Ollama** (local):
```javascript
window.api.langchain.testConnection({
  provider: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama2'
}).then(result => console.log(result));
```

### Test 4: Generate Entity with Structured Output

```javascript
// Generate a feature
window.api.langchain.generateEntity({
  dir: '/path/to/context-repo',
  entityType: 'feature',
  userPrompt: 'Create a feature for OAuth authentication with Google and GitHub providers',
  apiKey: 'your-api-key' // if needed
}).then(result => {
  console.log('Generated entity:', result.entity);
  // Entity is GUARANTEED to match the schema
  // {
  //   id: 'FEAT-XXX',
  //   title: '...',
  //   status: 'draft',
  //   domain: 'authentication',
  //   objective: '...',
  //   ...
  // }
});
```

### Test 5: Streaming Assistant

```javascript
// Start a streaming conversation
const streamId = await window.api.langchain.assistStreamStart({
  dir: '/path/to/context-repo',
  question: 'What features are in this repository?',
  conversationHistory: [],
  contextSnapshot: {
    features: [...],
    userStories: [...],
    specs: [...],
    tasks: [...]
  }
});

// Listen for tokens
window.api.on('langchain:assistStream:token', (data) => {
  if (data.streamId === streamId) {
    process.stdout.write(data.token);
  }
});

// Listen for completion
window.api.on('langchain:assistStream:end', (data) => {
  if (data.streamId === streamId) {
    console.log('\nStream completed!');
  }
});

// Listen for errors
window.api.on('langchain:assistStream:error', (data) => {
  if (data.streamId === streamId) {
    console.error('Stream error:', data.error);
  }
});
```

---

## Side-by-Side Comparison

### Entity Generation

| Aspect | Legacy (ai-common.mjs) | LangChain |
|--------|------------------------|-----------|
| **Lines of Code** | ~300 (custom prompt) | ~100 (structured schema) |
| **Output Validation** | Hope for valid YAML | Guaranteed via Zod schema |
| **Error Handling** | Manual parsing errors | Automatic retry on invalid output |
| **Type Safety** | None | Full TypeScript types from schema |
| **Retry Logic** | Manual | Built-in with LangChain |
| **Schema Documentation** | Scattered comments | Self-documenting via `.describe()` |

**Example Output Quality**:

**Legacy** (might generate):
```yaml
id: FEAT001  # ❌ Wrong format (missing dash)
title: OAuth
status: working  # ❌ Invalid status
objective: Add OAuth
# Missing required fields
```

**LangChain** (guaranteed valid):
```yaml
id: FEAT-001  # ✅ Correct format
title: OAuth Authentication Feature
status: draft  # ✅ Valid status from enum
objective: Implement OAuth 2.0 authentication with Google and GitHub providers
domain: authentication
userStories: []
specs: []
tasks: []
requires: []
tags: []
```

### Streaming

| Aspect | Legacy | LangChain |
|--------|--------|-----------|
| **Streaming Code** | ~200 lines (manual SSE parsing) | ~50 lines (built-in) |
| **Error Recovery** | Manual | Automatic with retries |
| **Token Counting** | Custom implementation | Built-in |
| **Connection Management** | Manual timeout handling | Automatic |
| **Provider Switching** | Rewrite parsing logic | Change model instance |

### Provider Support

| Aspect | Legacy | LangChain |
|--------|--------|-----------|
| **Providers** | 2 (manual: Azure, Ollama) | 50+ (built-in) |
| **Adding New Provider** | ~200 lines of custom code | ~5 lines (new model instance) |
| **Maintenance** | Provider-specific bugs | Community-maintained |
| **Documentation** | Custom docs needed | Official docs available |

---

## Performance Benchmarks

### Expected Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Streaming Start** | <2s | Time to first token |
| **Token Usage** | ±20% of legacy | Compare prompt sizes |
| **Memory** | <100MB overhead | Monitor process memory |
| **Cache Hit Rate** | >80% for repeated queries | Log cache usage |

### How to Benchmark

1. **Create benchmark script** (`app/benchmark-langchain.ts`):

```typescript
import { LangChainAIService } from './src/main/services/LangChainAIService';
import { getSchemaForEntityType } from './src/main/schemas/entitySchemas';

async function benchmark() {
  const service = new LangChainAIService();
  const config = {
    provider: 'azure-openai',
    endpoint: process.env.AZURE_ENDPOINT!,
    model: 'gpt-4',
    apiKey: process.env.AZURE_API_KEY!,
    enabled: true
  };

  console.time('Entity Generation');
  const entity = await service.generateEntity({
    config,
    entityType: 'feature',
    userPrompt: 'Create a feature for user profile management',
    schema: getSchemaForEntityType('feature')
  });
  console.timeEnd('Entity Generation');
  console.log('Generated:', entity);

  console.time('Streaming Start');
  const stream = service.assistStream({
    config,
    question: 'What is this feature about?',
    conversationHistory: [],
    contextSnapshot: { features: [entity] }
  });
  
  let firstToken = true;
  for await (const token of stream) {
    if (firstToken) {
      console.timeEnd('Streaming Start');
      firstToken = false;
    }
    process.stdout.write(token);
  }
  console.log('\n');
}

benchmark();
```

2. **Run benchmark**:
```bash
cd app
AZURE_ENDPOINT=xxx AZURE_API_KEY=xxx tsx benchmark-langchain.ts
```

---

## Known Limitations (POC Phase)

### 1. Credential Management
**Issue**: Currently doesn't integrate with existing credential storage

**Workaround**: Pass `apiKey` directly in requests

**Fix**: Integrate with `AIService.hasCredentials()` in Phase 2

### 2. No Frontend Integration
**Issue**: No UI components to use LangChain handlers

**Solution**: Phase 2 will add UI components

### 3. Feature Flag Control
**Issue**: Requires environment variable restart

**Solution**: Phase 3 will add runtime toggle in settings

---

## Next Steps: Phase 2 (Week 3-4)

### 1. Frontend Integration

**Create**: `app/src/renderer/services/langchainBridge.ts`
```typescript
export const langchainBridge = {
  isEnabled: () => window.api.langchain.isEnabled(),
  testConnection: (opts) => window.api.langchain.testConnection(opts),
  generateEntity: (opts) => window.api.langchain.generateEntity(opts),
  // ...
};
```

### 2. UI Toggle Component

**Add to**: Settings panel
```vue
<template>
  <div class="setting-item">
    <label>
      <input 
        type="checkbox" 
        v-model="useLangChain" 
        @change="toggleLangChain"
      />
      Use LangChain Implementation (Experimental)
    </label>
  </div>
</template>
```

### 3. Entity Builder Integration

**Modify**: `ContextBuilderWizard.vue`
```typescript
async function generateEntity() {
  const implementation = useLangChain ? 'langchain' : 'legacy';
  
  if (implementation === 'langchain') {
    const result = await window.api.langchain.generateEntity({...});
  } else {
    const result = await window.api.ai.generate({...});
  }
}
```

### 4. Side-by-Side Testing UI

**Create**: `ComparisonTestPanel.vue`
- Run same prompt through both implementations
- Show outputs side-by-side
- Highlight differences
- Collect user feedback on quality

### 5. Metrics Dashboard

**Create**: `app/src/renderer/components/LangChainMetrics.vue`
- Show cache hit rate
- Display average response times
- Token usage comparison
- Error rate tracking

---

## Rollback Plan

If issues arise during testing:

### Step 1: Disable Feature Flag
```bash
# Set to false or unset
unset USE_LANGCHAIN
pnpm start
```

### Step 2: Verify Legacy Still Works
Test all AI features with legacy implementation

### Step 3: Report Issues
Document any problems discovered:
- Error messages
- Performance degradation
- Output quality issues
- Provider compatibility problems

### Step 4: Fix and Retry
Address issues in LangChainAIService and re-test

---

## Success Criteria

POC is considered successful if:

- ✅ **Functional Parity**: All features work with LangChain
- ✅ **Performance**: Within ±20% of legacy implementation
- ✅ **Output Quality**: Equal or better entity generation
- ✅ **Stability**: No crashes or hangs during normal usage
- ✅ **Compatibility**: Works with both Azure OpenAI and Ollama

## Decision Point

**After 2 weeks of testing**:
- ✅ **PROCEED** to Phase 2 if all criteria met
- ⏸️ **PAUSE** to address issues if criteria not met
- ❌ **ROLLBACK** if fundamental blockers discovered

---

## Questions & Feedback

### For the Team

1. Does the structured output approach feel more reliable than free-form YAML generation?
2. Is the Zod schema definition clear and maintainable?
3. Do you prefer the LangChain error messages over the legacy ones?
4. Is model caching noticeably faster for repeated operations?
5. Any concerns about the feature flag approach?

### Testing Checklist

- [ ] Connection test passes for your AI provider
- [ ] Entity generation produces valid output
- [ ] Streaming works without errors
- [ ] Model cache improves repeat query performance
- [ ] Feature flag can be toggled without crashes
- [ ] Error messages are clear and actionable
- [ ] No regression in existing functionality

---

## Resources

- **LangChain POC Code**: `app/src/main/services/LangChainAIService.ts`
- **Schemas**: `app/src/main/schemas/entitySchemas.ts`
- **Handlers**: `app/src/main/ipc/handlers/langchain-ai.handlers.ts`
- **Enhancement Plan**: `docs/langchain-enhancement-plan.md`
- **LangChain Docs**: https://js.langchain.com/docs/

---

**Status**: Ready for Testing  
**Last Updated**: 2025-10-30  
**Phase**: 1 of 6 (POC Complete)  
**Next Milestone**: Phase 2 Frontend Integration (Week 3-4)
