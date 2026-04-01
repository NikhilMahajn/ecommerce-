from fastapi import APIRouter, Depends, Query, status
from app.db.database import get_db
from app.services.analytics import ProductAnalyticsService
from sqlalchemy.orm import Session
from app.core.security import check_admin_role

router = APIRouter(tags=["Analytics"], prefix="/analytics")


# Get analytics for a specific product
@router.get("/products/{product_id}", status_code=status.HTTP_200_OK)
def get_product_analytics(
    product_id: int,
    db: Session = Depends(get_db),
):
    return ProductAnalyticsService.get_product_analytics(db, product_id)


# Get top products by metric
@router.get("/top-products", status_code=status.HTTP_200_OK, dependencies=[Depends(check_admin_role)])
def get_top_products(
    metric: str = Query("purchases", description="Metric to sort by: purchases, cart_adds, or views"),
    limit: int = Query(10, ge=1, le=100, description="Number of top products to retrieve"),
    db: Session = Depends(get_db),
):
    return ProductAnalyticsService.get_top_products(db, metric, limit)


# Get overall analytics summary
@router.get("/summary", status_code=status.HTTP_200_OK, dependencies=[Depends(check_admin_role)])
def get_analytics_summary(
    db: Session = Depends(get_db),
):
    return ProductAnalyticsService.get_analytics_summary(db)
