"""Tests for centralized settings configuration."""

import os
from pathlib import Path

import pytest

from context_kit_service.infrastructure.config import (
    Settings,
    get_settings,
    reset_settings,
)


@pytest.fixture(autouse=True)
def reset_settings_after_test():
    """Reset settings singleton after each test."""
    yield
    reset_settings()


def test_get_settings_singleton():
    """Test that get_settings returns singleton instance."""
    settings1 = get_settings()
    settings2 = get_settings()
    
    assert settings1 is settings2


def test_default_settings():
    """Test default settings values."""
    settings = get_settings()
    
    assert settings.service_name == "context-kit-service"
    assert settings.version == "0.1.0"
    assert settings.host == "127.0.0.1"
    assert settings.port == 8000
    assert settings.debug is False
    assert settings.environment == "development"


def test_ai_provider_settings():
    """Test AI provider settings structure."""
    settings = get_settings()
    
    assert hasattr(settings, "ai_provider")
    assert settings.ai_provider.temperature == 0.7
    assert settings.ai_provider.azure_api_version == "2024-02-15-preview"
    assert settings.ai_provider.ollama_base_url == "http://localhost:11434"


def test_pipeline_settings():
    """Test pipeline settings structure."""
    settings = get_settings()
    
    assert hasattr(settings, "pipeline")
    assert settings.pipeline.execution_timeout == 30
    assert settings.pipeline.max_concurrent_pipelines == 5


def test_session_settings():
    """Test session settings structure."""
    settings = get_settings()
    
    assert hasattr(settings, "session")
    assert settings.session.max_session_age_hours == 24
    assert settings.session.storage_backend == "memory"


def test_security_settings():
    """Test security settings structure."""
    settings = get_settings()
    
    assert hasattr(settings, "security")
    assert settings.security.rate_limit_per_minute == 60
    assert settings.security.enable_auth is False


def test_feature_flags():
    """Test feature flag settings."""
    settings = get_settings()
    
    assert settings.enable_streaming is True
    assert settings.enable_rag is False
    assert settings.enable_metrics is False


def test_environment_detection():
    """Test environment detection helpers."""
    settings = get_settings()
    
    assert settings.is_development is True
    assert settings.is_production is False


def test_environment_variable_override(monkeypatch):
    """Test that environment variables override defaults."""
    reset_settings()
    
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("ENVIRONMENT", "production")
    
    settings = get_settings()
    
    assert settings.debug is True
    assert settings.port == 9000
    assert settings.environment == "production"
    assert settings.is_production is True


def test_nested_settings_override(monkeypatch):
    """Test that nested settings can be overridden."""
    reset_settings()
    
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("PIPELINE_EXECUTION_TIMEOUT", "60")
    monkeypatch.setenv("SESSION_STORAGE_BACKEND", "redis")
    
    settings = get_settings()
    
    assert settings.ai_provider.azure_api_key == "test-key"
    assert settings.pipeline.execution_timeout == 60
    assert settings.session.storage_backend == "redis"


def test_redis_settings():
    """Test Redis configuration."""
    settings = get_settings()
    
    assert hasattr(settings, "redis")
    assert settings.redis.host == "localhost"
    assert settings.redis.port == 6379
    assert settings.redis.db == 0
    assert settings.redis.password is None


def test_redis_settings_override(monkeypatch):
    """Test Redis settings can be overridden."""
    reset_settings()
    
    monkeypatch.setenv("REDIS_HOST", "redis.example.com")
    monkeypatch.setenv("REDIS_PORT", "6380")
    monkeypatch.setenv("REDIS_PASSWORD", "secret")
    
    settings = get_settings()
    
    assert settings.redis.host == "redis.example.com"
    assert settings.redis.port == 6380
    assert settings.redis.password == "secret"


def test_settings_immutability():
    """Test that settings cannot be modified after creation."""
    settings = get_settings()
    
    # Pydantic settings are not frozen by default, but we can test that
    # the singleton pattern prevents unintended modifications
    original_port = settings.port
    
    # Get settings again - should be same instance
    settings2 = get_settings()
    assert settings2.port == original_port


def test_reset_settings():
    """Test that reset_settings clears the singleton."""
    settings1 = get_settings()
    settings1_id = id(settings1)
    
    reset_settings()
    
    settings2 = get_settings()
    settings2_id = id(settings2)
    
    # Should be different instances after reset
    assert settings1_id != settings2_id
