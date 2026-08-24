# E-Commerce Platform

A full-stack, modern e-commerce application built with **Next.js** and **FastAPI**. It provides a complete shopping experience — user authentication, product browsing, cart management, order checkout — plus an **AI shopping assistant**, **dynamic pricing**, and **product analytics**.

---

## 🎯 Project Overview

This platform is a production-style web application where users can:

- Browse and search for products by category
- Chat with an AI shopping assistant that searches the real catalog and manages the cart
- Manage a shopping cart with real-time updates
- Create accounts and authenticate securely (JWT)
- Checkout and place orders
- Manage user profiles

Admin users can:

- Add and manage products (with Cloudinary image uploads)
- Organize products into categories
- View and manage orders
- Track product analytics (views, cart adds, purchases)
- Let a background worker adjust prices dynamically every hour

---

## 🏗️ Architecture

Client–server architecture with a clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Ecommerce_fe)                  │
│                   Next.js + React + TypeScript              │
│                     (Browser - Port 3000)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / REST API Calls
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Ecommerce-Api)                  │
│                     FastAPI + Python                        │
│                     (Server - Port 8000)                    │
│                                                             │
│  ┌───────────────────┐   ┌──────────────────────────────┐   │
│  │ Pricing Worker    │   │ AI Agent (Groq tool calling) │   │
│  │ (APScheduler,     │   │ search / inventory / cart    │   │
│  │  hourly job)      │   │ tools + chat history         │   │
│  └───────────────────┘   └──────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ Database Queries
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Tech Stack

### Frontend (`Ecommerce_fe`)

| Technology          | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| **Next.js 16**      | React framework with App Router                      |
| **React 19**        | UI library for building interactive components       |
| **TypeScript**      | Type-safe JavaScript                                 |
| **Tailwind CSS 4**  | Utility-first CSS framework                          |
| **shadcn/ui**       | Pre-built, accessible UI components                  |
| **React Hook Form** | Efficient form state management                      |
| **Zod**             | Schema validation                                    |
| **Cloudinary**      | Cloud-based image storage and optimization           |
| **Sonner**          | Toast notification system                            |
| **pnpm**            | Fast, disk space-efficient package manager           |

### Backend (`Ecommerce-Api`)

| Technology            | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| **FastAPI**           | Modern, fast web framework for building APIs       |
| **SQLAlchemy 2**      | ORM for database operations                        |
| **Pydantic v2**       | Data validation and settings management            |
| **Alembic**           | Database migrations                                |
| **PostgreSQL**        | Relational database                                |
| **python-jose**       | JWT token creation and verification                |
| **bcrypt / passlib**  | Password hashing                                   |
| **APScheduler**       | Background scheduler for the pricing worker        |
| **Groq SDK**          | LLM-powered shopping assistant & dynamic pricing   |
| **Uvicorn**           | ASGI server                                        |

---

## 📁 Project Structure

```
Ecommerce/
│
├── Ecommerce_fe/                 # Frontend Application (Next.js)
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Home page
│   │   ├── cart/                 # Shopping cart page
│   │   ├── product/[id]/         # Product detail page
│   │   ├── login/                # Login page
│   │   ├── signup/               # User registration
│   │   └── admin/                # Admin dashboard
│   ├── components/               # Reusable React components + shadcn/ui library
│   ├── hooks/                    # Custom React hooks
│   ├── lib/                      # API client, auth context, types, utils
│   ├── public/                   # Static assets
│   └── styles/                   # Global styles
│
├── Ecommerce-Api/                # Backend Application (FastAPI)
│   ├── app/
│   │   ├── main.py               # FastAPI app initialization & router wiring
│   │   ├── routers/              # Route handlers
│   │   │   ├── auth.py           # Authentication endpoints
│   │   │   ├── users.py          # User management (admin)
│   │   │   ├── accounts.py       # Self-service account management
│   │   │   ├── products.py       # Product CRUD
│   │   │   ├── categories.py     # Category management
│   │   │   ├── carts.py          # Shopping cart operations
│   │   │   ├── orders.py         # Order management
│   │   │   ├── admin.py          # Admin dashboard endpoints
│   │   │   ├── analytics.py      # Product analytics
│   │   │   ├── agent.py          # AI shopping assistant
│   │   │   ├── chatHistory.py    # Agent conversation history
│   │   │   └── pricing.py        # Dynamic pricing endpoints
│   │   ├── services/             # Business logic layer
│   │   ├── workers/
│   │   │   └── pricing_worker.py # APScheduler job (hourly price updates)
│   │   ├── models/models.py      # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── db/database.py        # Database connection & session
│   │   ├── core/                 # Config (settings) + security (JWT, hashing)
│   │   └── utils/                # Helper functions
│   ├── alembic/versions/         # Migration files
│   ├── requirements.txt
│   ├── run.py                    # Dev server entry point
│   ├── Dockerfile
│   └── render.yaml               # Render.com deployment config
│
└── README.md
```

---

## 🚀 Features

### Customer Features

