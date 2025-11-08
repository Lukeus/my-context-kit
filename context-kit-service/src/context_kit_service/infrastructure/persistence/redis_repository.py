"""Redis session repository implementation."""

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from redis.asyncio import Redis

from ...domain.entities import Message, Session, Task
from ...domain.repositories import SessionRepository
from ...domain.value_objects import (
    ProviderConfig,
    SessionId,
    TaskActionType,
    TaskStatus,
)
from ..logging.structured_logger import get_logger

logger = get_logger(__name__)


class RedisSessionRepository(SessionRepository):
    """
    Redis implementation of SessionRepository.
    
    Sessions are stored as Redis hashes with automatic expiration.
    Each session is serialized to JSON for storage.
    """
    
    KEY_PREFIX = "session:"
    
    def __init__(self, redis_client: Redis, ttl_hours: int = 24):
        """
        Initialize the repository.
        
        Args:
            redis_client: Async Redis client
            ttl_hours: Time-to-live for sessions in hours
        """
        self._redis = redis_client
        self._ttl_seconds = ttl_hours * 3600
        logger.info("initialized_repository", backend="redis", ttl_hours=ttl_hours)
    
    def _session_key(self, session_id: SessionId) -> str:
        """Generate Redis key for session."""
        return f"{self.KEY_PREFIX}{session_id}"
    
    def _serialize_session(self, session: Session) -> Dict[str, Any]:
        """
        Serialize session to JSON-compatible dict.
        
        Args:
            session: Session entity
            
        Returns:
            Dict suitable for JSON serialization
        """
        return {
            "session_id": str(session.session_id),
            "user_id": session.user_id,
            "created_at": session.created_at.isoformat(),
            "last_activity_at": session.last_activity_at.isoformat(),
            "system_prompt": session.system_prompt,
            "active_tools": session.active_tools,
            "provider_config": {
                "provider": session.provider_config.provider.value,
                "model": session.provider_config.model,
                "endpoint": session.provider_config.endpoint,
                "temperature": session.provider_config.temperature,
                "max_tokens": session.provider_config.max_tokens,
            },
            "messages": [
                {
                    "message_id": str(msg.message_id),
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                    "metadata": msg.metadata,
                }
                for msg in session.messages
            ],
            "tasks": [
                {
                    "task_id": str(task.task_id),
                    "action_type": task.action_type.value,
                    "status": task.status.value,
                    "created_at": task.created_at.isoformat(),
                    "outputs": task.outputs,
                }
                for task in session.tasks
            ],
        }
    
    def _deserialize_session(self, data: Dict[str, Any]) -> Session:
        """
        Deserialize session from dict.
        
        Args:
            data: Serialized session data
            
        Returns:
            Session entity
        """
        # Recreate provider config
        config_data = data["provider_config"]
        provider_config = ProviderConfig(
            provider=config_data["provider"],
            model=config_data["model"],
            endpoint=config_data["endpoint"],
            temperature=config_data["temperature"],
            max_tokens=config_data["max_tokens"],
        )
        
        # Create session
        session = Session(
            session_id=SessionId.from_string(data["session_id"]),
            user_id=data["user_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            provider_config=provider_config,
            system_prompt=data["system_prompt"],
            active_tools=data["active_tools"],
        )
        session._last_activity_at = datetime.fromisoformat(data["last_activity_at"])
        
        # Recreate messages
        for msg_data in data["messages"]:
            message = Message(
                message_id=msg_data["message_id"],
                role=msg_data["role"],
                content=msg_data["content"],
                timestamp=datetime.fromisoformat(msg_data["timestamp"]),
                metadata=msg_data.get("metadata", {}),
            )
            session._messages.append(message)
        
        # Recreate tasks
        for task_data in data["tasks"]:
            task = Task(
                task_id=task_data["task_id"],
                action_type=TaskActionType(task_data["action_type"]),
                status=TaskStatus(task_data["status"]),
                created_at=datetime.fromisoformat(task_data["created_at"]),
                outputs=task_data.get("outputs", []),
            )
            session._tasks.append(task)
        
        return session
    
    async def save(self, session: Session) -> None:
        """
        Save a session to Redis.
        
        Args:
            session: Session entity to save
        """
        key = self._session_key(session.session_id)
        serialized = self._serialize_session(session)
        json_data = json.dumps(serialized)
        
        await self._redis.set(key, json_data, ex=self._ttl_seconds)
        
        logger.debug(
            "session_saved",
            session_id=str(session.session_id),
            user_id=session.user_id,
            message_count=len(session.messages),
            task_count=len(session.tasks),
            ttl_hours=self._ttl_seconds // 3600,
        )
    
    async def find_by_id(self, session_id: SessionId) -> Session | None:
        """
        Find a session by ID.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session if found, None otherwise
        """
        key = self._session_key(session_id)
        data = await self._redis.get(key)
        
        if data is None:
            logger.debug("session_not_found", session_id=str(session_id))
            return None
        
        try:
            serialized = json.loads(data)
            session = self._deserialize_session(serialized)
            logger.debug("session_found", session_id=str(session_id))
            return session
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.error(
                "session_deserialization_failed",
                session_id=str(session_id),
                error=str(e),
            )
            return None
    
    async def delete(self, session_id: SessionId) -> None:
        """
        Delete a session.
        
        Args:
            session_id: Session identifier
        """
        key = self._session_key(session_id)
        deleted = await self._redis.delete(key)
        
        if deleted:
            logger.info("session_deleted", session_id=str(session_id))
        else:
            logger.warning("session_delete_not_found", session_id=str(session_id))
    
    async def find_expired(self, max_age_hours: int) -> list[Session]:
        """
        Find all expired sessions.
        
        Note: Redis automatically expires keys, so this method finds sessions
        that are close to expiring based on their last_activity timestamp.
        
        Args:
            max_age_hours: Maximum age in hours before session is expired
            
        Returns:
            List of expired sessions
        """
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        expired = []
        
        # Scan for all session keys
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(
                cursor, match=f"{self.KEY_PREFIX}*", count=100
            )
            
            for key in keys:
                data = await self._redis.get(key)
                if data:
                    try:
                        serialized = json.loads(data)
                        last_activity_at = datetime.fromisoformat(serialized["last_activity_at"])
                        
                        if last_activity_at < cutoff_time:
                            session = self._deserialize_session(serialized)
                            expired.append(session)
                    except (json.JSONDecodeError, KeyError, ValueError):
                        # Skip corrupted data
                        continue
            
            if cursor == 0:
                break
        
        if expired:
            logger.info(
                "expired_sessions_found",
                count=len(expired),
                max_age_hours=max_age_hours,
            )
        
        return expired
    
    async def count(self) -> int:
        """
        Count total sessions in Redis.
        
        Returns:
            Number of sessions
        """
        count = 0
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(
                cursor, match=f"{self.KEY_PREFIX}*", count=100
            )
            count += len(keys)
            
            if cursor == 0:
                break
        
        return count
