from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import User, Order, Product
from app.utils.responses import ResponseHandler


class AdminService:
    """Service for admin dashboard and analytics"""

    @staticmethod
    def get_dashboard_stats(db: Session):
        """
        Get dashboard statistics including:
        - Total users (excluding admins)
        - Total orders
        - Total products
        - Total revenue
        """
        try:
            # Get total users count (only users with role 'user', excluding admins)
            total_users = db.query(func.count(User.id)).filter(User.role == "user").scalar() or 0

            # Get total orders count
            total_orders = db.query(func.count(Order.id)).scalar() or 0

            # Get total products count
            total_products = db.query(func.count(Product.id)).scalar() or 0

            # Get total revenue (sum of all order totals)
            total_revenue = db.query(func.sum(Order.total_amount)).scalar() or 0

            dashboard_data = {
                "total_users": total_users,
                "total_orders": total_orders,
                "total_products": total_products,
                "total_revenue": float(total_revenue)
            }

            return ResponseHandler.success("Dashboard statistics fetched successfully", dashboard_data)

        except Exception as e:
            raise Exception(f"Error fetching dashboard stats: {str(e)}")
