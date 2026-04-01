from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional
from app.schemas.carts import CartBase


class AccountBase(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    address: Optional[str] = None
    created_at: datetime
    carts: List[CartBase]

    class Config:
        from_attributes = True


class AccountUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True


class AccountOut(BaseModel):
    message: str
    data: AccountBase

    class Config:
        from_attributes = True
