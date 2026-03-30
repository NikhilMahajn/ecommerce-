export interface User {
  id: string
  email: string
  full_name: string
  role: 'user' | 'admin'
  createdAt: string
}

export interface Category {
  id: string
  name: string
  slug: string
  image?: string
}

export interface Product {
  id: string
  title: string
  slug: string
  description: string
  price: number
  image: string
  gallery: string[]
  category_id: string
  category: Category
  specs: Record<string, string>
  stock: boolean
  rating: number
  reviews: number
  createdAt: string
}

export interface CartItem {
  productId: string
  product: Product
  quantity: number
}

export interface Cart {
  items: CartItem[]
  total: number
}

export interface Order {
  id: string
  userId: string
  items: CartItem[]
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered'
  createdAt: string
}

export interface AuthResponse {
  message: string
  data?: {
    user: User
    token: string
  }
  error?: string
}

export interface ApiResponse<T = any> {
  message: string
  data?: T
  error?: string
}
