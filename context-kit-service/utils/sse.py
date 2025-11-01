"""
Server-Sent Events (SSE) Utilities

Provides streaming progress updates for long-running operations.
"""

import json
from collections.abc import AsyncGenerator
from typing import Any


class SSEMessage:
    """Represents a Server-Sent Event message."""

    def __init__(
        self, data: dict[str, Any], event: str = "message", id: str = None, retry: int = None
    ):
        self.data = data
        self.event = event
        self.id = id
        self.retry = retry

    def format(self) -> str:
        """Format the message for SSE protocol."""
        lines = []

        if self.event and self.event != "message":
            lines.append(f"event: {self.event}")

        if self.id:
            lines.append(f"id: {self.id}")

        if self.retry:
            lines.append(f"retry: {self.retry}")

        # Data must be JSON serialized
        data_str = json.dumps(self.data)
        lines.append(f"data: {data_str}")

        # SSE messages end with double newline
        return "\n".join(lines) + "\n\n"


class ProgressStream:
    """Helper for streaming progress updates."""

    def __init__(self):
        self.current_step = 0
        self.total_steps = 100
        self.status = "initializing"

    async def update(
        self,
        progress: int,
        message: str,
        status: str = "in_progress",
        metadata: dict[str, Any] = None,
    ) -> SSEMessage:
        """Create a progress update message."""
        self.current_step = progress
        self.status = status

        data = {
            "type": "progress",
            "progress": progress,
            "message": message,
            "status": status,
        }

        if metadata:
            data["metadata"] = metadata

        return SSEMessage(data=data, event="progress")

    async def complete(self, result: dict[str, Any]) -> SSEMessage:
        """Create a completion message."""
        self.status = "complete"
        self.current_step = 100

        data = {
            "type": "complete",
            "progress": 100,
            "status": "complete",
            "result": result,
        }

        return SSEMessage(data=data, event="complete")

    async def error(self, error_message: str, error_code: str = None) -> SSEMessage:
        """Create an error message."""
        self.status = "error"

        data = {
            "type": "error",
            "status": "error",
            "error": error_message,
        }

        if error_code:
            data["error_code"] = error_code

        return SSEMessage(data=data, event="error")

    async def token(self, token: str, cumulative_text: str = None) -> SSEMessage:
        """Create a token streaming message."""
        data = {
            "type": "token",
            "token": token,
            "status": "streaming",
        }

        if cumulative_text is not None:
            data["cumulative_text"] = cumulative_text

        return SSEMessage(data=data, event="token")


async def stream_generator(
    operation_fn, progress_stream: ProgressStream
) -> AsyncGenerator[str, None]:
    """
    Generic SSE stream generator.
    Args:
        operation_fn: Async function that yields progress updates or tokens
        progress_stream: ProgressStream instance for tracking
    Yields:
        Formatted SSE messages
    """
    try:
        async for update in operation_fn():
            if isinstance(update, SSEMessage):
                yield update.format()
            elif isinstance(update, dict):
                # Auto-wrap dict in SSEMessage
                msg = SSEMessage(data=update)
                yield msg.format()
            elif isinstance(update, str):
                # Assume it's a token
                msg = await progress_stream.token(update)
                yield msg.format()
    except Exception as e:
        error_msg = await progress_stream.error(str(e))
        yield error_msg.format()


def create_sse_response_headers() -> dict[str, str]:
    """Create standard SSE response headers."""
    return {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # Disable buffering in nginx
    }
