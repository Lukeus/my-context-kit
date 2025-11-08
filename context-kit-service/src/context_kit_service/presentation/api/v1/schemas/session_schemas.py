"""API request/response schemas for sessions."""

from datetime import datetime

from pydantic import BaseModel, Field


# =============================================================================
# Provider Configuration
# =============================================================================


class ProviderConfigSchema(BaseModel):
    """Provider configuration schema."""
    
    provider: str = Field(..., description="AI provider (azure-openai or ollama)")
    endpoint: str = Field(..., description="Provider endpoint URL")
    model: str = Field(..., description="Model name or deployment")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int | None = Field(None, description="Maximum tokens to generate")


# =============================================================================
# Create Session
# =============================================================================


class CreateSessionRequest(BaseModel):
    """Request to create a new session."""
    
    user_id: str = Field(..., description="User identifier")
    provider_config: ProviderConfigSchema = Field(..., description="AI provider configuration")
    system_prompt: str | None = Field(None, description="Custom system prompt")
    active_tools: list[str] = Field(default_factory=list, description="Active tool names")


class SessionResponse(BaseModel):
    """Session response."""
    
    session_id: str = Field(..., description="Unique session identifier")
    user_id: str = Field(..., description="User identifier")
    message_count: int = Field(..., description="Number of messages in session")
    task_count: int = Field(..., description="Number of tasks in session")
    created_at: datetime = Field(..., description="Session creation timestamp")
    last_activity_at: datetime = Field(..., description="Last activity timestamp")


# =============================================================================
# Send Message
# =============================================================================


class SendMessageRequest(BaseModel):
    """Request to send a message in a session."""
    
    session_id: str = Field(..., description="Session identifier")
    content: str = Field(..., description="Message content", min_length=1)


class TaskResponse(BaseModel):
    """Task response."""
    
    task_id: str = Field(..., description="Unique task identifier")
    action_type: str = Field(..., description="Type of action (prompt, tool_execution)")
    status: str = Field(..., description="Task status (pending, streaming, succeeded, failed)")


class SendMessageResponse(BaseModel):
    """Response from sending a message."""
    
    task: TaskResponse = Field(..., description="Created task")
