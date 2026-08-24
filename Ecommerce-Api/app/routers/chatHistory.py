from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials

from app.db.database import get_db
from app.services.ChatHistory import ChatHistoryService
from app.schemas.chatHistory import ChatHistoryResponse
from app.core.security import get_current_user

router = APIRouter(tags=["Carts"], prefix="/agent/chat")
auth_scheme = HTTPBearer()



@router.get("/history")
def get_chat_history(session_id: str, token: HTTPAuthorizationCredentials = Depends(auth_scheme), db=Depends(get_db)):
    user_id = get_current_user(token)
    history = ChatHistoryService.load_history(db, session_id, user_id)
    return {"messages": history}
 