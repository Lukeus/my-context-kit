"""Context repository tools for reading and searching entities."""

import os
from pathlib import Path
from typing import Any

import yaml
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class ContextReadInput(BaseModel):
    """Input for context.read tool."""

    entity_type: str = Field(description="Entity type (e.g., 'feature', 'task', 'service')")
    entity_id: str = Field(description="Entity ID (filename without extension)")
    repo_path: str | None = Field(
        default=None, description="Path to context repository (optional, uses default if not provided)"
    )


class ContextSearchInput(BaseModel):
    """Input for context.search tool."""

    query: str = Field(description="Search query string")
    entity_type: str | None = Field(
        default=None, description="Entity type to filter by (optional)"
    )
    repo_path: str | None = Field(
        default=None, description="Path to context repository (optional, uses default if not provided)"
    )


def _read_context_file(entity_type: str, entity_id: str, repo_path: str | None = None) -> dict[str, Any]:
    """Read a context entity file."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")

    entity_path = Path(repo_path) / "contexts" / entity_type / f"{entity_id}.yaml"

    if not entity_path.exists():
        raise FileNotFoundError(f"Entity not found: {entity_type}/{entity_id}")

    with open(entity_path) as f:
        data = yaml.safe_load(f)

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "data": data,
        "path": str(entity_path),
    }


def _search_context(query: str, entity_type: str | None = None, repo_path: str | None = None) -> list[dict[str, Any]]:
    """Search context entities by query."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")

    contexts_dir = Path(repo_path) / "contexts"
    results = []

    # Determine which entity types to search
    if entity_type:
        search_types = [entity_type]
    else:
        search_types = [d.name for d in contexts_dir.iterdir() if d.is_dir()]

    query_lower = query.lower()

    for etype in search_types:
        type_dir = contexts_dir / etype
        if not type_dir.exists():
            continue

        for yaml_file in type_dir.glob("*.yaml"):
            try:
                with open(yaml_file) as f:
                    data = yaml.safe_load(f)

                # Simple text search in entity content
                if query_lower in str(data).lower():
                    results.append({
                        "entity_type": etype,
                        "entity_id": yaml_file.stem,
                        "name": data.get("name", yaml_file.stem),
                        "summary": data.get("summary", "")[:200],
                    })
            except Exception:
                continue

    return results


def ContextReadTool() -> StructuredTool:
    """Create context.read tool."""
    return StructuredTool.from_function(
        func=_read_context_file,
        name="context.read",
        description="Read a specific context entity from the repository. Returns the full entity data including metadata, relationships, and content.",
        args_schema=ContextReadInput,
    )


def ContextSearchTool() -> StructuredTool:
    """Create context.search tool."""
    return StructuredTool.from_function(
        func=_search_context,
        name="context.search",
        description="Search for context entities by query string. Returns a list of matching entities with basic info.",
        args_schema=ContextSearchInput,
    )
