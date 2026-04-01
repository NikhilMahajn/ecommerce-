# E-Commerce Platform

A full-stack, modern e-commerce application built with Next.js and FastAPI. This platform provides a complete shopping experience with user authentication, product browsing, cart management, and order checkout functionality.

---

## 🎯 Project Overview

This e-commerce platform is a production-ready web application that enables users to:
- Browse and search for products by category
- Manage shopping carts with real-time updates
- Create accounts and authenticate securely
- Checkout and place orders
- Manage user profiles and addresses

Admin users can:
- Add and manage products
- Organize products into categories
- View and manage orders
- Track inventory

---

## 🏗️ Architecture

The application follows a **client-server architecture** with a clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Ecommerce_fe)                  │
│                   Next.js + React + TypeScript              │
│            (Browser - Port 3000)                            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST API Calls
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Ecommerce-Api)                  │
│                     FastAPI + Python                        │
│            (Server - Port 8000)                             │
└────────────────────────┬────────────────────────────────────┘
                         │ Database Queries
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

### **Frontend (Ecommerce_fe)**

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router, SSR, and API routes |
| **React 19** | UI library for building interactive components |
| **TypeScript** | Type-safe JavaScript for better code quality |
| **Tailwind CSS** | Utility-first CSS framework for styling |
| **Shadcn/ui** | Pre-built, accessible UI components |
| **React Hook Form** | Efficient form state management |
| **Zod** | Schema validation library |
| **Axios** | HTTP client for API communication |
| **Cloudinary** | Cloud-based image storage and optimization |
| **Lucide React** | Icon library |
| **Sonner** | Toast notification system |
| **pnpm** | Fast, disk space-efficient package manager |

### **Backend (Ecommerce-Api)**

| Technology | Purpose |
|------------|---------|
| **FastAPI** | Modern, fast web framework for building APIs |
| **Python 3.x** | Core backend language |
| **SQLAlchemy** | ORM for database operations |
| **Pydantic** | Data validation and serialization |
| **Alembic** | Database migration tool |
| **PostgreSQL** | Relational database |
| **psycopg2** | PostgreSQL adapter for Python |
| **python-jose** | JWT token creation and verification |
| **bcrypt** | Password hashing and verification |
| **python-multipart** | Form data parsing |
| **python-dotenv** | Environment variable management |
| **CORS Middleware** | Cross-Origin Resource Sharing support |

---

## 📁 Project Structure

```
Ecommerce/
│
├── Ecommerce_fe/                 # Frontend Application (Next.js)
│   ├── app/                       # Next.js App Router
│   │   ├── page.tsx              # Home page
│   │   ├── cart/                 # Shopping cart page
│   │   ├── product/[id]/         # Product detail page
│   │   ├── login/                # Login page
│   │   ├── signup/               # User registration
│   │   └── admin/                # Admin dashboard
│   │
│   ├── components/                # Reusable React components
│   │   ├── Navbar.tsx            # Navigation bar
│   │   ├── ProductCard.tsx       # Product display card
│   │   ├── AddProductDialog.tsx  # Admin: Add product modal
│   │   ├── AddCategoryDialog.tsx # Admin: Add category modal
│   │   ├── Toast.tsx             # Toast notifications
│   │   └── ui/                   # Shadcn/ui component library
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── use-toast.ts          # Toast hook
│   │   └── use-mobile.ts         # Mobile detection hook
│   │
│   ├── lib/                       # Utility functions and contexts
│   │   ├── apiClient.ts          # Axios API client instance
│   │   ├── AuthContext.tsx       # Authentication context
│   │   ├── types.ts              # TypeScript type definitions
│   │   └── utils.ts              # Helper functions
│   │
│   ├── public/                    # Static assets
│   ├── styles/                    # Global styles
│   ├── package.json              # Dependencies
│   ├── tsconfig.json             # TypeScript config
│   ├── tailwind.config.ts        # Tailwind CSS config
│   └── next.config.mjs           # Next.js configuration
│
├── Ecommerce-Api/                # Backend Application (FastAPI)
│   ├── app/
│   │   ├── main.py               # FastAPI app initialization
│   │   │
│   │   ├── routers/              # API route handlers
│   │   │   ├── auth.py           # Authentication endpoints
│   │   │   ├── users.py          # User management
│   │   │   ├── products.py       # Product CRUD operations
│   │   │   ├── categories.py     # Category management
│   │   │   ├── carts.py          # Shopping cart operations
│   │   │   ├── orders.py         # Order management
│   │   │   └── accounts.py       # Account settings
│   │   │
│   │   ├── models/
│   │   │   └── models.py         # SQLAlchemy ORM models
│   │   │
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # Business logic
│   │   │
│   │   ├── db/
│   │   │   └── database.py       # Database connection & session
│   │   │
│   │   ├── core/
│   │   │   ├── config.py         # Application settings
│   │   │   └── security.py       # Security utilities (JWT, passwords)
│   │   │
│   │   └── utils/                # Helper functions
│   │
│   ├── alembic/                  # Database migrations
│   │   └── versions/             # Migration files
│   │
│   ├── requirements.txt          # Python dependencies
│   ├── run.py                    # Application entry point
│   └── main.py                   # Legacy entry point
│
├── README.md                      # This file
└── ORDER_CHECKOUT_IMPLEMENTATION.md  # Detailed checkout flow documentation
```

