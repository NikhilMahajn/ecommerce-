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

