import logging

from fastapi import APIRouter, Depends, status
from fastapi.security.http import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer


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

