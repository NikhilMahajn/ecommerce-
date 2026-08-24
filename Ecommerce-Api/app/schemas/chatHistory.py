from typing import List
from pydantic import BaseModel, Field


class ChatHistoryResponse(BaseModel):
    message: List[dict]