"""
Request models for Context Kit service endpoints.
"""

from typing import Any

from pydantic import BaseModel, Field


class InspectRequest(BaseModel):
    """Request to inspect context repository structure."""

    repo_path: str = Field(..., description="Path to the context repository")
    include_types: list[str] | None = Field(
        default=None, description="Entity types to include (default: all)"
    )
    depth: int = Field(default=2, ge=1, le=5, description="Depth of relationship traversal")


class SpecGenerateRequest(BaseModel):
    """Request to generate a technical specification."""

    repo_path: str = Field(..., description="Path to the context repository")
    entity_ids: list[str] = Field(..., description="Entity IDs to generate spec from")
    user_prompt: str = Field(..., min_length=1, description="User's natural language requirement")
    template_id: str | None = Field(default=None, description="Template to use for generation")
    include_rag: bool = Field(default=True, description="Include RAG context in generation")
    llm_config: dict[str, Any] | None = Field(
        default=None, description="Override LLM configuration"
    )


class PromptifyRequest(BaseModel):
    """Request to convert specification into agent-ready prompt."""

    repo_path: str = Field(..., description="Path to the context repository")
    spec_id: str = Field(..., description="Specification ID or content to promptify")
    spec_content: str | None = Field(default=None, description="Specification content if not ID")
    target_agent: str = Field(
        default="codegen", description="Target agent type (codegen, review, test)"
    )
    include_context: bool = Field(default=True, description="Include relevant context entities")


class CodegenRequest(BaseModel):
    """Request to generate code from specification."""

    repo_path: str = Field(..., description="Path to the context repository")
    spec_id: str = Field(..., description="Specification ID")
    prompt: str | None = Field(default=None, description="Agent-ready prompt (optional)")
    output_path: str | None = Field(default=None, description="Target path for generated code")
    language: str | None = Field(default=None, description="Target programming language")
    framework: str | None = Field(default=None, description="Target framework")
    style_guide: str | None = Field(default=None, description="Code style guidelines")
    llm_config: dict[str, Any] | None = Field(
        default=None, description="Override LLM configuration"
    )
