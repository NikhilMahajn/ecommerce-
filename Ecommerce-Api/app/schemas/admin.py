from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_users: int
    total_orders: int
    total_products: int
    total_revenue: float
    
    class Config:
        from_attributes = True
