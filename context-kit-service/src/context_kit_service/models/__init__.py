"""
Context Kit Service Models

Pydantic models for request/response validation and data structures.
"""

from .ai_requests import (
    # Enums
    AIProvider,
    EntityType,
    HealthStatusEnum,
    MessageRole,
    # Provider Configuration
    ProviderConfig,
    # Entity Generation
    GenerateEntityRequest,
    GenerateEntityResponse,
    GenerateEntityMetadata,
    # Streaming Assistance
    ConversationMessage,
    AssistStreamRequest,
    StreamToken,
    StreamTokenMetadata,
    StreamComplete,
    StreamCompleteMetadata,
    StreamError,
    StreamEvent,
    # Tool Execution
    ToolExecutionRequest,
    ToolExecutionResponse,
    ToolExecutionMetadata,
    # RAG
    RAGQueryRequest,
    RAGQueryResponse,
    RAGSource,
    RAGQueryMetadata,
    # Health & Status
    HealthStatus,
    # Error Response
    ErrorResponse,
)
from .requests import (
    CodegenRequest,
    InspectRequest,
    PromptifyRequest,
    SpecGenerateRequest,
)
from .responses import (
    CodegenResponse,
    InspectResponse,
    PromptifyResponse,
    SpecGenerateResponse,
    SpecLogEntry,
)

__all__ = [
    # AI Request/Response Models (sidecar)
    "AIProvider",
    "EntityType",
    "HealthStatusEnum",
    "MessageRole",
    "ProviderConfig",
    "GenerateEntityRequest",
    "GenerateEntityResponse",
    "GenerateEntityMetadata",
    "ConversationMessage",
    "AssistStreamRequest",
    "StreamToken",
    "StreamTokenMetadata",
    "StreamComplete",
    "StreamCompleteMetadata",
    "StreamError",
    "StreamEvent",
    "ToolExecutionRequest",
    "ToolExecutionResponse",
    "ToolExecutionMetadata",
    "RAGQueryRequest",
    "RAGQueryResponse",
    "RAGSource",
    "RAGQueryMetadata",
    "HealthStatus",
    "ErrorResponse",
    # Legacy Models
    "InspectRequest",
    "SpecGenerateRequest",
    "PromptifyRequest",
    "CodegenRequest",
    "InspectResponse",
    "SpecGenerateResponse",
    "PromptifyResponse",
    "CodegenResponse",
    "SpecLogEntry",
]
