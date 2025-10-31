"""
Code Generation Endpoint

Generates code artifacts from specifications and prompts.
"""

import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..models.requests import CodegenRequest
from ..models.responses import CodeArtifact, CodegenResponse
from ..services.code_generator import CodeGenerator
from ..services.context_loader import ContextLoader
from ..services.spec_log_writer import SpecLogWriter

router = APIRouter()


@router.post("/from-spec", response_model=CodegenResponse)
async def generate_code(request: CodegenRequest) -> CodegenResponse:
    """
    Generate code from specification.

    Produces implementation artifacts based on specification and optional
    agent-ready prompt, following project conventions and style guides.
    """
    start_time = time.time()

    # Validate repository path
    repo_path = Path(request.repo_path)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {request.repo_path}")

    try:
        # Load specification
        loader = ContextLoader(repo_path)
        spec = await loader.load_spec_by_id(request.spec_id)

        # Use provided prompt or load from spec
        prompt = request.prompt
        if not prompt:
            # Could load pre-generated prompt from spec-log
            prompt = spec  # Fallback to spec content

        # Load stack and domain information for context
        stack_info = await loader.load_stack_info()
        domain_info = await loader.load_domain_info()

        # Generate code artifacts
        generator = CodeGenerator(repo_path, request.model_config)
        artifacts, summary, metadata = await generator.generate(
            spec_id=request.spec_id,
            spec_content=spec,
            prompt=prompt,
            stack_info=stack_info,
            domain_info=domain_info,
            language=request.language,
            framework=request.framework,
            style_guide=request.style_guide,
        )

        duration_ms = int((time.time() - start_time) * 1000)

        # Write spec log entry
        log_writer = SpecLogWriter(repo_path)
        log_entry_id = await log_writer.write_entry(
            request_type="codegen",
            status="success",
            input_data={
                "spec_id": request.spec_id,
                "language": request.language,
                "framework": request.framework,
                "output_path": request.output_path,
            },
            output_data={
                "artifacts_count": len(artifacts),
                "artifact_paths": [a.path for a in artifacts],
                "summary": summary,
            },
            model_info=metadata.get("model_info"),
            duration_ms=duration_ms,
            related_entities=[request.spec_id],
        )

        # Convert to response format
        code_artifacts = [
            CodeArtifact(
                path=artifact.path,
                content=artifact.content,
                language=artifact.language,
                description=artifact.description,
            )
            for artifact in artifacts
        ]

        return CodegenResponse(
            spec_id=request.spec_id,
            artifacts=code_artifacts,
            summary=summary,
            metadata=metadata,
            log_entry_id=log_entry_id,
            duration_ms=duration_ms,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate code: {str(e)}")
