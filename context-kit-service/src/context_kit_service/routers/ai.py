"""
FastAPI Router for AI Operations

Provides HTTP endpoints for AI-powered operations including entity generation,
streaming assistance, tool execution, and RAG queries.

All endpoints use Pydantic models for request/response validation.

@see context_kit_service/models/ai_requests.py
@see docs/python-sidecar-migration-plan.md
"""

import asyncio
import json
import time
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from ..models.ai_requests import (
    AssistStreamRequest,
    GenerateEntityRequest,
    GenerateEntityResponse,
    RAGQueryRequest,
    RAGQueryResponse,
    StreamComplete,
    StreamCompleteMetadata,
    StreamError,
    StreamToken,
    StreamTokenMetadata,
    ToolExecutionRequest,
    ToolExecutionResponse,
)
from ..services import get_langchain_service

router = APIRouter(prefix="/ai", tags=["AI Operations"])


# =============================================================================
# Entity Generation
# =============================================================================


@router.post("/generate-entity", response_model=GenerateEntityResponse)
async def generate_entity(request: GenerateEntityRequest) -> GenerateEntityResponse:
    """
    Generate an entity (feature, spec, task, etc.) using AI.
    
    This endpoint uses LangChain to orchestrate AI generation based on the
    entity type and user prompt.
    """
    start_time = time.time()
    
    try:
        langchain_service = get_langchain_service()
        
        # Generate entity using LangChain
        entity = await langchain_service.generate_entity(
            entity_type=request.entity_type,
            user_prompt=request.user_prompt,
            linked_feature_id=request.linked_feature_id,
            config=request.config,
        )
        
        duration_ms = (time.time() - start_time) * 1000
        
        # Estimate token counts (would be real from LLM response in production)
        prompt_tokens = len(request.user_prompt.split()) * 2
        completion_tokens = len(str(entity)) // 4
        
        return GenerateEntityResponse(
            entity=entity,
            metadata={
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "duration_ms": duration_ms,
                "model": request.config.model,
                "provider": request.config.provider.value,
            },
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Entity generation failed: {str(e)}",
        ) from e


# =============================================================================
# Streaming Assistance
# =============================================================================


async def generate_stream_events(
    request: AssistStreamRequest,
) -> AsyncGenerator[str, None]:
    """
    Generate Server-Sent Events for streaming AI assistance.
    
    Yields SSE-formatted events as strings.
    """
    start_time = time.time()
    
    try:
        langchain_service = get_langchain_service()
        
        full_content = ""
        token_count = 0
        
        # Stream tokens from LangChain
        async for token in langchain_service.stream_assistance(
            question=request.question,
            conversation_history=request.conversation_history,
            context_snapshot=request.context_snapshot,
            config=request.config,
        ):
            full_content += token
            token_count += 1
            
            # Create and send token event
            stream_token = StreamToken(
                type="token",
                token=token,
                metadata=StreamTokenMetadata(token_index=token_count - 1),
            )
            
            # Format as SSE
            event_data = stream_token.model_dump(by_alias=True)
            yield f"data: {json.dumps(event_data)}\n\n"
        
        # Send completion event
        duration_ms = (time.time() - start_time) * 1000
        stream_complete = StreamComplete(
            type="complete",
            full_content=full_content.strip(),
            metadata=StreamCompleteMetadata(
                total_tokens=token_count,
                duration_ms=duration_ms,
                model=request.config.model,
            ),
        )
        
        event_data = stream_complete.model_dump(by_alias=True)
        yield f"data: {json.dumps(event_data)}\n\n"
        
        # Send done signal
        yield "data: [DONE]\n\n"
    
    except Exception as e:
        # Send error event
        stream_error = StreamError(
            type="error",
            message=str(e),
            code="STREAM_ERROR",
        )
        event_data = stream_error.model_dump(by_alias=True)
        yield f"data: {json.dumps(event_data)}\n\n"


@router.post("/assist/stream")
async def assist_stream(request: AssistStreamRequest) -> StreamingResponse:
    """
    Stream AI assistance responses using Server-Sent Events.
    
    This endpoint returns a streaming response that emits tokens as they
    are generated by the AI model.
    """
    return StreamingResponse(
        generate_stream_events(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


# =============================================================================
# Tool Execution
# =============================================================================


@router.post("/tools/execute", response_model=ToolExecutionResponse)
async def execute_tool(request: ToolExecutionRequest) -> ToolExecutionResponse:
    """
    Execute an AI tool with given parameters.
    
    Tools can perform actions like code analysis, file operations, or
    interact with the repository.
    """
    start_time = time.time()
    
    try:
        langchain_service = get_langchain_service()
        
        # Execute tool using LangChain service
        result = await langchain_service.execute_tool(
            tool_id=request.tool_id,
            parameters=request.parameters,
            repo_path=request.repo_path,
            config=request.config,
        )
        
        duration_ms = (time.time() - start_time) * 1000
        
        return ToolExecutionResponse(
            result=result,
            error=None,
            metadata={
                "duration_ms": duration_ms,
                "tool_id": request.tool_id,
            },
        )
    
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        
        return ToolExecutionResponse(
            result=None,
            error=str(e),
            metadata={
                "duration_ms": duration_ms,
                "tool_id": request.tool_id,
            },
        )


# =============================================================================
# RAG Queries
# =============================================================================


@router.post("/rag/query", response_model=RAGQueryResponse)
async def rag_query(request: RAGQueryRequest) -> RAGQueryResponse:
    """
    Query the repository using Retrieval-Augmented Generation.
    
    This combines vector similarity search with AI generation to provide
    context-aware answers from the repository.
    
    Note: Full vector store implementation pending. Currently uses placeholder.
    """
    retrieval_start = time.time()
    
    try:
        langchain_service = get_langchain_service()
        
        # Execute RAG query (currently returns placeholder)
        result = await langchain_service.rag_query(
            query=request.query,
            repo_path=request.repo_path,
            top_k=request.top_k,
            entity_types=request.entity_types,
            config=request.config,
        )
        
        retrieval_time_ms = (time.time() - retrieval_start) * 1000
        
        # For now, create minimal response structure
        # TODO: Implement full vector store in Phase 3.5
        return RAGQueryResponse(
            answer=result.get("answer", "RAG query processed"),
            sources=result.get("sources", []),
            metadata={
                "retrieval_time_ms": retrieval_time_ms,
                "generation_time_ms": 0,
                "total_sources": len(result.get("sources", [])),
                "model": request.config.model,
            },
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG query failed: {str(e)}",
        ) from e
