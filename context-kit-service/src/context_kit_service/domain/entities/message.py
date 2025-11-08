"""Message domain entity."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4


class Message:
    """Message entity representing a single conversation message.
    
    A message is part of a conversation and has a role (user, assistant, system)
    and content. Messages are immutable once created.
    
    Attributes:
        message_id: Unique identifier for the message.
        role: Role of the message sender (user, assistant, system).
        content: Text content of the message.
        timestamp: When the message was created.
        metadata: Additional metadata about the message.
    """
    
    def __init__(
        self,
        message_id: UUID,
        role: str,
        content: str,
        timestamp: datetime,
        metadata: dict[str, Any] | None = None,
    ):
        """Initialize a message.
        
        Args:
            message_id: Unique message identifier.
            role: Message role (user, assistant, system).
            content: Message text content.
            timestamp: Creation timestamp.
            metadata: Optional metadata dict.
        
        Raises:
            ValueError: If role is invalid.
        """
        self._message_id = message_id
        self._role = self._validate_role(role)
        self._content = content
        self._timestamp = timestamp
        self._metadata = metadata or {}
    
    @property
    def message_id(self) -> UUID:
        """Get message ID."""
        return self._message_id
    
    @property
    def role(self) -> str:
        """Get message role."""
        return self._role
    
    @property
    def content(self) -> str:
        """Get message content."""
        return self._content
    
    @property
    def timestamp(self) -> datetime:
        """Get message timestamp."""
        return self._timestamp
    
    @property
    def metadata(self) -> dict[str, Any]:
        """Get message metadata (defensive copy)."""
        return self._metadata.copy()
    
    @staticmethod
    def _validate_role(role: str) -> str:
        """Validate message role.
        
        Args:
            role: Role to validate.
        
        Returns:
            The validated role.
        
        Raises:
            ValueError: If role is not valid.
        """
        valid_roles = {"user", "assistant", "system"}
        if role not in valid_roles:
            raise ValueError(f"Invalid role: {role}. Must be one of {valid_roles}")
        return role
    
    def is_from_user(self) -> bool:
        """Check if message is from user.
        
        Returns:
            True if message role is 'user'.
        """
        return self._role == "user"
    
    def is_from_assistant(self) -> bool:
        """Check if message is from assistant.
        
        Returns:
            True if message role is 'assistant'.
        """
        return self._role == "assistant"
    
    def is_system_message(self) -> bool:
        """Check if message is a system message.
        
        Returns:
            True if message role is 'system'.
        """
        return self._role == "system"
    
    @classmethod
    def create_user_message(
        cls,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> "Message":
        """Factory method to create a user message.
        
        Args:
            content: Message content.
            metadata: Optional metadata.
        
        Returns:
            New Message instance with role 'user'.
        
        Example:
            >>> msg = Message.create_user_message("Hello!")
            >>> assert msg.is_from_user()
            >>> assert msg.content == "Hello!"
        """
        return cls(
            message_id=uuid4(),
            role="user",
            content=content,
            timestamp=datetime.now(timezone.utc),
            metadata=metadata,
        )
    
    @classmethod
    def create_assistant_message(
        cls,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> "Message":
        """Factory method to create an assistant message.
        
        Args:
            content: Message content.
            metadata: Optional metadata.
        
        Returns:
            New Message instance with role 'assistant'.
        
        Example:
            >>> msg = Message.create_assistant_message("Hi there!")
            >>> assert msg.is_from_assistant()
        """
        return cls(
            message_id=uuid4(),
            role="assistant",
            content=content,
            timestamp=datetime.now(timezone.utc),
            metadata=metadata,
        )
    
    @classmethod
    def create_system_message(
        cls,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> "Message":
        """Factory method to create a system message.
        
        Args:
            content: Message content.
            metadata: Optional metadata.
        
        Returns:
            New Message instance with role 'system'.
        
        Example:
            >>> msg = Message.create_system_message("System initialized")
            >>> assert msg.is_system_message()
        """
        return cls(
            message_id=uuid4(),
            role="system",
            content=content,
            timestamp=datetime.now(timezone.utc),
            metadata=metadata,
        )
    
    def __eq__(self, other: object) -> bool:
        """Check equality based on message ID."""
        if not isinstance(other, Message):
            return NotImplemented
        return self._message_id == other._message_id
    
    def __hash__(self) -> int:
        """Hash based on message ID."""
        return hash(self._message_id)
    
    def __repr__(self) -> str:
        """Developer-friendly representation."""
        return f"Message(id={self._message_id}, role={self._role}, content='{self._content[:50]}...')"
