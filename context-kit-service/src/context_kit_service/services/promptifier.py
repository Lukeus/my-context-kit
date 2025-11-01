"""Promptifier Service - Converts specs into agent-ready prompts."""

from pathlib import Path
from typing import Any


class Promptifier:
    """Converts specifications into agent-ready prompts."""

    def __init__(self, repo_path: Path) -> None:
        self.repo_path = repo_path

    async def promptify(
        self,
        spec_id: str,
        spec_content: str,
        context_entities: list[dict[str, Any]],
        target_agent: str,
    ) -> tuple[str, dict[str, Any]]:
        """
        Convert specification into agent-ready prompt.

        Returns:
            Tuple of (prompt, metadata)
        """
        # Get agent-specific template
        template = self._get_agent_template(target_agent)

        # Build context summary
        context_summary = self._build_context_summary(context_entities)

        # Format the prompt
        prompt = template.format(
            spec_id=spec_id,
            spec_content=spec_content,
            context_summary=context_summary,
            context_count=len(context_entities),
        )

        metadata = {
            "target_agent": target_agent,
            "context_entities_count": len(context_entities),
            "prompt_length": len(prompt),
        }

        return prompt, metadata

    def _build_context_summary(self, entities: list[dict[str, Any]]) -> str:
        """Build a summary of context entities."""
        if not entities:
            return "No additional context entities."

        lines = []
        for entity in entities:
            entity_id = entity.get("id", "unknown")
            entity_type = entity.get("_type", "unknown")
            title = entity.get("title", entity.get("objective", ""))

            lines.append(f"- {entity_type.upper()}: {entity_id}")
            if title:
                lines.append(f"  {title}")

        return "\n".join(lines)

    def _get_agent_template(self, target_agent: str) -> str:
        """Get prompt template for specific agent type."""
        templates = {
            "codegen": """# Code Generation Task

## Specification ID: {spec_id}

## Specification
{spec_content}

## Context Entities
{context_summary}

## Task
Implement the above specification following these requirements:

### Code Quality
- Write clean, maintainable, production-ready code
- Follow language-specific best practices and idioms
- Use TypeScript strict mode if applicable
- Include comprehensive error handling
- Add detailed inline comments for complex logic

### Testing
- Write unit tests for all functions/methods
- Include edge case tests
- Aim for >80% code coverage

### Documentation
- Add JSDoc/docstring comments for public APIs
- Include usage examples where appropriate
- Document any assumptions or limitations

### Architecture
- Follow SOLID principles
- Keep functions/methods focused and single-purpose
- Use dependency injection where appropriate
- Make code testable and mockable

Generate the complete implementation with all necessary files.
""",
            "review": """# Code Review Task

## Specification ID: {spec_id}

## Specification
{spec_content}

## Context
{context_summary}

## Task
Review the implementation against this specification.

### Review Checklist

1. **Correctness**
   - Does the code correctly implement all requirements?
   - Are there any logical errors or edge cases not handled?

2. **Code Quality**
   - Is the code readable and maintainable?
   - Are naming conventions consistent and meaningful?
   - Is there unnecessary complexity?

3. **Best Practices**
   - Are language-specific best practices followed?
   - Are design patterns used appropriately?
   - Is error handling comprehensive?

4. **Testing**
   - Are tests comprehensive?
   - Are edge cases covered?
   - Is test code quality maintained?

5. **Documentation**
   - Are public APIs documented?
   - Are complex algorithms explained?
   - Are assumptions documented?

6. **Security & Performance**
   - Are there any security vulnerabilities?
   - Are there performance bottlenecks?
   - Are resources properly managed?

Provide specific feedback with code examples where applicable.
""",
            "test": """# Test Generation Task

## Specification ID: {spec_id}

## Specification
{spec_content}

## Context
{context_summary}

## Task
Generate comprehensive tests for the specification above.

### Test Requirements

1. **Unit Tests**
   - Test each function/method independently
   - Mock dependencies appropriately
   - Test both success and failure paths

2. **Integration Tests**
   - Test component interactions
   - Verify data flow between modules
   - Test real dependencies where appropriate

3. **Edge Cases**
   - Null/undefined inputs
   - Boundary values
   - Empty collections
   - Large datasets
   - Concurrent operations

4. **Error Scenarios**
   - Invalid inputs
   - Network failures
   - Timeout conditions
   - Resource unavailability

5. **Test Quality**
   - Clear, descriptive test names
   - Arrange-Act-Assert structure
   - No test interdependencies
   - Fast execution time

### Coverage Goal
Aim for >80% code coverage with meaningful tests (not just coverage for coverage's sake).

Generate test files with all necessary setup, fixtures, and assertions.
""",
        }

        return templates.get(target_agent, templates["codegen"])
