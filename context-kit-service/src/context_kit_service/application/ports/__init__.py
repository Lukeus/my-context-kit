"""Application ports package.

Ports are interfaces that define contracts for external dependencies.
They allow the application layer to remain independent of infrastructure details.
"""

from .ai_service_port import AIServicePort

__all__ = [
    "AIServicePort",
]
