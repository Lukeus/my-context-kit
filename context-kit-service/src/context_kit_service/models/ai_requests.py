"""
Pydantic Models for Python Sidecar AI Operations

These models define the type-safe contract between TypeScript (Electron)
and Python (FastAPI sidecar) for all AI operations.

Mirrors: app/src/shared/sidecar/schemas.ts

@see docs/python-sidecar-migration-plan.md
"""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, HttpUrl, field_validator


# =============================================================================
# Provider Configuration
# =============================================================================


class AIProvider(str, Enum):
    """AI provider types"""

    AZURE_OPENAI = "azure-openai"
    OLLAMA = "ollama"


class ProviderConfig(BaseModel):
    """Configuration for AI provider connection"""

    provider: AIProvider
    endpoint: HttpUrl
    model: str = Field(min_length=1)
    api_key: Optional[str] = Field(None, alias="apiKey")
    api_version: Optional[str] = Field(None, alias="apiVersion")
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(None, gt=0, alias="maxTokens")

    class Config:
        populate_by_name = True  # Allow both snake_case and camelCase


# =============================================================================
# Entity Generation
# =============================================================================


class EntityType(str, Enum):
    """Entity types that can be generated"""

    FEATURE = "feature"
    USERSTORY = "userstory"
    SPEC = "spec"
    TASK = "task"
    GOVERNANCE = "governance"


class GenerateEntityRequest(BaseModel):
    """Request to generate an entity with AI"""

    entity_type: EntityType = Field(alias="entityType")
    user_prompt: str = Field(min_length=10, alias="userPrompt")
    linked_feature_id: Optional[str] = Field(None, alias="linkedFeatureId")
    config: ProviderConfig

    class Config:
        populate_by_name = True

    @field_validator("user_prompt")
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("Prompt must be at least 10 characters")
        return v


class GenerateEntityMetadata(BaseModel):
    """Metadata about entity generation"""

    prompt_tokens: int = Field(ge=0, alias="promptTokens")
    completion_tokens: int = Field(ge=0, alias="completionTokens")
    duration_ms: float = Field(ge=0, alias="durationMs")
    model: str
    provider: Optional[str] = None

    class Config:
        populate_by_name = True


class GenerateEntityResponse(BaseModel):
    """Response from entity generation"""

    entity: Dict[str, Any]
    metadata: GenerateEntityMetadata


# =============================================================================
# Streaming Assistance
# =============================================================================


class MessageRole(str, Enum):
    """Role of a conversation message"""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ConversationMessage(BaseModel):
    """A message in a conversation history"""

    role: MessageRole
    content: str
    timestamp: Optional[str] = None


class AssistStreamRequest(BaseModel):
    """Request for streaming assistance"""

    question: str = Field(min_length=1)
    conversation_history: List[ConversationMessage] = Field(
        default_factory=list, alias="conversationHistory"
    )
    context_snapshot: Optional[Dict[str, Any]] = Field(None, alias="contextSnapshot")
    config: ProviderConfig

    class Config:
        populate_by_name = True

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Question cannot be empty")
        return v


# Streaming response types (Server-Sent Events)


class StreamTokenMetadata(BaseModel):
    """Metadata for a single stream token"""

    token_index: int = Field(ge=0, alias="tokenIndex")

    class Config:
        populate_by_name = True


class StreamToken(BaseModel):
    """Individual token in streaming response"""

    type: Literal["token"] = "token"
    token: str
    metadata: Optional[StreamTokenMetadata] = None


class StreamCompleteMetadata(BaseModel):
    """Metadata for stream completion"""

    total_tokens: int = Field(ge=0, alias="totalTokens")
    duration_ms: float = Field(ge=0, alias="durationMs")
    model: Optional[str] = None

    class Config:
        populate_by_name = True


class StreamComplete(BaseModel):
    """Signal that streaming is complete"""

    type: Literal["complete"] = "complete"
    full_content: str = Field(alias="fullContent")
    metadata: StreamCompleteMetadata

    class Config:
        populate_by_name = True


class StreamError(BaseModel):
    """Error during streaming"""

    type: Literal["error"] = "error"
    message: str
    code: Optional[str] = None


# Union type for all stream events
StreamEvent = Union[StreamToken, StreamComplete, StreamError]


# =============================================================================
# Tool Execution
# =============================================================================


class ToolExecutionRequest(BaseModel):
    """Request to execute an AI tool"""

    tool_id: str = Field(min_length=1, alias="toolId")
    parameters: Dict[str, Any]
    repo_path: str = Field(alias="repoPath")
    config: ProviderConfig

    class Config:
        populate_by_name = True


class ToolExecutionMetadata(BaseModel):
    """Metadata about tool execution"""

    duration_ms: float = Field(ge=0, alias="durationMs")
    tool_id: str = Field(alias="toolId")

    class Config:
        populate_by_name = True


class ToolExecutionResponse(BaseModel):
    """Response from tool execution"""

    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metadata: ToolExecutionMetadata


# =============================================================================
# RAG (Retrieval-Augmented Generation)
# =============================================================================


class RAGQueryRequest(BaseModel):
    """Request for RAG query"""

    query: str = Field(min_length=1)
    repo_path: str = Field(alias="repoPath")
    top_k: int = Field(default=5, gt=0, alias="topK")
    entity_types: Optional[List[str]] = Field(None, alias="entityTypes")
    config: ProviderConfig

    class Config:
        populate_by_name = True

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Query cannot be empty")
        return v


class RAGSource(BaseModel):
    """A source document from RAG retrieval"""

    entity_id: str = Field(alias="entityId")
    entity_type: str = Field(alias="entityType")
    relevance_score: float = Field(ge=0, le=1, alias="relevanceScore")
    excerpt: str
    file_path: Optional[str] = Field(None, alias="filePath")

    class Config:
        populate_by_name = True


class RAGQueryMetadata(BaseModel):
    """Metadata about RAG query"""

    retrieval_time_ms: float = Field(ge=0, alias="retrievalTimeMs")
    generation_time_ms: float = Field(ge=0, alias="generationTimeMs")
    total_sources: int = Field(ge=0, alias="totalSources")
    model: Optional[str] = None

    class Config:
        populate_by_name = True


class RAGQueryResponse(BaseModel):
    """Response from RAG query"""

    answer: str
    sources: List[RAGSource]
    metadata: RAGQueryMetadata


# =============================================================================
# Health & Status
# =============================================================================


class HealthStatusEnum(str, Enum):
    """Health status values"""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class HealthStatus(BaseModel):
    """Health status of the sidecar service"""

    status: HealthStatusEnum
    version: str
    uptime_seconds: float = Field(ge=0, alias="uptimeSeconds")
    dependencies: Dict[str, str]
    timestamp: Optional[str] = None

    class Config:
        populate_by_name = True


# =============================================================================
# Error Response
# =============================================================================


class ErrorResponse(BaseModel):
    """Standard error response"""

    error: str
    message: str
    type: Optional[str] = None
    code: Optional[str] = None
    details: Optional[Any] = None