---

## 🚀 Features

### **Customer Features**
- ✅ User registration and authentication
- ✅ Browse products by category
- ✅ View product details
- ✅ Add/remove items from cart
- ✅ Real-time cart updates
- ✅ Secure checkout with order placement
- ✅ Order history tracking
- ✅ User profile management

### **Admin Features**
- ✅ Add new products with image uploads (via Cloudinary)
- ✅ Create and manage product categories
- ✅ View all orders
- ✅ Manage product inventory
- ✅ User management

### **Security Features**
- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ Role-based access control (User/Admin)
- ✅ CORS protection
- ✅ Input validation with Pydantic
- ✅ Secure token refresh mechanism

---

## 🛠️ Getting Started

### **Prerequisites**
- Node.js 18+ (for frontend)
- Python 3.10+ (for backend)
- PostgreSQL 12+ (database)
- pnpm (frontend package manager)
- Cloudinary account (for image handling)

### **Backend Setup**

1. **Navigate to backend directory:**
   ```bash
   cd Ecommerce-Api
   ```

2. **Create and activate virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   Create a `.env` file in `Ecommerce-Api/` with:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce
   SECRET_KEY=your_secret_key_here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   ```

5. **Run database migrations:**
   ```bash
   alembic upgrade head
   ```

6. **Start the server:**
   ```bash
   python run.py
   ```
   The API will be available at `http://localhost:8000`

### **Frontend Setup**

1. **Navigate to frontend directory:**
   ```bash
   cd Ecommerce_fe
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file with:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```
   The application will be available at `http://localhost:3000`

---

## 📡 API Documentation

Once the backend is running, access the interactive API documentation:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

### **Main API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | User registration |
| POST | `/auth/login` | User login |
| GET | `/products` | List all products |
| GET | `/products/{id}` | Get product details |
| GET | `/categories` | List all categories |
| POST | `/cart/add` | Add item to cart |
| GET | `/cart` | Get cart items |
| POST | `/orders` | Create new order |
| GET | `/orders` | Get user orders |
| POST | `/admin/products` | Add new product (admin) |
| POST | `/admin/categories` | Add new category (admin) |

---

## 🔄 Key Workflows

### **Authentication Flow**
1. User registers with email and password
2. Password is hashed using bcrypt
3. User receives JWT access and refresh tokens
4. Tokens are stored in localStorage on frontend
5. All subsequent requests include JWT in Authorization header

### **Shopping Flow**
1. User browses products by category
2. Adds items to cart (stored in context/state)
3. Views cart summary with pricing
4. Enters delivery address
5. Clicks checkout to create order
6. Order is saved to database
7. Cart is cleared after successful order

For detailed checkout implementation, see [ORDER_CHECKOUT_IMPLEMENTATION.md](ORDER_CHECKOUT_IMPLEMENTATION.md)

---

## 🗄️ Database Schema

The application uses **PostgreSQL** with the following main tables:
- `users` - User accounts and profiles
- `products` - Product information
- `categories` - Product categories
- `carts` - Shopping cart items
- `orders` - Order records
- `order_items` - Items within each order

All tables include timestamps (`created_at`, `updated_at`) for audit trails.

---

## 📝 Development Guidelines

### **Frontend**
- Use TypeScript for type safety
- Follow React best practices with hooks
- Use Tailwind CSS for styling
- Implement proper error handling with toast notifications
- Validate user input with React Hook Form + Zod

### **Backend**
- Follow FastAPI best practices
- Use type hints with Python
- Implement proper exception handling
- Validate input with Pydantic
- Use SQLAlchemy for database operations
- Create database migrations for schema changes

---

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add some amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

---

## 📄 License

This project is open source and available under the MIT License.

---

## 📧 Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Last Updated:** April 2026
**Version:** 1.0.0
