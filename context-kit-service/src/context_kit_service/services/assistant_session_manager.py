"""Assistant session management service."""

from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any
from uuid import uuid4

from ..models.assistant import (
    AssistantProvider,
    CreateSessionRequest,
    CreateSessionResponse,
    ProviderConfig,
    SendMessageRequest,
    TaskActionType,
    TaskEnvelope,
    TaskStatus,
    TaskTimestamps,
)
from .langchain_agent import LangChainAgent, create_agent


class AssistantSession:
    """Assistant session state."""

    def __init__(
        self,
        session_id: str,
        user_id: str,
        provider: AssistantProvider,
        system_prompt: str | None = None,
        active_tools: list[str] | None = None,
        config: ProviderConfig | None = None,
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.provider = provider
        self.system_prompt = system_prompt or self._default_system_prompt()
        self.active_tools = active_tools or []
        self.config = config
        self.messages: list[dict[str, Any]] = []
        self.tasks: list[TaskEnvelope] = []
        self.created_at = datetime.utcnow()
        self._agent: LangChainAgent | None = None

    def _default_system_prompt(self) -> str:
        """Generate default system prompt."""
        return (
            "You are a guard-railed operator for context repository pipelines. "
            "Confirm scope, execute only allowlisted commands, and summarize results for humans."
        )

    def add_message(self, role: str, content: str, metadata: dict[str, Any] | None = None):
        """Add message to conversation."""
        self.messages.append(
            {
                "role": role,
                "content": content,
                "timestamp": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            }
        )

    def add_task(self, task: TaskEnvelope):
        """Add task to session."""
        self.tasks.append(task)

    @property
    def agent(self) -> LangChainAgent:
        """Lazy-initialize LangChain agent."""
        if self._agent is None:
            print(f"[AssistantSession] Creating agent with active_tools: {self.active_tools}")
            self._agent = create_agent(
                provider=self.provider,
                system_prompt=self.system_prompt,
                available_tools=self.active_tools,
                config=self.config,
            )
        return self._agent


class AssistantSessionManager:
    """Manages assistant sessions and routing."""

    def __init__(self):
        self._sessions: dict[str, AssistantSession] = {}

    async def create_session(self, request: CreateSessionRequest) -> CreateSessionResponse:
        """Create new assistant session."""
        session_id = str(uuid4())

        print(f"[SessionManager] Creating session with activeTools: {request.activeTools}")

        session = AssistantSession(
            session_id=session_id,
            user_id=request.userId,
            provider=request.provider or AssistantProvider.AZURE_OPENAI,
            system_prompt=request.systemPrompt,
            active_tools=request.activeTools,
            config=request.config,
        )

        self._sessions[session_id] = session
        print(f"[SessionManager] Created session {session_id}. Total sessions: {len(self._sessions)}")
        print(f"[SessionManager] Session stored at manager id: {id(self)}")
        print(f"[SessionManager] Session active_tools: {session.active_tools}")

        # Build capability profile (in real implementation, this would check actual capabilities)
        from ..services.capability_checker import get_capability_profile

        capability_profile = await get_capability_profile()

        return CreateSessionResponse(
            sessionId=session_id,
            capabilityProfile=capability_profile,
            createdAt=session.created_at,
        )

    def get_session(self, session_id: str) -> AssistantSession | None:
        """Get session by ID."""
        print(f"[SessionManager] Looking up session {session_id} in manager id: {id(self)}")
        print(f"[SessionManager] Available sessions: {list(self._sessions.keys())}")
        session = self._sessions.get(session_id)
        print(f"[SessionManager] Session found: {session is not None}")
        return session

    async def send_message(
        self, session_id: str, request: SendMessageRequest
    ) -> TaskEnvelope:
        """Send message and create task."""
        print(f"[SessionManager] send_message called for session {session_id}")
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        print(f"[SessionManager] Adding user message: {request.content[:50]}...")
        # Add user message to conversation
        session.add_message("user", request.content, {"mode": request.mode})

        # Create task
        task_id = str(uuid4())
        task = TaskEnvelope(
            taskId=task_id,
            status=TaskStatus.STREAMING,
            actionType=TaskActionType.PROMPT,
            timestamps=TaskTimestamps(created=datetime.utcnow()),
        )
        session.add_task(task)
        print(f"[SessionManager] Created task {task_id}")

        try:
            # Update task to processing
            task.status = TaskStatus.STREAMING
            task.timestamps.firstResponse = datetime.utcnow()

            # Get conversation history (exclude current message)
            chat_history = [msg for msg in session.messages[:-1]]
            print(f"[SessionManager] Invoking agent with {len(chat_history)} history messages")

            # Invoke LangChain agent
            response = await session.agent.invoke(
                message=request.content,
                chat_history=chat_history,
            )
            print(f"[SessionManager] Agent responded: {response[:100]}...")

            # Mark task as succeeded
            task.status = TaskStatus.SUCCEEDED
            task.timestamps.completed = datetime.utcnow()
            task.outputs.append(
                {
                    "type": "text",
                    "content": response,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )

            # Add assistant response
            session.add_message("assistant", response)
            print(f"[SessionManager] Task {task_id} succeeded")

        except Exception as e:
            print(f"[SessionManager] Error in send_message: {type(e).__name__}: {e}")
            # Mark task as failed
            task.status = TaskStatus.FAILED
            task.timestamps.completed = datetime.utcnow()
            task.outputs.append(
                {
                    "type": "error",
                    "content": f"Error: {str(e)}",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
            raise

        return task

    async def stream_message(
        self, session_id: str, request: SendMessageRequest
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream message response with real-time tokens."""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Add user message to conversation
        session.add_message("user", request.content, {"mode": request.mode})

        # Create task
        task_id = str(uuid4())
        task = TaskEnvelope(
            taskId=task_id,
            status=TaskStatus.STREAMING,
            actionType=TaskActionType.PROMPT,
            timestamps=TaskTimestamps(
                created=datetime.utcnow(), firstResponse=datetime.utcnow()
            ),
        )

        session.add_task(task)

        # Yield initial task status
        yield {"type": "task.started", "taskId": task_id, "timestamp": datetime.utcnow().isoformat()}

        try:
            # Get conversation history
            chat_history = [msg for msg in session.messages[:-1]]

            # Stream tokens from LangChain agent
            response_text = ""
            token_index = 0
            async for token in session.agent.stream(
                message=request.content,
                chat_history=chat_history,
            ):
                response_text += token
                yield {
                    "type": "token",
                    "taskId": task_id,
                    "token": token,
                    "index": token_index,
                    "timestamp": datetime.utcnow().isoformat(),
                }
                token_index += 1

            # Mark task complete
            task.status = TaskStatus.SUCCEEDED
            task.timestamps.completed = datetime.utcnow()
            task.outputs.append({"type": "text", "content": response_text})

            session.add_message("assistant", response_text)

            yield {
                "type": "task.completed",
                "taskId": task_id,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            # Mark task as failed
            task.status = TaskStatus.FAILED
            task.timestamps.completed = datetime.utcnow()
            task.outputs.append(
                {
                    "type": "error",
                    "content": f"Error: {str(e)}",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
            yield {
                "type": "task.failed",
                "taskId": task_id,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }


# Global singleton
_manager: AssistantSessionManager | None = None


def get_session_manager() -> AssistantSessionManager:
    """Get global session manager instance."""
    global _manager
    if _manager is None:
        _manager = AssistantSessionManager()
        print(f"[SessionManager] Created new singleton manager instance: {id(_manager)}")
    return _manager
