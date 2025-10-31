"""
Context Loader Service

Loads and processes context repository entities, relationships, and metadata.
"""

from pathlib import Path
from typing import Any

import yaml


class ContextLoader:
    """Loads context repository data."""

    def __init__(self, repo_path: Path) -> None:
        self.repo_path = repo_path
        self.context_path = repo_path / ".context"
        self.context_kit_path = repo_path / ".context-kit"

    async def load_all_entities(
        self, include_types: list[str] | None = None, depth: int = 2
    ) -> list[dict[str, Any]]:
        """Load all entities from the context repository."""
        entities: list[dict[str, Any]] = []

        entity_dirs = {
            "feature": "features",
            "userstory": "userstories",
            "spec": "specs",
            "task": "tasks",
            "service": "services",
            "package": "packages",
        }

        contexts_dir = self.repo_path / "contexts"

        for entity_type, dir_name in entity_dirs.items():
            if include_types and entity_type not in include_types:
                continue

            entity_dir = contexts_dir / dir_name
            if not entity_dir.exists():
                continue

            for yaml_file in entity_dir.glob("*.yaml"):
                try:
                    with open(yaml_file, encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                        if data:
                            data["_type"] = entity_type
                            data["_file"] = str(yaml_file)
                            entities.append(data)
                except Exception as e:
                    print(f"Warning: Failed to load {yaml_file}: {e}")

        return entities

    async def load_entities_by_ids(self, entity_ids: list[str]) -> list[dict[str, Any]]:
        """Load specific entities by their IDs."""
        all_entities = await self.load_all_entities()
        return [e for e in all_entities if e.get("id") in entity_ids]

    async def load_spec_by_id(self, spec_id: str) -> str:
        """Load specification content by ID."""
        specs = await self.load_all_entities(include_types=["spec"])
        for spec in specs:
            if spec.get("id") == spec_id:
                return spec.get("content", "")
        raise ValueError(f"Specification not found: {spec_id}")

    async def load_related_entities(self, entity_id: str) -> list[dict[str, Any]]:
        """Load entities related to the given entity."""
        all_entities = await self.load_all_entities()
        entity = next((e for e in all_entities if e.get("id") == entity_id), None)

        if not entity:
            return []

        related_ids: set[str] = set()
        for key, value in entity.items():
            if isinstance(value, list) and key not in ["_type", "_file"]:
                for item in value:
                    if isinstance(item, str) and "-" in item:  # Likely an entity ID
                        related_ids.add(item)

        return [e for e in all_entities if e.get("id") in related_ids]

    async def load_rag_context(self, query: str) -> list[str]:
        """Load RAG context relevant to the query."""
        # Stub: Would implement vector search here
        return []

    async def load_stack_info(self) -> dict[str, Any]:
        """Load stack.yml from .context-kit/."""
        stack_file = self.context_kit_path / "stack.yml"
        if stack_file.exists():
            with open(stack_file, encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        return {}

    async def load_domain_info(self) -> dict[str, Any]:
        """Load domains.yml from .context-kit/."""
        domains_file = self.context_kit_path / "domains.yml"
        if domains_file.exists():
            with open(domains_file, encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        return {}

    async def identify_gaps(self, entities: list[dict[str, Any]]) -> list[str]:
        """Identify gaps in entity relationships and definitions."""
        gaps: list[str] = []

        # Check for entities without descriptions
        for entity in entities:
            if not entity.get("title") and not entity.get("objective"):
                gaps.append(f"{entity.get('id')}: Missing title/objective")

        return gaps

    async def generate_recommendations(
        self, entities: list[dict[str, Any]], gaps: list[str]
    ) -> list[str]:
        """Generate recommendations for improving context quality."""
        recommendations: list[str] = []

        if gaps:
            recommendations.append(f"Address {len(gaps)} identified gaps")

        # Count entities by status
        status_counts: dict[str, int] = {}
        for entity in entities:
            status = entity.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1

        if status_counts.get("blocked", 0) > 0:
            recommendations.append(f"Review {status_counts['blocked']} blocked items")

        return recommendations
