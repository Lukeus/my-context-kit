"""Code Generator Service - Generates code from specifications."""

import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from pydantic import SecretStr


@dataclass
class GeneratedArtifact:
    """Generated code artifact."""

    path: str
    content: str
    language: str
    description: str | None = None


class CodeGenerator:
    """Generates code artifacts from specifications."""

    def __init__(self, repo_path: Path, model_config: dict[str, Any] | None = None) -> None:
        self.repo_path = repo_path
        self.model_config = model_config or {}
        self._llm: ChatOpenAI | AzureChatOpenAI | None = None  # Lazy initialization

    @property
    def llm(self) -> ChatOpenAI | AzureChatOpenAI:
        """Lazy-initialize LLM on first use."""
        if self._llm is None:
            # Try to get API key from environment first
            api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY")

            # If not in env, try Windows Credential Manager (for Azure OpenAI)
            if not api_key and os.name == "nt":
                api_key = self._get_azure_key_from_credential_manager()

            if not api_key:
                raise ValueError(
                    "No API key found. Please configure Azure OpenAI in the AI Settings modal."
                )

            # Check if using Azure OpenAI
            azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
            if azure_endpoint:
                # Use Azure OpenAI
                self._llm = AzureChatOpenAI(
                    azure_endpoint=azure_endpoint,
                    api_key=SecretStr(api_key),
                    api_version="2024-02-15-preview",
                    azure_deployment=self.model_config.get("model", "gpt-4"),
                    temperature=self.model_config.get("temperature", 0.3),
                )
            else:
                # Use standard OpenAI
                self._llm = ChatOpenAI(
                    model=self.model_config.get("model", "gpt-4"),
                    temperature=self.model_config.get("temperature", 0.3),
                    api_key=SecretStr(api_key),
                )
        return self._llm

    def _get_azure_key_from_credential_manager(self) -> str | None:
        """Try to retrieve Azure OpenAI key from Windows Credential Manager."""
        try:
            result = subprocess.run(
                ["cmdkey", "/list:azure-openai"],
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode == 0:
                # Use PowerShell to read the credential (Windows only workaround)
                # Note: cmdkey doesn't support reading passwords directly for security
                # In production, consider using keyring library instead
                print("Info: Azure OpenAI key found in Credential Manager")
                return "credential-manager-key"  # Placeholder - actual reading is complex
        except Exception as e:
            print(f"Warning: Could not read from Credential Manager: {e}")

        return None

    async def generate(
        self,
        spec_id: str,
        spec_content: str,
        prompt: str,
        stack_info: dict[str, Any],
        domain_info: dict[str, Any],
        language: str | None = None,
        framework: str | None = None,
        style_guide: str | None = None,
    ) -> tuple[list[GeneratedArtifact], str, dict[str, Any]]:
        """
        Generate code artifacts from specification.

        Returns:
            Tuple of (artifacts, summary, metadata)
        """
        target_language = language or stack_info.get("runtime", {}).get("language", "typescript")

        # Build context for code generation
        context = self._build_generation_context(
            stack_info, domain_info, target_language, framework, style_guide
        )

        # Create generation prompt
        gen_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", self._get_system_prompt(target_language, framework)),
                (
                    "user",
                    """Specification:
{spec_content}

Prompt:
{prompt}

Context:
{context}

Generate complete, production-ready code artifacts. Return each file in this format:

```filename: path/to/file.ext
// file content here
```

Generate all necessary files including implementation and tests.""",
                ),
            ]
        )

        # Generate code
        chain = gen_prompt | self.llm
        response = await chain.ainvoke(
            {
                "spec_content": spec_content,
                "prompt": prompt,
                "context": context,
            }
        )

        # Handle response content which can be str or list
        if isinstance(response.content, str):
            content_str = response.content
        else:
            # If content is a list, join all string parts
            content_str = "".join(
                item if isinstance(item, str) else str(item) for item in response.content
            )

        # Parse artifacts from response
        artifacts = self._parse_artifacts(content_str, target_language)

        summary = f"Generated {len(artifacts)} files: {', '.join(a.path for a in artifacts)}"

        metadata = {
            "model_info": {
                "provider": "openai",
                "model": self.model_config.get("model", "gpt-4"),
                "tokens_used": response.response_metadata.get("token_usage", {}).get(
                    "total_tokens", 0
                ),
            },
            "language": target_language,
            "framework": framework,
            "artifacts_count": len(artifacts),
        }

        return artifacts, summary, metadata

    def _build_generation_context(
        self,
        stack: dict,
        domain: dict,
        language: str,
        framework: str | None,
        style_guide: str | None,
    ) -> str:
        """Build context string for code generation."""
        context_parts = []

        if stack:
            context_parts.append(f"Stack: {stack.get('runtime', {}).get('name', 'Unknown')}")

        if domain:
            context_parts.append(f"Domain: {domain.get('name', 'Unknown')}")

        context_parts.append(f"Language: {language}")

        if framework:
            context_parts.append(f"Framework: {framework}")

        if style_guide:
            context_parts.append(f"Style Guide: {style_guide}")

        return "\n".join(context_parts)

    def _get_system_prompt(self, language: str, framework: str | None) -> str:
        """Get system prompt for code generation."""
        base_prompt = f"""You are an expert {language} developer. Generate clean, production-ready code following best practices.

Requirements:
- Write idiomatic {language} code
- Include comprehensive error handling
- Add inline comments for complex logic
- Follow SOLID principles
- Make code testable
- Include type annotations/hints
- Write unit tests for all functions
"""

        if framework:
            base_prompt += f"\n- Use {framework} framework conventions and patterns"

        return base_prompt

    def _parse_artifacts(self, content: str, language: str) -> list[GeneratedArtifact]:
        """Parse generated artifacts from LLM response."""
        artifacts = []

        # Pattern to match code blocks with filename markers
        pattern = r"```(?:filename:\s*)?([\w\-./]+\.\w+)\s*\n([\s\S]*?)```"

        matches = re.finditer(pattern, content, re.MULTILINE)

        for match in matches:
            path = match.group(1).strip()
            code_content = match.group(2).strip()

            # Infer description from path
            filename = path.split("/")[-1]
            if "test" in filename.lower():
                description = f"Tests for {filename}"
            elif "spec" in filename.lower():
                description = f"Specification for {filename}"
            else:
                description = f"Implementation: {filename}"

            artifacts.append(
                GeneratedArtifact(
                    path=path,
                    content=code_content,
                    language=language,
                    description=description,
                )
            )

        # If no artifacts parsed, create a default one
        if not artifacts:
            artifacts.append(
                GeneratedArtifact(
                    path=f"generated_{language}_code.txt",
                    content=content,
                    language=language,
                    description="Generated code (unparsed)",
                )
            )

        return artifacts
