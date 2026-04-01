from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# Base Config
class BaseConfig:
    from_attributes = True


# OrderItem Schemas
class OrderItemBase(BaseModel):
    product_id: int
    quantity: int
    price: float
    subtotal: float

    class Config(BaseConfig):
        pass


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

    class Config(BaseConfig):
        pass


class OrderItemOut(OrderItemBase):
    id: int

    class Config(BaseConfig):
        pass


# Order Schemas
class OrderBase(BaseModel):
    status: str = "pending"
    total_amount: float

    class Config(BaseConfig):
        pass


class OrderCreate(BaseModel):
    order_items: List[OrderItemCreate]

    class Config(BaseConfig):
        pass


class OrderOut(OrderBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    order_items: List[OrderItemOut]

    class Config(BaseConfig):
        pass


class OrdersOutList(BaseModel):
    message: str
    data: List[OrderOut]

    class Config(BaseConfig):
        pass


class OrderOutDelete(BaseModel):
    message: str
    data: OrderOut

    class Config(BaseConfig):
        pass


class OrderUpdate(BaseModel):
    status: Optional[str] = None

    class Config(BaseConfig):
        pass
