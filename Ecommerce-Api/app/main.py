from app.routers import products, categories, carts, users, auth, accounts, orders, analytics, pricing, admin
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.workers.pricing_worker import start_pricing_worker, stop_pricing_worker
import logging

logger = logging.getLogger(__name__)



description = """
Welcome to the E-commerce API! 🚀

This API provides a comprehensive set of functionalities for managing your e-commerce platform.

Key features include:

- **Crud**
	- Create, Read, Update, and Delete endpoints.
- **Search**
	- Find specific information with parameters and pagination.
- **Auth**
	- Verify user/system identity.
	- Secure with Access and Refresh tokens.
- **Permission**
	- Assign roles with specific permissions.
	- Different access levels for User/Admin.
- **Validation**
	- Ensure accurate and secure input data.


For any inquiries, please contact:

* Github: https://github.com/aliseyedi01
"""


app = FastAPI(
    description=description,
    title="E-commerce API",
    version="1.0.0",
    swagger_ui_parameters={
        "syntaxHighlight.theme": "monokai",
        "layout": "BaseLayout",
        "filter": True,
        "tryItOutEnabled": True,
        "onComplete": "Ok"
    },
)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://ecommerce-delta-bice-74.vercel.app/"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(categories.router)
app.include_router(carts.router)
app.include_router(users.router)
app.include_router(accounts.router)
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(analytics.router)
app.include_router(pricing.router)
app.include_router(admin.router)


# Startup event - start background workers
@app.on_event("startup")
async def startup_event():
    """Start background workers on application startup"""
    logger.info("Starting background workers")
    start_pricing_worker()


# Shutdown event - stop background workers
@app.on_event("shutdown")
async def shutdown_event():
    """Stop background workers on application shutdown"""
    logger.info("Stopping background workers")
    stop_pricing_worker()

