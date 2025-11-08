"""AI service port interface."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Any

from ...domain.value_objects import ProviderConfig


class AIServicePort(ABC):
    """Interface for AI service operations.
    
    This port defines the contract for interacting with AI services (LangChain, etc.).
    The infrastructure layer provides concrete implementations.
    """
    
    @abstractmethod
    async def invoke(
        self,
        prompt: str,
        conversation_history: list[dict[str, Any]],
        provider_config: ProviderConfig,
        system_prompt: str,
        available_tools: list[str],
    ) -> str:
        """Invoke AI with a prompt and return response.
        
        Args:
            prompt: User prompt to send to AI.
            conversation_history: Previous conversation messages.
            provider_config: AI provider configuration.
            system_prompt: System prompt for the AI.
            available_tools: List of tool IDs available to the AI.
        
        Returns:
            AI response text.
        """
        pass
    
    @abstractmethod
    async def stream(
        self,
        prompt: str,
        conversation_history: list[dict[str, Any]],
        provider_config: ProviderConfig,
        system_prompt: str,
        available_tools: list[str],
    ) -> AsyncIterator[str]:
        """Stream AI response token by token.
        
        Args:
            prompt: User prompt to send to AI.
            conversation_history: Previous conversation messages.
            provider_config: AI provider configuration.
            system_prompt: System prompt for the AI.
            available_tools: List of tool IDs available to the AI.
        
        Yields:
            Token strings as they are generated.
        """
        pass
