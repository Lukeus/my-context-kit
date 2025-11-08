# Clean Architecture Refactoring Plan

**Project:** context-kit-service  
**Date:** 2025-11-08  
**Goal:** Refactor to Clean Architecture principles for maintainability, testability, and separation of concerns

---

## Overview

### Clean Architecture Principles

1. **Dependency Rule**: Dependencies only point inward. Inner layers know nothing about outer layers.
2. **Independence**: Business logic independent of frameworks, UI, databases, and external agencies.
3. **Testability**: Business logic can be tested without external dependencies.
4. **Framework Independence**: Architecture not dependent on FastAPI, LangChain, etc.

### Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│                   (FastAPI Controllers)                     │
│  • HTTP Routes        • Request/Response Mapping            │
│  • Middleware         • Exception Handlers                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ depends on
┌──────────────────────▼──────────────────────────────────────┐
│                    Application Layer                        │
│                      (Use Cases)                            │
│  • Session Management     • Tool Execution                  │
│  • Message Processing     • Input/Output DTOs               │
│  • Orchestration          • Boundaries/Interfaces           │
└──────────────────────┬──────────────────────────────────────┘
                       │ depends on
┌──────────────────────▼──────────────────────────────────────┐
│                      Domain Layer                           │
│                   (Business Logic)                          │
│  • Entities               • Domain Services                 │
│  • Value Objects          • Repository Interfaces           │
│  • Domain Events          • Business Rules                  │
└──────────────────────┬──────────────────────────────────────┘
                       │ implemented by
┌──────────────────────▼──────────────────────────────────────┐
│                  Infrastructure Layer                       │
│               (External Dependencies)                       │
│  • LangChain Adapter      • Redis Repository                │
│  • Pipeline Executor      • File System                     │
│  • Database               • External APIs                   │
└─────────────────────────────────────────────────────────────┘
```

---

## New Directory Structure

```
src/context_kit_service/
├── domain/                          # Domain Layer (Core Business Logic)
│   ├── __init__.py
│   ├── entities/
│   │   ├── __init__.py
│   │   ├── session.py              # Session entity
│   │   ├── message.py              # Message entity
│   │   ├── task.py                 # Task entity
│   │   └── tool.py                 # Tool entity
│   ├── value_objects/
│   │   ├── __init__.py
│   │   ├── session_id.py           # Session ID value object
│   │   ├── provider_config.py      # AI provider configuration
│   │   └── task_status.py          # Task status enum
│   ├── repositories/               # Repository interfaces (no implementation)
│   │   ├── __init__.py
│   │   ├── session_repository.py
│   │   └── tool_repository.py
│   ├── services/                   # Domain services (pure business logic)
│   │   ├── __init__.py
│   │   ├── message_processor.py
│   │   └── tool_orchestrator.py
│   └── exceptions/
│       ├── __init__.py
│       ├── domain_exceptions.py
│       └── validation_errors.py
│
├── application/                     # Application Layer (Use Cases)
│   ├── __init__.py
│   ├── use_cases/
│   │   ├── __init__.py
│   │   ├── create_session.py       # CreateSessionUseCase
│   │   ├── send_message.py         # SendMessageUseCase
│   │   ├── stream_message.py       # StreamMessageUseCase
│   │   ├── execute_tool.py         # ExecuteToolUseCase
│   │   └── get_capabilities.py     # GetCapabilitiesUseCase
│   ├── dtos/                       # Data Transfer Objects
│   │   ├── __init__.py
│   │   ├── session_dto.py
│   │   ├── message_dto.py
│   │   └── tool_dto.py
│   ├── ports/                      # Interfaces for external dependencies
│   │   ├── __init__.py
│   │   ├── ai_service_port.py      # Interface for LangChain
│   │   ├── pipeline_port.py        # Interface for pipelines
│   │   └── storage_port.py         # Interface for persistence
│   └── services/                   # Application services
│       ├── __init__.py
│       └── session_manager.py      # Orchestrates use cases
│
├── infrastructure/                  # Infrastructure Layer (Implementation)
│   ├── __init__.py
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── langchain/
│   │   │   ├── __init__.py
│   │   │   ├── langchain_adapter.py    # Implements AIServicePort
│   │   │   ├── agent_factory.py
│   │   │   └── tool_registry.py
│   │   ├── pipelines/
│   │   │   ├── __init__.py
│   │   │   └── pipeline_executor.py    # Implements PipelinePort
│   │   └── context/
│   │       ├── __init__.py
│   │       └── file_reader.py
│   ├── persistence/
│   │   ├── __init__.py
│   │   ├── in_memory/
│   │   │   ├── __init__.py
│   │   │   └── session_repository.py   # In-memory implementation
│   │   ├── redis/
│   │   │   ├── __init__.py
│   │   │   └── session_repository.py   # Redis implementation
│   │   └── repositories.py             # Repository factory
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py                 # Centralized configuration
│   │   └── dependencies.py             # DI container
│   └── logging/
│       ├── __init__.py
│       └── structured_logger.py
│
├── presentation/                    # Presentation Layer (API)
│   ├── __init__.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── assistant.py        # Thin controllers
│   │   │   │   ├── health.py
│   │   │   │   └── capabilities.py
│   │   │   └── schemas/               # API request/response models
│   │   │       ├── __init__.py
│   │   │       ├── session_schemas.py
│   │   │       ├── message_schemas.py
│   │   │       └── tool_schemas.py
│   │   └── dependencies.py            # FastAPI dependencies
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── auth_middleware.py
│   │   ├── rate_limit_middleware.py
│   │   ├── request_id_middleware.py
│   │   └── error_handler.py
│   └── mappers/                       # DTO to Schema mappers
│       ├── __init__.py
│       └── session_mapper.py
│
├── main.py                            # Application entry point
└── shared/                            # Shared utilities (can be used by all layers)
    ├── __init__.py
    ├── types.py
    └── validators.py
