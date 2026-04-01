from fastapi import APIRouter, Depends, status, HTTPException
from app.db.database import get_db
from sqlalchemy.orm import Session
from app.core.security import check_admin_role
from app.workers.pricing_worker import trigger_price_update_immediately
from app.services.pricing import PricingService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Pricing"], prefix="/pricing")


# Trigger immediate price update
@router.post("/update-now", status_code=status.HTTP_200_OK, dependencies=[Depends(check_admin_role)])
def trigger_price_update(db: Session = Depends(get_db)):
    """
    Manually trigger price update for all products
    Admin only endpoint
    """
    try:
        result = trigger_price_update_immediately()
        return {
            "message": "Price update triggered successfully",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error triggering price update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger price update"
        )


# Get pricing configuration
@router.get("/config", status_code=status.HTTP_200_OK, dependencies=[Depends(check_admin_role)])
def get_pricing_config():
    """
    Get pricing worker configuration
    Admin only endpoint
    """
    return {
        "message": "Pricing configuration",
        "data": {
            "update_interval_hours": 1,
            "rate_limit_delay_seconds": 1,
            "price_adjustment_range": {
                "min": -0.2,
                "max": 0.2
            },
            "ai_model": "llama-3.1-8b-instant",
            "temperature": 0.2,
            "status": "Background worker active"
        }
    }


# Get pricing history for a product
@router.get("/product/{product_id}", status_code=status.HTTP_200_OK)
def get_product_pricing_info(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Get current price and analytics for a specific product
    """
    from app.models.models import Product, ProductAnalytics
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found"
        )
    
    analytics = db.query(ProductAnalytics).filter(
        ProductAnalytics.product_id == product_id
    ).first()
    
    return {
        "message": "Product pricing information",
        "data": {
            "product_id": product.id,
            "title": product.title,
            "current_price": product.price,
            "stock": product.stock,
            "discount": product.discount_percentage,
            "analytics": {
                "views": analytics.views if analytics else 0,
                "cart_adds": analytics.cart_adds if analytics else 0,
                "purchases": analytics.purchases if analytics else 0
            },
            "conversion_rate": (
                round((analytics.purchases / analytics.cart_adds * 100), 2)
                if analytics and analytics.cart_adds > 0
                else 0
            )
        }
    }
