import { ApiResponse, AuthResponse } from './types'

const API_BASE = 'http://127.0.0.1:8000'

class ApiClient {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  getToken() {
    return this.token
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE}${endpoint}`
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    } else if (['/products', '/categories', '/orders'].some(p => endpoint.startsWith(p)) && endpoint !== '/products' && endpoint !== '/categories') {
      console.warn(`[API] Missing token for protected endpoint: ${endpoint}`)
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        return {
          message: error.message || 'Request failed',
          error: error.error || error.detail || response.statusText,
        }
      }

      const data = await response.json()
      return data
    } catch (error) {
      return {
        message: 'Network error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const formData = new URLSearchParams()
    formData.append("username", username)
    formData.append("password", password)

    return this.request<AuthResponse>("/auth/login", {
      method: 'POST',
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    })
  }

  async signup(email: string, password: string, full_name: string, username: string) {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, username }),
    })
  }

  async getProfile() {
    return this.request('/auth/profile')
  }

  async getMe() {
    return this.request('/me/')
  }

  // Products endpoints
  async getProducts(params?: {
    page?: number
    limit?: number
    search?: string
    categoryId?: string
    sort?: string
  }) {
    const query = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, String(value))
      })
    }
    return this.request(`/products?${query.toString()}`)
  }

  async getProduct(id: string) {
    return this.request(`/products/${id}`)
  }

  async createProduct(data: any) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProduct(id: string, data: any) {
    return this.request(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteProduct(id: string) {
    return this.request(`/products/${id}`, {
      method: 'DELETE',
    })
  }

  // Categories endpoints
  async getCategories() {
    return this.request('/categories')
  }

  async createCategory(data: any) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Cart endpoints
  async addToCart(cartItems: Array<{ product_id: string; quantity: number }>) {
    return this.request('/carts', {
      method: 'POST',
      body: JSON.stringify({ cart_items: cartItems }),
    })
  }

  async getCart(params?: {
    page?: number
    limit?: number
  }) {
    const query = new URLSearchParams()
    if (params) {
      if (params.page !== undefined) query.append('page', String(params.page))
      if (params.limit !== undefined) query.append('limit', String(params.limit))
    }
    return this.request(`/carts?${query.toString()}`)
  }

  async updateCart(cartId: string | number, cartItems: Array<{ product_id: string; quantity: number }>) {
    return this.request(`/carts/${cartId}`, {
      method: 'PUT',
      body: JSON.stringify({ cart_items: cartItems }),
    })
  }

  async deleteCart(cartId: string | number) {
    return this.request(`/carts/${cartId}`, {
      method: 'DELETE',
    })
  }

  async deleteFromCart(productId: string) {
    return this.request(`/carts/${productId}`, {
      method: 'DELETE',
    })
  }

  // Orders endpoints
  async createOrder(items: any[]) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
  }

  async getOrders() {
    return this.request('/orders')
  }

  async getOrder(id: string) {
    return this.request(`/orders/${id}`)
  }
}

export const apiClient = new ApiClient()
