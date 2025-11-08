"""Session data transfer objects."""

from dataclasses import dataclass
from datetime import datetime

from ...domain.entities import Session


@dataclass
class SessionDTO:
    """Data transfer object for Session entity.
    
    DTOs are simple data structures used to transfer data between layers
    without exposing domain entities directly.
    """
    
    session_id: str
    user_id: str
    created_at: datetime
    last_activity_at: datetime
    message_count: int
    task_count: int
    
    @classmethod
    def from_entity(cls, session: Session) -> "SessionDTO":
        """Create DTO from domain entity.
        
        Args:
            session: Session entity.
        
        Returns:
            SessionDTO instance.
        """
        return cls(
            session_id=str(session.session_id),
            user_id=session.user_id,
            created_at=session.created_at,
            last_activity_at=session.last_activity_at,
            message_count=len(session.messages),
            task_count=len(session.tasks),
        )
