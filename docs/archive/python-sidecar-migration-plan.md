# Python Sidecar Migration Plan: AI Features

**Status**: Planning  
**Created**: 2025-11-07  
**Goal**: Migrate all AI operations from TypeScript (`LangChainAIService`) to Python sidecar (`context-kit-service`) per Constitution v1.2.0

---

## Executive Summary

Per Constitution §AI Orchestration & Assistant Architecture:
> "The Python `context-kit-service` sidecar (FastAPI + LangChain for Python) is the canonical orchestration boundary; Electron processes MUST call AI providers only through its versioned HTTP APIs."

This migration removes direct AI provider access from TypeScript, routing all operations through the Python sidecar for:
- **Unified provider abstraction** (Azure OpenAI, Ollama)
- **Zod schema validation** (TypeScript) + **Pydantic** (Python) for type safety
- **Centralized prompt engineering** in Python
- **Deterministic RAG pipelines** tracked in Git

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron App (TypeScript)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────┐ │
│  │ UI Layer     │───▶│ assistantStore│───▶│ sidecarClient   │ │
│  │ (Vue 3)      │    │ (Session Mgmt)│    │ (HTTP Client)   │ │
│  └──────────────┘    └───────────────┘    └─────────────────┘ │
│                                                      │ HTTP/SSE  │
└──────────────────────────────────────────────────────┼──────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│           Python Sidecar (context-kit-service)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌───────────────┐    ┌─────────────────┐ │
│  │ FastAPI      │───▶│ LangChain     │───▶│ Provider Clients│ │
│  │ Endpoints    │    │ Chains/Agents │    │ (OpenAI/Ollama) │ │
│  └──────────────┘    └───────────────┘    └─────────────────┘ │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  ┌──────────────────────────────────────┐                       │
│  │  Pydantic Models (Request/Response)  │                       │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Context Repository   │
              │ (YAML + Git)         │
              └──────────────────────┘
```

---

## Phase 1: Schema Contracts (Week 1)

### 1.1 Define Shared Type Contracts with Zod

**File**: `app/src/shared/sidecar/schemas.ts`

```typescript
import { z } from 'zod';

// Provider configuration
export const ProviderConfigSchema = z.object({
  provider: z.enum(['azure-openai', 'ollama']),
  endpoint: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().optional(),
  apiVersion: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// Entity generation request
export const GenerateEntityRequestSchema = z.object({
  entityType: z.enum(['feature', 'userstory', 'spec', 'task', 'governance']),
  userPrompt: z.string().min(10),
  linkedFeatureId: z.string().optional(),
  config: ProviderConfigSchema,
});
export type GenerateEntityRequest = z.infer<typeof GenerateEntityRequestSchema>;

// Entity generation response
export const GenerateEntityResponseSchema = z.object({
  entity: z.record(z.unknown()), // Will be validated against entity-specific schema
  metadata: z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
    model: z.string(),
  }),
});
export type GenerateEntityResponse = z.infer<typeof GenerateEntityResponseSchema>;

// Streaming assistance request
export const AssistStreamRequestSchema = z.object({
  question: z.string().min(1),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ).default([]),
  contextSnapshot: z.record(z.unknown()).optional(),
  config: ProviderConfigSchema,
});
export type AssistStreamRequest = z.infer<typeof AssistStreamRequestSchema>;

// Streaming token response
export const StreamTokenSchema = z.object({
  type: z.literal('token'),
  token: z.string(),
  metadata: z.object({
    tokenIndex: z.number().int().nonnegative(),
  }).optional(),
});
export type StreamToken = z.infer<typeof StreamTokenSchema>;

// Stream completion response
export const StreamCompleteSchema = z.object({
  type: z.literal('complete'),
  fullContent: z.string(),
  metadata: z.object({
    totalTokens: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
  }),
});
export type StreamComplete = z.infer<typeof StreamCompleteSchema>;

