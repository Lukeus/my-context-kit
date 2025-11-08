"""LangChain agent for conversational AI with tool execution."""

import os
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from pydantic import SecretStr

from ..models.assistant import AssistantProvider, ProviderConfig
from .tools import get_tool_registry


class LangChainAgent:
    """LangChain-powered conversational agent with tool execution."""

    def __init__(
        self,
        provider: AssistantProvider,
        system_prompt: str,
        available_tools: list[str] | None = None,
        config: ProviderConfig | None = None,
    ):
        self.provider = provider
        self.system_prompt = system_prompt
        self.available_tools = available_tools or []
        self.config = config
        self._llm: ChatOpenAI | AzureChatOpenAI | ChatOllama | None = None

    @property
    def llm(self) -> ChatOpenAI | AzureChatOpenAI | ChatOllama:
        """Lazy-initialize LLM."""
        if self._llm is None:
            # Use config if provided, otherwise fall back to environment variables
            if self.config:
                api_key = self.config.apiKey
                endpoint = self.config.endpoint
                model = self.config.model
                temperature = self.config.temperature
                provider = self.config.provider
            else:
                # Fallback to environment variables (legacy)
                api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY")
                endpoint = None
                model = None
                temperature = 0.7
                provider = self.provider

            if not api_key and provider == AssistantProvider.AZURE_OPENAI:
                raise ValueError(
                    "No API key found. Please configure Azure OpenAI credentials in the app settings."
                )

            # Check provider type
            if provider == AssistantProvider.AZURE_OPENAI:
                # Use config endpoint or fallback to environment
                azure_endpoint = endpoint or os.getenv("AZURE_OPENAI_ENDPOINT")
                if not azure_endpoint:
                    raise ValueError(
                        "Azure endpoint is required. Please configure it in the sidecar settings."
                    )

                # Use config model or fallback to environment
                deployment_name = model or os.getenv("AZURE_OPENAI_DEPLOYMENT") or os.getenv("MODEL_NAME") or "gpt-4"

                # Detect APIM vs standard Azure OpenAI
                is_apim = "azure-api.net" in azure_endpoint

                if is_apim:
                    self._llm = AzureChatOpenAI(
                        azure_endpoint=azure_endpoint,
                        api_key=SecretStr(api_key),
                        api_version=self.config.apiVersion if self.config else "2024-02-15-preview",
                        azure_deployment=deployment_name,
                        temperature=temperature,
                        streaming=True,
                        default_headers={"Ocp-Apim-Subscription-Key": api_key},
                    )
                else:
                    self._llm = AzureChatOpenAI(
                        azure_endpoint=azure_endpoint,
                        api_key=SecretStr(api_key),
                        api_version=self.config.apiVersion if self.config else "2024-02-15-preview",
                        azure_deployment=deployment_name,
                        temperature=temperature,
                        streaming=True,
                    )
            elif provider == AssistantProvider.OLLAMA:
                # Use native Ollama API via langchain-ollama (better tool support)
                ollama_base_url = endpoint or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
                model_name = model or os.getenv("OLLAMA_MODEL", "llama2")

                print(f"[LangChainAgent] Initializing Ollama via native API: base_url={ollama_base_url}, model={model_name}")
                self._llm = ChatOllama(
                    base_url=ollama_base_url,
                    model=model_name,
                    temperature=temperature,
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
                    print(f"[LangChainAgent] Tool schemas: {[{t.name: t.args} for t in tools]}")
                    self._llm = self._llm.bind_tools(tools)
                    print(f"[LangChainAgent] Tools bound successfully. LLM type: {type(self._llm)}")
                else:
                    print(f"[LangChainAgent] WARNING: No tools found for IDs: {self.available_tools}")
            elif self.available_tools:
                print("[LangChainAgent] WARNING: available_tools specified but LLM is None")
            else:
                print("[LangChainAgent] No tools specified for this agent")

        return self._llm

    def _build_messages(
        self, message: str, chat_history: list[dict[str, Any]] | None = None
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
        self, message: str, chat_history: list[dict[str, Any]] | None = None
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
        # Loop up to 5 times to handle multi-turn tool calls
        max_iterations = 5
        for iteration in range(max_iterations):
            response = await self.llm.ainvoke(messages)

            print(f"[LangChainAgent] Iteration {iteration + 1}: Response type: {type(response)}")
            print(f"[LangChainAgent] Response has tool_calls: {hasattr(response, 'tool_calls')}")
            if hasattr(response, "tool_calls"):
                print(f"[LangChainAgent] Tool calls: {response.tool_calls}")

            # Check if response includes tool calls
            if not (hasattr(response, "tool_calls") and response.tool_calls):
                # No more tool calls, return final response
                print(f"[LangChainAgent] No tool calls, returning response: {response.content[:200] if response.content else '<empty>'}...")
                return response.content if response.content else "I couldn't process that request."

            # Has tool calls - execute them
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

            # Continue loop to get next response
            print(f"[LangChainAgent] Tool execution complete, continuing to next iteration...")

        # Max iterations reached
        print(f"[LangChainAgent] Max iterations ({max_iterations}) reached")
        return "I apologize, but I reached the maximum number of tool calls without completing the task."

    async def stream(
        self, message: str, chat_history: list[dict[str, Any]] | None = None
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
    available_tools: list[str] | None = None,
    config: ProviderConfig | None = None,
) -> LangChainAgent:
    """
    Factory function to create a LangChain agent.

    Args:
        provider: AI provider (azure-openai, ollama)
        system_prompt: System prompt for the agent
        available_tools: List of tool IDs available to the agent
        config: Provider configuration (endpoint, model, API key, etc.)

    Returns:
        Configured LangChain agent
    """
    return LangChainAgent(provider, system_prompt, available_tools, config)
