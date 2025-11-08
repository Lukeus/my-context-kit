"""Send message use case."""

from dataclasses import dataclass

from ...domain.entities import Message, Task
from ...domain.repositories import SessionRepository
from ...domain.value_objects import SessionId, TaskActionType
from ...infrastructure.logging import get_logger
from ..dtos import TaskDTO
from ..ports import AIServicePort

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
        task = Task.create(TaskActionType.PROMPT)
        session.add_task(task)
        
        try:
            # Start task
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
