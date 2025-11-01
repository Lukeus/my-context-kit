"""
Context Inspection Endpoint

Analyzes context repository structure, entities, and relationships.
"""

import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..models.requests import InspectRequest
from ..models.responses import EntitySummary, InspectResponse
from ..services.context_loader import ContextLoader

router = APIRouter()


@router.post("/inspect", response_model=InspectResponse)
async def inspect_context(request: InspectRequest) -> InspectResponse:
    """
    Inspect context repository structure and entities.

    Analyzes the repository to provide:
    - Overview of entity counts and status distribution
    - Detailed entity summaries with relationships
    - Identified gaps and missing links
    - Recommendations for improvements
    """
    start_time = time.time()

    # Validate repository path
    repo_path = Path(request.repo_path)
    if not repo_path.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {request.repo_path}")

    # Check for contexts directory (where entities are stored)
    contexts_path = repo_path / "contexts"
    context_kit_path = repo_path / ".context-kit"

    if not contexts_path.exists() and not context_kit_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No contexts or .context-kit directory found in: {request.repo_path}",
        )

    try:
        # Load context repository
        loader = ContextLoader(repo_path)
        entities = await loader.load_all_entities(
            include_types=request.include_types, depth=request.depth
        )

        # Build overview statistics
        by_type: dict[str, int] = {}
        by_status: dict[str, int] = {}
        overview = {
            "total_entities": len(entities),
            "by_type": by_type,
            "by_status": by_status,
        }

        entity_summaries: list[EntitySummary] = []
        all_relationships: dict[str, list[dict[str, str]]] = {}

        for entity in entities:
            entity_type = entity.get("_type", "unknown")
            entity_status = entity.get("status", "unknown")

            # Update counts
            by_type[entity_type] = by_type.get(entity_type, 0) + 1
            by_status[entity_status] = by_status.get(entity_status, 0) + 1

            # Extract relationships
            relationships: dict[str, list[str]] = {}
            for key, value in entity.items():
                if key.endswith("s") and isinstance(
                    value, list
                ):  # Simple heuristic for relationships
                    if all(isinstance(v, str) for v in value):
                        relationships[key] = value

            # Create entity summary
            entity_summaries.append(
                EntitySummary(
                    id=entity.get("id", "unknown"),
                    type=entity_type,
                    title=entity.get("title"),
                    status=entity_status,
                    relationships=relationships,
                )
            )

            # Track all relationships for global view
            entity_id = entity.get("id")
            if entity_id:
                for rel_type, rel_ids in relationships.items():
                    if rel_type not in all_relationships:
                        all_relationships[rel_type] = []
                    for rel_id in rel_ids:
                        all_relationships[rel_type].append(
                            {"from": entity_id, "to": rel_id, "type": rel_type}
                        )

        # Identify gaps and provide recommendations
        gaps = await loader.identify_gaps(entities)
        recommendations = await loader.generate_recommendations(entities, gaps)

        duration_ms = int((time.time() - start_time) * 1000)

        response = InspectResponse(
            overview=overview,
            entities=entity_summaries,
            relationships=all_relationships,
            gaps=gaps,
            recommendations=recommendations,
            duration_ms=duration_ms,
        )
        
        # Convert to dict to ensure JSON serializability across IPC boundary
        return response.model_dump()

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to inspect context repository: {str(e)}"
        )
