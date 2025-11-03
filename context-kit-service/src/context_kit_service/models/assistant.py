"""Pydantic models for Assistant API."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional
from uuid import UUID, uuid4

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
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    components: Optional[dict[str, Any]] = None


class CapabilityEntry(BaseModel):
    """Individual capability entry."""

    status: ToolCapabilityStatus
    fallback: Optional[str] = None
    rolloutNotes: Optional[str] = None


class CapabilityProfile(BaseModel):
    """Capability manifest."""

    profileId: str = "default"
    lastUpdated: datetime = Field(default_factory=datetime.utcnow)
    capabilities: dict[str, CapabilityEntry]


# ============================================================================
# Session Models
# ============================================================================


class CreateSessionRequest(BaseModel):
    """Create assistant session request."""

    userId: str = "local-user"
    clientVersion: str = "0.1.0"
    provider: Optional[AssistantProvider] = AssistantProvider.AZURE_OPENAI
    systemPrompt: Optional[str] = None
    activeTools: Optional[list[str]] = None


class CreateSessionResponse(BaseModel):
    """Create session response."""

    sessionId: str = Field(default_factory=lambda: str(uuid4()))
    capabilityProfile: Optional[CapabilityProfile] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Message & Task Models
# ============================================================================


class SendMessageRequest(BaseModel):
    """Send message request."""

    content: str
    mode: Literal["general", "improvement", "clarification"] = "general"
    attachments: Optional[list[str]] = None


class TaskTimestamps(BaseModel):
    """Task execution timestamps."""

    created: Optional[datetime] = None
    firstResponse: Optional[datetime] = None
    completed: Optional[datetime] = None


class TaskEnvelope(BaseModel):
    """Task execution envelope."""

    taskId: str = Field(default_factory=lambda: str(uuid4()))
    status: TaskStatus = TaskStatus.PENDING
    actionType: TaskActionType = TaskActionType.PROMPT
    provenance: Optional[dict[str, Any]] = None
    outputs: list[dict[str, Any]] = Field(default_factory=list)
    timestamps: Optional[TaskTimestamps] = Field(default_factory=TaskTimestamps)


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
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None


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
    output: Optional[str] = None
    exitCode: int = 0
    durationMs: int = 0
    error: Optional[str] = None
