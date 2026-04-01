# Order Checkout Implementation - Complete Flow

## ✅ System Status: FULLY IMPLEMENTED

### Frontend - Order Checkout Flow (Next.js/React)

**File:** [Ecommerce_fe/app/cart/page.tsx](Ecommerce_fe/app/cart/page.tsx)

#### 1. **Cart Page Components**

- Shopping cart display with product details
- Quantity adjustment controls
- Item removal functionality
- Real-time cart updates

#### 2. **Order Summary Section**

- Displays subtotal
- Shows shipping (Free)
- Displays total amount
- All calculations performed in real-time

#### 3. **Delivery Address Management**

- Address input textarea
- Save address button
- Address validation before checkout

#### 4. **Checkout Handler** - `handleCheckout()`

```typescript
async handleCheckout() {
  // 1. Validates cart is not empty
  // 2. Validates delivery address is provided
  // 3. Prepares order items from cart
  // 4. Calls API to create order: apiClient.createOrder(order_items)
  // 5. Clears cart after successful order
  // 6. Redirects to home page
  // 7. Shows success toast notification
}
```

**API Client Method:**

```typescript
async createOrder(order_items: Array<{
  product_id: string | number;
  quantity: number
}>) {
  return this.request('/orders', {
    method: 'POST',
    body: JSON.stringify({ order_items }),
  })
}
```

---

### Backend - Order Processing (Python/FastAPI)

#### 1. **Order Router** - [app/routers/orders.py](../../Ecommerce-Api/app/routers/orders.py)

- POST `/orders` - Creates new order
- GET `/orders` - Retrieves user's orders
- GET `/orders/{id}` - Gets specific order details
- PUT `/orders/{id}` - Updates order status
- DELETE `/orders/{id}` - Cancels order (restores stock)

#### 2. **Order Service** - [app/services/orders.py](../../Ecommerce-Api/app/services/orders.py)

**`create_order()` implementation:**

```python
1. Extracts user from JWT token
2. Validates all products exist
3. Checks stock availability for each item
4. Calculates price with discount applied:
   - price = product.price * (1 - discount_percentage / 100)
   - subtotal = price * quantity
5. Creates OrderItem entries with calculated prices
6. Reduces product stock by ordered quantity
7. Creates Order with "pending" status
8. Commits to database
9. Returns created order with all details
```

#### 3. **Database Models**

