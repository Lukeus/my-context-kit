"""Tests for SpecLogWriter service."""

from pathlib import Path

import pytest

from context_kit_service.services.spec_log_writer import SpecLogWriter


class TestSpecLogWriter:
    """Test cases for SpecLogWriter."""

    @pytest.mark.asyncio
    async def test_write_entry(self, temp_repo: Path) -> None:
        """Test writing a spec log entry."""
        writer = SpecLogWriter(temp_repo)

        entry_id = await writer.write_entry(
            request_type="spec-generate",
            status="success",
            input_data={"user_prompt": "Test prompt"},
            output_data={"spec_id": "SPEC-001"},
            duration_ms=100,
        )

        assert entry_id.startswith("log-")

        # Verify file was created
        log_file = temp_repo / ".context-kit" / "spec-log" / f"{entry_id}.json"
        assert log_file.exists()

    @pytest.mark.asyncio
    async def test_read_entry(self, temp_repo: Path) -> None:
        """Test reading a spec log entry."""
        writer = SpecLogWriter(temp_repo)

        entry_id = await writer.write_entry(
            request_type="inspect",
            status="success",
            input_data={"repo_path": str(temp_repo)},
            duration_ms=50,
        )

        entry = await writer.read_entry(entry_id)

        assert entry is not None
        assert entry["id"] == entry_id
        assert entry["request_type"] == "inspect"
        assert entry["status"] == "success"
        assert entry["duration_ms"] == 50

    @pytest.mark.asyncio
    async def test_read_nonexistent_entry(self, temp_repo: Path) -> None:
        """Test reading non-existent entry returns None."""
        writer = SpecLogWriter(temp_repo)
        entry = await writer.read_entry("log-nonexistent")

        assert entry is None

    @pytest.mark.asyncio
    async def test_list_entries(self, temp_repo: Path) -> None:
        """Test listing spec log entries."""
        writer = SpecLogWriter(temp_repo)

        # Write multiple entries
        await writer.write_entry(
            request_type="spec-generate",
            status="success",
            input_data={},
            duration_ms=100,
        )
        await writer.write_entry(
            request_type="promptify",
            status="success",
            input_data={},
            duration_ms=50,
        )
        await writer.write_entry(
            request_type="codegen",
            status="failure",
            input_data={},
            duration_ms=200,
            error={"message": "Test error"},
        )

        # List all entries
        entries = await writer.list_entries()
        assert len(entries) == 3

    @pytest.mark.asyncio
    async def test_list_entries_with_type_filter(self, temp_repo: Path) -> None:
        """Test listing entries filtered by request type."""
        writer = SpecLogWriter(temp_repo)

        await writer.write_entry(
            request_type="spec-generate",
            status="success",
            input_data={},
            duration_ms=100,
        )
        await writer.write_entry(
            request_type="promptify",
            status="success",
            input_data={},
            duration_ms=50,
        )

        # List only spec-generate entries
        entries = await writer.list_entries(request_type="spec-generate")
        assert len(entries) == 1
        assert entries[0]["request_type"] == "spec-generate"

    @pytest.mark.asyncio
    async def test_list_entries_with_limit(self, temp_repo: Path) -> None:
        """Test listing entries with limit."""
        writer = SpecLogWriter(temp_repo)

        # Write 5 entries
        for i in range(5):
            await writer.write_entry(
                request_type="inspect",
                status="success",
                input_data={"index": i},
                duration_ms=10,
            )

        # List with limit of 3
        entries = await writer.list_entries(limit=3)
        assert len(entries) == 3

    @pytest.mark.asyncio
    async def test_write_entry_with_all_fields(self, temp_repo: Path) -> None:
        """Test writing entry with all optional fields."""
        writer = SpecLogWriter(temp_repo)

        entry_id = await writer.write_entry(
            request_type="codegen",
            status="success",
            input_data={"spec_id": "SPEC-001"},
            output_data={"artifacts": 2},
            model_info={
                "provider": "azure-openai",
                "model": "gpt-4",
                "tokens_used": 1000,
            },
            error=None,
            duration_ms=500,
            related_entities=["SPEC-001", "FEAT-001"],
            tags=["production", "critical"],
        )

        entry = await writer.read_entry(entry_id)

        assert entry is not None
        assert entry["model_info"]["provider"] == "azure-openai"
        assert len(entry["related_entities"]) == 2
        assert len(entry["tags"]) == 2
        assert "production" in entry["tags"]
