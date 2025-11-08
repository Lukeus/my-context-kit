"""Session repository interface."""

from abc import ABC, abstractmethod

from ..entities.session import Session
from ..value_objects.session_id import SessionId


class SessionRepository(ABC):
    """Abstract session repository interface.
    
    This interface defines the contract for session persistence.
    Implementations can use in-memory storage, Redis, databases, etc.
    """
    
    @abstractmethod
    async def save(self, session: Session) -> None:
        """Persist a session.
        
        Args:
            session: Session to save.
        """
        pass
    
    @abstractmethod
    async def find_by_id(self, session_id: SessionId) -> Session | None:
        """Find session by ID.
        
        Args:
            session_id: Session identifier.
        
        Returns:
            Session if found, None otherwise.
        """
        pass
    
    @abstractmethod
    async def delete(self, session_id: SessionId) -> None:
        """Delete a session.
        
        Args:
            session_id: Session identifier.
        """
        pass
    
    @abstractmethod
    async def find_expired(self, max_age_hours: int) -> list[Session]:
        """Find all expired sessions.
        
        Args:
            max_age_hours: Maximum age in hours.
        
        Returns:
            List of expired sessions.
        """
        pass
