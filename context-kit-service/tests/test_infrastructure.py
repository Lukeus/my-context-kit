"""Tests for infrastructure layer."""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from context_kit_service.domain.entities import Message, Session
from context_kit_service.domain.value_objects import ProviderConfig, SessionId
from context_kit_service.infrastructure.ai import LangChainAIAdapter
from context_kit_service.infrastructure.persistence import (
    InMemorySessionRepository,
    RedisSessionRepository,
)


# =============================================================================
# In-Memory Repository Tests
# =============================================================================


@pytest.mark.asyncio
async def test_in_memory_save_and_find():
    """Test saving and finding sessions in memory."""
    repo = InMemorySessionRepository()
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    await repo.save(session)
    
    found = await repo.find_by_id(session.session_id)
    assert found is not None
    assert found.session_id == session.session_id
    assert found.user_id == "user123"


@pytest.mark.asyncio
async def test_in_memory_find_not_found():
    """Test finding non-existent session returns None."""
    repo = InMemorySessionRepository()
    session_id = SessionId.generate()
    
    found = await repo.find_by_id(session_id)
    assert found is None


@pytest.mark.asyncio
async def test_in_memory_delete():
    """Test deleting a session."""
    repo = InMemorySessionRepository()
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    await repo.save(session)
    await repo.delete(session.session_id)
    
    found = await repo.find_by_id(session.session_id)
    assert found is None


@pytest.mark.asyncio
async def test_in_memory_find_expired():
    """Test finding expired sessions."""
    repo = InMemorySessionRepository()
    config = ProviderConfig.for_ollama()
    
    # Create old session
    old_session = Session.create(user_id="user1", provider_config=config)
    old_session._last_activity_at = datetime.now(timezone.utc) - timedelta(hours=25)
    await repo.save(old_session)
    
    # Create recent session
    new_session = Session.create(user_id="user2", provider_config=config)
    await repo.save(new_session)
    
    # Find sessions older than 24 hours
    expired = await repo.find_expired(max_age_hours=24)
    
    assert len(expired) == 1
    assert expired[0].session_id == old_session.session_id


@pytest.mark.asyncio
async def test_in_memory_count():
    """Test counting sessions."""
    repo = InMemorySessionRepository()
    config = ProviderConfig.for_ollama()
    
    assert await repo.count() == 0
    
    session1 = Session.create(user_id="user1", provider_config=config)
    await repo.save(session1)
    
    assert await repo.count() == 1
    
    session2 = Session.create(user_id="user2", provider_config=config)
    await repo.save(session2)
    
    assert await repo.count() == 2


@pytest.mark.asyncio
async def test_in_memory_clear():
    """Test clearing all sessions."""
    repo = InMemorySessionRepository()
    config = ProviderConfig.for_ollama()
    
    session = Session.create(user_id="user123", provider_config=config)
    await repo.save(session)
    
    assert await repo.count() == 1
    
    await repo.clear()
    
    assert await repo.count() == 0


@pytest.mark.asyncio
async def test_in_memory_thread_safety():
    """Test concurrent access to repository."""
    repo = InMemorySessionRepository()
    config = ProviderConfig.for_ollama()
    
    async def save_session(user_id: str):
        session = Session.create(user_id=user_id, provider_config=config)
        await repo.save(session)
        return session.session_id
    
    # Save 10 sessions concurrently
    session_ids = await asyncio.gather(*[
        save_session(f"user{i}") for i in range(10)
    ])
    
    assert await repo.count() == 10
    
    # Verify all can be found
    for session_id in session_ids:
        found = await repo.find_by_id(session_id)
        assert found is not None


# =============================================================================
# Redis Repository Tests (with mocked Redis)
# =============================================================================


