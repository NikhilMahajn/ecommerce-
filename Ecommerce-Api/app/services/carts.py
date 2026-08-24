from sqlalchemy.orm import Session
from app.models.models import Cart, CartItem, Product
from app.schemas.carts import CartUpdate, CartCreate
from app.utils.responses import ResponseHandler
from sqlalchemy.orm import joinedload
from app.core.security import get_current_user
from app.services.analytics import ProductAnalyticsService
from app.services.products import ProductService

class CartService:
    # Get All Carts
    @staticmethod
    def get_all_carts(token, db: Session, page: int, limit: int):
        user_id = get_current_user(token)
        carts = db.query(Cart).filter(Cart.user_id == user_id).offset((page - 1) * limit).limit(limit).all()
        message = f"Page {page} with {limit} carts"
        return ResponseHandler.success(message, carts)

    # Get A Cart By ID
    @staticmethod
    def get_cart(token, db: Session, cart_id: int):
        user_id = get_current_user(token)
        cart = db.query(Cart).filter(Cart.id == cart_id, Cart.user_id == user_id).first()
        if not cart:
            ResponseHandler.not_found_error("Cart", cart_id)
        return ResponseHandler.get_single_success("cart", cart_id, cart)

    # Create a new Cart
    @staticmethod
    def create_cart(token, db: Session, cart: CartCreate):
        user_id = get_current_user(token)
        cart_dict = cart.model_dump()

        cart_items_data = cart_dict.pop("cart_items", [])
        
        # Consolidate duplicate products by product_id
        products_map = {}
        for item_data in cart_items_data:
            product_id = item_data['product_id']
            quantity = item_data['quantity']
            
            if product_id in products_map:
                products_map[product_id] += quantity
            else:
                products_map[product_id] = quantity
        
        cart_items = []
        total_amount = 0
        for product_id, quantity in products_map.items():
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                return ResponseHandler.not_found_error("Product", product_id)

            subtotal = quantity * product.price * (1 - product.discount_percentage / 100)
            cart_item = CartItem(product_id=product_id, quantity=quantity, subtotal=subtotal)
            total_amount += subtotal

            cart_items.append(cart_item)
        
        cart_db = Cart(cart_items=cart_items, user_id=user_id, total_amount=total_amount, **cart_dict)
        db.add(cart_db)
        db.commit()
        db.refresh(cart_db)
        
        # Track cart additions in analytics after main transaction completes
        for product_id, quantity in products_map.items():
            try:
                ProductAnalyticsService.track_cart_add(db, product_id, quantity, commit=True)
            except Exception as e:
                print(f"Failed to track cart addition for product {product_id}: {str(e)}")
        
        return ResponseHandler.create_success("Cart", cart_db.id, cart_db)

    # Update Cart & CartItem
    @staticmethod
    def update_cart(token, db: Session, cart_id: int, updated_cart: CartUpdate):
        user_id = get_current_user(token)

        cart = db.query(Cart).filter(Cart.id == cart_id, Cart.user_id == user_id).first()
        if not cart:
            return ResponseHandler.not_found_error("Cart", cart_id)

        # Consolidate duplicate products by product_id
        products_map = {}
        for item in updated_cart.cart_items:
            product_id = item.product_id
            quantity = item.quantity
            
            if product_id in products_map:
                products_map[product_id] += quantity
            else:
                products_map[product_id] = quantity

        # Delete existing cart_items
        db.query(CartItem).filter(CartItem.cart_id == cart_id).delete()

        total_amount = 0
        for product_id, quantity in products_map.items():
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                return ResponseHandler.not_found_error("Product", product_id)

            subtotal = quantity * product.price * (1 - product.discount_percentage / 100)

            cart_item = CartItem(
                cart_id=cart_id,
                product_id=product_id,
                quantity=quantity,
                subtotal=subtotal
            )
            db.add(cart_item)
            total_amount += subtotal

        cart.total_amount = total_amount
        db.commit()

        # Track cart addition in analytics after main transaction completes
        for product_id, quantity in products_map.items():
            try:
                ProductAnalyticsService.track_cart_add(db, product_id, quantity, commit=True)
            except Exception as e:
                print(f"Failed to track cart addition for product {product_id}: {str(e)}")

        db.refresh(cart)
        return ResponseHandler.update_success("cart", cart.id, cart)

    # Delete Both Cart and CartItems
    @staticmethod
    def delete_cart(token, db: Session, cart_id: int):
        user_id = get_current_user(token)
        cart = (
            db.query(Cart)
            .options(joinedload(Cart.cart_items).joinedload(CartItem.product))
            .filter(Cart.id == cart_id, Cart.user_id == user_id)
            .first()
        )
        if not cart:
            ResponseHandler.not_found_error("Cart", cart_id)

        for cart_item in cart.cart_items:
            db.delete(cart_item)

        db.delete(cart)
        db.commit()
        return ResponseHandler.delete_success("Cart", cart_id, cart)


    @staticmethod
    def validate_cart(db: Session, items: list[dict]) -> tuple[list[dict], list[dict]]:
        """
        Checks each proposed {product_id, quantity} pair against the database.
        Returns (valid_items, errors):
        valid_items: [{"product_id", "quantity", "product": <Product row>}]
        errors:      [{"product_id", "error": "..."}]
    
        Only product_id/quantity are read from `items` — anything else the
        caller (or the LLM) might have included (a price, a name) is ignored.
        Existence and stock are always looked up fresh here.
        """
        valid_items: list[dict] = []
        errors: list[dict] = []
    
        for item in items or []:
            product_id = item.get("product_id")
            quantity = item.get("quantity")
    
            if not isinstance(product_id, int):
                errors.append({"product_id": product_id, "error": "invalid product_id"})
                continue
            if not isinstance(quantity, int) or quantity <= 0:
                errors.append({"product_id": product_id, "error": "quantity must be a positive integer"})
                continue
    
            product = db.query(Product).filter(Product.id == product_id).first()
            if not product:
                errors.append({"product_id": product_id, "error": "product does not exist"})
                continue
    
            inventory = ProductService.check_inventory(db, product_id=product_id, quantity=quantity)
            if not inventory or not inventory.get("available"):
                in_stock = inventory.get("in_stock") if inventory else 0
                errors.append({
                    "product_id": product_id,
                    "error": f"only {in_stock} in stock, requested {quantity}",
                })
                continue
    
            valid_items.append({"product_id": product_id, "quantity": quantity, "product": product})
    
        return valid_items, errors
    
    
    @staticmethod
    def calculate_cart(db: Session, items: list[dict]) -> dict:
        """
        PURE calculation — the ONLY place a total is computed for the agent
        flow. Uses the exact same pricing formula as create_cart/update_cart
        (quantity * price * (1 - discount_percentage/100)), so what the agent
        quotes always matches what a real cart would charge. No value in the
        output comes from anywhere except a fresh Product lookup done here.
    
        Returns:
        {
            "line_items": [{"product_id","name","unit_price","discount_percentage",
                            "quantity","subtotal"}],
            "subtotal": <sum of line subtotals>,
            "total_amount": <same as subtotal — kept as its own key so
                            shipping/tax can be layered in later without
                            changing this function's contract>,
            "errors": [{"product_id","error"}, ...]  # invalid lines, skipped
        }
        """
        valid_items, errors = CartService.validate_cart(db, items)
    
        line_items = []
        subtotal_total = 0.0
        for entry in valid_items:
            product = entry["product"]
            quantity = entry["quantity"]
            unit_price = float(product.price)
            discount_pct = float(product.discount_percentage or 0)
            line_subtotal = round(quantity * unit_price * (1 - discount_pct / 100), 2)
            subtotal_total = round(subtotal_total + line_subtotal, 2)
    
            line_items.append({
                "product_id": product.id,
                "name": getattr(product, "title", None) or getattr(product, "name", None),
                "unit_price": unit_price,
                "discount_percentage": discount_pct,
                "quantity": quantity,
                "subtotal": line_subtotal,
            })
    
        return {
            "line_items": line_items,
            "subtotal": subtotal_total,
            "total_amount": subtotal_total,
            "errors": errors,
        }
    
