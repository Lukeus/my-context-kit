"""Session aggregate root entity."""

from datetime import datetime, timedelta, timezone
from typing import Any

from ..value_objects.provider_config import ProviderConfig
from ..value_objects.session_id import SessionId
from .message import Message
from .task import Task


class Session:
    """Session aggregate root.
    
    A session represents a conversation between a user and the AI assistant.
    It is the aggregate root that manages messages, tasks, and configuration.
    """
    
    def __init__(
        self,
        session_id: SessionId,
        user_id: str,
        provider_config: ProviderConfig,
        system_prompt: str | None = None,
        active_tools: list[str] | None = None,
        created_at: datetime | None = None,
    ):
        self._session_id = session_id
        self._user_id = user_id
        self._provider_config = provider_config
        self._system_prompt = system_prompt or self._default_system_prompt()
        self._active_tools = active_tools or []
        self._messages: list[Message] = []
        self._tasks: list[Task] = []
        self._created_at = created_at or datetime.now(timezone.utc)
        self._last_activity_at = self._created_at
    
    @property
    def session_id(self) -> SessionId:
        return self._session_id
    
    @property
    def user_id(self) -> str:
        return self._user_id
    
    @property
    def provider_config(self) -> ProviderConfig:
        return self._provider_config
    
    @property
    def system_prompt(self) -> str:
        return self._system_prompt
    
    @property
    def active_tools(self) -> list[str]:
        return self._active_tools.copy()
    
    @property
    def messages(self) -> list[Message]:
        return self._messages.copy()
    
    @property
    def tasks(self) -> list[Task]:
        return self._tasks.copy()
    
    @property
    def created_at(self) -> datetime:
        return self._created_at
    
    @property
    def last_activity_at(self) -> datetime:
        return self._last_activity_at
    
    def add_message(self, message: Message) -> None:
        """Add a message to the session."""
        self._messages.append(message)
        self._last_activity_at = datetime.now(timezone.utc)
    
    def add_task(self, task: Task) -> None:
        """Add a task to the session."""
        self._tasks.append(task)
        self._last_activity_at = datetime.now(timezone.utc)
    
    def is_expired(self, max_age_hours: int) -> bool:
        """Check if session has expired."""
        age = datetime.now(timezone.utc) - self._last_activity_at
        return age > timedelta(hours=max_age_hours)
    
    def get_conversation_history(self) -> list[dict[str, Any]]:
        """Get conversation history for AI context."""
        return [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
            }
            for msg in self._messages
        ]
    
    @staticmethod
    def _default_system_prompt() -> str:
        return (
            "You are a guard-railed operator for context repository pipelines. "
            "Confirm scope, execute only allowlisted commands, and summarize results."
        )
    
    @classmethod
    def create(
        cls,
        user_id: str,
        provider_config: ProviderConfig,
        system_prompt: str | None = None,
        active_tools: list[str] | None = None,
    ) -> "Session":
        """Factory method to create a new session."""
        return cls(
            session_id=SessionId.generate(),
            user_id=user_id,
            provider_config=provider_config,
            system_prompt=system_prompt,
            active_tools=active_tools,
        )
