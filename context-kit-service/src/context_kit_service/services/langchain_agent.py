"""LangChain agent for conversational AI with tool execution."""

import os
from collections.abc import AsyncIterator
from typing import Any, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from pydantic import SecretStr

from ..models.assistant import AssistantProvider
from .tools import get_tool_registry


class LangChainAgent:
    """LangChain-powered conversational agent with tool execution."""

    def __init__(
        self,
        provider: AssistantProvider,
        system_prompt: str,
        available_tools: Optional[list[str]] = None,
    ):
        self.provider = provider
        self.system_prompt = system_prompt
        self.available_tools = available_tools or []
        self._llm: Optional[ChatOpenAI | AzureChatOpenAI] = None

    @property
    def llm(self) -> ChatOpenAI | AzureChatOpenAI:
        """Lazy-initialize LLM."""
        if self._llm is None:
            # Get API key from environment (passed from Electron app)
            api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY")

            if not api_key:
                raise ValueError(
                    "No API key found. Please configure Azure OpenAI credentials in the app settings."
                )

            # Check provider type
            if self.provider == AssistantProvider.AZURE_OPENAI:
                azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
                if not azure_endpoint:
                    raise ValueError(
                        "AZURE_OPENAI_ENDPOINT environment variable is required for Azure OpenAI provider."
                    )

                deployment_name = (
                    os.getenv("AZURE_OPENAI_DEPLOYMENT")
                    or os.getenv("MODEL_NAME")
                    or "gpt-4"
                )

                # Detect APIM vs standard Azure OpenAI
                is_apim = "azure-api.net" in azure_endpoint

                if is_apim:
                    self._llm = AzureChatOpenAI(
                        azure_endpoint=azure_endpoint,
                        api_key=SecretStr(api_key),
                        api_version="2024-02-15-preview",
                        azure_deployment=deployment_name,
                        temperature=0.7,
                        streaming=True,
                        default_headers={"Ocp-Apim-Subscription-Key": api_key},
                    )
                else:
                    self._llm = AzureChatOpenAI(
                        azure_endpoint=azure_endpoint,
                        api_key=SecretStr(api_key),
                        api_version="2024-02-15-preview",
                        azure_deployment=deployment_name,
                        temperature=0.7,
                        streaming=True,
                    )
            elif self.provider == AssistantProvider.OLLAMA:
                # Ollama doesn't need API key
                from langchain_community.llms import Ollama

                ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
                model_name = os.getenv("OLLAMA_MODEL", "llama2")
                
                # Note: Ollama uses different class, but we'll need to adapt
                # For now, raise error as Ollama needs different handling
                raise NotImplementedError(
                    "Ollama provider requires different implementation. Use Azure OpenAI for now."
                )
            else:
                # Standard OpenAI
                self._llm = ChatOpenAI(
                    model="gpt-4",
                    temperature=0.7,
                    api_key=SecretStr(api_key),
                    streaming=True,
                )

            # Bind tools if any are specified
            if self.available_tools and self._llm is not None:
                registry = get_tool_registry()
                tools = registry.get_by_ids(self.available_tools)
                if tools:
                    print(f"[LangChainAgent] Binding {len(tools)} tools to LLM: {[t.name for t in tools]}")
                    self._llm = self._llm.bind_tools(tools)
                else:
                    print(f"[LangChainAgent] WARNING: No tools found for IDs: {self.available_tools}")
            elif self.available_tools:
                print(f"[LangChainAgent] WARNING: available_tools specified but LLM is None")
            else:
                print(f"[LangChainAgent] No tools specified for this agent")

        return self._llm

    def _build_messages(
        self, message: str, chat_history: Optional[list[dict[str, Any]]] = None
    ) -> list[SystemMessage | HumanMessage | AIMessage]:
        """Build message list for LLM invocation."""
        messages = [SystemMessage(content=self.system_prompt)]
        
        # Add chat history
        if chat_history:
            for msg in chat_history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
        
        # Add current user message
        messages.append(HumanMessage(content=message))
        
        return messages

    async def invoke(
        self, message: str, chat_history: Optional[list[dict[str, Any]]] = None
    ) -> str:
        """
        Invoke agent with a message and return response.
        Handles tool execution if tools are bound.

        Args:
            message: User message
            chat_history: Optional conversation history

        Returns:
            Agent response text
        """
        messages = self._build_messages(message, chat_history)
        
        # Invoke LLM (may include tool calls if tools are bound)
        response = await self.llm.ainvoke(messages)
        
        print(f"[LangChainAgent] Response type: {type(response)}")
        print(f"[LangChainAgent] Response has tool_calls: {hasattr(response, 'tool_calls')}")
        if hasattr(response, "tool_calls"):
            print(f"[LangChainAgent] Tool calls: {response.tool_calls}")
        
        # Check if response includes tool calls
        if hasattr(response, "tool_calls") and response.tool_calls:
            print(f"[LangChainAgent] Executing {len(response.tool_calls)} tool calls")
            
            # Add AI message with tool calls to conversation
            messages.append(response)
            
            # Execute each tool call
            registry = get_tool_registry()
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                tool_call_id = tool_call.get("id", "unknown")
                
                print(f"[LangChainAgent] Calling tool: {tool_name} with args: {tool_args}")
                
                tool = registry.get(tool_name)
                if tool:
                    try:
                        # Execute the tool
                        tool_result = await tool.ainvoke(tool_args)
                        print(f"[LangChainAgent] Tool {tool_name} result: {str(tool_result)[:200]}...")
                        
                        # Add tool result to messages
                        from langchain_core.messages import ToolMessage
                        messages.append(
                            ToolMessage(
                                content=str(tool_result),
                                tool_call_id=tool_call_id,
                                name=tool_name
                            )
                        )
                    except Exception as e:
                        print(f"[LangChainAgent] Tool {tool_name} error: {e}")
                        from langchain_core.messages import ToolMessage
                        messages.append(
                            ToolMessage(
                                content=f"Error executing tool: {str(e)}",
                                tool_call_id=tool_call_id,
                                name=tool_name
                            )
                        )
                else:
                    print(f"[LangChainAgent] Tool {tool_name} not found in registry")
            
            # Get final response after tool execution
            final_response = await self.llm.ainvoke(messages)
            return final_response.content
        
        # No tool calls, return direct response
        return response.content

    async def stream(
        self, message: str, chat_history: Optional[list[dict[str, Any]]] = None
    ) -> AsyncIterator[str]:
        """
        Stream agent response token by token.

        Args:
            message: User message
            chat_history: Optional conversation history

        Yields:
            Response tokens
        """
        messages = self._build_messages(message, chat_history)

        # Stream from LLM
        async for chunk in self.llm.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content


def create_agent(
    provider: AssistantProvider,
    system_prompt: str,
    available_tools: Optional[list[str]] = None,
) -> LangChainAgent:
    """
    Factory function to create a LangChain agent.

    Args:
        provider: AI provider (azure-openai, ollama)
        system_prompt: System prompt for the agent
        available_tools: List of tool IDs available to the agent

    Returns:
        Configured LangChain agent
    """
    return LangChainAgent(provider, system_prompt, available_tools)
