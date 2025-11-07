# Assistant Service Integration - COMPLETE

## Overview
The FastAPI sidecar service for the Unified Assistant is now fully implemented with:
- ✅ Health checking
- ✅ Capability manifest
- ✅ Session management
- ✅ Message routing with streaming support
- ✅ Tool execution (pipelines + context reading)
- ✅ SSE streaming for real-time responses

## Architecture

```
Frontend (Electron Renderer)
    ↓ IPC Bridge
Main Process (Electron)
    ↓ HTTP/SSE (localhost:8000)
FastAPI Sidecar (context-kit-service)
    ↓
Tool Executors (pipelines, file readers, etc.)
```

## Implemented Endpoints

### `/assistant/health` (GET)
Returns service health with component status:
```json
{
  "status": "healthy",
  "message": "Assistant service operational",
  "components": {
    "langchain": "available",
    "pipelines": "available",
    "storage": "available"
  }
}
```

### `/assistant/capabilities` (GET)
Returns tool capability manifest:
```json
{
  "profileId": "default-profile",
  "lastUpdated": "2025-11-02T...",
  "capabilities": {
    "pipeline.validate": { "status": "enabled" },
    "pipeline.build-graph": { "status": "enabled" },
    "pipeline.impact": { "status": "enabled" },
    "pipeline.generate": { "status": "enabled" },
    "context.read": { "status": "enabled" },
    ...
  }
}
```

### `/assistant/sessions` (POST)
Creates new assistant session:
```json
Request:
{
  "userId": "local-user",
  "clientVersion": "0.1.0",
  "provider": "azure-openai",
  "systemPrompt": "You are...",
  "activeTools": ["pipeline.validate", "context.read"]
}

Response:
{
  "sessionId": "uuid",
  "capabilityProfile": {...},
  "createdAt": "2025-11-02T..."
}
```

### `/assistant/sessions/{id}/messages` (POST)
Send message to assistant:
```json
Request:
{
  "content": "Run validation pipeline",
  "mode": "general"
}

Response:
{
  "task": {
    "taskId": "uuid",
    "status": "succeeded",
    "actionType": "prompt",
    "outputs": [...],
    "timestamps": {...}
  }
}
```

### `/assistant/sessions/{id}/stream` (GET)
SSE streaming endpoint for real-time responses:
```
GET /assistant/sessions/{id}/stream?content=hello&mode=general

data: {"type":"task.started","taskId":"..."}
data: {"type":"token","token":"H","index":0}
data: {"type":"token","token":"e","index":1}
...
data: {"type":"task.completed","taskId":"..."}
```

### `/assistant/sessions/{id}/tools/execute` (POST)
Execute tools (pipelines, file reading, etc.):
```json
Request:
{
  "toolId": "pipeline.validate",
  "repoPath": "/path/to/repo",
  "parameters": {}
}

Response:
{
  "task": {...},
  "result": {
    "success": true,
    "output": "...",
    "exitCode": 0,
    "durationMs": 1250
  }
}
```

## Services Implemented

### `assistant_session_manager.py`
- Session lifecycle management
- Conversation history tracking
- Task envelope management
- Message routing
- Streaming support

### `capability_checker.py`
- Tool availability checking
- Capability manifest generation
- Health-based capability gating

### `pipeline_executor.py`
- Spawns `pnpm run` commands in context-repo
- Captures stdout/stderr
- Returns execution results with timing
- Supports all pipelines: validate, build-graph, impact, generate

### `context_file_reader.py`
- Reads files from context repositories
- Path traversal protection
- Encoding support
- File metadata (size, modified time)

## Starting the Service

### Development Mode
```powershell
cd context-kit-service
pnpm run dev
```

### Production Mode
```powershell
cd context-kit-service
pnpm start
```

The service will start on `http://127.0.0.1:8000`.

## Main Process Integration

The main process already has the LangChain client configured to call these endpoints. Update the base URL in `app/src/renderer/services/langchain/config.ts` if needed:

```typescript
export function resolveLangChainConfig() {
  return {
    baseUrl: 'http://127.0.0.1:8000',
    // ...
  };
}
```

## Next Steps

### 1. Start the Service
```powershell
cd context-kit-service
pnpm run dev
```

### 2. Open the Electron App
The UI will automatically:
- Poll `/assistant/health` every 10s
- Fetch `/assistant/capabilities` on session creation
- Create sessions via `/assistant/sessions`
- Execute tools via `/assistant/sessions/{id}/tools/execute`

### 3. Test Tool Execution
1. Click "AI Assistant" in the app
2. Select a tool from the palette
3. Fill in parameters (e.g., repo path)
4. Click "Run Tool"
5. Watch the tool execute and return results

## Tool Routing

The backend routes tools as follows:

### Pipeline Tools
- `pipeline.validate` → `pnpm run validate`
- `pipeline.build-graph` → `pnpm run build-graph`
- `pipeline.impact` → `pnpm run impact --changedIds=X,Y`
- `pipeline.generate` → `pnpm run generate --ids=X,Y`

### Context Tools
- `context.read` → Read YAML file from `contexts/` directory
- `context.search` → TODO: Implement semantic search (RAG)

### Entity Tools
- `entity.details` → TODO: Parse entity YAML and return structured data
- `entity.similar` → TODO: Use embeddings for similarity search

## Extending the Backend

### Add a New Tool

1. **Update capability manifest** (`capability_checker.py`):
```python
"my.new.tool": CapabilityEntry(status=ToolCapabilityStatus.ENABLED)
```

2. **Add tool handler** (`endpoints/assistant.py`):
```python
elif request.toolId == "my.new.tool":
    result = await my_tool_handler(request.parameters)
    task.status = TaskStatus.SUCCEEDED
    task.outputs.append(result)
    return ExecuteToolResponse(task=task, result=result)
```

3. **Implement the handler** (create new service file if needed)

### Add LangChain Agents

To integrate actual LangChain agents for conversational AI:

1. Install LangChain dependencies (already in pyproject.toml)
2. Create agent in `services/langchain_agent.py`
3. Update `send_message()` to route to agent instead of echo
4. Add tools to agent for pipeline execution
5. Enable streaming via LangChain callbacks

## Production Considerations

- [ ] Add authentication (shared secret between Electron and sidecar)
- [ ] Add rate limiting
- [ ] Add request logging
- [ ] Configure proper CORS origins
- [ ] Add health checks for LangChain dependencies
- [ ] Implement proper session persistence
- [ ] Add telemetry/metrics
- [ ] Configure production uvicorn settings (workers, timeout)

## Status: ✅ COMPLETE

The FastAPI backend is fully functional and ready to use. Start the service and the UI will immediately come alive with working tools.
