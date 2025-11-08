"""
Promptify Endpoint

Converts specifications into agent-ready prompts for code generation.
"""

import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..models.requests import PromptifyRequest
from ..models.responses import PromptifyResponse
from ..services.context_loader import ContextLoader
from ..services.promptifier import Promptifier
from ..services.spec_log_writer import SpecLogWriter

router = APIRouter()


@router.post("/promptify", response_model=PromptifyResponse)
async def promptify_spec(request: PromptifyRequest) -> PromptifyResponse:
    """
    Convert specification into agent-ready prompt.

    Transforms a detailed specification into a focused, actionable prompt
    optimized for code generation agents.
    """
    start_time = time.time()

    # Validate repository path
    repo_path = Path(request.repo_path)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {request.repo_path}")

    try:
        # Load specification
        spec_content = request.spec_content
        if not spec_content:
            loader = ContextLoader(repo_path)
            spec_content = await loader.load_spec_by_id(request.spec_id)

        # Load additional context if requested
        context_entities = []
        if request.include_context:
            loader = ContextLoader(repo_path)
            context_entities = await loader.load_related_entities(request.spec_id)

        # Generate agent-ready prompt
        promptifier = Promptifier(repo_path)
        prompt, metadata = await promptifier.promptify(
            spec_id=request.spec_id,
            spec_content=spec_content,
            context_entities=context_entities,
            target_agent=request.target_agent,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Write spec log entry
        log_writer = SpecLogWriter(repo_path)
        log_entry_id = await log_writer.write_entry(
            request_type="promptify",
            status="success",
            input_data={
                "spec_id": request.spec_id,
                "target_agent": request.target_agent,
                "include_context": request.include_context,
            },
            output_data={
                "prompt_length": len(prompt),
                "context_entities": [e.get("id") for e in context_entities],
            },
            model_info=metadata.get("model_info"),
            duration_ms=duration_ms,
            related_entities=[request.spec_id],
        )

        response = PromptifyResponse(
            spec_id=request.spec_id,
            prompt=prompt,
            context_included=[e.get("id") for e in context_entities],
            metadata=metadata,
            log_entry_id=log_entry_id,
            duration_ms=duration_ms,
        )

        # Convert to dict with mode='json' to ensure JSON serializability across IPC boundary
        # This handles Pydantic models, dates, and other complex types that cause cloning issues
        return response.model_dump(mode='json')

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to promptify specification: {str(e)}")
