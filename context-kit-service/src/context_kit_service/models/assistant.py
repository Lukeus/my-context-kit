"""Pydantic models for Assistant API."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class AssistantProvider(str, Enum):
    """AI provider options."""

    AZURE_OPENAI = "azure-openai"
    OLLAMA = "ollama"


class ToolCapabilityStatus(str, Enum):
    """Tool capability status."""

    ENABLED = "enabled"
    DISABLED = "disabled"
    DEGRADED = "degraded"


class HealthStatus(str, Enum):
    """Service health status."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class TaskStatus(str, Enum):
    """Task execution status."""

    PENDING = "pending"
    STREAMING = "streaming"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class TaskActionType(str, Enum):
    """Task action types."""

    PROMPT = "prompt"
    TOOL_EXECUTION = "tool-execution"
    APPROVAL = "approval"
    FALLBACK = "fallback"


# ============================================================================
# Health & Capability Models
# ============================================================================


class HealthResponse(BaseModel):
    """Health check response."""

    status: HealthStatus
    message: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    components: dict[str, Any] | None = None


class CapabilityEntry(BaseModel):
    """Individual capability entry."""

    status: ToolCapabilityStatus
    fallback: str | None = None
    rolloutNotes: str | None = None


class CapabilityProfile(BaseModel):
    """Capability manifest."""

    profileId: str = "default"
    lastUpdated: datetime = Field(default_factory=datetime.utcnow)
    capabilities: dict[str, CapabilityEntry]


# ============================================================================
# Session Models
# ============================================================================


class ProviderConfig(BaseModel):
    """Provider configuration."""

    provider: AssistantProvider
    endpoint: str
    model: str
    apiKey: str | None = None
    apiVersion: str | None = "2024-02-15-preview"
    temperature: float = 0.7
    maxTokens: int | None = None


class CreateSessionRequest(BaseModel):
    """Create assistant session request."""

    userId: str = "local-user"
    clientVersion: str = "0.1.0"
    provider: AssistantProvider | None = AssistantProvider.AZURE_OPENAI
    systemPrompt: str | None = None
    activeTools: list[str] | None = None
    config: ProviderConfig | None = None


class CreateSessionResponse(BaseModel):
    """Create session response."""

    sessionId: str = Field(default_factory=lambda: str(uuid4()))
    capabilityProfile: CapabilityProfile | None = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Message & Task Models
# ============================================================================


class SendMessageRequest(BaseModel):
    """Send message request."""

    content: str
    mode: Literal["general", "improvement", "clarification"] = "general"
    attachments: list[str] | None = None


class TaskTimestamps(BaseModel):
    """Task execution timestamps."""

    created: datetime | None = None
    firstResponse: datetime | None = None
    completed: datetime | None = None


class TaskEnvelope(BaseModel):
    """Task execution envelope."""

    taskId: str = Field(default_factory=lambda: str(uuid4()))
    status: TaskStatus = TaskStatus.PENDING
    actionType: TaskActionType = TaskActionType.PROMPT
    provenance: dict[str, Any] | None = None
    outputs: list[dict[str, Any]] = Field(default_factory=list)
    timestamps: TaskTimestamps | None = Field(default_factory=TaskTimestamps)


class SendMessageResponse(BaseModel):
    """Send message response."""

    task: TaskEnvelope


# ============================================================================
# Tool Execution Models
# ============================================================================


class ExecuteToolRequest(BaseModel):
    """Execute tool request."""

    toolId: str
    repoPath: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class ExecuteToolResponse(BaseModel):
    """Execute tool response."""

    task: TaskEnvelope
    result: dict[str, Any] | None = None
    error: str | None = None


# ============================================================================
# Pipeline Models
# ============================================================================


class PipelineName(str, Enum):
    """Available pipeline names."""

    VALIDATE = "validate"
    BUILD_GRAPH = "build-graph"
    IMPACT = "impact"
    GENERATE = "generate"


class RunPipelineRequest(BaseModel):
    """Run pipeline request."""

    pipeline: PipelineName
    args: dict[str, Any] = Field(default_factory=dict)


class RunPipelineResponse(BaseModel):
    """Run pipeline response."""

    success: bool
    output: str | None = None
    exitCode: int = 0
    durationMs: int = 0
    error: str | None = None
