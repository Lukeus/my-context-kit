"""Pytest configuration and fixtures for Context Kit Service tests."""

import tempfile
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest
import yaml


@pytest.fixture
def temp_repo() -> Generator[Path, None, None]:
    """Create a temporary repository structure for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir)

        # Create .context directory structure
        context_dir = repo_path / ".context"
        context_dir.mkdir()
        (context_dir / "schemas").mkdir()
        (context_dir / "pipelines").mkdir()
        (context_dir / "rules").mkdir()

        # Create .context-kit directory structure
        context_kit_dir = repo_path / ".context-kit"
        context_kit_dir.mkdir()
        (context_kit_dir / "schemas").mkdir()
        (context_kit_dir / "spec-log").mkdir()
        (context_kit_dir / "rag").mkdir()

        # Create contexts directory structure
        contexts_dir = repo_path / "contexts"
        contexts_dir.mkdir()
        (contexts_dir / "features").mkdir()
        (contexts_dir / "userstories").mkdir()
        (contexts_dir / "specs").mkdir()
        (contexts_dir / "tasks").mkdir()
        (contexts_dir / "services").mkdir()
        (contexts_dir / "packages").mkdir()

        # Create sample entities
        feature_data = {
            "id": "FEAT-001",
            "title": "Test Feature",
            "status": "in-progress",
            "domain": "test-domain",
            "objective": "Test objective",
            "userStories": ["US-001"],
            "specs": ["SPEC-001"],
            "tasks": ["T-001"],
        }
        with open(contexts_dir / "features" / "FEAT-001.yaml", "w") as f:
            yaml.dump(feature_data, f)

        userstory_data = {
            "id": "US-001",
            "feature": "FEAT-001",
            "asA": "developer",
            "iWant": "to test",
            "soThat": "I can verify functionality",
            "status": "todo",
            "acceptanceCriteria": ["Works correctly"],
        }
        with open(contexts_dir / "userstories" / "US-001.yaml", "w") as f:
            yaml.dump(userstory_data, f)

        spec_data = {
            "id": "SPEC-001",
            "title": "Test Specification",
            "content": "This is a test specification",
            "status": "draft",
        }
        with open(contexts_dir / "specs" / "SPEC-001.yaml", "w") as f:
            yaml.dump(spec_data, f)

        # Create .context-kit YAML files
        project_data = {
            "version": "1.0.0",
            "id": "test-project",
            "name": "Test Project",
            "type": "application",
        }
        with open(context_kit_dir / "project.yml", "w") as f:
            yaml.dump(project_data, f)

        stack_data = {
            "version": "1.0.0",
            "runtime": {"language": "typescript", "version": ">=18.0.0"},
            "frameworks": [],
        }
        with open(context_kit_dir / "stack.yml", "w") as f:
            yaml.dump(stack_data, f)

        domains_data = {
            "version": "1.0.0",
            "domains": [
                {
                    "id": "test-domain",
                    "name": "Test Domain",
                    "type": "core",
                }
            ],
        }
        with open(context_kit_dir / "domains.yml", "w") as f:
            yaml.dump(domains_data, f)

        yield repo_path


@pytest.fixture
def sample_entities() -> list[dict[str, Any]]:
    """Sample entities for testing."""
    return [
        {
            "id": "FEAT-001",
            "_type": "feature",
            "title": "Test Feature",
            "status": "in-progress",
            "userStories": ["US-001"],
        },
        {
            "id": "US-001",
            "_type": "userstory",
            "feature": "FEAT-001",
            "status": "todo",
        },
        {
            "id": "SPEC-001",
            "_type": "spec",
            "title": "Test Spec",
            "status": "draft",
        },
    ]
