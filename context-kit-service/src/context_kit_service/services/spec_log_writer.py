"""Spec Log Writer Service - Persists spec generation logs."""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any


class SpecLogWriter:
    """Writes spec generation logs to .context-kit/spec-log/."""

    def __init__(self, repo_path: Path) -> None:
        self.repo_path = repo_path
        self.spec_log_dir = repo_path / ".context-kit" / "spec-log"
        self.spec_log_dir.mkdir(parents=True, exist_ok=True)

    async def write_entry(
        self,
        request_type: str,
        status: str,
        input_data: dict[str, Any],
        output_data: dict[str, Any] | None = None,
        model_info: dict[str, Any] | None = None,
        error: dict[str, str] | None = None,
        duration_ms: int = 0,
        related_entities: list[str] | None = None,
        tags: list[str] | None = None,
    ) -> str:
        """
        Write a spec log entry.

        Returns:
            Log entry ID
        """
        entry_id = f"log-{uuid.uuid4().hex[:12]}"
        timestamp = datetime.utcnow()

        log_entry = {
            "id": entry_id,
            "timestamp": timestamp.isoformat() + "Z",
            "request_type": request_type,
            "status": status,
            "input_data": input_data,
            "output_data": output_data,
            "model_info": model_info,
            "error": error,
            "duration_ms": duration_ms,
            "related_entities": related_entities or [],
            "tags": tags or [],
        }

        # Write to JSON file
        log_file = self.spec_log_dir / f"{entry_id}.json"
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(log_entry, f, indent=2)

        return entry_id

    async def read_entry(self, entry_id: str) -> dict[str, Any] | None:
        """Read a spec log entry by ID."""
        log_file = self.spec_log_dir / f"{entry_id}.json"
        if not log_file.exists():
            return None

        with open(log_file, encoding="utf-8") as f:
            return json.load(f)

    async def list_entries(
        self, limit: int = 50, request_type: str | None = None
    ) -> list[dict[str, Any]]:
        """List recent spec log entries."""
        entries: list[dict[str, Any]] = []

        for log_file in sorted(self.spec_log_dir.glob("*.json"), reverse=True):
            if len(entries) >= limit:
                break

            try:
                with open(log_file, encoding="utf-8") as f:
                    entry = json.load(f)
                    if request_type is None or entry.get("request_type") == request_type:
                        entries.append(entry)
            except Exception:
                continue

        return entries
