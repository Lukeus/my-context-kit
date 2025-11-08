"""Session ID value object."""

from dataclasses import dataclass
from uuid import UUID, uuid4


@dataclass(frozen=True)
class SessionId:
    """Session identifier value object.
    
    This is an immutable value object that represents a unique session identifier.
    Value objects are compared by their values, not by identity.
    
    Attributes:
        value: The UUID value of the session ID.
    
    Example:
        >>> session_id = SessionId.generate()
        >>> print(session_id)
        12345678-1234-5678-1234-567812345678
        
        >>> session_id2 = SessionId.from_string("12345678-1234-5678-1234-567812345678")
        >>> assert session_id == session_id2  # Value equality
    """
    
    value: UUID
    
    def __str__(self) -> str:
        """Return string representation of session ID."""
        return str(self.value)
    
    def __repr__(self) -> str:
        """Return developer-friendly representation."""
        return f"SessionId('{self.value}')"
    
    @classmethod
    def generate(cls) -> "SessionId":
        """Generate a new unique session ID.
        
        Returns:
            A new SessionId with a randomly generated UUID.
        
        Example:
            >>> session_id = SessionId.generate()
            >>> assert isinstance(session_id.value, UUID)
        """
        return cls(value=uuid4())
    
    @classmethod
    def from_string(cls, session_id: str) -> "SessionId":
        """Create a SessionId from a string representation.
        
        Args:
            session_id: String representation of a UUID.
        
        Returns:
            SessionId instance.
        
        Raises:
            ValueError: If the string is not a valid UUID format.
        
        Example:
            >>> session_id = SessionId.from_string("12345678-1234-5678-1234-567812345678")
            >>> assert str(session_id) == "12345678-1234-5678-1234-567812345678"
        """
        try:
            return cls(value=UUID(session_id))
        except ValueError as e:
            raise ValueError(f"Invalid session ID format: {session_id}") from e
