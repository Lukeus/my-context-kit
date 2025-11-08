# RAG Tool Integration Guide

## Overview

Three RAG (Retrieval-Augmented Generation) tools have been added to enable the assistant to perform semantic searches and entity operations using vector embeddings.

## New Tools

### 1. **rag.search** - Semantic Search
**Purpose**: Search the context repository using natural language queries  
**Capability**: `read`  
**Requires Approval**: No

**Parameters**:
- `query` (string, required): Search query (1-500 characters)
- `limit` (number, optional): Max results 1-20, default 10

**Returns**:
```typescript
{
  results: Array<{
    id: string;          // e.g., "FEAT-001"
    title?: string;
    type: string;        // "feature", "task", etc.
    relevance: number;   // 0-100
    excerpt: string;     // First 140 chars
  }>;
  count: number;
}
```

**Example**:
```typescript
await toolOrchestrator.executeTool({
  sessionId: 'sess-123',
  provider: 'azure-openai',
  toolId: 'rag.search',
  repoPath: '/path/to/repo',
  parameters: { query: 'authentication features', limit: 5 }
});
```

---

### 2. **rag.getEntity** - Retrieve Entity Details
**Purpose**: Get complete information about a specific entity by ID  
**Capability**: `read`  
**Requires Approval**: No

**Parameters**:
- `entityId` (string, required): Entity ID matching pattern `(FEAT|US|SPEC|T|SERVICE|PKG)-\d{3,}`

**Returns**:
```typescript
{
  id: string;
  type: string;
  title?: string;
  status?: string;
  description?: string;
  objective?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  raw: Record<string, unknown>;  // Complete entity YAML
}
```

**Example**:
```typescript
await toolOrchestrator.executeTool({
  sessionId: 'sess-123',
  provider: 'azure-openai',
  toolId: 'rag.getEntity',
  repoPath: '/path/to/repo',
  parameters: { entityId: 'FEAT-001' }
});
```

---

### 3. **rag.findSimilar** - Find Related Entities
**Purpose**: Discover entities semantically similar to a given entity  
**Capability**: `read`  
**Requires Approval**: No

**Parameters**:
- `entityId` (string, required): Source entity ID
- `limit` (number, optional): Max results 1-15, default 5

**Returns**:
```typescript
{
  sourceEntity: string;
  similar: Array<{
    id: string;
    title?: string;
    type: string;
    relevance: number;
    excerpt: string;
  }>;
  count: number;
}
```

**Example**:
```typescript
await toolOrchestrator.executeTool({
  sessionId: 'sess-123',
  provider: 'azure-openai',
  toolId: 'rag.findSimilar',
  repoPath: '/path/to/repo',
  parameters: { entityId: 'FEAT-001', limit: 10 }
});
```

## Integration Steps

### 1. Register Tools in Provider Configuration

Update `app/src/main/services/assistantSessionManager.ts` or your provider configuration:

```typescript
import { RAG_TOOLS } from './ragToolDescriptors';

const providerConfig: ProviderRuntimeSettings = {
  id: 'azure-openai',
  displayName: 'Azure OpenAI',
  // ... other settings
  tools: [
    ...existingTools,
    ...RAG_TOOLS  // Add RAG tools
  ]
};
```

### 2. Wire ToolOrchestrator Dependencies

When creating the ToolOrchestrator, provide the RAG tool implementations:

```typescript
import { searchContextRepository } from './tools/searchContextRepository';
import { getEntityDetails } from './tools/getEntityDetails';
import { findSimilarEntities } from './tools/findSimilarEntities';
import { LangChainAIService } from './LangChainAIService';

const aiService = new LangChainAIService();

const orchestrator = new ToolOrchestrator({
  loadConfiguration: () => getProviderConfig(),
  runPipeline: (opts) => pipelineRunner.run(opts),
  readContextFile: (opts) => readContextFile(opts),
  searchContextRepository: (opts) => searchContextRepository(opts),
  getEntityDetails: (opts) => getEntityDetails(opts),
  findSimilarEntities: (opts) => findSimilarEntities(opts),
  getAIConfig: async () => aiService.getConfig(repoPath),
  telemetryWriter: telemetryService,
  clock: () => new Date()
});
```

### 3. Enable Tools in LangChain Model

To use tools with LangChain's function calling:

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { RAG_TOOLS } from './ragToolDescriptors';

