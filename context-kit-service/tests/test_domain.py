"""Tests for domain layer entities and value objects."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from context_kit_service.domain.entities import Message, Session, Task
from context_kit_service.domain.value_objects import (
    AIProvider,
    ProviderConfig,
    SessionId,
    TaskActionType,
    TaskStatus,
)


# =============================================================================
# Value Object Tests
# =============================================================================


def test_session_id_generation():
    """Test SessionId generation."""
    session_id = SessionId.generate()
    
    assert session_id is not None
    assert session_id.value is not None
    assert str(session_id) == str(session_id.value)


def test_session_id_from_string():
    """Test creating SessionId from string."""
    uuid_str = "12345678-1234-5678-1234-567812345678"
    session_id = SessionId.from_string(uuid_str)
    
    assert str(session_id) == uuid_str


def test_session_id_equality():
    """Test SessionId value equality."""
    uuid_val = uuid4()
    id1 = SessionId(uuid_val)
    id2 = SessionId(uuid_val)
    
    assert id1 == id2
    assert id1 is not id2  # Different objects


def test_provider_config_azure():
    """Test creating Azure provider config."""
    config = ProviderConfig.for_azure(
        endpoint="https://test.openai.azure.com",
        model="gpt-4"
    )
    
    assert config.provider == AIProvider.AZURE_OPENAI
    assert config.endpoint == "https://test.openai.azure.com"
    assert config.model == "gpt-4"
    assert config.temperature == 0.7


def test_provider_config_ollama():
    """Test creating Ollama provider config."""
    config = ProviderConfig.for_ollama(model="llama3")
    
    assert config.provider == AIProvider.OLLAMA
    assert config.model == "llama3"


def test_provider_config_validation_temperature():
    """Test provider config temperature validation."""
    with pytest.raises(ValueError, match="Temperature must be between"):
        ProviderConfig(
            provider=AIProvider.AZURE_OPENAI,
            endpoint="https://test.com",
            model="gpt-4",
            temperature=3.0  # Invalid
        )


def test_provider_config_validation_max_tokens():
    """Test provider config max_tokens validation."""
    with pytest.raises(ValueError, match="Max tokens must be positive"):
        ProviderConfig(
            provider=AIProvider.AZURE_OPENAI,
            endpoint="https://test.com",
            model="gpt-4",
            max_tokens=-1  # Invalid
        )


def test_task_status_is_terminal():
    """Test TaskStatus is_terminal property."""
    assert TaskStatus.SUCCEEDED.is_terminal
    assert TaskStatus.FAILED.is_terminal
    assert not TaskStatus.PENDING.is_terminal
    assert not TaskStatus.STREAMING.is_terminal


def test_task_status_is_active():
    """Test TaskStatus is_active property."""
    assert TaskStatus.PENDING.is_active
    assert TaskStatus.STREAMING.is_active
    assert not TaskStatus.SUCCEEDED.is_active


# =============================================================================
# Entity Tests - Message
# =============================================================================


def test_message_create_user_message():
    """Test creating user message."""
    msg = Message.create_user_message("Hello!")
    
    assert msg.is_from_user()
    assert msg.content == "Hello!"
    assert msg.role == "user"
    assert not msg.is_from_assistant()


def test_message_create_assistant_message():
    """Test creating assistant message."""
    msg = Message.create_assistant_message("Hi there!")
    
    assert msg.is_from_assistant()
    assert msg.content == "Hi there!"
    assert msg.role == "assistant"


def test_message_invalid_role():
    """Test message with invalid role raises error."""
    with pytest.raises(ValueError, match="Invalid role"):
        Message(
            message_id=uuid4(),
            role="invalid",
            content="test",
            timestamp=datetime.now(timezone.utc)
        )


def test_message_equality():
    """Test message equality based on ID."""
    msg_id = uuid4()
    msg1 = Message(msg_id, "user", "content", datetime.now(timezone.utc))
    msg2 = Message(msg_id, "user", "content", datetime.now(timezone.utc))
    
    assert msg1 == msg2


# =============================================================================
# Entity Tests - Task
# =============================================================================


def test_task_create():
    """Test creating a task."""
    task = Task.create(TaskActionType.PROMPT)
    
    assert task.status == TaskStatus.PENDING
    assert task.action_type == TaskActionType.PROMPT


def test_task_lifecycle():
    """Test task state transitions."""
    task = Task.create("prompt")
    
    # Start task
    task.start()
    assert task.status == TaskStatus.STREAMING
    
    # Succeed task
    task.succeed({"type": "text", "content": "Result"})
    assert task.status == TaskStatus.SUCCEEDED
    assert len(task.outputs) == 1


def test_task_fail():
    """Test task failure."""
    task = Task.create(TaskActionType.TOOL_EXECUTION)
    task.start()
    task.fail("Something went wrong")
    
    assert task.status == TaskStatus.FAILED
    assert any("error" in output.get("type", "") for output in task.outputs)


def test_task_cannot_start_twice():
    """Test that task cannot be started twice."""
    task = Task.create(TaskActionType.PROMPT)
    task.start()
    
    with pytest.raises(ValueError, match="Cannot start task"):
        task.start()


# =============================================================================
# Entity Tests - Session (Aggregate Root)
# =============================================================================


def test_session_create():
    """Test creating a session."""
    config = ProviderConfig.for_ollama()
    session = Session.create(
        user_id="user123",
        provider_config=config
    )
    
    assert session.user_id == "user123"
    assert session.provider_config == config
    assert len(session.messages) == 0
    assert len(session.tasks) == 0


def test_session_add_message():
    """Test adding message to session."""
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    msg = Message.create_user_message("Hello")
    session.add_message(msg)
    
    assert len(session.messages) == 1
    assert session.messages[0] == msg


def test_session_add_task():
    """Test adding task to session."""
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    task = Task.create(TaskActionType.PROMPT)
    session.add_task(task)
    
    assert len(session.tasks) == 1


def test_session_conversation_history():
    """Test getting conversation history."""
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    session.add_message(Message.create_user_message("Hello"))
    session.add_message(Message.create_assistant_message("Hi!"))
    
    history = session.get_conversation_history()
    
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[1]["role"] == "assistant"


def test_session_is_expired():
    """Test session expiration check."""
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    # Fresh session should not be expired
    assert not session.is_expired(max_age_hours=24)


def test_session_active_tools():
    """Test session with active tools."""
    config = ProviderConfig.for_ollama()
    session = Session.create(
        user_id="user123",
        provider_config=config,
        active_tools=["pipeline.validate", "context.read"]
    )
    
    assert len(session.active_tools) == 2
    assert "pipeline.validate" in session.active_tools


def test_session_default_system_prompt():
    """Test session with default system prompt."""
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    assert session.system_prompt is not None
    assert len(session.system_prompt) > 0


def test_session_custom_system_prompt():
    """Test session with custom system prompt."""
    config = ProviderConfig.for_ollama()
    custom_prompt = "You are a helpful assistant."
    session = Session.create(
        user_id="user123",
        provider_config=config,
        system_prompt=custom_prompt
    )
    
    assert session.system_prompt == custom_prompt


# =============================================================================
# Integration Tests
# =============================================================================


def test_full_session_workflow():
    """Test complete session workflow."""
    # Create session
    config = ProviderConfig.for_azure(
        endpoint="https://test.openai.azure.com",
        model="gpt-4"
    )
    session = Session.create(
        user_id="user123",
        provider_config=config,
        active_tools=["pipeline.validate"]
    )
    
    # Add user message
    user_msg = Message.create_user_message("Run validation")
    session.add_message(user_msg)
    
    # Create and track task
    task = Task.create(TaskActionType.PROMPT)
    session.add_task(task)
    
    # Start task
    task.start()
    
    # Add assistant response
    assistant_msg = Message.create_assistant_message("Validation complete!")
    session.add_message(assistant_msg)
    
    # Complete task
    task.succeed({"type": "text", "content": "Validation passed"})
    
    # Verify final state
    assert len(session.messages) == 2
    assert len(session.tasks) == 1
    assert task.status == TaskStatus.SUCCEEDED
    assert session.get_conversation_history()[0]["role"] == "user"
    assert session.get_conversation_history()[1]["role"] == "assistant"