**Order Model** - [app/models/models.py](../../Ecommerce-Api/app/models/models.py#L98)

```python
- id: Integer (Primary Key)
- user_id: Integer (Foreign Key → users.id)
- status: Enum (pending|processing|completed|cancelled)
- total_amount: Float
- created_at: Timestamp
- updated_at: Timestamp
- Relationships: user, order_items
```

**OrderItem Model** - [app/models/models.py](../../Ecommerce-Api/app/models/models.py#L115)

```python
- id: Integer (Primary Key)
- order_id: Integer (Foreign Key → orders.id)
- product_id: Integer (Foreign Key → products.id)
- quantity: Integer
- price: Float (price with discount applied)
- subtotal: Float (price * quantity)
- Relationships: order, product
```

#### 4. **Schemas** - [app/schemas/orders.py](../../Ecommerce-Api/app/schemas/orders.py)

```python
OrderCreate: { order_items: List[OrderItemCreate] }
OrderItemCreate: { product_id: int, quantity: int }
OrderOut: Complete order with all details
OrdersOutList: Paginated list of orders
```

---

## 🔄 Complete Order Checkout Flow

### Step-by-Step Process

```
1. USER ACTION: Clicks "Proceed to Checkout"
   └─ Validation: Cart has items, address provided

2. FRONTEND: Calls apiClient.createOrder(order_items)
   └─ Sends POST request to /orders
   └─ Data: { order_items: [{product_id, quantity}, ...] }

3. BACKEND: OrderService.create_order(token, db, order)
   ├─ Extracts user_id from JWT token
   ├─ For each order item:
   │  ├─ Validates product exists
   │  ├─ Validates stock availability
   │  ├─ Calculates discounted price
   │  ├─ Creates OrderItem record
   │  └─ Reduces product stock
   ├─ Creates Order with status="pending"
   └─ Commits all changes to database

4. RESPONSE: Returns created Order object with:
   └─ Order ID
   └─ All order items with prices
   └─ Total amount
   └─ Status: "pending"
   └─ Created timestamp

5. FRONTEND: On success:
   ├─ Shows success toast: "Order placed successfully!"
   ├─ Calls apiClient.deleteCart(cart.id)
   ├─ Waits 1.5 seconds
   └─ Redirects to home (/)`

6. PRODUCT INVENTORY:
   └─ Stock automatically reduced for each product ordered

7. ORDER STATUS:
   └─ Admin can update status: pending → processing → completed
```

---

## 📊 Features Implemented

### ✅ Order Creation

- [x] Accept order items with product_id and quantity
- [x] Validate product availability
- [x] Apply discount pricing
- [x] Calculate subtotals and order total
- [x] Create order records with pending status

### ✅ Inventory Management

- [x] Reduce stock when order is placed
- [x] Restore stock if order is cancelled
- [x] Validate sufficient stock before creating order

### ✅ User Association

- [x] Link orders to authenticated user via JWT token
- [x] User can only see their own orders
- [x] Secure order creation endpoint

### ✅ Price Calculation

- [x] Apply product discount percentages
- [x] Calculate item subtotals
- [x] Calculate order total_amount

### ✅ Cart Management

- [x] Clear cart after successful order
- [x] Prevent checkout with empty cart
- [x] Require delivery address

### ✅ Error Handling

- [x] Toast notifications for errors
- [x] Insufficient stock validation
- [x] Missing product validation
- [x] Address validation

---

## 🧪 Testing the Checkout Flow

### Prerequisites

- Backend API running: `python3 run.py` (Port 8000)
- Frontend: `npm run dev` (Port 3000)
- Database migrations applied: `alembic upgrade head`

### Manual Test Steps

1. **Login/Register**
   - Create user account or login with existing credentials

2. **Browse Products**
   - Navigate to home page
   - View available products

3. **Add to Cart**
   - Click "Add to Cart" on any product
   - Select quantity

4. **View Cart**
   - Navigate to `/cart`
   - Verify items are listed with correct prices and discounts

5. **Enter Address**
   - Fill in delivery address field
   - Click "Save Address"
   - Verify success toast

6. **Place Order**
   - Click "Proceed to Checkout"
   - Verify:
     - Success toast appears: "Order placed successfully!"
     - Cart is cleared
     - Redirected to home page
     - Stock is reduced for ordered products

7. **Verify Order Creation (Backend)**
   - Check database: `SELECT * FROM orders WHERE user_id = <user_id>;`
   - Check order items: `SELECT * FROM order_items WHERE order_id = <order_id>;`
   - Check product stock: `SELECT id, stock FROM products;`

### Curl Test (Backend Only)

```bash
# Create order (requires valid JWT token)
curl -X POST http://127.0.0.1:8000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "order_items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 3, "quantity": 1}
    ]
  }'

# Get orders
curl -X GET http://127.0.0.1:8000/orders \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Get specific order
curl -X GET http://127.0.0.1:8000/orders/1 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## 📝 API Endpoints Summary

| Method | Endpoint       | Purpose             | Auth Required |
| ------ | -------------- | ------------------- | ------------- |
| POST   | `/orders`      | Create new order    | ✅ Yes        |
| GET    | `/orders`      | List user's orders  | ✅ Yes        |
| GET    | `/orders/{id}` | Get order details   | ✅ Yes        |
| PUT    | `/orders/{id}` | Update order status | ✅ Yes        |
| DELETE | `/orders/{id}` | Cancel order        | ✅ Yes        |

---

## 🎯 Order Workflow Status

| Component            | Status      | File                                   |
| -------------------- | ----------- | -------------------------------------- |
| Frontend Checkout UI | ✅ Complete | `Ecommerce_fe/app/cart/page.tsx`       |
| Order API Client     | ✅ Complete | `Ecommerce_fe/lib/apiClient.ts`        |
| Backend Router       | ✅ Complete | `Ecommerce-Api/app/routers/orders.py`  |
| Order Service        | ✅ Complete | `Ecommerce-Api/app/services/orders.py` |
| Database Models      | ✅ Complete | `Ecommerce-Api/app/models/models.py`   |
| Order Schemas        | ✅ Complete | `Ecommerce-Api/app/schemas/orders.py`  |
| Stock Management     | ✅ Complete | Integrated in OrderService             |
| Discount Pricing     | ✅ Complete | Integrated in OrderService             |

---

## 🚀 Ready for Production

The order checkout and product purchase simulation system is **fully implemented and ready to use**. Users can:

- ✅ Add products to cart
- ✅ Review cart with prices and discounts
- ✅ Enter delivery address
- ✅ Place order with one click
- ✅ See order confirmation
- ✅ Inventory automatically managed
- ✅ Orders saved to database with pending status
