"""Integration tests for FastAPI endpoints."""

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from context_kit_service.main import app


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

        assert response.status_code == 200
        data = response.json()
        assert "spec_id" in data
        assert "spec_content" in data
        assert "log_entry_id" in data
        assert "duration_ms" in data


class TestPromptifyEndpoint:
    """Tests for promptify endpoint."""

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
