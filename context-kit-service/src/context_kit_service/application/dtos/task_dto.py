"""Task data transfer objects."""

from dataclasses import dataclass
from typing import Any

from ...domain.entities import Task


@dataclass
class TaskDTO:
    """Data transfer object for Task entity."""
    
    task_id: str
    action_type: str
    status: str
    outputs: list[dict[str, Any]]
    
    @classmethod
    def from_entity(cls, task: Task) -> "TaskDTO":
        """Create DTO from domain entity."""
        return cls(
            task_id=str(task.task_id),
            action_type=str(task.action_type),
            status=str(task.status),
            outputs=task.outputs,
        )
