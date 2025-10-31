"""
Spec Log Endpoint

Provides access to persisted specification generation logs.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from ..models.responses import SpecLogListResponse
from ..services.spec_log_writer import SpecLogWriter

router = APIRouter()


@router.get("/list", response_model=SpecLogListResponse)
async def list_spec_logs(
    repo_path: str = Query(..., description="Repository path"),
    limit: int = Query(50, description="Maximum number of entries to return"),
    request_type: str | None = Query(None, description="Filter by request type"),
) -> SpecLogListResponse:
    """
    List spec generation log entries.

    Returns recent log entries with optional filtering by request type.
    """
    # Validate repository path
    path = Path(repo_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {repo_path}")

    try:
        writer = SpecLogWriter(path)
        entries = await writer.list_entries(limit=limit, request_type=request_type)

        return SpecLogListResponse(
            entries=entries,
            total=len(entries),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list logs: {str(e)}")


@router.get("/{entry_id}")
async def get_spec_log_entry(
    entry_id: str,
    repo_path: str = Query(..., description="Repository path"),
):
    """Get a specific spec log entry by ID."""
    path = Path(repo_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Repository not found: {repo_path}")

    try:
        writer = SpecLogWriter(path)
        entry = await writer.read_entry(entry_id)

        if not entry:
            raise HTTPException(status_code=404, detail=f"Log entry not found: {entry_id}")

        return entry

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read log entry: {str(e)}")
