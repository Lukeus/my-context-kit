"""Provider configuration value object."""

from dataclasses import dataclass
from enum import Enum


class AIProvider(str, Enum):
    """AI provider types.
    
    Supported providers for the AI service.
    """
    
    AZURE_OPENAI = "azure-openai"
    OLLAMA = "ollama"
    
    def __str__(self) -> str:
        """Return string representation."""
        return self.value


@dataclass(frozen=True)
class ProviderConfig:
    """AI provider configuration value object.
    
    This immutable value object encapsulates all configuration needed
    to connect to an AI provider. It validates its own invariants.
    
    Attributes:
        provider: The AI provider type (Azure OpenAI or Ollama).
        endpoint: The endpoint URL for the provider.
        model: The model name/deployment to use.
        temperature: Sampling temperature (0.0 to 2.0).
        max_tokens: Maximum tokens to generate (optional).
    
    Example:
        >>> config = ProviderConfig(
        ...     provider=AIProvider.AZURE_OPENAI,
        ...     endpoint="https://my-resource.openai.azure.com",
        ...     model="gpt-4",
        ...     temperature=0.7
        ... )
        >>> assert config.temperature == 0.7
    """
    
    provider: AIProvider
    endpoint: str
    model: str
    temperature: float = 0.7
    max_tokens: int | None = None
    
    def __post_init__(self) -> None:
        """Validate configuration invariants.
        
        Raises:
            ValueError: If any configuration value is invalid.
        """
        # Validate temperature range
        if not 0.0 <= self.temperature <= 2.0:
            raise ValueError(
                f"Temperature must be between 0.0 and 2.0, got {self.temperature}"
            )
        
        # Validate max_tokens if provided
        if self.max_tokens is not None and self.max_tokens <= 0:
            raise ValueError(
                f"Max tokens must be positive, got {self.max_tokens}"
            )
        
        # Validate endpoint
        if not self.endpoint or not self.endpoint.strip():
            raise ValueError("Endpoint cannot be empty")
        
        # Validate model
        if not self.model or not self.model.strip():
            raise ValueError("Model cannot be empty")
    
    @classmethod
    def for_azure(
        cls,
        endpoint: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> "ProviderConfig":
        """Create configuration for Azure OpenAI.
        
        Args:
            endpoint: Azure OpenAI endpoint URL.
            model: Deployment name.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
        
        Returns:
            ProviderConfig instance for Azure OpenAI.
        
        Example:
            >>> config = ProviderConfig.for_azure(
            ...     endpoint="https://my-resource.openai.azure.com",
            ...     model="gpt-4"
            ... )
            >>> assert config.provider == AIProvider.AZURE_OPENAI
        """
        return cls(
            provider=AIProvider.AZURE_OPENAI,
            endpoint=endpoint,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    
    @classmethod
    def for_ollama(
        cls,
        base_url: str = "http://localhost:11434",
        model: str = "llama2",
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> "ProviderConfig":
        """Create configuration for Ollama.
        
        Args:
            base_url: Ollama base URL.
            model: Model name.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
        
        Returns:
            ProviderConfig instance for Ollama.
        
        Example:
            >>> config = ProviderConfig.for_ollama(model="llama3")
            >>> assert config.provider == AIProvider.OLLAMA
        """
        return cls(
            provider=AIProvider.OLLAMA,
            endpoint=base_url,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
