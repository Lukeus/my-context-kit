"""Tests for application layer use cases."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from context_kit_service.application.dtos import SessionDTO, TaskDTO
from context_kit_service.application.ports import AIServicePort
from context_kit_service.application.use_cases import (
    CreateSessionInput,
    CreateSessionUseCase,
    SendMessageInput,
    SendMessageUseCase,
)
from context_kit_service.domain.entities import Session
from context_kit_service.domain.repositories import SessionRepository
from context_kit_service.domain.value_objects import ProviderConfig, SessionId


# =============================================================================
# Mock Repository
# =============================================================================


class MockSessionRepository(SessionRepository):
    """Mock implementation of SessionRepository for testing."""
    
    def __init__(self):
        self.sessions: dict[str, Session] = {}
    
    async def save(self, session: Session) -> None:
        self.sessions[str(session.session_id)] = session
    
    async def find_by_id(self, session_id: SessionId) -> Session | None:
        return self.sessions.get(str(session_id))
    
    async def delete(self, session_id: SessionId) -> None:
        self.sessions.pop(str(session_id), None)
    
    async def find_expired(self, max_age_hours: int) -> list[Session]:
        return []


# =============================================================================
# Mock AI Service
# =============================================================================


class MockAIService(AIServicePort):
    """Mock implementation of AIServicePort for testing."""
    
    def __init__(self, response: str = "Mock AI response"):
        self.response = response
        self.call_count = 0
    
    async def invoke(self, prompt, conversation_history, provider_config, system_prompt, available_tools):
        self.call_count += 1
        return self.response
    
    async def stream(self, prompt, conversation_history, provider_config, system_prompt, available_tools):
        for token in self.response.split():
            yield token + " "


# =============================================================================
# Create Session Use Case Tests
# =============================================================================


@pytest.mark.asyncio
async def test_create_session_use_case():
    """Test creating a session via use case."""
    repository = MockSessionRepository()
    use_case = CreateSessionUseCase(repository)
    
    config = ProviderConfig.for_ollama()
    input_data = CreateSessionInput(
        user_id="user123",
        provider_config=config
    )
    
    output = await use_case.execute(input_data)
    
    assert isinstance(output.session, SessionDTO)
    assert output.session.user_id == "user123"
    assert output.session.message_count == 0
    assert output.session.task_count == 0
    
    # Verify session was persisted
    assert len(repository.sessions) == 1


@pytest.mark.asyncio
async def test_create_session_with_tools():
    """Test creating a session with active tools."""
    repository = MockSessionRepository()
    use_case = CreateSessionUseCase(repository)
    
    config = ProviderConfig.for_azure(
        endpoint="https://test.openai.azure.com",
        model="gpt-4"
    )
    input_data = CreateSessionInput(
        user_id="user123",
        provider_config=config,
        active_tools=["pipeline.validate", "context.read"]
    )
    
    output = await use_case.execute(input_data)
    
    assert output.session.user_id == "user123"
    
    # Verify session was created with tools
    session_id = SessionId.from_string(output.session.session_id)
    session = await repository.find_by_id(session_id)
    assert len(session.active_tools) == 2


@pytest.mark.asyncio
async def test_create_session_with_custom_prompt():
    """Test creating a session with custom system prompt."""
    repository = MockSessionRepository()
    use_case = CreateSessionUseCase(repository)
    
    config = ProviderConfig.for_ollama()
    custom_prompt = "You are a helpful coding assistant."
    input_data = CreateSessionInput(
        user_id="user123",
        provider_config=config,
        system_prompt=custom_prompt
    )
    
    output = await use_case.execute(input_data)
    
    # Verify custom prompt was used
    session_id = SessionId.from_string(output.session.session_id)
    session = await repository.find_by_id(session_id)
    assert session.system_prompt == custom_prompt


# =============================================================================
# Send Message Use Case Tests
# =============================================================================


@pytest.mark.asyncio
async def test_send_message_use_case():
    """Test sending a message via use case."""
    repository = MockSessionRepository()
    ai_service = MockAIService(response="Hello from AI")
    use_case = SendMessageUseCase(repository, ai_service)
    
    # Create a session first
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    await repository.save(session)
    
    # Send message
    input_data = SendMessageInput(
        session_id=str(session.session_id),
        content="Hello AI"
    )
    
    output = await use_case.execute(input_data)
    
    assert isinstance(output.task, TaskDTO)
    assert output.task.status == "succeeded"
    assert ai_service.call_count == 1
    
    # Verify session was updated
    updated_session = await repository.find_by_id(session.session_id)
    assert len(updated_session.messages) == 2  # User + Assistant
    assert len(updated_session.tasks) == 1


@pytest.mark.asyncio
async def test_send_message_session_not_found():
    """Test sending message to non-existent session raises error."""
    repository = MockSessionRepository()
    ai_service = MockAIService()
    use_case = SendMessageUseCase(repository, ai_service)
    
    # Use a valid UUID format that doesn't exist in repository
    input_data = SendMessageInput(
        session_id="00000000-0000-0000-0000-000000000000",
        content="Hello"
    )
    
    with pytest.raises(ValueError, match="Session not found"):
        await use_case.execute(input_data)


@pytest.mark.asyncio
async def test_send_message_ai_failure():
    """Test handling AI service failure."""
    repository = MockSessionRepository()
    
    # Mock AI service that raises an error
    ai_service = MagicMock(spec=AIServicePort)
    ai_service.invoke = AsyncMock(side_effect=Exception("AI service error"))
    
    use_case = SendMessageUseCase(repository, ai_service)
    
    # Create a session first
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    await repository.save(session)
    
    # Send message
    input_data = SendMessageInput(
        session_id=str(session.session_id),
        content="Hello"
    )
    
    with pytest.raises(Exception, match="AI service error"):
        await use_case.execute(input_data)
    
    # Verify task was marked as failed
    updated_session = await repository.find_by_id(session.session_id)
    assert len(updated_session.tasks) == 1
    assert updated_session.tasks[0].status.value == "failed"


@pytest.mark.asyncio
async def test_send_message_with_conversation_history():
    """Test sending message with conversation history."""
    repository = MockSessionRepository()
    ai_service = MockAIService(response="Second response")
    use_case = SendMessageUseCase(repository, ai_service)
    
    # Create session and send first message
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    await repository.save(session)
    
    # First message
    await use_case.execute(SendMessageInput(
        session_id=str(session.session_id),
        content="First message"
    ))
    
    # Second message
    output = await use_case.execute(SendMessageInput(
        session_id=str(session.session_id),
        content="Second message"
    ))
    
    # Verify session has full conversation
    updated_session = await repository.find_by_id(session.session_id)
    assert len(updated_session.messages) == 4  # 2 user + 2 assistant
    assert len(updated_session.tasks) == 2
    assert ai_service.call_count == 2


# =============================================================================
# DTO Tests
# =============================================================================


def test_session_dto_from_entity():
    """Test creating SessionDTO from entity."""
    config = ProviderConfig.for_ollama()
    session = Session.create(user_id="user123", provider_config=config)
    
    dto = SessionDTO.from_entity(session)
    
    assert dto.user_id == "user123"
    assert dto.session_id == str(session.session_id)
    assert dto.message_count == 0
    assert dto.task_count == 0


def test_task_dto_from_entity():
    """Test creating TaskDTO from entity."""
    from context_kit_service.domain.entities import Task
    from context_kit_service.domain.value_objects import TaskActionType
    
    task = Task.create(TaskActionType.PROMPT)
    
    dto = TaskDTO.from_entity(task)
    
    assert dto.task_id == str(task.task_id)
    assert dto.action_type == "prompt"
    assert dto.status == "pending"


# =============================================================================
# Integration Test
# =============================================================================


@pytest.mark.asyncio
async def test_complete_workflow():
    """Test complete workflow: create session, send multiple messages."""
    repository = MockSessionRepository()
    ai_service = MockAIService()
    
    create_use_case = CreateSessionUseCase(repository)
    message_use_case = SendMessageUseCase(repository, ai_service)
    
    # 1. Create session
    config = ProviderConfig.for_azure(
        endpoint="https://test.openai.azure.com",
        model="gpt-4"
    )
    create_output = await create_use_case.execute(CreateSessionInput(
        user_id="user123",
        provider_config=config,
        active_tools=["pipeline.validate"]
    ))
    
    session_id = create_output.session.session_id
    
    # 2. Send first message
    await message_use_case.execute(SendMessageInput(
        session_id=session_id,
        content="Run validation"
    ))
    
    # 3. Send second message
    await message_use_case.execute(SendMessageInput(
        session_id=session_id,
        content="Show results"
    ))
    
    # 4. Verify final state
    session = await repository.find_by_id(SessionId.from_string(session_id))
    assert len(session.messages) == 4  # 2 user + 2 assistant
    assert len(session.tasks) == 2
    assert all(task.status.value == "succeeded" for task in session.tasks)
