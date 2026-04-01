from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import ProductAnalytics, Product
from app.utils.responses import ResponseHandler
from datetime import datetime, timezone


class ProductAnalyticsService:
    """Service for managing product analytics tracking"""

    @staticmethod
    def get_or_create_analytics(db: Session, product_id: int) -> ProductAnalytics:
        """
        Get existing analytics record or create new one if doesn't exist
        """
        try:
            analytics = db.query(ProductAnalytics).filter(
                ProductAnalytics.product_id == product_id
            ).first()

            if not analytics:
                # Verify product exists
                product = db.query(Product).filter(Product.id == product_id).first()
                if not product:
                    raise ValueError(f"Product with id {product_id} does not exist")

                # Create new analytics record
                analytics = ProductAnalytics(
                    product_id=product_id,
                    views=0,
                    cart_adds=0,
                    purchases=0
                )
                db.add(analytics)
                db.flush()  # Use flush instead of commit to avoid transaction issues
                # Don't refresh here, let the caller handle it

            return analytics
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def track_view(db: Session, product_id: int, commit: bool = True):
        """Increment view count for a product"""
        try:
            analytics = ProductAnalyticsService.get_or_create_analytics(db, product_id)
            analytics.views += 1
            analytics.updated_at = datetime.now(timezone.utc)
            if commit:
                db.commit()
                db.refresh(analytics)
            return analytics
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def track_cart_add(db: Session, product_id: int, quantity: int = 1, commit: bool = False):
        """Increment cart add count for a product"""
        try:
            analytics = ProductAnalyticsService.get_or_create_analytics(db, product_id)
            analytics.cart_adds += quantity
            analytics.updated_at = datetime.now(timezone.utc)
            if commit:
                db.commit()
                db.refresh(analytics)
            return analytics
        except Exception as e:
            if commit:
                db.rollback()
            raise e

    @staticmethod
    def track_purchase(db: Session, product_id: int, quantity: int = 1, commit: bool = False):
        """Increment purchase count for a product"""
        try:
            analytics = ProductAnalyticsService.get_or_create_analytics(db, product_id)
            analytics.purchases += quantity
            analytics.updated_at = datetime.now(timezone.utc)
            if commit:
                db.commit()
                db.refresh(analytics)
            return analytics
        except Exception as e:
            if commit:
                db.rollback()
            raise e

    @staticmethod
    def get_product_analytics(db: Session, product_id: int):
        """Get analytics for a specific product"""
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return ResponseHandler.not_found_error("Product", product_id)

        analytics = ProductAnalyticsService.get_or_create_analytics(db, product_id)
        return ResponseHandler.success("Product analytics retrieved", {
            "product_id": analytics.product_id,
            "views": analytics.views,
            "cart_adds": analytics.cart_adds,
            "purchases": analytics.purchases,
            "created_at": analytics.created_at,
            "updated_at": analytics.updated_at
        })

    @staticmethod
    def get_top_products(db: Session, metric: str = "purchases", limit: int = 10):
        """
        Get top products by metric (purchases, cart_adds, views)
        """
        valid_metrics = {"purchases", "cart_adds", "views"}
        if metric not in valid_metrics:
            raise ValueError(f"Invalid metric. Must be one of {valid_metrics}")

        metric_column = getattr(ProductAnalytics, metric)

        top_products = db.query(
            Product,
            ProductAnalytics
        ).join(
            ProductAnalytics,
            Product.id == ProductAnalytics.product_id
        ).order_by(
            metric_column.desc()
        ).limit(limit).all()

        result = []
        for product, analytics in top_products:
            result.append({
                "product": {
                    "id": product.id,
                    "title": product.title,
                    "price": product.price,
                    "thumbnail": product.thumbnail
                },
                "analytics": {
                    "views": analytics.views,
                    "cart_adds": analytics.cart_adds,
                    "purchases": analytics.purchases
                }
            })

        return ResponseHandler.success(f"Top {limit} products by {metric}", result)

    @staticmethod
    def get_analytics_summary(db: Session):
        """Get overall analytics summary across all products"""
        total_views = db.query(func.sum(ProductAnalytics.views)).scalar() or 0
        total_cart_adds = db.query(func.sum(ProductAnalytics.cart_adds)).scalar() or 0
        total_purchases = db.query(func.sum(ProductAnalytics.purchases)).scalar() or 0

        return ResponseHandler.success("Analytics summary", {
            "total_views": total_views,
            "total_cart_adds": total_cart_adds,
            "total_purchases": total_purchases
        })

    @staticmethod
    def bulk_track_cart_adds(db: Session, cart_items_data: list):
        """
        Track cart additions for multiple products
        cart_items_data: list of {'product_id': int, 'quantity': int}
        """
        for item_data in cart_items_data:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity', 1)
            if product_id:
                try:
                    ProductAnalyticsService.track_cart_add(db, product_id, quantity, commit=False)
                except Exception as e:
                    print(f"Failed to track cart addition for product {product_id}: {str(e)}")

    @staticmethod
    def bulk_track_purchases(db: Session, order_items_data: list):
        """
        Track purchases for multiple products
        order_items_data: list of {'product_id': int, 'quantity': int}
        """
        for item_data in order_items_data:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity', 1)
            if product_id:
                try:
                    ProductAnalyticsService.track_purchase(db, product_id, quantity, commit=False)
                except Exception as e:
                    print(f"Failed to track purchase for product {product_id}: {str(e)}")
        # Commit all at once after tracking all items
        try:
            db.commit()
        except Exception as e:
            print(f"Failed to commit bulk analytics: {str(e)}")