```

---

## Migration Plan

### Phase 1: Foundation (Day 1-2)

#### Step 1.1: Create Configuration Management
Replace hardcoded values and environment variable calls with centralized settings.

**File:** `src/context_kit_service/infrastructure/config/settings.py`

```python
"""Centralized application settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AIProviderSettings(BaseSettings):
    """AI provider configuration."""
    
    azure_api_key: str | None = Field(None, alias="AZURE_OPENAI_API_KEY")
    azure_endpoint: str | None = Field(None, alias="AZURE_OPENAI_ENDPOINT")
    azure_deployment: str = Field("gpt-4", alias="AZURE_OPENAI_DEPLOYMENT")
    azure_api_version: str = "2024-02-15-preview"
    
    ollama_base_url: str = Field("http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field("llama2", alias="OLLAMA_MODEL")
    
    temperature: float = 0.7
    max_tokens: int | None = None
    request_timeout: int = 30
    
    model_config = SettingsConfigDict(env_prefix="", env_file=".env")


class PipelineSettings(BaseSettings):
    """Pipeline execution settings."""
    
    default_repo_path: str = Field("../context-repo", alias="CONTEXT_REPO_PATH")
    execution_timeout: int = 30
    max_concurrent_pipelines: int = 5
    
    model_config = SettingsConfigDict(env_prefix="PIPELINE_", env_file=".env")


class SessionSettings(BaseSettings):
    """Session management settings."""
    
    max_session_age_hours: int = 24
    cleanup_interval_hours: int = 1
    storage_backend: str = "memory"  # Options: memory, redis
    
    model_config = SettingsConfigDict(env_prefix="SESSION_", env_file=".env")


class RedisSettings(BaseSettings):
    """Redis configuration."""
    
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: str | None = None
    
    model_config = SettingsConfigDict(env_prefix="REDIS_", env_file=".env")


class SecuritySettings(BaseSettings):
    """Security configuration."""
    
    shared_secret: str | None = Field(None, alias="SIDECAR_SHARED_SECRET")
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:*"])
    rate_limit_per_minute: int = 60
    
    model_config = SettingsConfigDict(env_prefix="SECURITY_", env_file=".env")


class Settings(BaseSettings):
    """Application settings."""
    
    # Service metadata
    service_name: str = "context-kit-service"
    version: str = "0.1.0"
    environment: str = "development"
    debug: bool = False
    
    # Host configuration
    host: str = "127.0.0.1"
    port: int = 8000
    
    # Feature flags
    enable_rag: bool = False
    enable_streaming: bool = True
    
    # Nested settings
    ai_provider: AIProviderSettings = Field(default_factory=AIProviderSettings)
    pipeline: PipelineSettings = Field(default_factory=PipelineSettings)
    session: SessionSettings = Field(default_factory=SessionSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


# Singleton instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get application settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
```

#### Step 1.2: Create Structured Logger

**File:** `src/context_kit_service/infrastructure/logging/structured_logger.py`

```python
"""Structured logging configuration."""

import logging
import sys
from typing import Any

import structlog


def configure_logging(debug: bool = False) -> None:
    """Configure structured logging."""
    
    log_level = logging.DEBUG if debug else logging.INFO
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer() if not debug else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> Any:
    """Get a structured logger instance."""
    return structlog.get_logger(name)
```

---

### Phase 2: Domain Layer (Day 2-3)

#### Step 2.1: Create Domain Entities

**File:** `src/context_kit_service/domain/entities/session.py`

```python
"""Session domain entity."""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from ..value_objects.provider_config import ProviderConfig
from ..value_objects.session_id import SessionId
from .message import Message
from .task import Task


class Session:
    """Session aggregate root."""
    
    def __init__(
        self,
        session_id: SessionId,
        user_id: str,
        provider_config: ProviderConfig,
        system_prompt: str | None = None,
        active_tools: list[str] | None = None,
        created_at: datetime | None = None,
    ):
        self._session_id = session_id
        self._user_id = user_id
        self._provider_config = provider_config
        self._system_prompt = system_prompt or self._default_system_prompt()
        self._active_tools = active_tools or []
        self._messages: list[Message] = []
        self._tasks: list[Task] = []
        self._created_at = created_at or datetime.utcnow()
        self._last_activity_at = self._created_at
    
    @property
    def session_id(self) -> SessionId:
        return self._session_id
    
    @property
    def user_id(self) -> str:
        return self._user_id
    
    @property
    def provider_config(self) -> ProviderConfig:
        return self._provider_config
    
    @property
    def system_prompt(self) -> str:
        return self._system_prompt
    
    @property
    def active_tools(self) -> list[str]:
        return self._active_tools.copy()
    
    @property
    def messages(self) -> list[Message]:
        return self._messages.copy()
    
    @property
    def tasks(self) -> list[Task]:
        return self._tasks.copy()
    
    @property
    def created_at(self) -> datetime:
        return self._created_at
    
    @property
    def last_activity_at(self) -> datetime:
        return self._last_activity_at
    
    def add_message(self, message: Message) -> None:
        """Add a message to the session."""
        self._messages.append(message)
        self._last_activity_at = datetime.utcnow()
    
    def add_task(self, task: Task) -> None:
        """Add a task to the session."""
        self._tasks.append(task)
        self._last_activity_at = datetime.utcnow()
    
    def is_expired(self, max_age_hours: int) -> bool:
        """Check if session has expired."""
        age = datetime.utcnow() - self._last_activity_at
        return age > timedelta(hours=max_age_hours)
    
    def get_conversation_history(self) -> list[dict[str, Any]]:
        """Get conversation history for AI context."""
        return [
            {
                "role": msg.role,
                "content": msg.content,
                "timestamp": msg.timestamp.isoformat(),
            }
            for msg in self._messages
        ]
    
    @staticmethod
    def _default_system_prompt() -> str:
        return (
            "You are a guard-railed operator for context repository pipelines. "
            "Confirm scope, execute only allowlisted commands, and summarize results."
        )
    
    @classmethod
    def create(
        cls,
        user_id: str,
        provider_config: ProviderConfig,
        system_prompt: str | None = None,
        active_tools: list[str] | None = None,
    ) -> "Session":
        """Factory method to create a new session."""
        return cls(
            session_id=SessionId.generate(),
            user_id=user_id,
            provider_config=provider_config,
            system_prompt=system_prompt,
            active_tools=active_tools,
        )
```

**File:** `src/context_kit_service/domain/entities/message.py`

```python
"""Message domain entity."""

from datetime import datetime
from uuid import UUID, uuid4


class Message:
    """Message entity."""
    
    def __init__(
        self,
        message_id: UUID,
        role: str,
        content: str,
        timestamp: datetime,
        metadata: dict | None = None,
    ):
        self._message_id = message_id
        self._role = self._validate_role(role)
        self._content = content
        self._timestamp = timestamp
        self._metadata = metadata or {}
    
    @property
    def message_id(self) -> UUID:
        return self._message_id
    
    @property
    def role(self) -> str:
        return self._role
    
    @property
    def content(self) -> str:
        return self._content
    
    @property
    def timestamp(self) -> datetime:
        return self._timestamp
    
    @property
    def metadata(self) -> dict:
        return self._metadata.copy()
    
    @staticmethod
    def _validate_role(role: str) -> str:
        """Validate message role."""
        valid_roles = {"user", "assistant", "system"}
        if role not in valid_roles:
            raise ValueError(f"Invalid role: {role}. Must be one of {valid_roles}")
        return role
    
    @classmethod
    def create_user_message(cls, content: str, metadata: dict | None = None) -> "Message":
        """Factory method for user messages."""
        return cls(
            message_id=uuid4(),
            role="user",
            content=content,
            timestamp=datetime.utcnow(),
            metadata=metadata,
        )
    
    @classmethod
    def create_assistant_message(cls, content: str, metadata: dict | None = None) -> "Message":
        """Factory method for assistant messages."""
        return cls(
            message_id=uuid4(),
            role="assistant",
            content=content,
            timestamp=datetime.utcnow(),
            metadata=metadata,
        )
```

#### Step 2.2: Create Value Objects

**File:** `src/context_kit_service/domain/value_objects/session_id.py`

```python
"""Session ID value object."""

from dataclasses import dataclass
from uuid import UUID, uuid4


@dataclass(frozen=True)
class SessionId:
    """Session identifier value object."""
    
    value: UUID
    
    def __str__(self) -> str:
        return str(self.value)
    
    @classmethod
    def generate(cls) -> "SessionId":
        """Generate a new session ID."""
        return cls(value=uuid4())
    
    @classmethod
    def from_string(cls, session_id: str) -> "SessionId":
        """Create from string."""
        try:
            return cls(value=UUID(session_id))
        except ValueError as e:
            raise ValueError(f"Invalid session ID format: {session_id}") from e
```

**File:** `src/context_kit_service/domain/value_objects/provider_config.py`

```python
"""Provider configuration value object."""

from dataclasses import dataclass
from enum import Enum


class AIProvider(str, Enum):
    """AI provider types."""
    AZURE_OPENAI = "azure-openai"
    OLLAMA = "ollama"


@dataclass(frozen=True)
class ProviderConfig:
    """AI provider configuration value object."""
    
    provider: AIProvider
    endpoint: str
    model: str
    temperature: float = 0.7
    max_tokens: int | None = None
    
    def __post_init__(self):
        """Validate configuration."""
        if self.temperature < 0 or self.temperature > 2:
            raise ValueError("Temperature must be between 0 and 2")
        
        if self.max_tokens is not None and self.max_tokens <= 0:
            raise ValueError("Max tokens must be positive")
```

#### Step 2.3: Create Repository Interfaces

**File:** `src/context_kit_service/domain/repositories/session_repository.py`

```python
"""Session repository interface (domain layer)."""

from abc import ABC, abstractmethod
from typing import Optional

from ..entities.session import Session
from ..value_objects.session_id import SessionId


class SessionRepository(ABC):
    """Abstract session repository."""
    
    @abstractmethod
    async def save(self, session: Session) -> None:
        """Persist a session."""
        pass
    
    @abstractmethod
    async def find_by_id(self, session_id: SessionId) -> Optional[Session]:
        """Find session by ID."""
        pass
    
    @abstractmethod
    async def delete(self, session_id: SessionId) -> None:
        """Delete a session."""
        pass
    
    @abstractmethod
    async def find_expired(self, max_age_hours: int) -> list[Session]:
        """Find all expired sessions."""
        pass
```

---

### Phase 3: Application Layer (Day 3-4)

#### Step 3.1: Create Use Cases

**File:** `src/context_kit_service/application/use_cases/create_session.py`

```python
"""Create session use case."""

from dataclasses import dataclass

from ...domain.entities.session import Session
from ...domain.repositories.session_repository import SessionRepository
from ...domain.value_objects.provider_config import ProviderConfig
from ...infrastructure.logging.structured_logger import get_logger
from ..dtos.session_dto import SessionDTO

logger = get_logger(__name__)


@dataclass
class CreateSessionInput:
    """Input for create session use case."""
    user_id: str
    provider_config: ProviderConfig
    system_prompt: str | None = None
    active_tools: list[str] | None = None


@dataclass
class CreateSessionOutput:
    """Output from create session use case."""
    session: SessionDTO


class CreateSessionUseCase:
    """Use case for creating a new assistant session."""
    
    def __init__(self, session_repository: SessionRepository):
        self._session_repository = session_repository
    
    async def execute(self, input_data: CreateSessionInput) -> CreateSessionOutput:
        """Execute the use case."""
        logger.info(
            "creating_session",
            user_id=input_data.user_id,
            provider=input_data.provider_config.provider.value,
            tools_count=len(input_data.active_tools or []),
        )
        
        # Create session entity
        session = Session.create(
            user_id=input_data.user_id,
            provider_config=input_data.provider_config,
            system_prompt=input_data.system_prompt,
            active_tools=input_data.active_tools,
        )
        
        # Persist session
        await self._session_repository.save(session)
        
        logger.info(
            "session_created",
            session_id=str(session.session_id),
            user_id=input_data.user_id,
        )
        
        # Return DTO
        return CreateSessionOutput(
            session=SessionDTO.from_entity(session)
        )
```

**File:** `src/context_kit_service/application/use_cases/send_message.py`

```python
"""Send message use case."""

from dataclasses import dataclass
from datetime import datetime

from ...domain.entities.message import Message
from ...domain.entities.task import Task, TaskStatus
from ...domain.repositories.session_repository import SessionRepository
from ...domain.value_objects.session_id import SessionId
from ...infrastructure.logging.structured_logger import get_logger
from ..dtos.task_dto import TaskDTO
from ..ports.ai_service_port import AIServicePort

logger = get_logger(__name__)


@dataclass
class SendMessageInput:
    """Input for send message use case."""
    session_id: str
    content: str
    mode: str = "general"


@dataclass
class SendMessageOutput:
    """Output from send message use case."""
    task: TaskDTO


class SendMessageUseCase:
    """Use case for sending a message to the assistant."""
    
    def __init__(
        self,
        session_repository: SessionRepository,
        ai_service: AIServicePort,
    ):
        self._session_repository = session_repository
        self._ai_service = ai_service
    
    async def execute(self, input_data: SendMessageInput) -> SendMessageOutput:
        """Execute the use case."""
        logger.info(
            "processing_message",
            session_id=input_data.session_id,
            content_length=len(input_data.content),
            mode=input_data.mode,
        )
        
        # Find session
        session_id = SessionId.from_string(input_data.session_id)
        session = await self._session_repository.find_by_id(session_id)
        
        if not session:
            raise ValueError(f"Session not found: {input_data.session_id}")
        
        # Create user message
        user_message = Message.create_user_message(
            content=input_data.content,
            metadata={"mode": input_data.mode},
        )
        session.add_message(user_message)
        
        # Create task
        task = Task.create(action_type="prompt")
        session.add_task(task)
        
        try:
            # Update task status
            task.start()
            
            # Invoke AI service
            response = await self._ai_service.invoke(
                prompt=input_data.content,
                conversation_history=session.get_conversation_history(),
                provider_config=session.provider_config,
                system_prompt=session.system_prompt,
                available_tools=session.active_tools,
            )
            
            # Create assistant message
            assistant_message = Message.create_assistant_message(content=response)
            session.add_message(assistant_message)
            
            # Mark task as succeeded
            task.succeed(output={"type": "text", "content": response})
            
            logger.info(
                "message_processed",
                session_id=input_data.session_id,
                task_id=str(task.task_id),
                response_length=len(response),
            )
            
        except Exception as e:
            logger.error(
                "message_processing_failed",
                session_id=input_data.session_id,
                error=str(e),
                exc_info=True,
            )
            task.fail(error=str(e))
            raise
        
        finally:
            # Persist updated session
            await self._session_repository.save(session)
        
        return SendMessageOutput(task=TaskDTO.from_entity(task))
```

#### Step 3.2: Create Application Ports

**File:** `src/context_kit_service/application/ports/ai_service_port.py`

```python
"""AI service port (interface for LangChain adapter)."""

from abc import ABC, abstractmethod
from typing import Any, AsyncIterator

from ...domain.value_objects.provider_config import ProviderConfig


class AIServicePort(ABC):
    """Interface for AI service operations."""
    
    @abstractmethod
    async def invoke(
        self,
        prompt: str,
        conversation_history: list[dict[str, Any]],
        provider_config: ProviderConfig,
        system_prompt: str,
        available_tools: list[str],
    ) -> str:
        """Invoke AI with a prompt and return response."""
        pass
    
    @abstractmethod
    async def stream(
        self,
        prompt: str,
        conversation_history: list[dict[str, Any]],
        provider_config: ProviderConfig,
        system_prompt: str,
        available_tools: list[str],
    ) -> AsyncIterator[str]:
        """Stream AI response token by token."""
        pass
```

---

### Phase 4: Infrastructure Layer (Day 4-5)

#### Step 4.1: Implement Repositories

**File:** `src/context_kit_service/infrastructure/persistence/in_memory/session_repository.py`

```python
"""In-memory session repository implementation."""

from typing import Optional

from ....domain.entities.session import Session
from ....domain.repositories.session_repository import SessionRepository
from ....domain.value_objects.session_id import SessionId


class InMemorySessionRepository(SessionRepository):
    """In-memory implementation of session repository."""
    
    def __init__(self):
        self._sessions: dict[str, Session] = {}
    
    async def save(self, session: Session) -> None:
        """Persist a session."""
        self._sessions[str(session.session_id)] = session
    
    async def find_by_id(self, session_id: SessionId) -> Optional[Session]:
        """Find session by ID."""
        return self._sessions.get(str(session_id))
    
    async def delete(self, session_id: SessionId) -> None:
        """Delete a session."""
        self._sessions.pop(str(session_id), None)
    
    async def find_expired(self, max_age_hours: int) -> list[Session]:
        """Find all expired sessions."""
        return [
            session
            for session in self._sessions.values()
            if session.is_expired(max_age_hours)
        ]
```

#### Step 4.2: Implement LangChain Adapter

**File:** `src/context_kit_service/infrastructure/adapters/langchain/langchain_adapter.py`

```python
"""LangChain adapter implementing AIServicePort."""

from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langchain_openai import AzureChatOpenAI
from pydantic import SecretStr

from ....application.ports.ai_service_port import AIServicePort
from ....domain.value_objects.provider_config import AIProvider, ProviderConfig
from ....infrastructure.config.settings import get_settings
from ....infrastructure.logging.structured_logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


class LangChainAdapter(AIServicePort):
    """Adapter for LangChain AI operations."""
    
    def __init__(self):
        self._llm_cache: dict[str, Any] = {}
    
    def _get_llm(self, provider_config: ProviderConfig, streaming: bool = False):
        """Get or create LLM instance."""
        cache_key = f"{provider_config.provider}:{provider_config.model}:{streaming}"
        
        if cache_key in self._llm_cache:
            return self._llm_cache[cache_key]
        
        if provider_config.provider == AIProvider.AZURE_OPENAI:
            api_key = settings.ai_provider.azure_api_key
            if not api_key:
                raise ValueError("Azure OpenAI API key not configured")
            
            llm = AzureChatOpenAI(
                azure_endpoint=provider_config.endpoint,
                api_key=SecretStr(api_key),
                api_version=settings.ai_provider.azure_api_version,
                azure_deployment=provider_config.model,
                temperature=provider_config.temperature,
                max_tokens=provider_config.max_tokens,
                streaming=streaming,
                timeout=settings.ai_provider.request_timeout,
            )
        
        elif provider_config.provider == AIProvider.OLLAMA:
            llm = ChatOllama(
                base_url=provider_config.endpoint,
                model=provider_config.model,
                temperature=provider_config.temperature,
            )
        
        else:
            raise ValueError(f"Unsupported provider: {provider_config.provider}")
        
        self._llm_cache[cache_key] = llm
        return llm
    
    def _build_messages(
        self,
        prompt: str,
        conversation_history: list[dict[str, Any]],
        system_prompt: str,
    ) -> list:
        """Build message list for LLM."""
        messages = [SystemMessage(content=system_prompt)]
        
        for msg in conversation_history:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        
        messages.append(HumanMessage(content=prompt))
        return messages
    
    async def invoke(
        self,
        prompt: str,
        conversation_history: list[dict[str, Any]],
        provider_config: ProviderConfig,
        system_prompt: str,
        available_tools: list[str],
    ) -> str:
        """Invoke AI with a prompt."""
        logger.debug(
            "invoking_llm",
            provider=provider_config.provider.value,
            model=provider_config.model,
            tools_count=len(available_tools),
        )
        
        llm = self._get_llm(provider_config, streaming=False)
        messages = self._build_messages(prompt, conversation_history, system_prompt)
        
        # TODO: Bind tools if available_tools is not empty
        
        response = await llm.ainvoke(messages)
        return response.content if response.content else ""
    
    async def stream(
        self,
        prompt: str,
        conversation_history: list[dict[str, Any]],
        provider_config: ProviderConfig,
        system_prompt: str,
        available_tools: list[str],
    ) -> AsyncIterator[str]:
        """Stream AI response."""
        llm = self._get_llm(provider_config, streaming=True)
        messages = self._build_messages(prompt, conversation_history, system_prompt)
        
        async for chunk in llm.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content
```

---

### Phase 5: Presentation Layer (Day 5-6)

#### Step 5.1: Create Thin Controllers

**File:** `src/context_kit_service/presentation/api/v1/routes/assistant.py`

```python
"""Assistant API routes (thin controllers)."""

from fastapi import APIRouter, Depends, HTTPException, status

from .....application.use_cases.create_session import (
    CreateSessionInput,
    CreateSessionUseCase,
)
from .....application.use_cases.send_message import (
    SendMessageInput,
    SendMessageUseCase,
)
from .....infrastructure.logging.structured_logger import get_logger
from ...dependencies import get_create_session_use_case, get_send_message_use_case
from ..schemas.message_schemas import SendMessageRequest, SendMessageResponse
from ..schemas.session_schemas import CreateSessionRequest, CreateSessionResponse

logger = get_logger(__name__)
router = APIRouter(prefix="/v1/assistant", tags=["Assistant"])


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    use_case: CreateSessionUseCase = Depends(get_create_session_use_case),
) -> CreateSessionResponse:
    """Create a new assistant session."""
    logger.info("api_create_session", user_id=request.user_id)
    
    try:
        # Map request to use case input
        input_data = CreateSessionInput(
            user_id=request.user_id,
            provider_config=request.provider_config.to_domain(),
            system_prompt=request.system_prompt,
            active_tools=request.active_tools,
        )
        
        # Execute use case
        output = await use_case.execute(input_data)
        
        # Map output to response
        return CreateSessionResponse.from_dto(output.session)
    
    except ValueError as e:
        logger.warning("validation_error", error=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    except Exception as e:
        logger.exception("create_session_failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create session",
        )


@router.post("/sessions/{session_id}/messages", response_model=SendMessageResponse)
async def send_message(
    session_id: str,
    request: SendMessageRequest,
    use_case: SendMessageUseCase = Depends(get_send_message_use_case),
) -> SendMessageResponse:
    """Send a message to the assistant."""
    logger.info("api_send_message", session_id=session_id)
    
    try:
        # Map request to use case input
        input_data = SendMessageInput(
            session_id=session_id,
            content=request.content,
            mode=request.mode,
        )
        
        # Execute use case
        output = await use_case.execute(input_data)
        
        # Map output to response
        return SendMessageResponse.from_dto(output.task)
    
    except ValueError as e:
        logger.warning("validation_error", error=str(e), session_id=session_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    
    except Exception as e:
        logger.exception("send_message_failed", session_id=session_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process message",
        )
```

#### Step 5.2: Create Dependency Injection

**File:** `src/context_kit_service/presentation/api/dependencies.py`

```python
"""FastAPI dependency injection."""

from fastapi import Depends

from ...application.use_cases.create_session import CreateSessionUseCase
from ...application.use_cases.send_message import SendMessageUseCase
from ...domain.repositories.session_repository import SessionRepository
from ...infrastructure.adapters.langchain.langchain_adapter import LangChainAdapter
from ...infrastructure.config.settings import Settings, get_settings
from ...infrastructure.persistence.in_memory.session_repository import (
    InMemorySessionRepository,
)


# Repository dependencies
_session_repository: SessionRepository | None = None


def get_session_repository(
    settings: Settings = Depends(get_settings),
) -> SessionRepository:
    """Get session repository instance."""
    global _session_repository
    if _session_repository is None:
        # Factory based on configuration
        if settings.session.storage_backend == "memory":
            _session_repository = InMemorySessionRepository()
        # elif settings.session.storage_backend == "redis":
        #     _session_repository = RedisSessionRepository(...)
        else:
            raise ValueError(f"Unknown storage backend: {settings.session.storage_backend}")
    return _session_repository


# Service dependencies
_langchain_adapter: LangChainAdapter | None = None


def get_langchain_adapter() -> LangChainAdapter:
    """Get LangChain adapter instance."""
    global _langchain_adapter
    if _langchain_adapter is None:
        _langchain_adapter = LangChainAdapter()
    return _langchain_adapter


# Use case dependencies
def get_create_session_use_case(
    repository: SessionRepository = Depends(get_session_repository),
) -> CreateSessionUseCase:
    """Get create session use case."""
    return CreateSessionUseCase(session_repository=repository)


def get_send_message_use_case(
    repository: SessionRepository = Depends(get_session_repository),
    ai_service: LangChainAdapter = Depends(get_langchain_adapter),
) -> SendMessageUseCase:
    """Get send message use case."""
    return SendMessageUseCase(
        session_repository=repository,
        ai_service=ai_service,
    )
```

---

## Benefits of This Refactoring

### 1. **Testability**
- Domain logic can be tested without external dependencies
- Use cases can be tested with mocked repositories
- Controllers can be tested independently

### 2. **Maintainability**
- Clear separation of concerns
- Changes to infrastructure don't affect business logic
- Easy to understand code organization

### 3. **Flexibility**
- Swap implementations easily (e.g., Redis instead of in-memory)
- Change AI providers without affecting business logic
- Add new features without modifying existing code

### 4. **Security**
- API keys and secrets managed centrally
- Validation at domain layer
- Clear boundaries prevent leakage

### 5. **Scalability**
- Stateless use cases
- Repository pattern allows for distributed storage
- Clear interfaces for horizontal scaling

---

## Migration Steps

1. **Create new structure** (Day 1)
   - Set up new directory structure
   - Create configuration and logging infrastructure

2. **Migrate domain** (Day 2)
   - Extract entities, value objects
   - Define repository interfaces
   - Write domain tests

3. **Create application layer** (Day 3)
   - Implement use cases
   - Define ports/interfaces
   - Create DTOs

4. **Implement infrastructure** (Day 4-5)
   - Adapt existing code to new interfaces
   - Implement repositories
   - Create adapters

5. **Refactor presentation** (Day 5-6)
   - Create thin controllers
   - Set up dependency injection
   - Add middleware

6. **Test and validate** (Day 6-7)
   - Run test suite
   - Integration testing
   - Performance testing

7. **Remove legacy code** (Day 7)
   - Delete old implementations
   - Update documentation
   - Final cleanup

---

## Estimated Effort

- **Total Time:** 7-10 days
- **Team Size:** 1-2 developers
- **Risk:** Medium (requires careful migration and testing)

---

## Next Steps

1. Review and approve this plan
2. Set up feature branch for refactoring
3. Begin Phase 1 (Foundation)
4. Iterative migration with continuous testing
5. Code review at each phase
6. Merge to main after validation

---

**Ready to begin implementation?**
