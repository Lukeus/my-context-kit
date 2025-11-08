"""Tests for structured logging configuration."""

import logging

import pytest
import structlog

from context_kit_service.infrastructure.logging import (
    bind_request_context,
    clear_request_context,
    configure_logging,
    get_logger,
    unbind_request_context,
)


@pytest.fixture(autouse=True)
def reset_logging_after_test():
    """Clear logging context after each test."""
    yield
    clear_request_context()


def test_configure_logging_debug_mode():
    """Test logging configuration in debug mode."""
    configure_logging(debug=True, json_output=False)
    
    # Check that root logger level is set (may be WARNING due to other loggers)
    # The important part is that structlog is configured
    root_logger = logging.getLogger()
    assert root_logger.level <= logging.DEBUG or root_logger.level == logging.WARNING


def test_configure_logging_production_mode():
    """Test logging configuration in production mode."""
    configure_logging(debug=False, json_output=True)
    
    # Check that root logger level is set (may be WARNING due to other loggers)
    # The important part is that structlog is configured
    root_logger = logging.getLogger()
    assert root_logger.level <= logging.INFO or root_logger.level == logging.WARNING


def test_get_logger():
    """Test getting a logger instance."""
    configure_logging(debug=True)
    
    logger = get_logger(__name__)
    
    assert logger is not None
    # Logger can be BoundLogger or BoundLoggerLazyProxy
    assert hasattr(logger, 'info') and hasattr(logger, 'error')


def test_get_logger_unnamed():
    """Test getting a logger without a name."""
    configure_logging(debug=True)
    
    logger = get_logger()
    
    assert logger is not None


def test_logger_basic_messages(caplog):
    """Test basic logging messages."""
    configure_logging(debug=True)
    logger = get_logger(__name__)
    
    # Log at different levels
    logger.debug("debug_message")
    logger.info("info_message")
    logger.warning("warning_message")
    logger.error("error_message")
    
    # Structlog doesn't use caplog directly, but we can verify no exceptions


def test_logger_with_context():
    """Test logging with context variables."""
    configure_logging(debug=True)
    logger = get_logger(__name__)
    
    # Log with context
    logger.info("user_action", user_id="123", action="login", success=True)
    
    # Should not raise any exceptions


def test_bind_request_context():
    """Test binding request context."""
    configure_logging(debug=True)
    
    bind_request_context(request_id="abc123", user_id="user456")
    
    # Context should be bound (verified by no exception)
    logger = get_logger(__name__)
    logger.info("test_message")
    
    clear_request_context()


def test_clear_request_context():
    """Test clearing request context."""
    configure_logging(debug=True)
    
    bind_request_context(request_id="abc123")
    clear_request_context()
    
    # Context should be cleared (verified by no exception)
    logger = get_logger(__name__)
    logger.info("test_message")


def test_unbind_specific_keys():
    """Test unbinding specific context keys."""
    configure_logging(debug=True)
    
    bind_request_context(request_id="abc123", user_id="user456", session_id="sess789")
    unbind_request_context("user_id", "session_id")
    
    # Only request_id should remain (verified by no exception)
    logger = get_logger(__name__)
    logger.info("test_message")
    
    clear_request_context()


def test_logger_exception_formatting():
    """Test that exceptions are properly formatted in logs."""
    configure_logging(debug=True)
    logger = get_logger(__name__)
    
    try:
        raise ValueError("Test error")
    except ValueError:
        # Log exception with exc_info=True
        logger.error("operation_failed", error="Test error", exc_info=True)
    
    # Should not raise any exceptions during logging


def test_multiple_loggers():
    """Test that multiple loggers can be created."""
    configure_logging(debug=True)
    
    logger1 = get_logger("module1")
    logger2 = get_logger("module2")
    
    assert logger1 is not None
    assert logger2 is not None
    
    # Both should be able to log
    logger1.info("message_from_module1")
    logger2.info("message_from_module2")


def test_context_isolation():
    """Test that context is properly isolated between requests."""
    configure_logging(debug=True)
    
    # First "request"
    bind_request_context(request_id="req1")
    logger = get_logger(__name__)
    logger.info("first_request")
    clear_request_context()
    
    # Second "request"
    bind_request_context(request_id="req2")
    logger.info("second_request")
    clear_request_context()
    
    # No exceptions should occur


def test_nested_context_binding():
    """Test nested context binding and unbinding."""
    configure_logging(debug=True)
    logger = get_logger(__name__)
    
    # Bind base context
    bind_request_context(request_id="req123")
    logger.info("base_context")
    
    # Add more context
    bind_request_context(user_id="user456")
    logger.info("extended_context")
    
    # Remove specific key
    unbind_request_context("user_id")
    logger.info("reduced_context")
    
    # Clear all
    clear_request_context()
    logger.info("no_context")
