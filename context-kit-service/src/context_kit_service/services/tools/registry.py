"""Tool registry for managing available LangChain tools."""


from langchain_core.tools import BaseTool


class ToolRegistry:
    """Registry for managing and retrieving LangChain tools."""

    def __init__(self):
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        """Register a tool with its ID."""
        self._tools[tool.name] = tool

    def get(self, tool_id: str) -> BaseTool | None:
        """Get a tool by ID."""
        return self._tools.get(tool_id)

    def get_all(self) -> list[BaseTool]:
        """Get all registered tools."""
        return list(self._tools.values())

    def get_by_ids(self, tool_ids: list[str]) -> list[BaseTool]:
        """Get tools by their IDs."""
        return [self._tools[tid] for tid in tool_ids if tid in self._tools]


# Global registry instance
_registry: ToolRegistry | None = None


def get_tool_registry() -> ToolRegistry:
    """Get the global tool registry instance."""
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
        _init_tools(_registry)
    return _registry


def _init_tools(registry: ToolRegistry) -> None:
    """Initialize all tools and register them."""
    # Import here to avoid circular dependencies
    from .context_tools import ContextReadTool, ContextSearchTool
    from .pipeline_tools import (
        PipelineBuildGraphTool,
        PipelineGenerateTool,
        PipelineImpactTool,
        PipelineValidateTool,
    )

    # Register all tools
    registry.register(ContextReadTool())
    registry.register(ContextSearchTool())
    registry.register(PipelineValidateTool())
    registry.register(PipelineBuildGraphTool())
    registry.register(PipelineImpactTool())
    registry.register(PipelineGenerateTool())
