"""Integration tests for FastAPI endpoints."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from context_kit_service.main import app
from context_kit_service.services.assistant_session_manager import get_session_manager


class _StubAgent:
    """Simple agent stub that returns a fixed response for testing."""

    async def invoke(self, message, chat_history=None):  # noqa: ANN001, D401 - test double
        return "Stub response"

    async def stream(self, message, chat_history=None):  # noqa: ANN001 - parity with real agent
        # TODO(TestStreamSupport): Extend when streaming behaviour is implemented server-side.
        yield "Stub response"


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_endpoint(self) -> None:
        """Test health endpoint returns 200."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "uptime_seconds" in data
        assert "dependencies" in data

    @pytest.mark.asyncio
    async def test_root_endpoint(self) -> None:
        """Test root endpoint returns service info."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "Context Kit Service"
        assert "version" in data


class TestAssistantMessages:
    """Tests for assistant session message workflow."""

    @pytest.mark.asyncio
    async def test_send_message_updates_session(self) -> None:
        """POST /assistant/sessions/{id}/messages returns task envelope and stores conversation."""
        manager = get_session_manager()

        with patch("context_kit_service.services.assistant_session_manager.create_agent", return_value=_StubAgent()):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                session_response = await client.post(
                    "/assistant/sessions",
                    json={
                        "userId": "test-user",
                        "provider": "azure-openai",
                        "systemPrompt": "Be helpful",
                        "activeTools": [],
                    },
                )

                assert session_response.status_code == 200
                session_id = session_response.json()["sessionId"]

                message_response = await client.post(
                    f"/assistant/sessions/{session_id}/messages",
                    json={"content": "Hello there", "mode": "general"},
                )

        assert message_response.status_code == 200
        payload = message_response.json()

        assert payload["task"]["status"] == "succeeded"
        assert payload["task"]["outputs"][0]["content"] == "Stub response"

        session = manager.get_session(session_id)
        assert session is not None
        assert session.messages[-1]["role"] == "assistant"
        assert session.messages[-1]["content"] == "Stub response"
        assert session.tasks[-1].taskId == payload["task"]["taskId"]

    @pytest.mark.asyncio
    async def test_send_message_returns_complete_task_envelope(self) -> None:
        """Task envelope includes timestamps, outputs, and conversation entries (FR-002 regression coverage)."""
        manager = get_session_manager()

        with patch("context_kit_service.services.assistant_session_manager.create_agent", return_value=_StubAgent()):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                session_response = await client.post(
                    "/assistant/sessions",
                    json={
                        "userId": "regression-user",
                        "provider": "ollama",
                        "systemPrompt": "Validate schema",
                        "activeTools": [],
                    },
                )

                assert session_response.status_code == 200
                session_id = session_response.json()["sessionId"]

                message_response = await client.post(
                    f"/assistant/sessions/{session_id}/messages",
                    json={"content": "Run health check", "mode": "general"},
                )

        assert message_response.status_code == 200
        payload = message_response.json()
        task = payload["task"]

        assert task["status"].lower() == "succeeded"
        assert task["actionType"].lower() == "prompt"
        assert isinstance(task["outputs"], list)
        assert task["outputs"], "Expected task outputs to contain assistant response"
        assert task["outputs"][0]["content"] == "Stub response"

        timestamps = task.get("timestamps")
        assert timestamps is not None
        assert timestamps["created"] is not None
        assert timestamps["firstResponse"] is not None
        assert timestamps["completed"] is not None

        session = manager.get_session(session_id)
        assert session is not None
        assert len(session.messages) >= 2
        assert session.messages[-2]["role"] == "user"
        assert session.messages[-1]["role"] == "assistant"
        assert session.tasks[-1].outputs[-1]["content"] == "Stub response"

    @pytest.mark.asyncio
    async def test_send_message_missing_session_returns_404(self) -> None:
        """Unknown session id yields 404."""
        with patch("context_kit_service.services.assistant_session_manager.create_agent", return_value=_StubAgent()):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post(
                    "/assistant/sessions/nonexistent/messages",
                    json={"content": "Hi", "mode": "general"},
                )

        assert response.status_code == 404
        detail = response.json()["detail"]
        assert "not found" in detail.lower()


class TestInspectEndpoint:
    """Tests for context inspection endpoint."""

    @pytest.mark.asyncio
    async def test_inspect_endpoint(self, temp_repo: Path) -> None:
        """Test inspect endpoint with valid repository."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/context/inspect",
                json={
                    "repo_path": str(temp_repo),
                    "depth": 2,
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert "overview" in data
        assert "entities" in data
        assert "relationships" in data
        assert "duration_ms" in data

    @pytest.mark.asyncio
    async def test_inspect_endpoint_invalid_path(self) -> None:
        """Test inspect endpoint with invalid repository path."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/context/inspect",
                json={
                    "repo_path": "/nonexistent/path",
                    "depth": 2,
                },
            )

        assert response.status_code == 404


class TestSpecGenerateEndpoint:
    """Tests for specification generation endpoint."""

    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY")
        or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key",
    )
    @pytest.mark.asyncio
    async def test_spec_generate_endpoint(self, temp_repo: Path) -> None:
        """Test spec generation endpoint."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/spec/generate",
                json={
                    "repo_path": str(temp_repo),
                    "entity_ids": ["FEAT-001"],
                    "user_prompt": "Generate a spec for this feature",
                    "include_rag": False,
                },
            )

        if response.status_code != 200:
            print(f"\n❌ Response status: {response.status_code}")
            print(f"Response body: {response.text}")
        assert response.status_code == 200
        data = response.json()
        assert "spec_id" in data
        assert "spec_content" in data
        assert "log_entry_id" in data
        assert "duration_ms" in data


class TestPromptifyEndpoint:
    """Tests for promptify endpoint."""

    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY")
        or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key",
    )
    @pytest.mark.asyncio
    async def test_promptify_endpoint(self, temp_repo: Path) -> None:
        """Test promptify endpoint."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/spec/promptify",
                json={
                    "repo_path": str(temp_repo),
                    "spec_id": "SPEC-001",
                    "target_agent": "codegen",
                    "include_context": True,
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert "spec_id" in data
        assert "prompt" in data
        assert "log_entry_id" in data


class TestCodegenEndpoint:
    """Tests for code generation endpoint."""

    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY")
        or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key",
    )
    @pytest.mark.asyncio
    async def test_codegen_endpoint(self, temp_repo: Path) -> None:
        """Test code generation endpoint."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/codegen/from-spec",
                json={
                    "repo_path": str(temp_repo),
                    "spec_id": "SPEC-001",
                    "language": "typescript",
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert "spec_id" in data
        assert "artifacts" in data
        assert "summary" in data
        assert "log_entry_id" in data
        assert len(data["artifacts"]) > 0
