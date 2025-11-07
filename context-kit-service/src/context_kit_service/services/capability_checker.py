"""Capability checking service."""

from ..models.assistant import CapabilityEntry, CapabilityProfile, ToolCapabilityStatus


async def get_capability_profile() -> CapabilityProfile:
    """Get current capability profile with tool availability."""
    # TODO: Add actual health checks for each capability
    # For now, return all tools as enabled
    return CapabilityProfile(
        profileId="default-profile",
        capabilities={
            "pipeline.validate": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
            "pipeline.build-graph": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
            "pipeline.impact": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
            "pipeline.generate": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
            "context.read": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
            "context.search": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
            "entity.details": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
            "entity.similar": CapabilityEntry(status=ToolCapabilityStatus.ENABLED),
        },
    )
