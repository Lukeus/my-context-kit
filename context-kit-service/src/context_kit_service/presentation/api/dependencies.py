"""FastAPI dependency injection."""

from typing import Annotated

from fastapi import Depends

from ...application.ports import AIServicePort
from ...application.use_cases import CreateSessionUseCase, SendMessageUseCase
from ...domain.repositories import SessionRepository
from ...infrastructure.ai import LangChainAIAdapter
from ...infrastructure.config.settings import Settings, get_settings
from ...infrastructure.persistence.repository_factory import create_session_repository


# =============================================================================
# Infrastructure Dependencies
# =============================================================================


def get_session_repository(
    settings: Annotated[Settings, Depends(get_settings)]
) -> SessionRepository:
    """
    Get session repository instance.
    
    Args:
        settings: Application settings
        
    Returns:
        Configured session repository (memory or Redis based on settings)
    """
    return create_session_repository(settings)


def get_ai_service() -> AIServicePort:
    """
    Get AI service instance.
    
    Returns:
        LangChain AI adapter
    """
    return LangChainAIAdapter()


# =============================================================================
# Use Case Dependencies
# =============================================================================


def get_create_session_use_case(
    repository: Annotated[SessionRepository, Depends(get_session_repository)]
) -> CreateSessionUseCase:
    """
    Get CreateSession use case.
    
    Args:
        repository: Session repository
        
    Returns:
        CreateSessionUseCase instance
    """
    return CreateSessionUseCase(repository)


def get_send_message_use_case(
    repository: Annotated[SessionRepository, Depends(get_session_repository)],
    ai_service: Annotated[AIServicePort, Depends(get_ai_service)],
) -> SendMessageUseCase:
    """
    Get SendMessage use case.
    
    Args:
        repository: Session repository
        ai_service: AI service
        
    Returns:
        SendMessageUseCase instance
    """
    return SendMessageUseCase(repository, ai_service)
