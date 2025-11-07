# Phase 3: LangChain Agent Integration - COMPLETE ✅

**Date**: November 2, 2025  
**Status**: Real AI responses now enabled with LangChain orchestration

## Overview

Phase 3 replaces the echo/mock responses in the assistant backend with actual LangChain-powered AI conversations. The service now invokes Azure OpenAI (or OpenAI) models with proper tool support, streaming, and conversation history.

## What Was Implemented

### 1. LangChain Agent Service (`services/langchain_agent.py`)

Created a new service that wraps LangChain's agent framework:

**Key Features**:
- **Provider Support**: Azure OpenAI (with APIM detection), standard OpenAI, Ollama placeholder
- **Lazy Initialization**: LLM and agent executor created on first use
- **Tool Integration**: Converts tool IDs to LangChain Tool objects
- **Streaming Support**: Token-by-token streaming via `astream()`
- **Conversation History**: Maintains chat history across turns
- **Error Handling**: Graceful fallback with error messages

**Components**:
```python
class LangChainAgent:
    - llm property: Lazy-loads AzureChatOpenAI or ChatOpenAI
    - agent_executor property: Creates OpenAI tools agent with prompt template
    - invoke(message, chat_history): Synchronous agent invocation
    - stream(message, chat_history): Async generator for streaming
    - invoke_with_tools(): Future tool execution callbacks
```

**Tool Mapping**:
- `pipeline.validate` → `validate_pipeline` tool
- `pipeline.build-graph` → `build_dependency_graph` tool  
- `pipeline.impact` → `analyze_impact` tool
- `pipeline.generate` → `generate_prompts` tool
- `context.read` → `read_context_file` tool

**Note**: Current tools are placeholder functions that return descriptive strings. Real implementations will come in Phase 4.

### 2. Updated Session Manager (`services/assistant_session_manager.py`)

Modified to use real LangChain agent instead of echo responses:

**Changes**:
1. **Import LangChain Agent**: Added `from .langchain_agent import create_agent, LangChainAgent`
2. **Agent Property**: Added `_agent` field and lazy `agent` property to `AssistantSession`
3. **Real Invoke**: `send_message()` now calls `session.agent.invoke()` with conversation history
4. **Real Streaming**: `stream_message()` now streams tokens from `session.agent.stream()`
5. **Error Handling**: Both methods wrap agent calls in try/except with proper task status updates

**Before** (echo):
```python
await asyncio.sleep(0.1)
task.status = TaskStatus.SUCCEEDED
task.outputs.append({"content": f"Echo: {request.content}"})
```

**After** (real AI):
```python
chat_history = [msg for msg in session.messages[:-1]]
response = await session.agent.invoke(
    message=request.content,
    chat_history=chat_history,
)
task.status = TaskStatus.SUCCEEDED
task.outputs.append({"content": response})
```

## How It Works

### 1. Session Creation

```
User sends message
    ↓
AssistantStore.sendMessage(sessionId, {content, mode})
    ↓
FastAPI POST /assistant/sessions/{id}/messages
    ↓
AssistantSessionManager.send_message()
    ↓
Session.agent (lazy-init LangChainAgent)
    ↓
LangChainAgent.llm (lazy-init AzureChatOpenAI)
    ↓
Agent reads credentials from environment:
  - AZURE_OPENAI_API_KEY
  - AZURE_OPENAI_ENDPOINT
  - AZURE_OPENAI_DEPLOYMENT
```

### 2. Message Processing

```
LangChainAgent.invoke(message, chat_history)
    ↓
Build LangChain messages:
  - SystemMessage(system_prompt)
  - [HumanMessage, AIMessage, ...] (history)
  - HumanMessage(current message)
    ↓
AgentExecutor.ainvoke({input, chat_history})
    ↓
Agent uses OpenAI tools format
    ↓
LLM generates response (with tool calls if needed)
    ↓
Return response text
```

### 3. Streaming

```
LangChainAgent.stream(message, chat_history)
    ↓
Build message list (same as above)
    ↓
async for chunk in llm.astream(messages):
    yield chunk.content
    ↓
Frontend receives SSE events:
  - {type: "task.started"}
  - {type: "token", token: "H", index: 0}
  - {type: "token", token: "e", index: 1}
  - ...
  - {type: "task.completed"}
```

## Configuration

The agent uses environment variables passed from Electron:

```typescript
// Electron main process (ContextKitServiceClient.ts)
this.process = spawn(pythonExec, uvicornArgs, {
  env: {
    AZURE_OPENAI_API_KEY: azureApiKey,
    AZURE_OPENAI_ENDPOINT: azureEndpoint,
    AZURE_OPENAI_DEPLOYMENT: azureDeployment
  }
});
```

