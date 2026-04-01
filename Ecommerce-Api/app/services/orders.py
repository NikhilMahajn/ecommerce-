from sqlalchemy.orm import Session, selectinload
from app.models.models import Order, OrderItem, Product, User, Cart, CartItem
from app.schemas.orders import OrderCreate, OrderUpdate
from app.utils.responses import ResponseHandler
from app.core.security import get_current_user
from app.services.analytics import ProductAnalyticsService


class OrderService:
    # Get All Orders
    @staticmethod
    def get_all_orders(token, db: Session, page: int, limit: int):
        user_id = get_current_user(token)
        orders = db.query(Order).options(selectinload(Order.order_items)).filter(Order.user_id == user_id).offset(
            (page - 1) * limit).limit(limit).order_by(Order.created_at.desc()).all()
        message = f"Page {page} with {limit} orders"
        return ResponseHandler.success(message, orders)

    # Get Order By ID
    @staticmethod
    def get_order(token, db: Session, order_id: int):
        user_id = get_current_user(token)
        order = db.query(Order).options(selectinload(Order.order_items)).filter(Order.id == order_id, Order.user_id == user_id).first()
        if not order:
            ResponseHandler.not_found_error("Order", order_id)
        return ResponseHandler.get_single_success("order", order_id, order)

    # Create a new Order from cart items
    @staticmethod
    def create_order(token, db: Session, order: OrderCreate):
        user_id = get_current_user(token)
        
        order_dict = order.model_dump()
        order_items_data = order_dict.pop("order_items", [])
        
        # Validate all products exist and have sufficient stock
        for item_data in order_items_data:
            product_id = item_data['product_id']
            quantity = item_data['quantity']
            
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                return ResponseHandler.not_found_error("Product", product_id)
            
            if product.stock < quantity:
                raise Exception(f"Insufficient stock for product {product.title}. Available: {product.stock}, Requested: {quantity}")
        
        # Create order items and calculate total
        order_items = []
        total_amount = 0
        
        for item_data in order_items_data:
            product_id = item_data['product_id']
            quantity = item_data['quantity']
            
            product = db.query(Product).filter(Product.id == product_id).first()
            
            # Calculate price with discount
            price = product.price * (1 - product.discount_percentage / 100)
            subtotal = price * quantity
            total_amount += subtotal
            
            order_item = OrderItem(
                product_id=product_id,
                quantity=quantity,
                price=price,
                subtotal=subtotal
            )
            order_items.append(order_item)
            
            # Reduce product stock
            product.stock -= quantity
        
        # Create order
        db_order = Order(
            user_id=user_id,
            order_items=order_items,
            total_amount=total_amount,
            status="pending"
        )
        
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        # Clear user's cart after order is created
        user_cart = db.query(Cart).filter(Cart.user_id == user_id).first()
        if user_cart:
            db.query(CartItem).filter(CartItem.cart_id == user_cart.id).delete()
            user_cart.total_amount = 0
            db.commit()
        
        # Track purchases in analytics after main transaction completes
        for item_data in order_items_data:
            product_id = item_data['product_id']
            quantity = item_data['quantity']
            try:
                ProductAnalyticsService.track_purchase(db, product_id, quantity, commit=True)
            except Exception as e:
                print(f"Failed to track purchase for product {product_id}: {str(e)}")
        
        # Eagerly load order_items relationship for proper serialization
        order = db.query(Order).options(selectinload(Order.order_items)).filter(Order.id == db_order.id).first()
        
        return order

    # Update Order Status
    @staticmethod
    def update_order(token, db: Session, order_id: int, updated_order: OrderUpdate):
        user_id = get_current_user(token)
        
        order = db.query(Order).filter(Order.id == order_id, Order.user_id == user_id).first()
        if not order:
            return ResponseHandler.not_found_error("Order", order_id)
        
        # Update status if provided
        if updated_order.status:
            order.status = updated_order.status
        
        db.commit()
        
        # Track purchase in analytics if status is changed to completed
        if updated_order.status == "completed":
            try:
                for order_item in order.order_items:
                    ProductAnalyticsService.track_purchase(db, order_item.product_id, order_item.quantity, commit=True)
            except Exception as e:
                print(f"Failed to track purchase analytics: {str(e)}")
        
        db.refresh(order)
        return ResponseHandler.update_success("Order", order.id, order)

    # Delete Order
    @staticmethod
    def delete_order(token, db: Session, order_id: int):
        user_id = get_current_user(token)
        
        order = db.query(Order).filter(Order.id == order_id, Order.user_id == user_id).first()
        if not order:
            return ResponseHandler.not_found_error("Order", order_id)
        
        # Restore product stock and analytics if order was completed
        for order_item in order.order_items:
            product = db.query(Product).filter(Product.id == order_item.product_id).first()
            if product:
                product.stock += order_item.quantity
                
                # Reverse purchase tracking if order was completed
                if order.status == "completed":
                    try:
                        from app.models.models import ProductAnalytics
                        analytics = db.query(ProductAnalytics).filter(
                            ProductAnalytics.product_id == order_item.product_id
                        ).first()
                        if analytics and analytics.purchases >= order_item.quantity:
                            analytics.purchases -= order_item.quantity
                    except Exception as e:
                        print(f"Failed to reverse purchase analytics: {str(e)}")
        
        db.delete(order)
        db.commit()
        
        return ResponseHandler.delete_success("Order", order_id, order)
