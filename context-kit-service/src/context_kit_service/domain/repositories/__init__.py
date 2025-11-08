"""Domain repositories package.

Repository interfaces define contracts for persistence without
specifying implementation details. The domain layer only defines
interfaces; implementations are in the infrastructure layer.
"""

from .session_repository import SessionRepository

__all__ = [
    "SessionRepository",
]
