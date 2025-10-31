"""
End-to-End Tests for Context Kit Pipeline

Tests the complete workflow from inspection through code generation.
"""

import os
import pytest
import tempfile
import shutil
from pathlib import Path
from fastapi.testclient import TestClient

# Mock environment variables for testing
os.environ["AZURE_OPENAI_API_KEY"] = "test-key-12345"
os.environ["AZURE_OPENAI_ENDPOINT"] = "https://test.openai.azure.com/"

from main import app
from services.spec_log_writer import SpecLogWriter

client = TestClient(app)


@pytest.fixture
def test_repo_path():
    """Create a temporary test repository with context structure."""
    temp_dir = tempfile.mkdtemp()
    
    # Create .context directory
    context_dir = Path(temp_dir) / ".context"
    context_dir.mkdir()
    
    # Create sample entities
    entities_dir = context_dir / "entities"
    entities_dir.mkdir()
    
    # Sample feature entity
    feature_entity = entities_dir / "feature-auth.md"
    feature_entity.write_text("""---
id: feature-auth
type: feature
title: User Authentication
status: planning
---

# User Authentication Feature

User authentication system with JWT tokens.

## Requirements
- Email/password login
- Token refresh
- Password reset
""")
    
    # Sample component entity
    component_entity = entities_dir / "component-login-form.md"
    component_entity.write_text("""---
id: component-login-form
type: component
title: Login Form Component
related_to:
  - feature-auth
---

# Login Form Component

React component for user login.
""")
    
    # Create spec-log directory
    spec_log_dir = context_dir / "spec-log"
    spec_log_dir.mkdir()
    
    yield temp_dir
    
    # Cleanup
    shutil.rmtree(temp_dir)


