"""Task domain entity."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from ..value_objects.task_status import TaskActionType, TaskStatus


class Task:
    """Task entity representing an asynchronous operation.
    
    A task tracks the execution of an operation (prompt, tool execution, etc.)
    and maintains its status, outputs, and timing information.
    """
    
    def __init__(
        self,
        task_id: UUID,
        action_type: TaskActionType,
        status: TaskStatus,
        created_at: datetime,
        first_response_at: datetime | None = None,
        completed_at: datetime | None = None,
        outputs: list[dict[str, Any]] | None = None,
    ):
        self._task_id = task_id
        self._action_type = action_type
        self._status = status
        self._created_at = created_at
        self._first_response_at = first_response_at
        self._completed_at = completed_at
        self._outputs = outputs or []
    
    @property
    def task_id(self) -> UUID:
        return self._task_id
    
    @property
    def action_type(self) -> TaskActionType:
        return self._action_type
    
    @property
    def status(self) -> TaskStatus:
        return self._status
    
    @property
    def created_at(self) -> datetime:
        return self._created_at
    
    @property
    def outputs(self) -> list[dict[str, Any]]:
        return self._outputs.copy()
    
    def start(self) -> None:
        """Mark task as started."""
        if self._status != TaskStatus.PENDING:
            raise ValueError(f"Cannot start task in status {self._status}")
        self._status = TaskStatus.STREAMING
        self._first_response_at = datetime.now(timezone.utc)
    
    def succeed(self, output: dict[str, Any] | None = None) -> None:
        """Mark task as succeeded."""
        self._status = TaskStatus.SUCCEEDED
        self._completed_at = datetime.now(timezone.utc)
        if output:
            self._outputs.append(output)
    
    def fail(self, error: str) -> None:
        """Mark task as failed."""
        self._status = TaskStatus.FAILED
        self._completed_at = datetime.now(timezone.utc)
        self._outputs.append({"type": "error", "content": error})
    
    @classmethod
    def create(cls, action_type: str | TaskActionType) -> "Task":
        """Factory method to create a new task."""
        if isinstance(action_type, str):
            action_type = TaskActionType(action_type)
        
        return cls(
            task_id=uuid4(),
            action_type=action_type,
            status=TaskStatus.PENDING,
            created_at=datetime.now(timezone.utc),
        )
