import logging

from fastapi import APIRouter, Depends, status
from fastapi.security.http import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer
from fastapi.responses import StreamingResponse

from app.core.security import get_current_user


from sqlalchemy.orm import Session


from app.db.database import get_db
from app.schemas.agent import ChatRequest, ChatResponse
from app.services.agent import AgentService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Agent"], prefix="/agent")
auth_scheme = HTTPBearer()

@router.post("/chat", status_code=status.HTTP_200_OK, response_model=ChatResponse)
async def send_message(
    message: ChatRequest, db: Session = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(auth_scheme)):

    logger.info("Agent route hit: message_length=%s", len(message.message or ""))
    try:
        response = AgentService.agent_chat(token,db, message)
        logger.info("Agent route completed successfully")
        return response
    except Exception:
        logger.exception("Agent route request failed")
        raise


@router.post("/chat/stream")
def agent_chat_stream(chat: ChatRequest,token: HTTPAuthorizationCredentials = Depends(auth_scheme), db=Depends(get_db)):
    user_id = get_current_user(token)
 
    return StreamingResponse(
        AgentService.agent_chat_stream(user_id, db, chat),
        media_type="application/x-ndjson",
    )
 