@pytest.mark.asyncio
async def test_redis_save_and_find():
    """Test saving and finding sessions in Redis."""
    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock()
    mock_redis.get = AsyncMock()
    
    repo = RedisSessionRepository(redis_client=mock_redis, ttl_hours=24)
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    # Save session
    await repo.save(session)
    
    # Verify Redis.set was called
    assert mock_redis.set.called
    call_args = mock_redis.set.call_args
    assert f"session:{session.session_id}" in str(call_args)
    
    # Mock Redis response for find
    saved_data = mock_redis.set.call_args[0][1]
    mock_redis.get.return_value = saved_data
    
    # Find session
    found = await repo.find_by_id(session.session_id)
    
    assert found is not None
    assert found.session_id == session.session_id
    assert found.user_id == "user123"


@pytest.mark.asyncio
async def test_redis_find_not_found():
    """Test finding non-existent session returns None."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    
    repo = RedisSessionRepository(redis_client=mock_redis)
    session_id = SessionId.generate()
    
    found = await repo.find_by_id(session_id)
    assert found is None


@pytest.mark.asyncio
async def test_redis_delete():
    """Test deleting a session."""
    mock_redis = AsyncMock()
    mock_redis.delete = AsyncMock(return_value=1)
    
    repo = RedisSessionRepository(redis_client=mock_redis)
    session_id = SessionId.generate()
    
    await repo.delete(session_id)
    
    assert mock_redis.delete.called
    call_args = mock_redis.delete.call_args
    assert f"session:{session_id}" in str(call_args)


@pytest.mark.asyncio
async def test_redis_serialization_with_messages():
    """Test Redis serialization with messages and tasks."""
    mock_redis = AsyncMock()
    mock_redis.set = AsyncMock()
    mock_redis.get = AsyncMock()
    
    repo = RedisSessionRepository(redis_client=mock_redis)
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    # Add messages
    user_msg = Message.create_user_message("Hello")
    assistant_msg = Message.create_assistant_message("Hi there!")
    session._messages.extend([user_msg, assistant_msg])
    
    # Save session
    await repo.save(session)
    
    # Get saved data and mock it for retrieval
    saved_data = mock_redis.set.call_args[0][1]
    mock_redis.get.return_value = saved_data
    
    # Find and verify
    found = await repo.find_by_id(session.session_id)
    
    assert found is not None
    assert len(found.messages) == 2
    assert found.messages[0].content == "Hello"
    assert found.messages[1].content == "Hi there!"


@pytest.mark.asyncio
async def test_redis_count():
    """Test counting sessions with mocked scan."""
    mock_redis = AsyncMock()
    
    # Mock scan to return 3 keys
    mock_redis.scan = AsyncMock(side_effect=[
        (0, [b"session:1", b"session:2", b"session:3"]),
    ])
    
    repo = RedisSessionRepository(redis_client=mock_redis)
    count = await repo.count()
    
    assert count == 3


# =============================================================================
# LangChain AI Adapter Tests
# =============================================================================


@pytest.mark.asyncio
async def test_langchain_adapter_invoke():
    """Test invoking AI via LangChain adapter."""
    mock_service = MagicMock()
    mock_llm = AsyncMock()
    
    # Mock LLM response
    mock_response = MagicMock()
    mock_response.content = "This is a test response"
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)
    
    mock_service._get_llm = MagicMock(return_value=mock_llm)
    
    adapter = LangChainAIAdapter(langchain_service=mock_service)
    config = ProviderConfig.for_ollama()
    
    response = await adapter.invoke(
        prompt="Hello",
        conversation_history=[],
        provider_config=config,
    )
    
    assert response == "This is a test response"
    assert mock_llm.ainvoke.called


@pytest.mark.asyncio
async def test_langchain_adapter_invoke_with_history():
    """Test invoking AI with conversation history."""
    mock_service = MagicMock()
    mock_llm = AsyncMock()
    
    mock_response = MagicMock()
    mock_response.content = "Response with context"
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)
    
    mock_service._get_llm = MagicMock(return_value=mock_llm)
    
    adapter = LangChainAIAdapter(langchain_service=mock_service)
    config = ProviderConfig.for_ollama()
    
    # Create conversation history
    history = [
        Message.create_user_message("First message"),
        Message.create_assistant_message("First response"),
    ]
    
    response = await adapter.invoke(
        prompt="Second message",
        conversation_history=history,
        provider_config=config,
    )
    
    assert response == "Response with context"
    
    # Verify messages were built correctly
    call_args = mock_llm.ainvoke.call_args[0][0]
    assert len(call_args) == 3  # 2 history + 1 new


@pytest.mark.asyncio
async def test_langchain_adapter_stream():
    """Test streaming AI response."""
    mock_service = MagicMock()
    mock_llm = AsyncMock()
    
    # Mock streaming chunks
    async def mock_astream(messages):
        chunks = ["Hello", " ", "world"]
        for chunk in chunks:
            mock_chunk = MagicMock()
            mock_chunk.content = chunk
            yield mock_chunk
    
    mock_llm.astream = mock_astream
    mock_service._get_llm = MagicMock(return_value=mock_llm)
    
    adapter = LangChainAIAdapter(langchain_service=mock_service)
    config = ProviderConfig.for_ollama()
    
    tokens = []
    async for token in adapter.stream(
        prompt="Test",
        conversation_history=[],
        provider_config=config,
    ):
        tokens.append(token)
    
    assert tokens == ["Hello", " ", "world"]


@pytest.mark.asyncio
async def test_langchain_adapter_with_tools():
    """Test AI invocation with tools."""
    mock_service = MagicMock()
    mock_llm = AsyncMock()
    
    mock_response = MagicMock()
    mock_response.content = "Using tools"
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)
    
    mock_service._get_llm = MagicMock(return_value=mock_llm)
    
    adapter = LangChainAIAdapter(langchain_service=mock_service)
    config = ProviderConfig.for_ollama()
    
    response = await adapter.invoke(
        prompt="Execute validation",
        conversation_history=[],
        provider_config=config,
        available_tools=["pipeline.validate", "context.read"],
    )
    
    assert response == "Using tools"
    
    # Verify tools were added to system message
    call_args = mock_llm.ainvoke.call_args[0][0]
    system_msg = str(call_args[0].content)
    assert "pipeline.validate" in system_msg
    assert "context.read" in system_msg


@pytest.mark.asyncio
async def test_langchain_adapter_error_handling():
    """Test error handling in AI adapter."""
    mock_service = MagicMock()
    mock_llm = AsyncMock()
    
    # Mock error
    mock_llm.ainvoke = AsyncMock(side_effect=Exception("AI error"))
    mock_service._get_llm = MagicMock(return_value=mock_llm)
    
    adapter = LangChainAIAdapter(langchain_service=mock_service)
    config = ProviderConfig.for_ollama()
    
    with pytest.raises(Exception, match="AI error"):
        await adapter.invoke(
            prompt="Test",
            conversation_history=[],
            provider_config=config,
        )


# =============================================================================
# Integration Tests
# =============================================================================


@pytest.mark.asyncio
async def test_repository_with_complete_session():
    """Test repository with session containing messages and tasks."""
    repo = InMemorySessionRepository()
    config = ProviderConfig.for_azure(
        endpoint="https://test.openai.azure.com",
        model="gpt-4"
    )
    session = Session.create(
        user_id="user123",
        provider_config=config,
        active_tools=["pipeline.validate"],
    )
    
    # Add messages
    user_msg = Message.create_user_message("Run validation")
    assistant_msg = Message.create_assistant_message("Running validation...")
    session._messages.extend([user_msg, assistant_msg])
    
    # Add task
    from context_kit_service.domain.entities import Task
    from context_kit_service.domain.value_objects import TaskActionType
    
    task = Task.create(TaskActionType.PROMPT)
    task.succeed(output={"status": "ok"})
    session._tasks.append(task)
    
    # Save and retrieve
    await repo.save(session)
    found = await repo.find_by_id(session.session_id)
    
    assert found is not None
    assert len(found.messages) == 2
    assert len(found.tasks) == 1
    assert found.tasks[0].status.value == "succeeded"
    assert len(found.active_tools) == 1
