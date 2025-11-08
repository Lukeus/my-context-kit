"""Mappers for session DTOs to API schemas."""

from ...application.dtos import SessionDTO, TaskDTO
from ...application.use_cases import CreateSessionInput
from ...domain.value_objects import AIProvider, ProviderConfig
from ..api.v1.schemas import (
    CreateSessionRequest,
    ProviderConfigSchema,
    SessionResponse,
    TaskResponse,
)


def schema_to_provider_config(schema: ProviderConfigSchema) -> ProviderConfig:
    """
    Convert API schema to domain ProviderConfig.
    
    Args:
        schema: Provider config from API request
        
    Returns:
        Domain ProviderConfig value object
    """
    return ProviderConfig(
        provider=AIProvider(schema.provider),
        endpoint=schema.endpoint,
        model=schema.model,
        temperature=schema.temperature,
        max_tokens=schema.max_tokens,
    )


def request_to_create_session_input(request: CreateSessionRequest) -> CreateSessionInput:
    """
    Convert API request to CreateSession input.
    
    Args:
        request: API request
        
    Returns:
        CreateSessionInput for use case
    """
    return CreateSessionInput(
        user_id=request.user_id,
        provider_config=schema_to_provider_config(request.provider_config),
        system_prompt=request.system_prompt,
        active_tools=request.active_tools,
    )


def session_dto_to_response(dto: SessionDTO) -> SessionResponse:
    """
    Convert SessionDTO to API response.
    
    Args:
        dto: Session DTO from application layer
        
    Returns:
        API response schema
    """
    return SessionResponse(
        session_id=dto.session_id,
        user_id=dto.user_id,
        message_count=dto.message_count,
        task_count=dto.task_count,
        created_at=dto.created_at,
        last_activity_at=dto.last_activity_at,
    )


def task_dto_to_response(dto: TaskDTO) -> TaskResponse:
    """
    Convert TaskDTO to API response.
    
    Args:
        dto: Task DTO from application layer
        
    Returns:
        API response schema
    """
    return TaskResponse(
        task_id=dto.task_id,
        action_type=dto.action_type,
        status=dto.status,
    )
