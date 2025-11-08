"""Centralized application settings.

This module provides a single source of truth for all application configuration,
replacing scattered os.getenv() calls and hardcoded values throughout the codebase.
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AIProviderSettings(BaseSettings):
    """AI provider configuration."""

    # Azure OpenAI
    azure_api_key: str | None = Field(None, alias="AZURE_OPENAI_API_KEY")
    azure_endpoint: str | None = Field(None, alias="AZURE_OPENAI_ENDPOINT")
    azure_deployment: str = Field("gpt-4", alias="AZURE_OPENAI_DEPLOYMENT")
    azure_api_version: str = "2024-02-15-preview"

    # Ollama
    ollama_base_url: str = Field("http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field("llama2", alias="OLLAMA_MODEL")

    # Common settings
    temperature: float = 0.7
    max_tokens: int | None = None
    request_timeout: int = 30

    model_config = SettingsConfigDict(env_prefix="", env_file=".env")


class PipelineSettings(BaseSettings):
    """Pipeline execution settings."""

    default_repo_path: str = Field("../context-repo", alias="CONTEXT_REPO_PATH")
    execution_timeout: int = 30
    max_concurrent_pipelines: int = 5

    model_config = SettingsConfigDict(env_prefix="PIPELINE_", env_file=".env")


class SessionSettings(BaseSettings):
    """Session management settings."""

    max_session_age_hours: int = 24
    cleanup_interval_hours: int = 1
    storage_backend: str = "memory"  # Options: memory, redis

    model_config = SettingsConfigDict(env_prefix="SESSION_", env_file=".env")


class RedisSettings(BaseSettings):
    """Redis configuration (for session persistence)."""

    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: str | None = None
    ssl: bool = False

    model_config = SettingsConfigDict(env_prefix="REDIS_", env_file=".env")


class SecuritySettings(BaseSettings):
    """Security configuration."""

    shared_secret: str | None = Field(None, alias="SIDECAR_SHARED_SECRET")
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:*"])
    rate_limit_per_minute: int = 60
    enable_auth: bool = False

    model_config = SettingsConfigDict(env_prefix="SECURITY_", env_file=".env")


class Settings(BaseSettings):
    """Application settings.

    This is the root settings class that aggregates all configuration sections.
    All settings can be overridden via environment variables or .env file.

    Example:
        >>> settings = get_settings()
        >>> api_key = settings.ai_provider.azure_api_key
        >>> timeout = settings.pipeline.execution_timeout
    """

    # Service metadata
    service_name: str = "context-kit-service"
    version: str = "0.1.0"
    environment: str = Field("development", alias="ENVIRONMENT")
    debug: bool = Field(False, alias="DEBUG")

    # Host configuration
    host: str = Field("127.0.0.1", alias="HOST")
    port: int = Field(8000, alias="PORT")

    # Feature flags
    enable_rag: bool = Field(False, alias="ENABLE_RAG")
    enable_streaming: bool = Field(True, alias="ENABLE_STREAMING")
    enable_metrics: bool = Field(False, alias="ENABLE_METRICS")

    # Nested settings
    ai_provider: AIProviderSettings = Field(default_factory=AIProviderSettings)
    pipeline: PipelineSettings = Field(default_factory=PipelineSettings)
    session: SessionSettings = Field(default_factory=SessionSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment.lower() == "development"


# Singleton instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get application settings singleton.

    Returns:
        Settings: The application settings instance.

    Example:
        >>> from context_kit_service.infrastructure.config.settings import get_settings
        >>> settings = get_settings()
        >>> print(settings.service_name)
        context-kit-service
    """
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings() -> None:
    """Reset settings singleton (useful for testing).

    Warning:
        This should only be used in tests to ensure a clean state.
    """
    global _settings
    _settings = None
