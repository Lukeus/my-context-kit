"""Application DTOs package.

Data Transfer Objects are simple data structures used to transfer data
between layers without exposing internal domain entities.
"""

from .session_dto import SessionDTO
from .task_dto import TaskDTO

__all__ = [
    "SessionDTO",
    "TaskDTO",
]
