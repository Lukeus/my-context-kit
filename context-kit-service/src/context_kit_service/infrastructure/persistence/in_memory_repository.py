"""In-memory session repository implementation."""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Dict

from ...domain.entities import Session
from ...domain.repositories import SessionRepository
from ...domain.value_objects import SessionId
from ..logging.structured_logger import get_logger

logger = get_logger(__name__)


class InMemorySessionRepository(SessionRepository):
    """
    In-memory implementation of SessionRepository.
    
    Suitable for development and testing. Sessions are stored in a dictionary
    and automatically cleaned up when expired.
    
    Thread-safe for async operations.
    """
    
    def __init__(self):
        """Initialize the repository."""
        self._sessions: Dict[str, Session] = {}
        self._lock = asyncio.Lock()
        logger.info("initialized_repository", backend="memory")
    
    async def save(self, session: Session) -> None:
        """
        Save a session to memory.
        
        Args:
            session: Session entity to save
        """
        async with self._lock:
            session_key = str(session.session_id)
            self._sessions[session_key] = session
            logger.debug(
                "session_saved",
                session_id=session_key,
                user_id=session.user_id,
                message_count=len(session.messages),
                task_count=len(session.tasks),
            )
    
    async def find_by_id(self, session_id: SessionId) -> Session | None:
        """
        Find a session by ID.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session if found, None otherwise
        """
        async with self._lock:
            session_key = str(session_id)
            session = self._sessions.get(session_key)
            
            if session:
                logger.debug("session_found", session_id=session_key)
            else:
                logger.debug("session_not_found", session_id=session_key)
            
            return session
    
    async def delete(self, session_id: SessionId) -> None:
        """
        Delete a session.
        
        Args:
            session_id: Session identifier
        """
        async with self._lock:
            session_key = str(session_id)
            if session_key in self._sessions:
                del self._sessions[session_key]
                logger.info("session_deleted", session_id=session_key)
            else:
                logger.warning("session_delete_not_found", session_id=session_key)
    
    async def find_expired(self, max_age_hours: int) -> list[Session]:
        """
        Find all expired sessions.
        
        Args:
            max_age_hours: Maximum age in hours before session is expired
            
        Returns:
            List of expired sessions
        """
        async with self._lock:
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
            expired = [
                session
                for session in self._sessions.values()
                if session.last_activity_at < cutoff_time
            ]
            
            if expired:
                logger.info(
                    "expired_sessions_found",
                    count=len(expired),
                    max_age_hours=max_age_hours,
                )
            
            return expired
    
    async def count(self) -> int:
        """
        Count total sessions in memory.
        
        Returns:
            Number of sessions
        """
        async with self._lock:
            return len(self._sessions)
    
    async def clear(self) -> None:
        """Clear all sessions (useful for testing)."""
        async with self._lock:
            count = len(self._sessions)
            self._sessions.clear()
            logger.info("repository_cleared", session_count=count)
