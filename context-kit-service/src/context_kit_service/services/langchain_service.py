"""
LangChain Service for AI Operations

Provides a high-level interface for LangChain operations including:
- Entity generation with prompt engineering
- Streaming assistance with callbacks
- Tool execution
- RAG queries with vector stores

This service abstracts LangChain complexity from the FastAPI routes.
"""

import json
from typing import Any, AsyncIterator, Dict, List, Optional

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_models import ChatOllama
from langchain_openai import AzureChatOpenAI

from ..models.ai_requests import (
    AIProvider,
    ConversationMessage,
    EntityType,
    MessageRole,
    ProviderConfig,
)


# =============================================================================
# Streaming Callback Handler
# =============================================================================


class StreamingCallbackHandler(AsyncCallbackHandler):
    """
    Async callback handler for streaming LangChain responses.
    
    Yields tokens as they are generated for SSE streaming.
    """

    def __init__(self):
        self.tokens: List[str] = []
        self.token_index = 0

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        """Called when a new token is generated."""
        self.tokens.append(token)
        self.token_index += 1

    def get_full_content(self) -> str:
        """Get the complete generated content."""
        return "".join(self.tokens)


# =============================================================================
# LangChain Service
# =============================================================================


class LangChainService:
    """
    Service class for LangChain operations.
    
    Handles LLM initialization, prompt engineering, and chain execution.
    """

    # Entity generation prompts
    ENTITY_PROMPTS = {
        EntityType.FEATURE: """You are a product manager creating a feature specification.

Given the user request, generate a comprehensive feature specification in JSON format with:
- id: unique identifier
- title: clear, concise feature name
- description: detailed description of the feature
- acceptanceCriteria: list of acceptance criteria
- priority: high/medium/low
- estimatedEffort: story points or time estimate

User Request: {user_prompt}

{linked_feature_context}

Generate the feature specification as valid JSON:""",
        EntityType.SPEC: """You are a technical architect creating a technical specification.

Given the user request, generate a detailed technical specification in JSON format with:
- id: unique identifier
- title: specification title
- overview: high-level overview
- technicalDetails: detailed technical approach
- apiEndpoints: list of API endpoints (if applicable)
- dataModels: data structures and schemas
- dependencies: external dependencies
- securityConsiderations: security notes

User Request: {user_prompt}

{linked_feature_context}

Generate the technical specification as valid JSON:""",
        EntityType.TASK: """You are a development team lead breaking down work into tasks.

Given the user request, generate a task definition in JSON format with:
- id: unique identifier
- title: clear task name
- description: what needs to be done
- steps: list of concrete steps
- estimatedHours: time estimate
- assignee: suggested role/person (optional)
- dependencies: task dependencies

User Request: {user_prompt}

{linked_feature_context}

Generate the task definition as valid JSON:""",
        EntityType.USERSTORY: """You are a product owner writing user stories.

Given the user request, generate a user story in JSON format with:
- id: unique identifier
- title: user story title
- asA: user role
- iWant: desired capability
- soThat: business value
- acceptanceCriteria: list of criteria
- priority: high/medium/low

User Request: {user_prompt}

{linked_feature_context}

Generate the user story as valid JSON:""",
        EntityType.GOVERNANCE: """You are a governance officer creating governance documentation.

Given the user request, generate governance documentation in JSON format with:
- id: unique identifier
- title: governance document title
- category: policy/procedure/standard/guideline
- description: detailed description
- scope: what this applies to
- requirements: list of requirements
- compliance: compliance considerations
- reviewCycle: review frequency

User Request: {user_prompt}

{linked_feature_context}

Generate the governance documentation as valid JSON:""",
    }

    def __init__(self):
        """Initialize the LangChain service."""
        self._llm_cache: Dict[str, Any] = {}

    def _get_llm(self, config: ProviderConfig, streaming: bool = False):
        """
        Get or create an LLM instance based on provider config.
        
        Args:
            config: Provider configuration
            streaming: Whether to enable streaming
            
        Returns:
            Configured LLM instance
        """
        cache_key = f"{config.provider}:{config.model}:{streaming}"

        if cache_key in self._llm_cache:
            return self._llm_cache[cache_key]

        if config.provider == AIProvider.OLLAMA:
            llm = ChatOllama(
                base_url=str(config.endpoint),
                model=config.model,
                temperature=config.temperature,
                streaming=streaming,
            )
        elif config.provider == AIProvider.AZURE_OPENAI:
            llm = AzureChatOpenAI(
                azure_endpoint=str(config.endpoint),
                deployment_name=config.model,
                api_key=config.api_key,
                api_version=config.api_version or "2024-02-15-preview",
                temperature=config.temperature,
                max_tokens=config.max_tokens,
                streaming=streaming,
            )
        else:
            raise ValueError(f"Unsupported provider: {config.provider}")

        self._llm_cache[cache_key] = llm
        return llm

    # ==========================================================================
    # Entity Generation
    # ==========================================================================

    async def generate_entity(
        self,
        entity_type: EntityType,
        user_prompt: str,
        linked_feature_id: Optional[str],
        config: ProviderConfig,
    ) -> Dict[str, Any]:
        """
        Generate an entity using LangChain.
        
        Args:
            entity_type: Type of entity to generate
            user_prompt: User's request/prompt
            linked_feature_id: Optional linked feature ID
            config: AI provider configuration
            
        Returns:
            Generated entity as dictionary
        """
        llm = self._get_llm(config, streaming=False)

        # Get prompt template for entity type
        prompt_template = self.ENTITY_PROMPTS.get(entity_type)
        if not prompt_template:
            raise ValueError(f"No prompt template for entity type: {entity_type}")

        # Add linked feature context if provided
        linked_context = ""
        if linked_feature_id:
            linked_context = f"This should be linked to feature: {linked_feature_id}"

        # Create and invoke chain using LCEL
        prompt = ChatPromptTemplate.from_template(prompt_template)
        chain = prompt | llm | StrOutputParser()

        content = await chain.ainvoke(
            {
                "user_prompt": user_prompt,
                "linked_feature_context": linked_context,
            }
        )

        # Parse JSON response
        content = content.strip()

        # Extract JSON from markdown code blocks if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        try:
            entity = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: create a basic entity structure
            entity = {
                "id": f"generated-{entity_type.value}",
                "type": entity_type.value,
                "title": f"Generated {entity_type.value.title()}",
                "description": content,
                "generated_from": user_prompt,
            }

        # Ensure entity has required fields
        entity["type"] = entity_type.value
        if linked_feature_id:
            entity["linked_feature_id"] = linked_feature_id

        return entity

    # ==========================================================================
    # Streaming Assistance
    # ==========================================================================

    async def stream_assistance(
        self,
        question: str,
        conversation_history: List[ConversationMessage],
        context_snapshot: Optional[Dict[str, Any]],
        config: ProviderConfig,
    ) -> AsyncIterator[str]:
        """
        Stream AI assistance responses.
        
        Args:
            question: User's question
            conversation_history: Previous conversation messages
            context_snapshot: Current context state
            config: AI provider configuration
            
        Yields:
            Token strings as they are generated
        """
        llm = self._get_llm(config, streaming=True)

        # Build messages from conversation history
        messages: List[BaseMessage] = [
            SystemMessage(
                content="You are a helpful AI assistant for a software development project. "
                "Provide clear, concise, and actionable advice."
            )
        ]

        # Add conversation history
        for msg in conversation_history:
            if msg.role == MessageRole.USER:
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == MessageRole.ASSISTANT:
                messages.append(SystemMessage(content=msg.content))

        # Add context snapshot if provided
        if context_snapshot:
            context_summary = f"Current context: {json.dumps(context_snapshot, indent=2)[:500]}"
            messages.append(SystemMessage(content=context_summary))

        # Add current question
        messages.append(HumanMessage(content=question))

        # Stream response
        async for chunk in llm.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content

    # ==========================================================================
    # Tool Execution (Placeholder)
    # ==========================================================================

    async def execute_tool(
        self,
        tool_id: str,
        parameters: Dict[str, Any],
        repo_path: str,
        config: ProviderConfig,
    ) -> Dict[str, Any]:
        """
        Execute a LangChain tool.
        
        Args:
            tool_id: Tool identifier
            parameters: Tool parameters
            repo_path: Repository path
            config: AI provider configuration
            
        Returns:
            Tool execution result
        """
        # TODO: Implement actual tool registry and execution
        # For now, return a placeholder
        return {
            "tool_id": tool_id,
            "status": "success",
            "message": f"Tool '{tool_id}' would be executed with parameters: {list(parameters.keys())}",
            "repo_path": repo_path,
        }

    # ==========================================================================
    # RAG Queries (Placeholder)
    # ==========================================================================

    async def rag_query(
        self,
        query: str,
        repo_path: str,
        top_k: int,
        entity_types: Optional[List[str]],
        config: ProviderConfig,
    ) -> Dict[str, Any]:
        """
        Execute a RAG query with vector search.
        
        Args:
            query: Search query
            repo_path: Repository path
            top_k: Number of results to return
            entity_types: Filter by entity types
            config: AI provider configuration
            
        Returns:
            RAG query results with sources
        """
        # TODO: Implement actual vector store and RAG chain
        # For now, return a placeholder
        return {
            "answer": f"RAG query for: {query}",
            "sources": [],
            "note": "Vector store not yet implemented",
        }


# =============================================================================
# Singleton Instance
# =============================================================================

_langchain_service: Optional[LangChainService] = None


def get_langchain_service() -> LangChainService:
    """Get or create the singleton LangChain service instance."""
    global _langchain_service
    if _langchain_service is None:
        _langchain_service = LangChainService()
    return _langchain_service