- ✅ User registration and authentication (JWT access + refresh tokens)
- ✅ Browse products by category, view product details
- ✅ Add/remove/update items in the cart
- ✅ Secure checkout with order placement
- ✅ Order history tracking
- ✅ Profile management
- ✅ **AI shopping assistant**: grounded in the live catalog via tool calls (`search_products`, `get_product`, `check_inventory`, `add_to_cart`, …), with persisted chat history

### Admin Features

- ✅ Add new products with image uploads (Cloudinary)
- ✅ Create and manage product categories
- ✅ User management
- ✅ View orders and manage inventory
- ✅ Product analytics: views, cart adds, purchases; top products; overall summary

### Automation & Intelligence

- ✅ **Dynamic pricing worker**: APScheduler background job that re-prices products hourly using the Groq LLM
- ✅ Manual price-update trigger endpoint for testing/admin use

### Security

- ✅ JWT-based authentication with refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Role-based access control (User/Admin)
- ✅ CORS protection
- ✅ Input validation with Pydantic

---

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Python 3.10+
- PostgreSQL 12+
- A [Groq](https://console.groq.com) API key (AI assistant + dynamic pricing)
- A [Cloudinary](https://cloudinary.com) account (product images)

### Backend Setup

1. Navigate to the backend directory and create a virtual environment:

   ```bash
   cd Ecommerce-Api
   python3 -m venv venv
   source venv/bin/activate   # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file in `Ecommerce-Api/`:

   ```env
   # Database
   db_username=postgres
   db_password=your_password
   db_hostname=localhost
   db_port=5432
   db_name=ecommerce

   # JWT
   secret_key=your_secret_key_here
   algorithm=HS256
   access_token_expire_minutes=30

   # Groq / AI
   GROQ_API_KEY=your_groq_api_key
   MODEL=llama-3.3-70b-versatile
   MAX_TOOL_ITERATIONS=5
   ```

4. Run database migrations and start the dev server:

   ```bash
   alembic upgrade head
   python run.py
   ```

   The API is now available at `http://localhost:8000`.

### Frontend Setup

1. Navigate to the frontend directory and install dependencies:

   ```bash
   cd Ecommerce_fe
   pnpm install
   ```

2. Configure environment variables (`.env.local`):

   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   NEXT_PUBLIC_CLOUDINARY_API_KEY=your_cloudinary_api_key
   NEXT_PUBLIC_CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   ```

3. Start the development server:

   ```bash
   pnpm dev
   ```

   The app is available at `http://localhost:3000`.

### Docker (Backend)

The backend ships with a `Dockerfile` and a `render.yaml` for one-click deployment on Render.com.

---

## 📡 API Documentation

Once the backend is running:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

### Main Endpoints

| Method | Endpoint                        | Description                        | Access |
| ------ | ------------------------------- | ---------------------------------- | ------ |
| POST   | `/auth/signup`                  | Register a new user                | Public |
| POST   | `/auth/login`                   | Login, get access/refresh tokens   | Public |
| POST   | `/auth/refresh`                 | Refresh access token               | Public |
| GET    | `/products/`                    | List / search products             | User   |
| GET    | `/products/{id}`                | Product details                    | User   |
| GET    | `/categories/`                  | List categories                    | User   |
| GET    | `/carts/mycart`                 | Get current user's cart            | User   |
| POST   | `/orders/`                      | Place an order from the cart       | User   |
| GET    | `/account/`                     | Get authenticated user's account   | User   |
| POST   | `/agent/chat`                   | Chat with the AI shopping assistant| User   |
| GET    | `/chatHistory/`                 | Retrieve agent conversation history| User   |
| POST   | `/pricing/update`               | Trigger dynamic price update       | Admin  |
| GET    | `/analytics/products/{id}`      | Per-product analytics              | User   |
| GET    | `/analytics/top-products`       | Top products by metric             | Admin  |
| GET    | `/analytics/summary`            | Overall analytics summary          | Admin  |

> See `/docs` for the complete, always up-to-date endpoint list.

---

## 🔄 Key Workflows

### Authentication Flow

1. User registers with email and password
2. Password is hashed with bcrypt
3. Server issues JWT access + refresh tokens
4. Requests include the JWT in the `Authorization` header

### Shopping Flow

1. User browses products by category
2. Items are added to a persistent server-side cart
3. At checkout, the user provides delivery details
4. An order is created from the cart and the cart is cleared

### AI Assistant Flow

1. User sends a message to `/agent/chat`
2. The Groq-hosted LLM decides which tools to call (search products, check inventory, add to cart…)
3. Tool results ground every recommendation — the assistant only recommends products that actually exist in the catalog with real prices/stock
4. Conversations are persisted per user in `chat_history`

### Dynamic Pricing Flow

1. Every hour, APScheduler fires the pricing worker
2. The worker feeds sales/inventory data to the Groq model
3. Suggested prices are validated and written back to the database

---

## 🗄️ Database Schema

Main tables (managed via Alembic migrations):

- `users` — user accounts, roles, addresses
- `products` — product info, price, stock
- `categories` — product categories
- `carts` / `cart_items` — shopping carts
- `orders` / `order_items` — orders and their line items
- `chat_history` — AI assistant conversations
- Product analytics columns — views, cart adds, purchases

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the MIT License.
