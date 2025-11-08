"""Assistant API endpoints."""

import json
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..models.assistant import (
    CapabilityProfile,
    CreateSessionRequest,
    CreateSessionResponse,
    ExecuteToolRequest,
    ExecuteToolResponse,
    HealthResponse,
    HealthStatus,
    RunPipelineRequest,
    RunPipelineResponse,
    SendMessageRequest,
    SendMessageResponse,
    TaskActionType,
    TaskEnvelope,
    TaskStatus,
    TaskTimestamps,
)
from ..services.assistant_session_manager import get_session_manager
from ..services.capability_checker import get_capability_profile
from ..services.context_file_reader import get_context_file_reader
from ..services.pipeline_executor import get_pipeline_executor

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/health")
async def get_health():
    """Get service health status."""
    # TODO: Add actual health checks (DB, LangChain, etc.)
    response = HealthResponse(
        status=HealthStatus.HEALTHY,
        message="Assistant service operational",
        components={
            "langchain": "available",
            "pipelines": "available",
            "storage": "available",
        },
    )
    return response.model_dump(mode='json')


@router.get("/capabilities")
async def get_capabilities():
    """Get capability manifest."""
    profile = await get_capability_profile()
    return profile.model_dump(mode='json')


@router.post("/sessions")
async def create_session(request: CreateSessionRequest):
    """Create new assistant session."""
    manager = get_session_manager()
    response = await manager.create_session(request)
    # Convert to dict with mode='json' to ensure JSON serializability across IPC boundary
    return response.model_dump(mode='json')


@router.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, request: SendMessageRequest):
    """Send message to assistant."""
    print(f"[Endpoint] Received message for session {session_id}: {request.content[:50]}...")
    manager = get_session_manager()

    try:
        task = await manager.send_message(session_id, request)
        print(f"[Endpoint] Message sent successfully, task: {task.taskId}")
        response = SendMessageResponse(task=task)
        return response.model_dump(mode='json')
    except ValueError as e:
        print(f"[Endpoint] ValueError caught: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        print(f"[Endpoint] Unexpected error: {type(e).__name__}: {e}")
        print(f"[Endpoint] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/stream")
async def stream_messages(session_id: str, content: str, mode: str = "general"):
    """Stream assistant response via SSE."""
    manager = get_session_manager()

    async def event_generator():
        """Generate SSE events."""
        request = SendMessageRequest(content=content, mode=mode)  # type: ignore
        try:
            async for event in manager.stream_message(session_id, request):
                # Format as SSE
                yield f"data: {json.dumps(event)}\n\n"
        except ValueError as e:
            error_event = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_generator(), media_type="text/event-stream"
    )


@router.post("/sessions/{session_id}/tools/execute")
async def execute_tool(session_id: str, request: ExecuteToolRequest):
    """Execute a tool."""
    manager = get_session_manager()
    session = manager.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    # Create task
    task = TaskEnvelope(
        taskId=str(uuid4()),
        status=TaskStatus.PENDING,
        actionType=TaskActionType.TOOL_EXECUTION,
        timestamps=TaskTimestamps(created=datetime.utcnow()),
    )

    session.add_task(task)

    try:
        # Route to appropriate tool handler
        if request.toolId.startswith("pipeline."):
            # Pipeline execution
            pipeline_name = request.toolId.replace("pipeline.", "")
            pipeline_request = RunPipelineRequest(
                pipeline=pipeline_name, args=request.parameters  # type: ignore
            )

            executor = get_pipeline_executor()
            result = await executor.run_pipeline(request.repoPath, pipeline_request)

            task.status = TaskStatus.SUCCEEDED if result.success else TaskStatus.FAILED
            task.timestamps.completed = datetime.utcnow()
            task.outputs.append(
                {
                    "type": "pipeline_result",
                    "output": result.output,
                    "exitCode": result.exitCode,
                    "durationMs": result.durationMs,
                }
            )

            response = ExecuteToolResponse(
                task=task,
                result={
                    "success": result.success,
                    "output": result.output,
                    "exitCode": result.exitCode,
                    "durationMs": result.durationMs,
                },
                error=result.error,
            )
            return response.model_dump(mode='json')

        elif request.toolId == "context.read":
            # Context file reading
            file_path = request.parameters.get("path")
            if not file_path:
                raise ValueError("Missing required parameter: path")

            reader = get_context_file_reader()
            file_data = await reader.read_file(
                request.repoPath,
                file_path,
                encoding=request.parameters.get("encoding", "utf-8"),
            )

            task.status = TaskStatus.SUCCEEDED
            task.timestamps.completed = datetime.utcnow()
            task.outputs.append({"type": "file_content", **file_data})

            response = ExecuteToolResponse(task=task, result=file_data)
            return response.model_dump(mode='json')

        else:
            # Unknown tool
            task.status = TaskStatus.FAILED
            task.timestamps.completed = datetime.utcnow()

            response = ExecuteToolResponse(
                task=task, error=f"Unknown tool: {request.toolId}"
            )
            return response.model_dump(mode='json')

    except Exception as e:
        task.status = TaskStatus.FAILED
        task.timestamps.completed = datetime.utcnow()
        response = ExecuteToolResponse(task=task, error=str(e))
        return response.model_dump(mode='json')


@router.post("/sessions/{session_id}/pipelines/run")
async def run_pipeline(
    session_id: str, repo_path: str, request: RunPipelineRequest
):
    """Run a context repository pipeline."""
    manager = get_session_manager()
    session = manager.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    executor = get_pipeline_executor()
    result = await executor.run_pipeline(repo_path, request)

    # Convert to dict with mode='json' to ensure JSON serializability
    return result.model_dump(mode='json') if hasattr(result, 'model_dump') else result