class TestHealthCheck:
    """Test service health and status endpoints."""
    
    def test_health_endpoint(self):
        """Test basic health check."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "uptime" in data


class TestInspectionWorkflow:
    """Test repository inspection functionality."""
    
    def test_inspect_repository(self, test_repo_path):
        """Test basic repository inspection."""
        response = client.post("/inspect", json={
            "repo_path": test_repo_path,
            "depth": 2
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "overview" in data
        assert "entities" in data
        assert "relationships" in data
        assert "gaps" in data
        assert "recommendations" in data
        assert "duration_ms" in data
        
        # Verify entities were found
        assert data["overview"]["total_entities"] > 0
        assert len(data["entities"]) > 0
    
    def test_inspect_with_type_filter(self, test_repo_path):
        """Test inspection with entity type filtering."""
        response = client.post("/inspect", json={
            "repo_path": test_repo_path,
            "include_types": ["feature"],
            "depth": 1
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify only features are returned
        for entity in data["entities"]:
            assert entity["type"] == "feature"
    
    def test_inspect_invalid_path(self):
        """Test inspection with invalid repository path."""
        response = client.post("/inspect", json={
            "repo_path": "/nonexistent/path",
            "depth": 2
        })
        
        assert response.status_code in [400, 404, 500]


class TestSpecGenerationWorkflow:
    """Test specification generation functionality."""
    
    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key"
    )
    def test_generate_specification(self, test_repo_path):
        """Test specification generation from requirements."""
        response = client.post("/spec-generate", json={
            "repo_path": test_repo_path,
            "entity_ids": ["feature-auth"],
            "user_prompt": "Create a detailed authentication specification with JWT support",
            "include_rag": True
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "spec_id" in data
        assert "spec_content" in data
        assert "related_entities" in data
        assert "metadata" in data
        assert "log_entry_id" in data
        assert "duration_ms" in data
        
        # Verify spec content is not empty
        assert len(data["spec_content"]) > 100
        
        # Verify log was created
        log_path = Path(test_repo_path) / ".context" / "spec-log" / f"{data['log_entry_id']}.json"
        assert log_path.exists()
    
    def test_generate_spec_invalid_repo(self):
        """Test spec generation with invalid repository."""
        response = client.post("/spec-generate", json={
            "repo_path": "/nonexistent/path",
            "entity_ids": [],
            "user_prompt": "Test prompt"
        })
        
        assert response.status_code in [400, 404, 500]
    
    def test_generate_spec_missing_prompt(self, test_repo_path):
        """Test spec generation with missing user prompt."""
        response = client.post("/spec-generate", json={
            "repo_path": test_repo_path,
            "entity_ids": ["feature-auth"],
            "user_prompt": ""
        })
        
        assert response.status_code == 422  # Validation error


class TestPromptifyWorkflow:
    """Test promptification functionality."""
    
    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key"
    )
    def test_promptify_specification(self, test_repo_path):
        """Test converting specification to optimized prompt."""
        # First generate a spec
        spec_response = client.post("/spec-generate", json={
            "repo_path": test_repo_path,
            "entity_ids": ["feature-auth"],
            "user_prompt": "Authentication feature with JWT",
            "include_rag": False
        })
        
        assert spec_response.status_code == 200
        spec_data = spec_response.json()
        
        # Now promptify it
        response = client.post("/promptify", json={
            "repo_path": test_repo_path,
            "spec_id": spec_data["spec_id"],
            "spec_content": spec_data["spec_content"],
            "target_agent": "codegen",
            "include_context": True
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "spec_id" in data
        assert "prompt" in data
        assert "context_included" in data
        assert "metadata" in data
        assert "log_entry_id" in data
        assert "duration_ms" in data
        
        # Verify prompt is structured
        assert len(data["prompt"]) > len(spec_data["spec_content"])
        assert isinstance(data["context_included"], list)


class TestCodeGenerationWorkflow:
    """Test code generation functionality."""
    
    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key"
    )
    def test_generate_code(self, test_repo_path):
        """Test code generation from specification."""
        # First generate a spec
        spec_response = client.post("/spec-generate", json={
            "repo_path": test_repo_path,
            "entity_ids": ["feature-auth", "component-login-form"],
            "user_prompt": "Create login form component with TypeScript",
            "include_rag": False
        })
        
        assert spec_response.status_code == 200
        spec_data = spec_response.json()
        
        # Generate code
        response = client.post("/codegen", json={
            "repo_path": test_repo_path,
            "spec_id": spec_data["spec_id"],
            "language": "typescript",
            "framework": "react",
            "style_guide": "airbnb"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "spec_id" in data
        assert "artifacts" in data
        assert "summary" in data
        assert "metadata" in data
        assert "log_entry_id" in data
        assert "duration_ms" in data
        
        # Verify artifacts were generated
        assert len(data["artifacts"]) > 0
        
        for artifact in data["artifacts"]:
            assert "path" in artifact
            assert "content" in artifact
            assert "language" in artifact
            assert len(artifact["content"]) > 0
        
        # Verify log was created
        log_path = Path(test_repo_path) / ".context" / "spec-log" / f"{data['log_entry_id']}.json"
        assert log_path.exists()


class TestCompleteE2EPipeline:
    """Test the complete end-to-end pipeline."""
    
    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key"
    )
    def test_full_pipeline_flow(self, test_repo_path):
        """
        Test complete workflow:
        1. Inspect repository
        2. Generate specification
        3. Promptify specification
        4. Generate code
        5. Verify all logs
        """
        
        # Step 1: Inspect
        inspect_response = client.post("/inspect", json={
            "repo_path": test_repo_path,
            "depth": 2
        })
        assert inspect_response.status_code == 200
        inspect_data = inspect_response.json()
        
        entity_ids = [e["id"] for e in inspect_data["entities"][:2]]
        
        # Step 2: Generate Spec
        spec_response = client.post("/spec-generate", json={
            "repo_path": test_repo_path,
            "entity_ids": entity_ids,
            "user_prompt": "Create comprehensive authentication system",
            "include_rag": True
        })
        assert spec_response.status_code == 200
        spec_data = spec_response.json()
        spec_id = spec_data["spec_id"]
        
        # Step 3: Promptify
        prompt_response = client.post("/promptify", json={
            "repo_path": test_repo_path,
            "spec_id": spec_id,
            "spec_content": spec_data["spec_content"],
            "target_agent": "codegen",
            "include_context": True
        })
        assert prompt_response.status_code == 200
        prompt_data = prompt_response.json()
        
        # Step 4: Generate Code
        code_response = client.post("/codegen", json={
            "repo_path": test_repo_path,
            "spec_id": spec_id,
            "prompt": prompt_data["prompt"],
            "language": "typescript",
            "framework": "react"
        })
        assert code_response.status_code == 200
        code_data = code_response.json()
        
        # Verify all steps completed
        assert spec_data["spec_id"] == spec_id
        assert prompt_data["spec_id"] == spec_id
        assert code_data["spec_id"] == spec_id
        
        # Verify logs were created
        log_dir = Path(test_repo_path) / ".context" / "spec-log"
        log_files = list(log_dir.glob("*.json"))
        assert len(log_files) >= 3  # spec-generate, promptify, codegen
        
        # Verify code artifacts are valid
        assert len(code_data["artifacts"]) > 0
        for artifact in code_data["artifacts"]:
            assert artifact["language"] == "typescript"
            # Basic code validation
            assert "import" in artifact["content"] or "export" in artifact["content"]


class TestSpecLogWorkflow:
    """Test spec log browsing and retrieval."""
    
    def test_list_empty_spec_logs(self, test_repo_path):
        """Test listing spec logs when none exist."""
        response = client.get(f"/spec-log/list?repo_path={test_repo_path}")
        
        assert response.status_code == 200
        data = response.json()
        assert "entries" in data
        assert "total" in data
        assert data["total"] == 0
    
    @pytest.mark.skipif(
        not os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY").startswith("test-"),
        reason="Requires valid Azure OpenAI API key"
    )
    def test_list_spec_logs_after_generation(self, test_repo_path):
        """Test listing spec logs after generating specs."""
        # Generate a spec first
        client.post("/spec-generate", json={
            "repo_path": test_repo_path,
            "entity_ids": ["feature-auth"],
            "user_prompt": "Test authentication",
            "include_rag": False
        })
        
        # List logs
        response = client.get(f"/spec-log/list?repo_path={test_repo_path}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        assert len(data["entries"]) > 0
        
        # Verify log structure
        log_entry = data["entries"][0]
        assert "entry_id" in log_entry
        assert "operation" in log_entry
        assert "timestamp" in log_entry
    
    def test_filter_spec_logs_by_operation(self, test_repo_path):
        """Test filtering spec logs by operation type."""
        response = client.get(
            f"/spec-log/list?repo_path={test_repo_path}&operation=spec-generate"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        for entry in data["entries"]:
            assert entry["operation"] == "spec-generate"


class TestErrorHandling:
    """Test error handling throughout the pipeline."""
    
    def test_missing_required_fields(self):
        """Test validation of required fields."""
        response = client.post("/spec-generate", json={})
        assert response.status_code == 422
    
    def test_invalid_entity_ids(self, test_repo_path):
        """Test handling of invalid entity IDs."""
        response = client.post("/spec-generate", json={
            "repo_path": test_repo_path,
            "entity_ids": ["nonexistent-entity"],
            "user_prompt": "Test prompt"
        })
        
        # Should still succeed but with warning in metadata
        # or return error depending on implementation
        assert response.status_code in [200, 400, 404]
    
    def test_malformed_json(self):
        """Test handling of malformed JSON requests."""
        response = client.post(
            "/spec-generate",
            data="{ invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
