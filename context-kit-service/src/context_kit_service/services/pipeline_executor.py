"""Pipeline execution service."""

import asyncio
import subprocess
from pathlib import Path
from typing import Any, Optional

from ..models.assistant import PipelineName, RunPipelineRequest, RunPipelineResponse


class PipelineExecutor:
    """Executes context-repo pipelines."""

    async def run_pipeline(
        self, repo_path: str, request: RunPipelineRequest
    ) -> RunPipelineResponse:
        """Execute a pipeline in the context repository."""
        repo = Path(repo_path)
        if not repo.exists():
            return RunPipelineResponse(
                success=False, error=f"Repository not found: {repo_path}"
            )

        # Map pipeline names to pnpm scripts
        script_map = {
            PipelineName.VALIDATE: "validate",
            PipelineName.BUILD_GRAPH: "build-graph",
            PipelineName.IMPACT: "impact",
            PipelineName.GENERATE: "generate",
        }

        script_name = script_map.get(request.pipeline)
        if not script_name:
            return RunPipelineResponse(
                success=False, error=f"Unknown pipeline: {request.pipeline}"
            )

        # Build command
        cmd = ["pnpm", "run", script_name]

        # Add arguments if provided
        if request.args:
            for key, value in request.args.items():
                if isinstance(value, bool):
                    if value:
                        cmd.append(f"--{key}")
                elif isinstance(value, list):
                    for item in value:
                        cmd.append(f"--{key}")
                        cmd.append(str(item))
                else:
                    cmd.append(f"--{key}")
                    cmd.append(str(value))

        # Execute pipeline
        start_time = asyncio.get_event_loop().time()

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(repo),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            end_time = asyncio.get_event_loop().time()
            duration_ms = int((end_time - start_time) * 1000)

            output = stdout.decode("utf-8", errors="replace")
            if stderr:
                error_output = stderr.decode("utf-8", errors="replace")
                if error_output.strip():
                    output += f"\n\nSTDERR:\n{error_output}"

            return RunPipelineResponse(
                success=process.returncode == 0,
                output=output,
                exitCode=process.returncode or 0,
                durationMs=duration_ms,
                error=None if process.returncode == 0 else "Pipeline execution failed",
            )

        except Exception as e:
            end_time = asyncio.get_event_loop().time()
            duration_ms = int((end_time - start_time) * 1000)

            return RunPipelineResponse(
                success=False,
                exitCode=1,
                durationMs=duration_ms,
                error=f"Pipeline execution error: {str(e)}",
            )


# Global instance
_executor: Optional[PipelineExecutor] = None


def get_pipeline_executor() -> PipelineExecutor:
    """Get global pipeline executor instance."""
    global _executor
    if _executor is None:
        _executor = PipelineExecutor()
    return _executor
