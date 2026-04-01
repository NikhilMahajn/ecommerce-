from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, Float, ARRAY, Enum
from sqlalchemy.sql.expression import text
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.orm import relationship
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, nullable=False, unique=True, autoincrement=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, server_default="True", nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)

    # New column for role
    role = Column(Enum("admin", "user", name="user_roles"), nullable=False, server_default="user")
    
    # Address field
    address = Column(String, nullable=True)

    # Relationship with carts
    carts = relationship("Cart", back_populates="user")

    # Relationship with orders
    orders = relationship("Order", back_populates="user")


class Cart(Base):
    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, nullable=False, unique=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)
    total_amount = Column(Float, nullable=False)

    # Relationship with user
    user = relationship("User", back_populates="carts")

    # Relationship with cart items
    cart_items = relationship("CartItem", back_populates="cart")


class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, nullable=False, unique=True, autoincrement=True)
    cart_id = Column(Integer, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    subtotal = Column(Float, nullable=False)

    # Relationship with cart and product
    cart = relationship("Cart", back_populates="cart_items")
    product = relationship("Product", back_populates="cart_items")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, nullable=False, unique=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)

    # Relationship with products
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, nullable=False, unique=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    discount_percentage = Column(Float, nullable=False)
    rating = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False)
    brand = Column(String, nullable=False)
    thumbnail = Column(String, nullable=False)
    images = Column(ARRAY(String), nullable=False)
    is_published = Column(Boolean, server_default="True", nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)

    # Relationship with category
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    category = relationship("Category", back_populates="products")

    # Relationship with cart items
    cart_items = relationship("CartItem", back_populates="product")

    # Relationship with order items
    order_items = relationship("OrderItem", back_populates="product")

    # Relationship with product analytics
    analytics = relationship("ProductAnalytics", back_populates="product", uselist=False, cascade="all, delete-orphan")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, nullable=False, unique=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum("pending", "processing", "completed", "cancelled", name="order_status"), nullable=False, server_default="pending")
    total_amount = Column(Float, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)

    # Relationship with user
    user = relationship("User", back_populates="orders")

    # Relationship with order items
    order_items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, nullable=False, unique=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

    # Relationship with order and product
    order = relationship("Order", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")

class ProductAnalytics(Base):
    __tablename__ = "product_analytics"

    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    views = Column(Integer, default=0, nullable=False)
    cart_adds = Column(Integer, default=0, nullable=False)
    purchases = Column(Integer, default=0, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=text("NOW()"), nullable=False)

    # Relationship with product
    product = relationship("Product", back_populates="analytics")