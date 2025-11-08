"""Create session use case."""

from dataclasses import dataclass

from ...domain.entities import Session
from ...domain.repositories import SessionRepository
from ...domain.value_objects import ProviderConfig
from ...infrastructure.logging import get_logger
from ..dtos import SessionDTO

logger = get_logger(__name__)


@dataclass
class CreateSessionInput:
    """Input for create session use case."""
    
    user_id: str
    provider_config: ProviderConfig
    system_prompt: str | None = None
    active_tools: list[str] | None = None


@dataclass
class CreateSessionOutput:
    """Output from create session use case."""
    
    session: SessionDTO


class CreateSessionUseCase:
    """Use case for creating a new assistant session.
    
    This use case orchestrates the creation of a new session,
    persists it, and returns a DTO for the presentation layer.
    """
    
    def __init__(self, session_repository: SessionRepository):
        """Initialize use case.
        
        Args:
            session_repository: Repository for session persistence.
        """
        self._session_repository = session_repository
    
    async def execute(self, input_data: CreateSessionInput) -> CreateSessionOutput:
        """Execute the use case.
        
        Args:
            input_data: Input parameters.
        
        Returns:
            Output with created session DTO.
        
        Example:
            >>> use_case = CreateSessionUseCase(repository)
            >>> config = ProviderConfig.for_ollama()
            >>> input_data = CreateSessionInput(
            ...     user_id="user123",
            ...     provider_config=config
            ... )
            >>> output = await use_case.execute(input_data)
            >>> print(output.session.session_id)
        """
        logger.info(
            "creating_session",
            user_id=input_data.user_id,
            provider=input_data.provider_config.provider.value,
            tools_count=len(input_data.active_tools or []),
        )
        
        # Create session entity using factory method
        session = Session.create(
            user_id=input_data.user_id,
            provider_config=input_data.provider_config,
            system_prompt=input_data.system_prompt,
            active_tools=input_data.active_tools,
        )
        
        # Persist session
        await self._session_repository.save(session)
        
        logger.info(
            "session_created",
            session_id=str(session.session_id),
            user_id=input_data.user_id,
        )
        
        # Return DTO
        return CreateSessionOutput(
            session=SessionDTO.from_entity(session)
        )
