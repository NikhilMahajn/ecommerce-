import json
from sqlalchemy.orm import Session
from app.models.models import ChatMessage

class ChatHistoryService:

    @staticmethod
    def load_history(db: Session, session_id: str, user_id: int) -> list[dict]:
        rows = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id, ChatMessage.user_id == user_id)
            .order_by(ChatMessage.id.asc())
            .all()
        )

        messages = []
        for row in rows:
            msg = {"role": row.role}
            if row.content is not None:
                msg["content"] = row.content
            if row.tool_calls:
                msg["tool_calls"] = json.loads(row.tool_calls)
            if row.tool_call_id:
                msg["tool_call_id"] = row.tool_call_id
            messages.append(msg)
        return messages

    @staticmethod
    def save_message(db: Session, session_id: str, user_id: int, message: dict):
        db_msg = ChatMessage(
            session_id=session_id,
            user_id=user_id,
            role=message["role"],
            content=message.get("content"),
            tool_calls=json.dumps(message["tool_calls"]) if message.get("tool_calls") else None,
            tool_call_id=message.get("tool_call_id"),
        )
        db.add(db_msg)
        db.commit()

    @staticmethod
    def save_messages(db: Session, session_id: str, user_id: int, messages: list[dict]):
        for msg in messages:
            ChatHistoryService.save_message(db, session_id, user_id, msg)