"""
Specification Generation Endpoint

Generates technical specifications from requirements using LangChain.
"""

import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..models.requests import SpecGenerateRequest
from ..models.responses import SpecGenerateResponse
from ..services.context_loader import ContextLoader
from ..services.spec_generator import SpecGenerator
from ..services.spec_log_writer import SpecLogWriter

router = APIRouter()


@router.post("/generate", response_model=SpecGenerateResponse)
async def generate_spec(request: SpecGenerateRequest) -> SpecGenerateResponse:
    """
    Generate a technical specification from requirements.

    Uses LangChain and AI models to create detailed technical specifications
    based on user requirements, entity context, and optional RAG context.
    """
    start_time = time.time()

    # Validate repository path
    repo_path = Path(request.repo_path)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {request.repo_path}")

    try:
        # Generate unique spec ID
        spec_id = f"SPEC-{uuid.uuid4().hex[:8]}"

        # Load context entities
        loader = ContextLoader(repo_path)
        entities = await loader.load_entities_by_ids(request.entity_ids)

        # Load RAG context if requested
        rag_context = []
        if request.include_rag:
            rag_context = await loader.load_rag_context(request.user_prompt)

        # Generate specification using LangChain
        generator = SpecGenerator(repo_path, request.model_config)
        spec_content, metadata = await generator.generate(
            user_prompt=request.user_prompt,
            entities=entities,
            rag_context=rag_context,
            template_id=request.template_id,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Write spec log entry
        log_writer = SpecLogWriter(repo_path)
        log_entry_id = await log_writer.write_entry(
            request_type="spec-generate",
            status="success",
            input_data={
                "entity_ids": request.entity_ids,
                "user_prompt": request.user_prompt,
                "template_id": request.template_id,
                "include_rag": request.include_rag,
            },
            output_data={
                "spec_id": spec_id,
                "spec_content": spec_content[:500] + "...",  # Truncate for log
            },
            model_info=metadata.get("model_info"),
            duration_ms=duration_ms,
            related_entities=request.entity_ids,
        )

        response = SpecGenerateResponse(
            spec_id=spec_id,
            spec_content=spec_content,
            related_entities=request.entity_ids,
            metadata=metadata,
            log_entry_id=log_entry_id,
            duration_ms=duration_ms,
        )
        
        # Convert to dict to ensure JSON serializability across IPC boundary
        return response.model_dump()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate specification: {str(e)}")
