"""Domain entities package.

Entities are objects with distinct identity that persists over time.
They are compared by their identifier, not their attributes.
"""

from .message import Message
from .session import Session
from .task import Task

__all__ = [
    "Session",
    "Message",
    "Task",
]
