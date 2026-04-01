from fastapi import APIRouter, Depends, Query, status
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from app.db.database import get_db
from app.services.orders import OrderService
from sqlalchemy.orm import Session
from app.schemas.orders import OrderCreate, OrderUpdate, OrderOut, OrderOutDelete, OrdersOutList

router = APIRouter(tags=["Orders"], prefix="/orders")
auth_scheme = HTTPBearer()


# Get All Orders for Current User
@router.get("/", status_code=status.HTTP_200_OK, response_model=OrdersOutList)
def get_all_orders(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    token: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    return OrderService.get_all_orders(token, db, page, limit)


# Get Order By ID
@router.get("/{order_id}", status_code=status.HTTP_200_OK, response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    return OrderService.get_order(token, db, order_id)


# Create New Order
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=OrderOut)
def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    return OrderService.create_order(token, db, order)


# Update Order Status
@router.put("/{order_id}", status_code=status.HTTP_200_OK, response_model=OrderOut)
def update_order(
    order_id: int,
    updated_order: OrderUpdate,
    db: Session = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    return OrderService.update_order(token, db, order_id, updated_order)


# Delete Order
@router.delete("/{order_id}", status_code=status.HTTP_200_OK, response_model=OrderOutDelete)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    token: HTTPAuthorizationCredentials = Depends(auth_scheme)
):
    return OrderService.delete_order(token, db, order_id)