```python
# Python service (langchain_agent.py)
api_key = os.getenv("AZURE_OPENAI_API_KEY")
azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT")
```

## Testing

### 1. Verify Service Restart

After making these changes, restart the service:

```powershell
# The service auto-restarts when you launch the app
cd app
pnpm start
```

### 2. Test AI Response

1. Open the app
2. Click "AI Assistant"
3. Send a message: "Hello, can you help me understand context repositories?"
4. You should now see a real AI response instead of "Echo: ..."

### 3. Test Streaming

1. In Assistant Settings, ensure "Enable streaming responses" is checked
2. Send a message
3. Watch tokens appear one by one in the transcript

### 4. Test Tool Awareness

Try asking the agent about available tools:
- "What tools can you use?"
- "Can you validate my context repository?"
- "How do I run the build-graph pipeline?"

The agent should mention the available tools (validate_pipeline, build_dependency_graph, etc.).

## Known Limitations

### Current Tool Implementation

Tools are **placeholders** that return descriptive strings:

```python
Tool(
    name="validate_pipeline",
    description="Validate YAML entities...",
    func=lambda x: "Pipeline validation would be executed here."
)
```

### Next Steps (Phase 4)

To make tools actually functional:

1. **Create Real Tool Functions**:
   ```python
   async def execute_validate_pipeline(repo_path: str) -> str:
       from .pipeline_executor import run_pipeline
       result = await run_pipeline(PipelineName.VALIDATE, repo_path, {})
       return result.output
   ```

2. **Update Tool Definitions**:
   ```python
   tools.append(
       Tool(
           name="validate_pipeline",
           description="Validate YAML entities...",
           func=execute_validate_pipeline,  # Real function
           coroutine=execute_validate_pipeline  # For async
       )
   )
   ```

3. **Wire to Existing Services**:
   - Connect to `pipeline_executor.py` for pipeline tools
   - Connect to `context_file_reader.py` for file reading
   - Add semantic search service for `context.search`

## Error Handling

The implementation includes comprehensive error handling:

### Agent Initialization Errors

```python
try:
    response = await session.agent.invoke(...)
except ValueError as e:
    # Missing API key or configuration
    task.status = TaskStatus.FAILED
    task.outputs.append({"type": "error", "content": str(e)})
```

### API Errors

```python
except Exception as e:
    # LLM API errors, network issues, etc.
    task.status = TaskStatus.FAILED
    yield {"type": "task.failed", "error": str(e)}
```

### User-Facing Messages

Errors are surfaced in the UI:
- Red banner for service unavailable
- Error messages in transcript
- Task status shows "failed" with error details

## Architecture Benefits

### 1. Separation of Concerns
- **LangChainAgent**: LLM orchestration, tool management
- **AssistantSession**: Session state, conversation history
- **SessionManager**: Session lifecycle, task coordination

### 2. Extensibility
- Easy to add new tools (just update `_get_tools()`)
- Easy to switch providers (Ollama, GPT-4, Claude)
- Easy to customize prompts per session

### 3. Testability
- Agent can be tested independently
- Mock tools for unit tests
- Real integration tests with API

## Performance Considerations

### Lazy Initialization
- LLM only created when first message sent
- Agent executor built once per session
- Reduces memory for idle sessions

### Streaming
- Tokens sent immediately (low latency)
- Client can display partial responses
- Better perceived performance

### Caching
- Conversation history reused across turns
- Agent state persists for session lifetime
- No redundant LLM initialization

## Security

### Credential Handling
- API keys never logged
- Passed via environment variables only
- Encrypted in Electron (safeStorage)

### Prompt Injection Protection
- System prompt clearly defines role
- Tools have explicit descriptions
- Agent executor has max iterations limit (10)

### Error Messages
- Don't expose internal paths
- Don't leak API keys or sensitive data
- User-friendly error descriptions

## Summary

✅ **Phase 3 Complete**: The assistant backend now provides real AI responses via LangChain

**What Works**:
- Real conversational AI powered by Azure OpenAI
- Token streaming for responsive UX
- Conversation history maintained across turns
- Tool awareness (agent knows what tools it has)
- Error handling with user-friendly messages
- Support for both standard invoke and streaming modes

**What's Next (Phase 4)**:
- Implement actual tool functions (not placeholders)
- Wire tools to existing services (pipeline_executor, context_file_reader)
- Add semantic search for context.search tool
- Add entity parsing for entity.details tool
- Add vector similarity for entity.similar tool
- Production hardening (authentication, rate limiting, logging)

The assistant is now **functional for conversations** and ready for tool execution in Phase 4!
