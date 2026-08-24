from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models.models import Product, Category
from app.schemas.products import ProductCreate, ProductUpdate
from app.utils.responses import ResponseHandler
from app.services.analytics import ProductAnalyticsService


class ProductService:
    @staticmethod
    def get_all_products(db: Session, page: int, limit: int, search: str = ""):
        products = db.query(Product).filter(
            Product.title.contains(search)).order_by(Product.id.asc()).offset((page - 1) * limit).limit(limit).all()
        return {"message": f"Page {page} with {limit} products", "data": products}

    @staticmethod
    def get_product(db: Session, product_id: int):
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            ResponseHandler.not_found_error("Product", product_id)
        
        # Track product view
        try:
            ProductAnalyticsService.track_view(db, product_id, commit=True)
        except Exception as e:
            # If analytics tracking fails, still return the product
            print(f"Failed to track product view: {str(e)}")
        
        return ResponseHandler.get_single_success(product.title, product_id, product)

    @staticmethod
    def create_product(db: Session, product: ProductCreate):
        category_exists = db.query(Category).filter(Category.id == product.category_id).first()
        if not category_exists:
            ResponseHandler.not_found_error("Category", product.category_id)

        product_dict = product.model_dump()
        db_product = Product(**product_dict)
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        return ResponseHandler.create_success(db_product.title, db_product.id, db_product)

    @staticmethod
    def update_product(db: Session, product_id: int, updated_product: ProductUpdate):
        db_product = db.query(Product).filter(Product.id == product_id).first()
        if not db_product:
            ResponseHandler.not_found_error("Product", product_id)

        for key, value in updated_product.model_dump().items():
            setattr(db_product, key, value)

        db.commit()
        db.refresh(db_product)
        return ResponseHandler.update_success(db_product.title, db_product.id, db_product)

    @staticmethod
    def delete_product(db: Session, product_id: int):
        db_product = db.query(Product).filter(Product.id == product_id).first()
        if not db_product:
            ResponseHandler.not_found_error("Product", product_id)
        db.delete(db_product)
        db.commit()
        return ResponseHandler.delete_success(db_product.title, db_product.id, db_product)

    #Agent Methods
    @staticmethod
    def search_products(db, query="", category=None, max_price=None, limit=10):
        q = db.query(Product)

        if query:
            words = query.strip().split()

            for word in words:
                like = f"%{word}%"
                q = q.filter(or_(
                    Product.title.ilike(like),
                    Product.description.ilike(like),
                    Product.brand.ilike(like),
                ))

        if category:
            q = q.join(Category).filter(Category.name.ilike(f"%{category}%"))

        if max_price is not None:
            q = q.filter(Product.price <= max_price)

        results =  q.order_by(Product.id.asc()).limit(limit).all()

        return {
            "count": len(results),
            "products": [
                {
                    "id": p.id,
                    "title": p.title,
                    "price": p.price,
                    "category_id": p.category_id,
                }
                for p in results
            ],
        }

    @staticmethod
    def get_product_tool(db: Session, product_id: int):
        # Deliberately NOT calling ProductService.get_product here — that method
        # tracks analytics views, which we don't want firing on every agent lookup.

        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return {"error": "not_found", "product_id": product_id}

        return {
            "id": product.id,
            "title": product.title,
            "price": product.price,
            "category_id": product.category_id,
        }

    @staticmethod
    def check_inventory(db: Session, product_id: int, quantity: int):
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return {"error": "not_found", "product_id": product_id}

        in_stock = product.stock  
        return {
            "product_id": product_id,
            "requested_quantity": quantity,
            "available": in_stock >= quantity,
            "in_stock": in_stock,
        }


    @staticmethod
    def get_related_products(db: Session, product_id: int, max_price: float | None = None, limit: int = 5) -> dict:
        """
        Simple rule-based cross-sell/upsell — no ML, no vector search. Rules,
        applied in order:
        1. Same category as the anchor product (excludes the anchor itself).
        2. In stock — checked live via check_inventory, not assumed from a
            cached count.
        3. Within max_price if given. This is what makes it budget-aware:
            pass the user's remaining budget (e.g. their stated total minus the
            price of what they just picked) and this never suggests something
            that blows it.
        4. Ranked by price proximity to the anchor (closest first) — keeps
            suggestions in the same rough tier instead of pairing a ₹500 cable
            with a ₹90,000 TV just because they share a category.
    
        Returns:
        {
            "anchor_product_id": <id>,
            "anchor_category_id": <id>,
            "products": [{"id","title","price","category_id","in_stock"}, ...],
        }
        or {"error": "..."} if the anchor product doesn't exist.
        """
        anchor = db.query(Product).filter(Product.id == product_id).first()
        if not anchor:
            return {"error": "anchor product does not exist", "products": []}
    
        query = db.query(Product).filter(
            Product.category_id == anchor.category_id,
            Product.id != anchor.id,
        )
        if max_price is not None:
            query = query.filter(Product.price <= max_price)
    
        candidates = query.all()
    
        in_stock_candidates = []
        for p in candidates:
            inv = ProductService.check_inventory(db, product_id=p.id, quantity=1)
            if inv and inv.get("available"):
                in_stock_candidates.append((p, inv.get("in_stock", 0)))
    
        in_stock_candidates.sort(key=lambda pair: abs(float(pair[0].price) - float(anchor.price)))
    
        products = []
        for product, in_stock in in_stock_candidates[:limit]:
            products.append({
                "id": product.id,
                "title": product.title,
                "price": float(product.price),
                "category_id": product.category_id,
                "in_stock": in_stock,
            })
    
        return {
            "anchor_product_id": anchor.id,
            "anchor_category_id": anchor.category_id,
            "products": products,
        }
    


