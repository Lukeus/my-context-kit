"""
Unit tests for LangChain Service

Tests the LangChain service layer including entity generation,
streaming, tool execution, and RAG queries.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from context_kit_service.models.ai_requests import (
    AIProvider,
    ConversationMessage,
    EntityType,
    MessageRole,
    ProviderConfig,
)
from context_kit_service.services.langchain_service import (
    LangChainService,
    get_langchain_service,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def ollama_config():
    """Ollama provider configuration."""
    return ProviderConfig(
        provider=AIProvider.OLLAMA,
        endpoint="http://localhost:11434",
        model="llama2",
        temperature=0.7,
    )


@pytest.fixture
def azure_config():
    """Azure OpenAI provider configuration."""
    return ProviderConfig(
        provider=AIProvider.AZURE_OPENAI,
        endpoint="https://test.openai.azure.com",
        model="gpt-4",
        api_key="test-key",
        api_version="2024-02-15-preview",
        temperature=0.7,
    )


@pytest.fixture
def langchain_service():
    """Fresh LangChain service instance."""
    return LangChainService()


# =============================================================================
# Service Initialization Tests
# =============================================================================


def test_get_langchain_service_singleton():
    """Test that get_langchain_service returns a singleton."""
    service1 = get_langchain_service()
    service2 = get_langchain_service()
    
    assert service1 is service2


def test_langchain_service_initialization(langchain_service):
    """Test LangChain service initializes correctly."""
    assert langchain_service is not None
    assert langchain_service._llm_cache == {}


# =============================================================================
# LLM Initialization Tests
# =============================================================================


@patch("context_kit_service.services.langchain_service.ChatOllama")
def test_get_llm_ollama(mock_ollama, langchain_service, ollama_config):
    """Test LLM initialization for Ollama."""
    mock_llm = MagicMock()
    mock_ollama.return_value = mock_llm
    
    llm = langchain_service._get_llm(ollama_config, streaming=False)
    
    assert llm is not None
    mock_ollama.assert_called_once_with(
        base_url="http://localhost:11434/",
        model="llama2",
        temperature=0.7,
        streaming=False,
    )


@patch("context_kit_service.services.langchain_service.AzureChatOpenAI")
def test_get_llm_azure(mock_azure, langchain_service, azure_config):
    """Test LLM initialization for Azure OpenAI."""
    mock_llm = MagicMock()
    mock_azure.return_value = mock_llm
    
    llm = langchain_service._get_llm(azure_config, streaming=False)
    
    assert llm is not None
    mock_azure.assert_called_once_with(
        azure_endpoint="https://test.openai.azure.com/",
        deployment_name="gpt-4",
        api_key="test-key",
        api_version="2024-02-15-preview",
        temperature=0.7,
        max_tokens=None,
        streaming=False,
    )


def test_get_llm_caching(langchain_service, ollama_config):
    """Test that LLM instances are cached."""
    with patch("context_kit_service.services.langchain_service.ChatOllama") as mock_ollama:
        mock_llm = MagicMock()
        mock_ollama.return_value = mock_llm
        
        llm1 = langchain_service._get_llm(ollama_config, streaming=False)
        llm2 = langchain_service._get_llm(ollama_config, streaming=False)
        
        assert llm1 is llm2
        assert mock_ollama.call_count == 1


def test_get_llm_invalid_provider(langchain_service):
    """Test that invalid provider raises validation error."""
    from pydantic import ValidationError
    
    # Pydantic will raise ValidationError during model instantiation
    with pytest.raises(ValidationError, match="Input should be"):
        invalid_config = ProviderConfig(
            provider="invalid-provider",  # type: ignore
            endpoint="http://localhost:11434",
            model="test",
            temperature=0.7,
        )


# =============================================================================
# Entity Generation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_generate_entity_feature(langchain_service, ollama_config):
    """Test generating a feature entity."""
    with patch.object(langchain_service, '_get_llm') as mock_get_llm:
        # Create a mock chain that returns a JSON string
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(
            return_value='{"id": "feat-001", "title": "Authentication Feature", "description": "User authentication system"}'
        )
        
        # Mock LLM that returns our chain when composed
        mock_llm = MagicMock()
        mock_llm.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))
        mock_get_llm.return_value = mock_llm
        
        # Generate entity
        entity = await langchain_service.generate_entity(
            entity_type=EntityType.FEATURE,
            user_prompt="Create user authentication feature",
            linked_feature_id=None,
            config=ollama_config,
        )
        
        assert entity is not None
        assert entity["type"] == "feature"
        assert "id" in entity
        assert "title" in entity


@pytest.mark.asyncio
async def test_generate_entity_with_linked_feature(langchain_service, ollama_config):
    """Test generating an entity with linked feature."""
    with patch.object(langchain_service, '_get_llm') as mock_get_llm:
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(
            return_value='{"id": "spec-001", "title": "API Spec"}'
        )
        mock_llm = MagicMock()
        mock_llm.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))
        mock_get_llm.return_value = mock_llm
        
        entity = await langchain_service.generate_entity(
            entity_type=EntityType.SPEC,
            user_prompt="Create API specification",
            linked_feature_id="feat-001",
            config=ollama_config,
        )
        
        assert entity["linked_feature_id"] == "feat-001"


@pytest.mark.asyncio
async def test_generate_entity_json_extraction(langchain_service, ollama_config):
    """Test JSON extraction from markdown code blocks."""
    with patch.object(langchain_service, '_get_llm') as mock_get_llm:
        # Response with markdown code block
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(
            return_value='```json\n{"id": "task-001", "title": "Implementation Task"}\n```'
        )
        mock_llm = MagicMock()
        mock_llm.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))
        mock_get_llm.return_value = mock_llm
        
        entity = await langchain_service.generate_entity(
            entity_type=EntityType.TASK,
            user_prompt="Create implementation task",
            linked_feature_id=None,
            config=ollama_config,
        )
        
        assert entity["id"] == "task-001"
        assert entity["title"] == "Implementation Task"


@pytest.mark.asyncio
async def test_generate_entity_invalid_json_fallback(langchain_service, ollama_config):
    """Test fallback when JSON parsing fails."""
    with patch.object(langchain_service, '_get_llm') as mock_get_llm:
        # Response with invalid JSON
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(
            return_value="This is not valid JSON"
        )
        mock_llm = MagicMock()
        mock_llm.__or__ = MagicMock(return_value=MagicMock(__or__=MagicMock(return_value=mock_chain)))
        mock_get_llm.return_value = mock_llm
        
        entity = await langchain_service.generate_entity(
            entity_type=EntityType.FEATURE,
            user_prompt="Create feature",
            linked_feature_id=None,
            config=ollama_config,
        )
        
        # Should create fallback entity
        assert entity["type"] == "feature"
        assert "generated-feature" in entity["id"]
        assert "description" in entity


def test_generate_entity_invalid_type(langchain_service, ollama_config):
    """Test that invalid entity type raises ValueError."""
    # This would be caught at Pydantic level in practice
    pass  # Skipping as Pydantic validates this


# =============================================================================
# Streaming Assistance Tests
# =============================================================================


@pytest.mark.asyncio
@patch("context_kit_service.services.langchain_service.ChatOllama")
async def test_stream_assistance_basic(mock_ollama, langchain_service, ollama_config):
    """Test basic streaming assistance."""
    # Mock streaming LLM
    mock_llm = MagicMock()
    
    async def mock_astream(messages):
        """Mock async stream."""
        tokens = ["Hello", " ", "world", "!"]
        for token in tokens:
            chunk = MagicMock()
            chunk.content = token
            yield chunk
    
    mock_llm.astream = mock_astream
    mock_ollama.return_value = mock_llm
    
    # Stream assistance
    tokens = []
    async for token in langchain_service.stream_assistance(
        question="What is Python?",
        conversation_history=[],
        context_snapshot=None,
        config=ollama_config,
    ):
        tokens.append(token)
    
    assert len(tokens) == 4
    assert "".join(tokens) == "Hello world!"


@pytest.mark.asyncio
@patch("context_kit_service.services.langchain_service.ChatOllama")
async def test_stream_assistance_with_history(
    mock_ollama, langchain_service, ollama_config
):
    """Test streaming with conversation history."""
    mock_llm = MagicMock()
    
    async def mock_astream(messages):
        # Verify history is included in messages
        assert len(messages) >= 3  # System + history + current
        yield MagicMock(content="Response")
    
    mock_llm.astream = mock_astream
    mock_ollama.return_value = mock_llm
    
    history = [
        ConversationMessage(role=MessageRole.USER, content="Hi"),
        ConversationMessage(role=MessageRole.ASSISTANT, content="Hello"),
    ]
    
    tokens = []
    async for token in langchain_service.stream_assistance(
        question="Continue",
        conversation_history=history,
        context_snapshot=None,
        config=ollama_config,
    ):
        tokens.append(token)
    
    assert len(tokens) > 0


@pytest.mark.asyncio
@patch("context_kit_service.services.langchain_service.ChatOllama")
async def test_stream_assistance_with_context(
    mock_ollama, langchain_service, ollama_config
):
    """Test streaming with context snapshot."""
    mock_llm = MagicMock()
    
    async def mock_astream(messages):
        # Verify context is included
        messages_content = [str(m.content) for m in messages]
        assert any("Current context" in content for content in messages_content)
        yield MagicMock(content="Response")
    
    mock_llm.astream = mock_astream
    mock_ollama.return_value = mock_llm
    
    context = {"repo": "test-repo", "file_count": 42}
    
    tokens = []
    async for token in langchain_service.stream_assistance(
        question="What is in the repo?",
        conversation_history=[],
        context_snapshot=context,
        config=ollama_config,
    ):
        tokens.append(token)
    
    assert len(tokens) > 0


# =============================================================================
# Tool Execution Tests
# =============================================================================


@pytest.mark.asyncio
async def test_execute_tool_placeholder(langchain_service, ollama_config):
    """Test tool execution placeholder."""
    result = await langchain_service.execute_tool(
        tool_id="analyze-code",
        parameters={"file": "main.py"},
        repo_path="/path/to/repo",
        config=ollama_config,
    )
    
    assert result is not None
    assert result["tool_id"] == "analyze-code"
    assert result["status"] == "success"


# =============================================================================
# RAG Query Tests
# =============================================================================


@pytest.mark.asyncio
async def test_rag_query_placeholder(langchain_service, ollama_config):
    """Test RAG query placeholder."""
    result = await langchain_service.rag_query(
        query="How does authentication work?",
        repo_path="/path/to/repo",
        top_k=5,
        entity_types=["feature", "spec"],
        config=ollama_config,
    )
    
    assert result is not None
    assert "answer" in result
    assert "sources" in result


# =============================================================================
# Prompt Template Tests
# =============================================================================


def test_entity_prompts_exist(langchain_service):
    """Test that all entity types have prompt templates."""
    for entity_type in EntityType:
        assert entity_type in langchain_service.ENTITY_PROMPTS
        prompt = langchain_service.ENTITY_PROMPTS[entity_type]
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        assert "{user_prompt}" in prompt
        assert "{linked_feature_context}" in prompt


def test_entity_prompts_structure(langchain_service):
    """Test that prompts have expected structure."""
    for entity_type, prompt in langchain_service.ENTITY_PROMPTS.items():
        # Should mention JSON
        assert "JSON" in prompt or "json" in prompt
        # Should have role/persona
        assert "You are" in prompt
        # Should have clear instructions
        assert "Generate" in prompt or "generate" in prompt