// Tool execution request
export const ToolExecutionRequestSchema = z.object({
  toolId: z.string(),
  parameters: z.record(z.unknown()),
  repoPath: z.string(),
  config: ProviderConfigSchema,
});
export type ToolExecutionRequest = z.infer<typeof ToolExecutionRequestSchema>;

// RAG query request
export const RAGQueryRequestSchema = z.object({
  query: z.string().min(1),
  repoPath: z.string(),
  topK: z.number().int().positive().default(5),
  config: ProviderConfigSchema,
});
export type RAGQueryRequest = z.infer<typeof RAGQueryRequestSchema>;

// RAG query response
export const RAGQueryResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      entityId: z.string(),
      entityType: z.string(),
      relevanceScore: z.number().min(0).max(1),
      excerpt: z.string(),
    })
  ),
  metadata: z.object({
    retrievalTimeMs: z.number().nonnegative(),
    generationTimeMs: z.number().nonnegative(),
  }),
});
export type RAGQueryResponse = z.infer<typeof RAGQueryResponseSchema>;
```

### 1.2 Python Pydantic Models

**File**: `context-kit-service/src/context_kit_service/models/ai_requests.py`

```python
"""AI Request/Response Models with Pydantic validation."""
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, HttpUrl


class AIProvider(str, Enum):
    """Supported AI providers."""
    AZURE_OPENAI = "azure-openai"
    OLLAMA = "ollama"


class ProviderConfig(BaseModel):
    """AI provider configuration."""
    provider: AIProvider
    endpoint: HttpUrl
    model: str = Field(min_length=1)
    api_key: Optional[str] = None
    api_version: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, gt=0)


class EntityType(str, Enum):
    """Context entity types."""
    FEATURE = "feature"
    USERSTORY = "userstory"
    SPEC = "spec"
    TASK = "task"
    GOVERNANCE = "governance"


class GenerateEntityRequest(BaseModel):
    """Request to generate a context entity."""
    entity_type: EntityType
    user_prompt: str = Field(min_length=10)
    linked_feature_id: Optional[str] = None
    config: ProviderConfig


class GenerateEntityResponse(BaseModel):
    """Response from entity generation."""
    entity: dict[str, Any]
    metadata: dict[str, Any]


