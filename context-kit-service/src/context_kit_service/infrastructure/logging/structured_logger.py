"""Structured logging configuration.

This module configures structured logging using structlog, replacing
print() statements throughout the codebase with proper structured logging.

Features:
- JSON output in production, human-readable in development
- Request ID tracking via context variables
- Automatic exception formatting
- Log levels (DEBUG, INFO, WARNING, ERROR)
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import FilteringBoundLogger


def configure_logging(debug: bool = False, json_output: bool = False) -> None:
    """Configure structured logging for the application.

    Args:
        debug: If True, sets log level to DEBUG and uses console renderer.
               If False, sets log level to INFO.
        json_output: If True, forces JSON output regardless of debug setting.
                    Useful for production environments.

    Example:
        >>> from context_kit_service.infrastructure.config.settings import get_settings
        >>> from context_kit_service.infrastructure.logging.structured_logger import configure_logging
        >>> settings = get_settings()
        >>> configure_logging(debug=settings.debug, json_output=settings.is_production)
    """
    log_level = logging.DEBUG if debug else logging.INFO

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # Silence noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    # Determine renderer based on settings
    use_json = json_output or not debug
    renderer = (
        structlog.processors.JSONRenderer()
        if use_json
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    # Configure structlog
    structlog.configure(
        processors=[
            # Add context variables (e.g., request_id)
            structlog.contextvars.merge_contextvars,
            # Add log level
            structlog.stdlib.add_log_level,
            # Add logger name
            structlog.stdlib.add_logger_name,
            # Format positional args
            structlog.stdlib.PositionalArgumentsFormatter(),
            # Add timestamp
            structlog.processors.TimeStamper(fmt="iso"),
            # Add stack info for errors
            structlog.processors.StackInfoRenderer(),
            # Format exceptions
            structlog.processors.format_exc_info,
            # Ensure unicode
            structlog.processors.UnicodeDecoder(),
            # Final renderer
            renderer,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> FilteringBoundLogger:
    """Get a structured logger instance.

    Args:
        name: Logger name (typically __name__ of the calling module).
              If None, returns a logger without a specific name.

    Returns:
        A structlog BoundLogger instance with structured logging capabilities.

    Example:
        >>> from context_kit_service.infrastructure.logging.structured_logger import get_logger
        >>> logger = get_logger(__name__)
        >>> logger.info("user_logged_in", user_id="123", ip="127.0.0.1")
        >>> logger.error("processing_failed", error="Connection timeout", exc_info=True)

    Usage Patterns:
        # Simple message
        logger.info("operation_completed")

        # With context
        logger.info("request_processed", duration_ms=150, status_code=200)

        # With exception
        try:
            risky_operation()
        except Exception as e:
            logger.error("operation_failed", error=str(e), exc_info=True)
            raise

        # Different log levels
        logger.debug("debug_info", variable=value)
        logger.info("info_message", key=value)
        logger.warning("warning_message", issue=description)
        logger.error("error_message", error=error_str)
    """
    return structlog.get_logger(name)


# Convenience function for adding request context
def bind_request_context(**kwargs: Any) -> None:
    """Bind context variables that will be included in all subsequent logs.

    This is useful for adding request-scoped context like request_id, user_id, etc.

    Args:
        **kwargs: Key-value pairs to add to the logging context.

    Example:
        >>> from context_kit_service.infrastructure.logging.structured_logger import bind_request_context
        >>> bind_request_context(request_id="abc123", session_id="xyz789")
        >>> # All subsequent logs will include request_id and session_id
    """
    structlog.contextvars.bind_contextvars(**kwargs)


def clear_request_context() -> None:
    """Clear all bound context variables.

    Should be called at the end of request processing to prevent context leakage.

    Example:
        >>> from context_kit_service.infrastructure.logging.structured_logger import clear_request_context
        >>> clear_request_context()
    """
    structlog.contextvars.clear_contextvars()


def unbind_request_context(*keys: str) -> None:
    """Remove specific keys from the logging context.

    Args:
        *keys: Keys to remove from the context.

    Example:
        >>> from context_kit_service.infrastructure.logging.structured_logger import unbind_request_context
        >>> unbind_request_context("user_id", "session_id")
    """
    structlog.contextvars.unbind_contextvars(*keys)
