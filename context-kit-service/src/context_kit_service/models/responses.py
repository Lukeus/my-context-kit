"""
Response models for Context Kit service endpoints.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class EntitySummary(BaseModel):
    """Summary of an entity in the context repository."""

    id: str
    type: str
    title: str | None = None
    status: str | None = None
    relationships: dict[str, list[str]] = Field(default_factory=dict)


class InspectResponse(BaseModel):
    """Response from context inspection."""

    overview: dict[str, Any] = Field(
        description="High-level repository overview (counts, status distribution)"
    )
    entities: list[EntitySummary] = Field(description="Detailed entity information")
    relationships: dict[str, list[dict[str, str]]] = Field(
        default_factory=dict, description="Relationship mappings"
    )
    gaps: list[str] = Field(default_factory=list, description="Identified gaps or issues")
    recommendations: list[str] = Field(
        default_factory=list, description="Improvement recommendations"
    )
    duration_ms: int = Field(description="Processing time in milliseconds")


class SpecGenerateResponse(BaseModel):
    """Response from specification generation."""

    spec_id: str = Field(description="Generated specification ID")
    spec_content: str = Field(description="Generated specification in Markdown format")
    related_entities: list[str] = Field(
        default_factory=list, description="Entity IDs referenced in spec"
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Generation metadata (model, tokens, etc.)"
    )
    log_entry_id: str = Field(description="Spec log entry ID for tracking")
    duration_ms: int = Field(description="Processing time in milliseconds")


class PromptifyResponse(BaseModel):
    """Response from specification promptification."""

    spec_id: str = Field(description="Source specification ID")
    prompt: str = Field(description="Agent-ready prompt")
    context_included: list[str] = Field(
        default_factory=list, description="Context entities included in prompt"
    )
    metadata: dict[str, Any] = Field(default_factory=dict, description="Prompt generation metadata")
    log_entry_id: str = Field(description="Spec log entry ID for tracking")
    duration_ms: int = Field(description="Processing time in milliseconds")


class CodeArtifact(BaseModel):
    """Generated code artifact."""

    path: str = Field(description="Relative file path")
    content: str = Field(description="Generated code content")
    language: str = Field(description="Programming language")
    description: str | None = Field(default=None, description="File description")


class CodegenResponse(BaseModel):
    """Response from code generation."""

    spec_id: str = Field(description="Source specification ID")
    artifacts: list[CodeArtifact] = Field(description="Generated code files")
    summary: str = Field(description="Generation summary")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Code generation metadata")
    log_entry_id: str = Field(description="Spec log entry ID for tracking")
    duration_ms: int = Field(description="Processing time in milliseconds")


class SpecLogEntry(BaseModel):
    """Specification generation log entry."""

    id: str = Field(description="Unique log entry ID")
    timestamp: datetime = Field(description="Log entry timestamp")
    request_type: str = Field(description="Type of operation: inspect, spec-generate, etc.")
    status: str = Field(description="Operation status: success, failure, partial")
    input_data: dict[str, Any] = Field(description="Input parameters")
    output_data: dict[str, Any] | None = Field(default=None, description="Output results")
    model_info: dict[str, Any] | None = Field(default=None, description="AI model information")
    error: dict[str, str] | None = Field(default=None, description="Error details if failed")
    duration_ms: int = Field(description="Operation duration in milliseconds")
    related_entities: list[str] = Field(default_factory=list, description="Related entity IDs")
    tags: list[str] = Field(default_factory=list, description="User-defined tags")


class SpecLogListResponse(BaseModel):
    """Response with list of spec log entries."""

    entries: list[dict[str, Any]] = Field(description="Log entries")
    total: int = Field(description="Total number of entries returned")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = Field(description="Service status: healthy, degraded, unhealthy")
    version: str = Field(description="Service version")
    uptime_seconds: float = Field(description="Service uptime in seconds")
    dependencies: dict[str, str] = Field(
        description="Dependency statuses (langchain, openai, etc.)"
    )
