"""Task status value object."""

from enum import Enum


class TaskStatus(str, Enum):
    """Task execution status.
    
    Represents the current state of a task in its lifecycle.
    """
    
    PENDING = "pending"
    STREAMING = "streaming"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"
    
    def __str__(self) -> str:
        """Return string representation."""
        return self.value
    
    @property
    def is_terminal(self) -> bool:
        """Check if this is a terminal status (task completed).
        
        Returns:
            True if task is in a final state (succeeded, failed, cancelled).
        
        Example:
            >>> assert TaskStatus.SUCCEEDED.is_terminal
            >>> assert not TaskStatus.PENDING.is_terminal
        """
        return self in (TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.CANCELLED)
    
    @property
    def is_active(self) -> bool:
        """Check if task is actively running.
        
        Returns:
            True if task is pending or streaming.
        
        Example:
            >>> assert TaskStatus.STREAMING.is_active
            >>> assert not TaskStatus.SUCCEEDED.is_active
        """
        return self in (TaskStatus.PENDING, TaskStatus.STREAMING)


class TaskActionType(str, Enum):
    """Type of action performed by a task.
    
    Categorizes the type of work being done.
    """
    
    PROMPT = "prompt"
    TOOL_EXECUTION = "tool_execution"
    PIPELINE_RUN = "pipeline_run"
    FILE_READ = "file_read"
    
    def __str__(self) -> str:
        """Return string representation."""
        return self.value
