"""
Integration tests for AI router endpoints.

Tests FastAPI routes with Pydantic validation, SSE streaming,
and error handling.

Run with: poetry run pytest tests/test_ai_router.py -v
"""

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from context_kit_service.main import app
from context_kit_service.models.ai_requests import (
    AIProvider,
    EntityType,
    MessageRole,
)

client = TestClient(app)


# =============================================================================
# Health Check Tests
# =============================================================================


def test_health_endpoint():
    """Test health check endpoint returns valid response."""
    response = client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert "status" in data
    assert data["status"] in ["healthy", "degraded", "unhealthy", "unknown"]
    assert "version" in data
    assert "uptime_seconds" in data or "uptimeSeconds" in data
    assert "dependencies" in data


# =============================================================================
# Entity Generation Tests
# =============================================================================


def test_generate_feature_entity():
    """Test generating a feature entity."""
    request_data = {
        "entityType": "feature",
        "userPrompt": "Create a user authentication feature with login and signup",
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
            "temperature": 0.7,
        },
    }
    
    response = client.post("/ai/generate-entity", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    
    assert "entity" in data
    assert "metadata" in data
    
    entity = data["entity"]
    assert entity["type"] == "feature"
    
    metadata = data["metadata"]
    assert metadata["promptTokens"] >= 0
    assert metadata["completionTokens"] >= 0
    assert metadata["durationMs"] > 0
    assert metadata["model"] == "llama2"


def test_generate_spec_with_linked_feature():
    """Test generating a spec entity with linked feature."""
    request_data = {
        "entityType": "spec",
        "userPrompt": "Write technical specification for authentication API endpoints",
        "linkedFeatureId": "feature-auth-001",
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/generate-entity", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["entity"]["type"] == "spec"
    assert data["entity"]["linked_feature_id"] == "feature-auth-001"


def test_generate_entity_validation_error():
    """Test that short prompts are rejected."""
    request_data = {
        "entityType": "task",
        "userPrompt": "Short",  # Too short (< 10 chars)
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/generate-entity", json=request_data)
    
    # Pydantic should reject this before it reaches the endpoint
    assert response.status_code == 422


def test_generate_entity_invalid_provider():
    """Test that invalid provider is rejected."""
    request_data = {
        "entityType": "feature",
        "userPrompt": "Create a feature for invalid provider testing",
        "config": {
            "provider": "invalid-provider",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/generate-entity", json=request_data)
    
    assert response.status_code == 422


# =============================================================================
# Streaming Assistance Tests
# =============================================================================


def test_stream_assist_basic():
    """Test streaming assistance with SSE."""
    request_data = {
        "question": "What is the purpose of this repository?",
        "conversationHistory": [],
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    with client.stream("POST", "/ai/assist/stream", json=request_data) as response:
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
        
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data = line[6:]  # Remove 'data: ' prefix
                if data != "[DONE]":
                    event = json.loads(data)
                    events.append(event)
        
        # Should have received at least some tokens and a complete event
        assert len(events) > 0
        
        # Check for token events
        token_events = [e for e in events if e.get("type") == "token"]
        assert len(token_events) > 0
        
        # Check for complete event
        complete_events = [e for e in events if e.get("type") == "complete"]
        assert len(complete_events) == 1
        
        complete_event = complete_events[0]
        assert "fullContent" in complete_event
        assert "metadata" in complete_event
        assert complete_event["metadata"]["totalTokens"] > 0


def test_stream_assist_with_conversation_history():
    """Test streaming with conversation history."""
    request_data = {
        "question": "Can you elaborate on that?",
        "conversationHistory": [
            {
                "role": "user",
                "content": "What is authentication?",
            },
            {
                "role": "assistant",
                "content": "Authentication is the process of verifying user identity.",
            },
        ],
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    with client.stream("POST", "/ai/assist/stream", json=request_data) as response:
        assert response.status_code == 200
        
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                data = line[6:]
                if data != "[DONE]":
                    event = json.loads(data)
                    events.append(event)
        
        assert len(events) > 0


def test_stream_assist_validation_error():
    """Test that empty questions are rejected."""
    request_data = {
        "question": "",  # Empty question
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/assist/stream", json=request_data)
    
    assert response.status_code == 422


# =============================================================================
# Tool Execution Tests
# =============================================================================


def test_execute_tool_success():
    """Test successful tool execution."""
    request_data = {
        "toolId": "analyze-code",
        "parameters": {
            "filePath": "/src/main.ts",
            "analysisType": "complexity",
        },
        "repoPath": "/path/to/repo",
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/tools/execute", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    
    assert "metadata" in data
    assert data["metadata"]["toolId"] == "analyze-code"
    assert data["metadata"]["durationMs"] > 0
    
    # Either result or error should be present
    assert "result" in data or "error" in data


def test_execute_tool_validation_error():
    """Test that empty toolId is rejected."""
    request_data = {
        "toolId": "",  # Empty toolId
        "parameters": {},
        "repoPath": "/path/to/repo",
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/tools/execute", json=request_data)
    
    assert response.status_code == 422


# =============================================================================
# RAG Query Tests
# =============================================================================


def test_rag_query_basic():
    """Test basic RAG query."""
    request_data = {
        "query": "How does user authentication work in this project?",
        "repoPath": "/path/to/repo",
        "topK": 3,
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/rag/query", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    
    assert "answer" in data
    assert "sources" in data
    assert "metadata" in data
    
    assert isinstance(data["sources"], list)
    assert len(data["sources"]) <= 3
    
    metadata = data["metadata"]
    assert metadata["retrievalTimeMs"] > 0
    assert metadata["generationTimeMs"] > 0
    assert metadata["totalSources"] >= 0


def test_rag_query_with_entity_filter():
    """Test RAG query with entity type filtering."""
    request_data = {
        "query": "Show me all features",
        "repoPath": "/path/to/repo",
        "topK": 5,
        "entityTypes": ["feature", "spec"],
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/rag/query", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    
    assert "sources" in data
    
    # Verify source structure
    for source in data["sources"]:
        assert "entityId" in source
        assert "entityType" in source
        assert "relevanceScore" in source
        assert 0 <= source["relevanceScore"] <= 1
        assert "excerpt" in source


def test_rag_query_validation_error():
    """Test that empty query is rejected."""
    request_data = {
        "query": "",  # Empty query
        "repoPath": "/path/to/repo",
        "config": {
            "provider": "ollama",
            "endpoint": "http://localhost:11434",
            "model": "llama2",
        },
    }
    
    response = client.post("/ai/rag/query", json=request_data)
    
    assert response.status_code == 422


# =============================================================================
# Pydantic Model Validation Tests
# =============================================================================


def test_pydantic_enum_validation():
    """Test that Pydantic enums work correctly."""
    # Valid enum values
    assert AIProvider.OLLAMA.value == "ollama"
    assert AIProvider.AZURE_OPENAI.value == "azure-openai"
    
    assert EntityType.FEATURE.value == "feature"
    assert EntityType.SPEC.value == "spec"
    
    assert MessageRole.USER.value == "user"
    assert MessageRole.ASSISTANT.value == "assistant"
    assert MessageRole.SYSTEM.value == "system"


def test_pydantic_field_aliases():
    """Test that camelCase/snake_case aliasing works."""
    from context_kit_service.models.ai_requests import ProviderConfig
    
    # Test with camelCase
    config_camel = ProviderConfig.model_validate({
        "provider": "ollama",
        "endpoint": "http://localhost:11434",
        "model": "llama2",
        "apiKey": "test-key",
        "temperature": 0.5,
    })
    
    assert config_camel.api_key == "test-key"
    assert config_camel.temperature == 0.5
    
    # Test model_dump with alias
    dumped = config_camel.model_dump(by_alias=True)
    assert "apiKey" in dumped
    assert dumped["apiKey"] == "test-key"
