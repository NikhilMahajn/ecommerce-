from fastapi import APIRouter, Depends, status
from app.db.database import get_db
from app.services.admin import AdminService
from app.schemas.admin import DashboardStats
from sqlalchemy.orm import Session
from app.core.security import check_admin_role

router = APIRouter(tags=["Admin"], prefix="/admin")


# Get Dashboard Statistics
@router.get(
    "/dashboard",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(check_admin_role)]
)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get admin dashboard statistics including:
    - Total users
    - Total orders
    - Total products
    - Total revenue
    """
    return AdminService.get_dashboard_stats(db)
