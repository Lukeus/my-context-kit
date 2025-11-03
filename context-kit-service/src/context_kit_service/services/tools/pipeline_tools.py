"""Pipeline execution tools for context repository validation and processing."""

import os
import subprocess
from pathlib import Path
from typing import Any, Optional

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class PipelineValidateInput(BaseModel):
    """Input for pipeline.validate tool."""

    repo_path: Optional[str] = Field(
        default=None, description="Path to context repository (optional, uses default if not provided)"
    )


class PipelineBuildGraphInput(BaseModel):
    """Input for pipeline.build-graph tool."""

    repo_path: Optional[str] = Field(
        default=None, description="Path to context repository (optional, uses default if not provided)"
    )


class PipelineImpactInput(BaseModel):
    """Input for pipeline.impact tool."""

    entity_ids: list[str] = Field(description="List of entity IDs to analyze impact for")
    repo_path: Optional[str] = Field(
        default=None, description="Path to context repository (optional, uses default if not provided)"
    )


class PipelineGenerateInput(BaseModel):
    """Input for pipeline.generate tool."""

    template: str = Field(description="Template name to generate from")
    output_path: Optional[str] = Field(default=None, description="Output file path (optional)")
    repo_path: Optional[str] = Field(
        default=None, description="Path to context repository (optional, uses default if not provided)"
    )


def _run_pipeline(command: list[str], repo_path: str) -> dict[str, Any]:
    """Run a pipeline command and return results."""
    try:
        result = subprocess.run(
            command,
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30,
        )

        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Pipeline execution timed out (30s limit)",
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


def _validate_pipeline(repo_path: Optional[str] = None) -> dict[str, Any]:
    """Run validation pipeline."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")

    return _run_pipeline(["pnpm", "validate"], repo_path)


def _build_graph_pipeline(repo_path: Optional[str] = None) -> dict[str, Any]:
    """Run build-graph pipeline."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")

    return _run_pipeline(["pnpm", "build-graph"], repo_path)


def _impact_pipeline(entity_ids: list[str], repo_path: Optional[str] = None) -> dict[str, Any]:
    """Run impact analysis pipeline."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")

    command = ["pnpm", "impact", "--entities", ",".join(entity_ids)]
    return _run_pipeline(command, repo_path)


def _generate_pipeline(template: str, output_path: Optional[str] = None, repo_path: Optional[str] = None) -> dict[str, Any]:
    """Run generate pipeline."""
    if repo_path is None:
        repo_path = os.getenv("CONTEXT_REPO_PATH", "../context-repo")

    command = ["pnpm", "generate", "--template", template]
    if output_path:
        command.extend(["--output", output_path])

    return _run_pipeline(command, repo_path)


def PipelineValidateTool() -> StructuredTool:
    """Create pipeline.validate tool."""
    return StructuredTool.from_function(
        func=_validate_pipeline,
        name="pipeline.validate",
        description="Validate all context entities in the repository against their JSON schemas. Returns validation results with any errors found.",
        args_schema=PipelineValidateInput,
    )


def PipelineBuildGraphTool() -> StructuredTool:
    """Create pipeline.build-graph tool."""
    return StructuredTool.from_function(
        func=_build_graph_pipeline,
        name="pipeline.build-graph",
        description="Build the dependency graph from context entities. Analyzes relationships and generates graph visualization data.",
        args_schema=PipelineBuildGraphInput,
    )


def PipelineImpactTool() -> StructuredTool:
    """Create pipeline.impact tool."""
    return StructuredTool.from_function(
        func=_impact_pipeline,
        name="pipeline.impact",
        description="Analyze impact of changes to specific entities. Shows which other entities depend on the specified ones.",
        args_schema=PipelineImpactInput,
    )


def PipelineGenerateTool() -> StructuredTool:
    """Create pipeline.generate tool."""
    return StructuredTool.from_function(
        func=_generate_pipeline,
        name="pipeline.generate",
        description="Generate output from a template using context repository data. Useful for creating documentation, reports, or code from templates.",
        args_schema=PipelineGenerateInput,
    )
