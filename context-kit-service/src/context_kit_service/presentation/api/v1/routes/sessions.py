"""Session management routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from .....application.use_cases import (
    CreateSessionInput,
    CreateSessionUseCase,
    SendMessageInput,
    SendMessageUseCase,
)
from ....mappers import (
    request_to_create_session_input,
    session_dto_to_response,
    task_dto_to_response,
)
from ...dependencies import get_create_session_use_case, get_send_message_use_case
from ..schemas import (
    CreateSessionRequest,
    SendMessageRequest,
    SendMessageResponse,
    SessionResponse,
)

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: CreateSessionRequest,
    use_case: Annotated[CreateSessionUseCase, Depends(get_create_session_use_case)],
) -> SessionResponse:
    """
    Create a new conversation session.
    
    Args:
        request: Session creation request
        use_case: Create session use case
        
    Returns:
        Created session
    """
    try:
        # Map request to use case input
        input_data = request_to_create_session_input(request)
        
        # Execute use case
        output = await use_case.execute(input_data)
        
        # Map DTO to response
        return session_dto_to_response(output.session)
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}",
        ) from e


@router.post("/messages", response_model=SendMessageResponse)
async def send_message(
    request: SendMessageRequest,
    use_case: Annotated[SendMessageUseCase, Depends(get_send_message_use_case)],
) -> SendMessageResponse:
    """
    Send a message in a session.
    
    Args:
        request: Send message request
        use_case: Send message use case
        
    Returns:
        Created task
    """
    try:
        # Map request to use case input
        input_data = SendMessageInput(
            session_id=request.session_id,
            content=request.content,
        )
        
        # Execute use case
        output = await use_case.execute(input_data)
        
        # Map DTO to response
        return SendMessageResponse(
            task=task_dto_to_response(output.task)
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}",
        ) from e
