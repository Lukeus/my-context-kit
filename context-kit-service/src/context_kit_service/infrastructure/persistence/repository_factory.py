"""Factory for creating repository instances."""

from redis.asyncio import Redis

from ...domain.repositories import SessionRepository
from ..config.settings import Settings, get_settings
from ..logging.structured_logger import get_logger
from .in_memory_repository import InMemorySessionRepository
from .redis_repository import RedisSessionRepository

logger = get_logger(__name__)


def create_session_repository(settings: Settings | None = None) -> SessionRepository:
    """
    Create a session repository based on configuration.
    
    Args:
        settings: Optional settings (uses get_settings() if not provided)
        
    Returns:
        Configured session repository
    """
    if settings is None:
        settings = get_settings()
    
    backend = settings.session.storage_backend.lower()
    
    if backend == "redis":
        logger.info(
            "creating_repository",
            backend="redis",
            host=settings.redis.host,
            port=settings.redis.port,
        )
        
        # Create Redis client
        redis_client = Redis(
            host=settings.redis.host,
            port=settings.redis.port,
            db=settings.redis.db,
            password=settings.redis.password,
            decode_responses=False,  # We handle encoding ourselves
        )
        
        return RedisSessionRepository(
            redis_client=redis_client,
            ttl_hours=settings.session.max_session_age_hours,
        )
    
    elif backend == "memory":
        logger.info("creating_repository", backend="memory")
        return InMemorySessionRepository()
    
    else:
        logger.warning(
            "unknown_backend_fallback_to_memory",
            backend=backend,
            supported=["memory", "redis"],
        )
        return InMemorySessionRepository()


async def cleanup_expired_sessions(
    repository: SessionRepository,
    settings: Settings | None = None,
) -> int:
    """
    Clean up expired sessions.
    
    Args:
        repository: Session repository
        settings: Optional settings (uses get_settings() if not provided)
        
    Returns:
        Number of sessions deleted
    """
    if settings is None:
        settings = get_settings()
    
    expired = await repository.find_expired(settings.session.max_session_age_hours)
    
    for session in expired:
        await repository.delete(session.session_id)
    
    if expired:
        logger.info("expired_sessions_cleaned", count=len(expired))
    
    return len(expired)
