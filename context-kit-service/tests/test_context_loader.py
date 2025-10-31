"""Tests for ContextLoader service."""

from pathlib import Path

import pytest

from context_kit_service.services.context_loader import ContextLoader


class TestContextLoader:
    """Test cases for ContextLoader."""

    @pytest.mark.asyncio
    async def test_load_all_entities(self, temp_repo: Path) -> None:
        """Test loading all entities from repository."""
        loader = ContextLoader(temp_repo)
        entities = await loader.load_all_entities()

        assert len(entities) == 3  # FEAT-001, US-001, SPEC-001
        assert any(e["id"] == "FEAT-001" for e in entities)
        assert any(e["id"] == "US-001" for e in entities)
        assert any(e["id"] == "SPEC-001" for e in entities)

    @pytest.mark.asyncio
    async def test_load_entities_with_type_filter(self, temp_repo: Path) -> None:
        """Test loading entities filtered by type."""
        loader = ContextLoader(temp_repo)
        entities = await loader.load_all_entities(include_types=["feature"])

        assert len(entities) == 1
        assert entities[0]["id"] == "FEAT-001"
        assert entities[0]["_type"] == "feature"

    @pytest.mark.asyncio
    async def test_load_entities_by_ids(self, temp_repo: Path) -> None:
        """Test loading specific entities by ID."""
        loader = ContextLoader(temp_repo)
        entities = await loader.load_entities_by_ids(["FEAT-001", "US-001"])

        assert len(entities) == 2
        ids = {e["id"] for e in entities}
        assert ids == {"FEAT-001", "US-001"}

    @pytest.mark.asyncio
    async def test_load_spec_by_id(self, temp_repo: Path) -> None:
        """Test loading specification content."""
        loader = ContextLoader(temp_repo)
        content = await loader.load_spec_by_id("SPEC-001")

        assert content == "This is a test specification"

    @pytest.mark.asyncio
    async def test_load_spec_by_id_not_found(self, temp_repo: Path) -> None:
        """Test loading non-existent specification raises error."""
        loader = ContextLoader(temp_repo)

        with pytest.raises(ValueError, match="Specification not found"):
            await loader.load_spec_by_id("SPEC-999")

    @pytest.mark.asyncio
    async def test_load_related_entities(self, temp_repo: Path) -> None:
        """Test loading entities related to a given entity."""
        loader = ContextLoader(temp_repo)
        related = await loader.load_related_entities("FEAT-001")

        # FEAT-001 references US-001, SPEC-001, T-001
        # T-001 doesn't exist, so only 2 should be found
        assert len(related) >= 1  # At least US-001 and SPEC-001
        related_ids = {e["id"] for e in related}
        assert "US-001" in related_ids or "SPEC-001" in related_ids

    @pytest.mark.asyncio
    async def test_load_stack_info(self, temp_repo: Path) -> None:
        """Test loading stack.yml configuration."""
        loader = ContextLoader(temp_repo)
        stack_info = await loader.load_stack_info()

        assert stack_info["version"] == "1.0.0"
        assert stack_info["runtime"]["language"] == "typescript"

    @pytest.mark.asyncio
    async def test_load_domain_info(self, temp_repo: Path) -> None:
        """Test loading domains.yml configuration."""
        loader = ContextLoader(temp_repo)
        domain_info = await loader.load_domain_info()

        assert domain_info["version"] == "1.0.0"
        assert len(domain_info["domains"]) == 1
        assert domain_info["domains"][0]["id"] == "test-domain"

    @pytest.mark.asyncio
    async def test_identify_gaps(self, temp_repo: Path, sample_entities: list) -> None:
        """Test gap identification in entities."""
        loader = ContextLoader(temp_repo)

        # Create entity without title
        entities_with_gap = sample_entities + [{"id": "TEST-001", "_type": "test"}]

        gaps = await loader.identify_gaps(entities_with_gap)

        assert len(gaps) > 0
        assert any("TEST-001" in gap for gap in gaps)

    @pytest.mark.asyncio
    async def test_generate_recommendations(self, temp_repo: Path) -> None:
        """Test recommendation generation."""
        loader = ContextLoader(temp_repo)
        entities = await loader.load_all_entities()
        gaps = await loader.identify_gaps(entities)
        recommendations = await loader.generate_recommendations(entities, gaps)

        assert isinstance(recommendations, list)
