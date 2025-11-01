"""
Specification Generator Service

Uses LangChain and LLMs to generate technical specifications from requirements.
"""

import os
import subprocess
from pathlib import Path
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from pydantic import SecretStr


class SpecGenerator:
    """Generates technical specifications using LangChain."""

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
                    "No API key found. Please either:\n"
                    "1. Set OPENAI_API_KEY or AZURE_OPENAI_API_KEY in your .env file, OR\n"
                    "2. Configure Azure OpenAI in the AI Settings modal (stores in Credential Manager)"
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
                    temperature=self.model_config.get("temperature", 0.7),
                )
            else:
                # Use standard OpenAI
                self._llm = ChatOpenAI(
                    model=self.model_config.get("model", "gpt-4"),
                    temperature=self.model_config.get("temperature", 0.7),
                    api_key=SecretStr(api_key),
                )
        return self._llm

    def _get_azure_key_from_credential_manager(self) -> str | None:
        """Try to retrieve Azure OpenAI key from Windows Credential Manager."""
        try:
            # The Electron app stores it as 'azure-openai'
            result = subprocess.run(
                ["cmdkey", "/list:azure-openai"],
                capture_output=True,
                text=True,
                check=False,
            )

            if result.returncode == 0:
                # Key exists, try to retrieve it using PowerShell
                ps_script = (
                    "$cred = (cmdkey /generic:azure-openai /pass | "
                    "Select-String -Pattern 'Password:' | "
                    "ForEach-Object { $_.Line.Split(':')[1].Trim() }); $cred"
                )
                ps_result = subprocess.run(
                    ["powershell", "-Command", ps_script],
                    capture_output=True,
                    text=True,
                    check=False,
                )

                if ps_result.returncode == 0 and ps_result.stdout.strip():
                    return ps_result.stdout.strip()
        except Exception as e:
            print(f"Warning: Could not read from Credential Manager: {e}")

        return None

    async def generate(
        self,
        user_prompt: str,
        entities: list[dict[str, Any]],
        rag_context: list[str],
        template_id: str | None = None,
    ) -> tuple[str, dict[str, Any]]:
        """
        Generate a technical specification.

        Returns:
            Tuple of (spec_content, metadata)
        """
        # Build context from entities
        entity_context = self._build_entity_context(entities)

        # Build RAG context string
        rag_context_str = "\n".join(rag_context) if rag_context else "No additional context"

        # Select template
        template = self._get_template(template_id)

        # Create prompt
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", template),
                (
                    "user",
                    "User Requirements: {user_prompt}\n\nContext Entities:\n{entity_context}\n\nAdditional Context:\n{rag_context}",
                ),
            ]
        )

        # Generate specification
        chain = prompt | self.llm
        response = await chain.ainvoke(
            {
                "user_prompt": user_prompt,
                "entity_context": entity_context,
                "rag_context": rag_context_str,
            }
        )

        # Handle response content which can be str or list
        if isinstance(response.content, str):
            spec_content = response.content
        else:
            # If content is a list, join all string parts
            spec_content = "".join(
                item if isinstance(item, str) else str(item) for item in response.content
            )

        metadata = {
            "model_info": {
                "provider": "openai",
                "model": self.model_config.get("model", "gpt-4"),
                "tokens_used": response.response_metadata.get("token_usage", {}).get(
                    "total_tokens", 0
                ),
            },
            "template_used": template_id or "default",
            "entities_count": len(entities),
            "rag_context_count": len(rag_context),
        }

        return spec_content, metadata

    def _build_entity_context(self, entities: list[dict[str, Any]]) -> str:
        """Build formatted context string from entities."""
        context_lines = []
        for entity in entities:
            entity_id = entity.get("id", "unknown")
            entity_type = entity.get("_type", "unknown")
            title = entity.get("title", entity.get("objective", "No title"))
            status = entity.get("status", "unknown")

            context_lines.append(f"- {entity_type.upper()}: {entity_id}")
            context_lines.append(f"  Title: {title}")
            context_lines.append(f"  Status: {status}")

            # Add relationships
            for key, value in entity.items():
                if isinstance(value, list) and key not in ["_type", "_file"]:
                    context_lines.append(f"  {key}: {', '.join(str(v) for v in value)}")

            context_lines.append("")  # Empty line between entities

        return "\n".join(context_lines)

    def _get_template(self, template_id: str | None) -> str:
        """Get specification template by ID."""
        templates = {
            "default": """You are a technical specification expert. Generate a comprehensive technical specification based on the provided requirements and context.

Your specification should include:
1. Overview and objectives
2. Functional requirements
3. Technical approach and architecture
4. Dependencies and integrations
5. Implementation plan with milestones
6. Testing strategy
7. Risks and mitigations

Format the output as markdown with clear sections.""",
            "api": """You are an API specification expert. Generate a detailed API specification based on the provided requirements.

Your specification should include:
1. API overview and purpose
2. Endpoints with HTTP methods, paths, and descriptions
3. Request/response schemas
4. Authentication and authorization
5. Error handling
6. Rate limiting and performance considerations

Format as OpenAPI 3.0 compatible markdown.""",
            "feature": """You are a product feature specification expert. Generate a detailed feature specification.

Your specification should include:
1. Feature overview and user value
2. User stories and acceptance criteria
3. User experience and UI/UX considerations
4. Technical implementation notes
5. Dependencies on other features/systems
6. Success metrics and KPIs

Format as markdown with clear sections.""",
        }

        return templates.get(template_id or "default", templates["default"])