// Convert tool descriptors to LangChain format
const langchainTools = RAG_TOOLS.map(tool => ({
  name: tool.id,
  description: tool.description,
  parameters: tool.inputSchema
}));

const model = new ChatOpenAI({
  // ... config
}).bind({
  tools: langchainTools,
  tool_choice: 'auto'  // or 'required' to force tool use
});
```

### 4. Handle Tool Calls in Streaming

Update your streaming handler to detect and execute tool calls:

```typescript
for await (const chunk of stream) {
  if (chunk.additional_kwargs?.tool_calls) {
    for (const toolCall of chunk.additional_kwargs.tool_calls) {
      const result = await orchestrator.executeTool({
        sessionId,
        provider: 'azure-openai',
        toolId: toolCall.function.name,
        repoPath,
        parameters: JSON.parse(toolCall.function.arguments)
      });
      
      // Send tool result back to model
      // ... handle result
    }
  }
}
```

## Prerequisites

### Repository Must Be Indexed

All RAG tools require the repository to be indexed first:

```typescript
// In your UI or IPC handler
await window.api.rag.indexRepository(repoPath, aiConfig);
```

Check indexing status:
```typescript
const status = await window.api.rag.getStatus(repoPath, aiConfig);
if (!status.indexed) {
  // Show "Index Repository" button
}
```

### AI Configuration Required

RAG tools need AI configuration for embeddings:

```typescript
const aiConfig: AIConfig = {
  provider: 'azure-openai',
  endpoint: 'https://your-endpoint.azure-api.net',
  model: 'gpt-4.1',
  apiKey: '***',
  // Optional: specify embedding model
  embeddingModel: 'text-embedding-3-small'
};
```

## Error Handling

All tools throw descriptive errors:

```typescript
try {
  const result = await orchestrator.executeTool(...);
  if (!result.ok) {
    console.error('Tool failed:', result.error);
  }
} catch (error) {
  // Handle:
  // - "Repository not indexed"
  // - "Entity not found"
  // - "Missing credentials"
  // - Parameter validation errors
}
```

## Telemetry

All tool executions are automatically logged:

```typescript
const result = await orchestrator.executeTool(...);
console.log(result.telemetry);
// {
//   id: 'inv-123',
//   toolId: 'rag.search',
//   status: 'succeeded',
//   startedAt: '2025-10-31T...',
//   finishedAt: '2025-10-31T...',
//   resultSummary: 'Found 5 relevant entities...'
// }
```

## Security

- **No approval required**: RAG tools are read-only
- **Repository sandboxing**: Paths validated in tool implementations
- **Credential resolution**: API keys retrieved securely via AICredentialResolver
- **Input validation**: All parameters validated against JSON schemas

## Testing

Run integration tests:

```bash
cd app
pnpm test -- toolOrchestrator.spec.ts
```

Manual testing via IPC:

```typescript
// In renderer process
const result = await window.api.assistant.executeTool({
  sessionId: currentSession.id,
  toolId: 'rag.search',
  parameters: { query: 'user authentication' }
});
```

## Next Steps

1. **Wire to LangChain**: Add `.bind({ tools })` to ChatOpenAI model
2. **Update UI**: Show tool usage indicators in assistant panel
3. **Add tool result formatting**: Display entity cards for results
4. **Implement streaming tool calls**: Handle tool_calls in chunk processing
5. **Add examples**: Create sample queries showcasing each tool

## Files Modified/Created

- ✅ `app/src/main/services/tools/searchContextRepository.ts` (new)
- ✅ `app/src/main/services/tools/getEntityDetails.ts` (new)
- ✅ `app/src/main/services/tools/findSimilarEntities.ts` (new)
- ✅ `app/src/main/services/ragToolDescriptors.ts` (new)
- ✅ `app/src/main/services/toolOrchestrator.ts` (updated)

## TODO

- [ ] Register RAG_TOOLS in provider configuration
- [ ] Wire ToolOrchestrator with RAG dependencies in IPC handler
- [ ] Add `.bind({ tools })` to LangChain ChatOpenAI model
- [ ] Handle tool calls in streaming response
- [ ] Add UI indicators for tool usage
- [ ] Create tool result visualization components
- [ ] Add integration tests for RAG tools
- [ ] Document tool usage patterns in AGENTS.md
