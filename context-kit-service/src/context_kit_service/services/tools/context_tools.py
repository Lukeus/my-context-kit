"""Context repository tools for reading and searching entities."""

import os
from pathlib import Path
from typing import Any

import yaml
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class ContextReadInput(BaseModel):
    """Input for context.read tool."""

    path: str = Field(description="Relative path to read from the repository root (e.g., 'contexts/features/auth.yaml', 'README.md', 'specs/feature-branch/spec.md')")
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


def _read_context_file(path: str, repo_path: str | None = None) -> dict[str, Any]:
    """Read a file from the context repository."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")

    # Resolve the full file path
    file_path = Path(repo_path) / path

    if not file_path.exists():
        # Try to give helpful suggestions
        suggestions = []
        contexts_dir = Path(repo_path) / "contexts"
        if contexts_dir.exists():
            # List first few available files
            for i, yaml_file in enumerate(contexts_dir.rglob("*.yaml")):
                if i >= 5:  # Limit to 5 suggestions
                    break
                rel_path = yaml_file.relative_to(repo_path)
                suggestions.append(str(rel_path))
        
        error_msg = f"File not found: {path}"
        if suggestions:
            error_msg += f"\n\nAvailable files (examples):\n" + "\n".join(f"  - {s}" for s in suggestions)
        raise FileNotFoundError(error_msg)

    with open(file_path, encoding='utf-8') as f:
        content = f.read()

    return {
        "path": str(file_path),
        "relative_path": path,
        "content": content,
        "size_bytes": len(content),
    }


def _search_context(query: str, entity_type: str | None = None, repo_path: str | None = None) -> list[dict[str, Any]]:
    """Search context entities by query."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")
    
    print(f"[ContextSearchTool] Searching with query='{query}', entity_type={entity_type}, repo_path={repo_path}")

    contexts_dir = Path(repo_path) / "contexts"
    
    if not contexts_dir.exists():
        error_msg = f"Context directory not found: {contexts_dir}. Please set CONTEXT_REPO_PATH environment variable."
        print(f"[ContextSearchTool] ERROR: {error_msg}")
        raise FileNotFoundError(error_msg)
    
    results = []

    # Determine which entity types to search
    if entity_type:
        search_types = [entity_type]
    else:
        search_types = [d.name for d in contexts_dir.iterdir() if d.is_dir()]
    
    print(f"[ContextSearchTool] Searching in types: {search_types}")

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
            except Exception as e:
                print(f"[ContextSearchTool] Error reading {yaml_file}: {e}")
                continue
    
    print(f"[ContextSearchTool] Found {len(results)} results")
    return results


def ContextReadTool() -> StructuredTool:
    """Create context.read tool."""
    return StructuredTool.from_function(
        func=_read_context_file,
        name="context.read",
        description="Read the contents of a file from the context repository. Use this to read YAML entities (contexts/*/), markdown docs (specs/, README.md), or any text file. Returns the file content.",
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
