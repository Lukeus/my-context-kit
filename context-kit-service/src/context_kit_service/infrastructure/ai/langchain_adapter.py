"""LangChain adapter for AI service port."""

from typing import Any, AsyncIterator, Dict, List

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from ...application.ports import AIServicePort
from ...domain.entities import Message
from ...domain.value_objects import ProviderConfig
from ...services.langchain_service import LangChainService
from ..logging.structured_logger import get_logger

logger = get_logger(__name__)


class LangChainAIAdapter(AIServicePort):
    """
    Adapter that implements AIServicePort using LangChain.
    
    Bridges the application layer with LangChain's LLM implementations.
    """
    
    def __init__(self, langchain_service: LangChainService | None = None):
        """
        Initialize the adapter.
        
        Args:
            langchain_service: Optional LangChain service instance (for DI)
        """
        self._langchain_service = langchain_service or LangChainService()
        logger.info("initialized_ai_adapter", implementation="langchain")
    
    def _build_messages(
        self,
        prompt: str,
        conversation_history: List[Message],
        system_prompt: str | None = None,
    ) -> List[BaseMessage]:
        """
        Build LangChain messages from conversation history.
        
        Args:
            prompt: Current user prompt
            conversation_history: Previous messages
            system_prompt: Optional system prompt
            
        Returns:
            List of LangChain messages
        """
        messages: List[BaseMessage] = []
        
        # Add system prompt if provided
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        
        # Add conversation history
        for msg in conversation_history:
            role = msg.role if hasattr(msg.role, "value") else msg.role
            role_str = role.value if hasattr(role, "value") else str(role)
            
            if role_str == "user":
                messages.append(HumanMessage(content=msg.content))
            elif role_str == "assistant":
                # Use SystemMessage for assistant responses in history
                messages.append(SystemMessage(content=msg.content))
        
        # Add current prompt
        messages.append(HumanMessage(content=prompt))
        
        return messages
    
    async def invoke(
        self,
        prompt: str,
        conversation_history: List[Message],
        provider_config: ProviderConfig,
        system_prompt: str | None = None,
        available_tools: List[str] | None = None,
    ) -> str:
        """
        Invoke AI model and get complete response.
        
        Args:
            prompt: User prompt
            conversation_history: Previous conversation messages
            provider_config: AI provider configuration
            system_prompt: Optional system prompt
            available_tools: Optional list of available tool names
            
        Returns:
            Complete AI response
        """
        logger.debug(
            "invoking_ai",
            provider=provider_config.provider.value,
            model=provider_config.model,
            history_length=len(conversation_history),
            has_tools=available_tools is not None,
        )
        
        try:
            # Get LLM from service
            llm = self._langchain_service._get_llm(provider_config, streaming=False)
            
            # Build messages
            messages = self._build_messages(prompt, conversation_history, system_prompt)
            
            # Add tool context to system message if tools are available
            if available_tools:
                tool_context = f"\n\nAvailable tools: {', '.join(available_tools)}"
                if system_prompt:
                    messages[0] = SystemMessage(content=system_prompt + tool_context)
                else:
                    messages.insert(0, SystemMessage(content=f"You are a helpful assistant.{tool_context}"))
            
            # Invoke LLM
            response = await llm.ainvoke(messages)
            
            # Extract content
            content = response.content if hasattr(response, "content") else str(response)
            
            logger.debug(
                "ai_invoked",
                provider=provider_config.provider.value,
                response_length=len(content),
            )
            
            return content
        
        except Exception as e:
            logger.error(
                "ai_invocation_failed",
                provider=provider_config.provider.value,
                error=str(e),
            )
            raise
    
    async def stream(
        self,
        prompt: str,
        conversation_history: List[Message],
        provider_config: ProviderConfig,
        system_prompt: str | None = None,
        available_tools: List[str] | None = None,
    ) -> AsyncIterator[str]:
        """
        Stream AI model response.
        
        Args:
            prompt: User prompt
            conversation_history: Previous conversation messages
            provider_config: AI provider configuration
            system_prompt: Optional system prompt
            available_tools: Optional list of available tool names
            
        Yields:
            Response tokens as they are generated
        """
        logger.debug(
            "streaming_ai",
            provider=provider_config.provider.value,
            model=provider_config.model,
            history_length=len(conversation_history),
            has_tools=available_tools is not None,
        )
        
        try:
            # Get streaming LLM from service
            llm = self._langchain_service._get_llm(provider_config, streaming=True)
            
            # Build messages
            messages = self._build_messages(prompt, conversation_history, system_prompt)
            
            # Add tool context if available
            if available_tools:
                tool_context = f"\n\nAvailable tools: {', '.join(available_tools)}"
                if system_prompt:
                    messages[0] = SystemMessage(content=system_prompt + tool_context)
                else:
                    messages.insert(0, SystemMessage(content=f"You are a helpful assistant.{tool_context}"))
            
            # Stream response
            total_tokens = 0
            async for chunk in llm.astream(messages):
                if hasattr(chunk, "content") and chunk.content:
                    total_tokens += 1
                    yield chunk.content
            
            logger.debug(
                "ai_streamed",
                provider=provider_config.provider.value,
                total_tokens=total_tokens,
            )
        
        except Exception as e:
            logger.error(
                "ai_streaming_failed",
                provider=provider_config.provider.value,
                error=str(e),
            )
            raise
