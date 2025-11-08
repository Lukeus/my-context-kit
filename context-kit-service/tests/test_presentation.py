"""Tests for presentation layer."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from context_kit_service.application.dtos import SessionDTO, TaskDTO
from context_kit_service.application.use_cases import (
    CreateSessionOutput,
    CreateSessionUseCase,
    SendMessageOutput,
    SendMessageUseCase,
)
from context_kit_service.domain.value_objects import SessionId
from context_kit_service.presentation.api.dependencies import (
    get_create_session_use_case,
    get_send_message_use_case,
)
from context_kit_service.presentation.api.v1.routes import sessions_router


# =============================================================================
# Test App Setup
# =============================================================================


def create_test_app() -> FastAPI:
    """Create a test FastAPI app."""
    app = FastAPI()
    app.include_router(sessions_router, prefix="/api/v1")
    return app


# =============================================================================
# Create Session Tests
# =============================================================================


@pytest.fixture
def mock_create_session_use_case():
    """Mock CreateSessionUseCase."""
    use_case = AsyncMock(spec=CreateSessionUseCase)
    
    # Mock execute to return a SessionDTO
    from datetime import datetime, timezone
    
    async def mock_execute(input_data):
        return CreateSessionOutput(
            session=SessionDTO(
                session_id=str(SessionId.generate()),
                user_id=input_data.user_id,
                message_count=0,
                task_count=0,
                created_at=datetime.now(timezone.utc),
                last_activity_at=datetime.now(timezone.utc),
            )
        )
    
    use_case.execute = mock_execute
    return use_case


def test_create_session(mock_create_session_use_case):
    """Test creating a session via API."""
    app = create_test_app()
    
    # Override dependency
    app.dependency_overrides[get_create_session_use_case] = lambda: mock_create_session_use_case
    
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/sessions",
        json={
            "user_id": "user123",
            "provider_config": {
                "provider": "ollama",
                "endpoint": "http://localhost:11434",
                "model": "llama2",
                "temperature": 0.7,
            },
            "active_tools": ["pipeline.validate"],
        },
    )
    
    if response.status_code != 201:
        print(f"Error response: {response.json()}")
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == "user123"
    assert data["message_count"] == 0
    assert data["task_count"] == 0
    assert "session_id" in data


def test_create_session_invalid_provider(mock_create_session_use_case):
    """Test creating session with invalid provider."""
    app = create_test_app()
    app.dependency_overrides[get_create_session_use_case] = lambda: mock_create_session_use_case
    
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/sessions",
        json={
            "user_id": "user123",
            "provider_config": {
                "provider": "invalid-provider",  # Invalid
                "endpoint": "http://localhost:11434",
                "model": "llama2",
            },
        },
    )
    
    assert response.status_code == 400  # Bad Request (invalid enum value)


# =============================================================================
# Send Message Tests
# =============================================================================


@pytest.fixture
def mock_send_message_use_case():
    """Mock SendMessageUseCase."""
    use_case = AsyncMock(spec=SendMessageUseCase)
    
    async def mock_execute(input_data):
        return SendMessageOutput(
            task=TaskDTO(
                task_id="task-123",
                action_type="prompt",
                status="succeeded",
                outputs=[],
            )
        )
    
    use_case.execute = mock_execute
    return use_case


def test_send_message(mock_send_message_use_case):
    """Test sending a message via API."""
    app = create_test_app()
    app.dependency_overrides[get_send_message_use_case] = lambda: mock_send_message_use_case
    
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/sessions/messages",
        json={
            "session_id": "00000000-0000-0000-0000-000000000000",
            "content": "Hello AI",
        },
    )
    
    if response.status_code != 200:
        print(f"Error response: {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert "task" in data
    assert data["task"]["task_id"] == "task-123"
    assert data["task"]["status"] == "succeeded"


def test_send_message_empty_content(mock_send_message_use_case):
    """Test sending message with empty content."""
    app = create_test_app()
    app.dependency_overrides[get_send_message_use_case] = lambda: mock_send_message_use_case
    
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/sessions/messages",
        json={
            "session_id": "00000000-0000-0000-0000-000000000000",
            "content": "",  # Empty - should fail validation
        },
    )
    
    assert response.status_code == 422  # Validation error


def test_send_message_session_not_found():
    """Test sending message to non-existent session."""
    app = create_test_app()
    
    # Mock use case that raises ValueError
    mock_use_case = AsyncMock(spec=SendMessageUseCase)
    mock_use_case.execute = AsyncMock(side_effect=ValueError("Session not found"))
    
    app.dependency_overrides[get_send_message_use_case] = lambda: mock_use_case
    
    client = TestClient(app)
    
    response = client.post(
        "/api/v1/sessions/messages",
        json={
            "session_id": "00000000-0000-0000-0000-000000000000",
            "content": "Hello",
        },
    )
    
    assert response.status_code == 400
    assert "Session not found" in response.json()["detail"]


# =============================================================================
# Integration Tests
# =============================================================================


def test_create_session_and_send_message(
    mock_create_session_use_case,
    mock_send_message_use_case,
):
    """Test complete flow: create session then send message."""
    app = create_test_app()
    app.dependency_overrides[get_create_session_use_case] = lambda: mock_create_session_use_case
    app.dependency_overrides[get_send_message_use_case] = lambda: mock_send_message_use_case
    
    client = TestClient(app)
    
    # 1. Create session
    create_response = client.post(
        "/api/v1/sessions",
        json={
            "user_id": "user123",
            "provider_config": {
                "provider": "ollama",
                "endpoint": "http://localhost:11434",
                "model": "llama2",
            },
        },
    )
    
    assert create_response.status_code == 201
    session_id = create_response.json()["session_id"]
    
    # 2. Send message
    message_response = client.post(
        "/api/v1/sessions/messages",
        json={
            "session_id": session_id,
            "content": "Hello AI",
        },
    )
    
    assert message_response.status_code == 200
    assert "task" in message_response.json()