class MessageRole(str, Enum):
    """Conversation message roles."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ConversationMessage(BaseModel):
    """Single conversation message."""
    role: MessageRole
    content: str


class AssistStreamRequest(BaseModel):
    """Request to start streaming assistance."""
    question: str = Field(min_length=1)
    conversation_history: list[ConversationMessage] = Field(default_factory=list)
    context_snapshot: Optional[dict[str, Any]] = None
    config: ProviderConfig


class StreamToken(BaseModel):
    """Streaming token chunk."""
    type: Literal["token"] = "token"
    token: str
    metadata: Optional[dict[str, Any]] = None


class StreamComplete(BaseModel):
    """Stream completion signal."""
    type: Literal["complete"] = "complete"
    full_content: str
    metadata: dict[str, Any]


class ToolExecutionRequest(BaseModel):
    """Tool execution request."""
    tool_id: str
    parameters: dict[str, Any]
    repo_path: str
    config: ProviderConfig


class RAGQueryRequest(BaseModel):
    """RAG query request."""
    query: str = Field(min_length=1)
    repo_path: str
    top_k: int = Field(default=5, gt=0)
    config: ProviderConfig


class RAGSource(BaseModel):
    """RAG source document."""
    entity_id: str
    entity_type: str
    relevance_score: float = Field(ge=0, le=1)
    excerpt: str


class RAGQueryResponse(BaseModel):
    """RAG query response."""
    answer: str
    sources: list[RAGSource]
    metadata: dict[str, Any]
```

---

## Phase 2: Python Sidecar Endpoints (Week 2)

### 2.1 Entity Generation Endpoint

**File**: `context-kit-service/src/context_kit_service/endpoints/ai_generation.py`

```python
"""AI Entity Generation Endpoints."""
from fastapi import APIRouter, HTTPException
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.prompts import ChatPromptTemplate

from ..models.ai_requests import (
    GenerateEntityRequest,
    GenerateEntityResponse,
    AIProvider,
)
from ..services.entity_schemas import get_entity_pydantic_schema

router = APIRouter(prefix="/ai")


def create_llm(config):
    """Create LangChain LLM from config."""
    if config.provider == AIProvider.AZURE_OPENAI:
        return AzureChatOpenAI(
            azure_endpoint=str(config.endpoint),
            api_key=config.api_key,
            api_version=config.api_version or "2024-12-01-preview",
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
    elif config.provider == AIProvider.OLLAMA:
        return ChatOpenAI(
            base_url=str(config.endpoint),
            model=config.model,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
    else:
        raise ValueError(f"Unsupported provider: {config.provider}")


@router.post("/generate-entity", response_model=GenerateEntityResponse)
async def generate_entity(request: GenerateEntityRequest):
    """
    Generate a context entity using AI with structured output.
    
    Uses LangChain with Pydantic output parsers to guarantee schema compliance.
    """
    try:
        # Get entity-specific Pydantic schema
        schema = get_entity_pydantic_schema(request.entity_type.value)
        
        # Create LLM
        llm = create_llm(request.config)
        
        # Create output parser
        parser = PydanticOutputParser(pydantic_object=schema)
        
        # Build prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert in specification-driven development.
Generate a {entity_type} entity based on the user's requirements.
Follow the schema exactly. Use clear, professional language.

{format_instructions}"""),
            ("user", "{user_prompt}")
        ])
        
        # Create chain
        chain = prompt | llm | parser
        
        # Execute with timing
        import time
        start = time.time()
        
        result = await chain.ainvoke({
            "entity_type": request.entity_type.value,
            "user_prompt": request.user_prompt,
            "format_instructions": parser.get_format_instructions(),
        })
        
        duration_ms = (time.time() - start) * 1000
        
        # Convert Pydantic model to dict
        entity_dict = result.model_dump()
        
        return GenerateEntityResponse(
            entity=entity_dict,
            metadata={
                "prompt_tokens": 0,  # TODO: Extract from LLM metadata
                "completion_tokens": 0,
                "duration_ms": duration_ms,
                "model": request.config.model,
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 2.2 Streaming Assistance Endpoint

**File**: `context-kit-service/src/context_kit_service/endpoints/ai_assistance.py`

```python
"""AI Streaming Assistance Endpoints."""
import asyncio
import time
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from langchain.schema import HumanMessage, AIMessage, SystemMessage

from ..models.ai_requests import AssistStreamRequest, StreamToken, StreamComplete
from .ai_generation import create_llm

router = APIRouter(prefix="/ai")


async def stream_assistance(request: AssistStreamRequest) -> AsyncIterator[str]:
    """Generate streaming assistance responses."""
    try:
        llm = create_llm(request.config)
        
        # Build message history
        messages = []
        
        # Add system message
        messages.append(SystemMessage(content="""You are an intelligent assistant for a context repository.
Help users understand entities, relationships, and impact.
Provide clear, actionable insights."""))
        
        # Add conversation history
        for msg in request.conversation_history:
            if msg.role.value == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role.value == "assistant":
                messages.append(AIMessage(content=msg.content))
        
        # Add current question
        messages.append(HumanMessage(content=request.question))
        
        # Stream response
        start_time = time.time()
        full_content = ""
        token_index = 0
        
        async for chunk in llm.astream(messages):
            if hasattr(chunk, 'content') and chunk.content:
                full_content += chunk.content
                
                token = StreamToken(
                    type="token",
                    token=chunk.content,
                    metadata={"token_index": token_index}
                )
                token_index += 1
                
                # Yield SSE formatted response
                yield f"data: {token.model_dump_json()}\n\n"
                
                # Small delay to prevent overwhelming client
                await asyncio.sleep(0.01)
        
        # Send completion signal
        duration_ms = (time.time() - start_time) * 1000
        complete = StreamComplete(
            type="complete",
            full_content=full_content,
            metadata={
                "total_tokens": token_index,
                "duration_ms": duration_ms,
            }
        )
        yield f"data: {complete.model_dump_json()}\n\n"
    
    except Exception as e:
        error_data = {"type": "error", "message": str(e)}
        yield f"data: {error_data}\n\n"


@router.post("/assist-stream")
async def assist_stream(request: AssistStreamRequest):
    """
    Stream AI assistance responses using Server-Sent Events.
    
    Returns streaming tokens as they're generated for real-time UX.
    """
    return StreamingResponse(
        stream_assistance(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

---

## Phase 3: TypeScript HTTP Client (Week 3)

### 3.1 Sidecar Client with Zod Validation

**File**: `app/src/renderer/services/sidecar/aiClient.ts`

```typescript
import { z } from 'zod';
import {
  GenerateEntityRequestSchema,
  GenerateEntityResponseSchema,
  AssistStreamRequestSchema,
  StreamTokenSchema,
  StreamCompleteSchema,
  type GenerateEntityRequest,
  type GenerateEntityResponse,
  type AssistStreamRequest,
} from '@shared/sidecar/schemas';

export class SidecarAIClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate entity with full Zod validation on request/response
   */
  async generateEntity(request: GenerateEntityRequest): Promise<GenerateEntityResponse> {
    // Validate request
    const validatedRequest = GenerateEntityRequestSchema.parse(request);

    const response = await fetch(`${this.baseUrl}/ai/generate-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Entity generation failed: ${error.detail || response.statusText}`);
    }

    const data = await response.json();

    // Validate response
    return GenerateEntityResponseSchema.parse(data);
  }

  /**
   * Start streaming assistance with SSE
   */
  async *assistStream(request: AssistStreamRequest): AsyncGenerator<string, void, unknown> {
    // Validate request
    const validatedRequest = AssistStreamRequestSchema.parse(request);

    const response = await fetch(`${this.baseUrl}/ai/assist-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    });

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6);
          const parsed = JSON.parse(data);

          // Validate token or completion
          if (parsed.type === 'token') {
            const token = StreamTokenSchema.parse(parsed);
            yield token.token;
          } else if (parsed.type === 'complete') {
            const complete = StreamCompleteSchema.parse(parsed);
            // Stream is complete
            return;
          } else if (parsed.type === 'error') {
            throw new Error(parsed.message);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }
}
```

---

## Phase 4: Integration with assistantStore (Week 4)

### 4.1 Update assistantStore to use Sidecar

**File**: `app/src/renderer/stores/assistantStore.ts` (partial update)

```typescript
import { SidecarAIClient } from '@/services/sidecar/aiClient';
import type { GenerateEntityRequest } from '@shared/sidecar/schemas';

const sidecarClient = new SidecarAIClient();

// Inside useAssistantStore:

async function generateEntityViaSidecar(
  entityType: string,
  userPrompt: string,
  linkedFeatureId?: string
): Promise<any> {
  const config = await window.api.ai.getConfig(contextStore.repoPath);
  
  if (!config.enabled) {
    throw new Error('AI is disabled');
  }

  const request: GenerateEntityRequest = {
    entityType: entityType as any,
    userPrompt,
    linkedFeatureId,
    config: {
      provider: config.provider as any,
      endpoint: config.endpoint,
      model: config.model,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
      temperature: 0.7,
    },
  };

  const response = await sidecarClient.generateEntity(request);
  return response.entity;
}

async function sendMessageWithStreaming(sessionId: string, content: string): Promise<void> {
  const config = await window.api.ai.getConfig(contextStore.repoPath);
  
  const request = {
    question: content,
    conversationHistory: conversation.value.map(turn => ({
      role: turn.role,
      content: turn.content,
    })),
    contextSnapshot: {}, // Build from contextStore
    config: {
      provider: config.provider as any,
      endpoint: config.endpoint,
      model: config.model,
      apiKey: config.apiKey,
    },
  };

  let accumulatedContent = '';
  
  for await (const token of sidecarClient.assistStream(request)) {
    accumulatedContent += token;
    // Update UI with streaming token
    // ... emit to reactive state
  }
}
```

---

## Phase 5: Remove TypeScript LangChain Dependencies (Week 5)

### 5.1 Deprecate Direct LangChain Usage

Mark these for removal:
- `app/src/main/services/LangChainAIService.ts` (keep config/credentials only)
- `app/src/main/services/EnhancedLangChainService.ts` (delete)
- `app/src/main/services/ContextRAGService.ts` (migrate to Python)

### 5.2 Update package.json

```json
{
  "dependencies": {
    // REMOVE these after migration:
    // "@langchain/community": "^1.0.0",
    // "@langchain/core": "^1.0.2",
    // "@langchain/openai": "^1.0.0",
    // "langchain": "^1.0.2",
    
    // KEEP for validation:
    "zod": "^4.1.12"
  }
}
```

---

## Migration Checklist

### Prerequisites
- [ ] Python sidecar running and healthy
- [ ] Zod schemas defined in TypeScript
- [ ] Pydantic models defined in Python
- [ ] FastAPI endpoints implemented

### Phase 1: Entity Generation
- [ ] Migrate `generateEntity()` to Python
- [ ] Add Zod validation in TypeScript client
- [ ] Test with all entity types
- [ ] Update entity builder UI to use sidecar

### Phase 2: Streaming Assistance
- [ ] Migrate `assistStream()` to Python
- [ ] Implement SSE in sidecar
- [ ] Update assistantStore streaming logic
- [ ] Test streaming performance

### Phase 3: RAG Operations
- [ ] Migrate embedding generation to Python
- [ ] Migrate similarity search to Python
- [ ] Update RAG store to call sidecar
- [ ] Test retrieval quality

### Phase 4: Configuration & Credentials
- [ ] Keep TypeScript config management (file I/O)
- [ ] Pass credentials securely to Python
- [ ] Update health checks
- [ ] Test provider switching

### Phase 5: Cleanup
- [ ] Remove TypeScript LangChain dependencies
- [ ] Delete obsolete service files
- [ ] Update tests
- [ ] Update documentation

---

## Testing Strategy

### Unit Tests (Python)
```python
# tests/test_ai_generation.py
import pytest
from context_kit_service.models.ai_requests import GenerateEntityRequest

def test_generate_feature_entity():
    request = GenerateEntityRequest(
        entity_type="feature",
        user_prompt="Create OAuth authentication feature",
        config=...
    )
    # Mock LangChain response
    # Validate response schema
```

### Integration Tests (TypeScript)
```typescript
// tests/integration/sidecar-ai.spec.ts
describe('Sidecar AI Client', () => {
  it('should generate valid entity', async () => {
    const client = new SidecarAIClient();
    const response = await client.generateEntity({
      entityType: 'feature',
      userPrompt: 'Test feature',
      config: testConfig,
    });
    expect(response.entity).toHaveProperty('id');
  });
});
```

---

## Rollout Strategy

1. **Week 1**: Schema contracts + Python models
2. **Week 2**: Python endpoints (entity generation)
3. **Week 3**: TypeScript client + Zod validation
4. **Week 4**: Feature flag: `SIDECAR_AI_ENABLED=true`
5. **Week 5**: Remove TypeScript LangChain, full cutover

---

## Success Metrics

- ✅ Zero direct `@langchain/*` imports in TypeScript
- ✅ All AI operations validate via Zod schemas
- ✅ Streaming latency < 50ms per token
- ✅ Entity generation < 5s for simple prompts
- ✅ 100% test coverage on Python endpoints

---

## References

- Constitution v1.2.0 §AI Orchestration
- [LangChain Python Docs](https://python.langchain.com/)
- [FastAPI SSE](https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse)
- [Zod Documentation](https://zod.dev/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
