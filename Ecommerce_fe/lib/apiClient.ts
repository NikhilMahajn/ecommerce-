import { ApiResponse, AuthResponse } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL

type LogoutCallback = () => void
let logoutCallback: LogoutCallback | null = null

export function setLogoutCallback(cb: LogoutCallback) {
  logoutCallback = cb
}

class ApiClient {
  private token: string | null = null
  private refreshToken: string | null = null
  private isRefreshing = false
  private refreshSubscribers: ((token: string) => void)[] = []

  setToken(token: string | null) {
    this.token = token
  }

  setRefreshToken(token: string | null) {
    this.refreshToken = token
  }

  getToken() {
    return this.token
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach(cb => cb(token))
    this.refreshSubscribers = []
  }

  private subscribeToRefresh(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback)
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.subscribeToRefresh(() => {
          resolve(!!this.token)
        })
      })
    }

    this.isRefreshing = true
    try {
      if (!this.refreshToken) {
        console.error('[API] No refresh token available')
        logoutCallback?.()
        return false
      }

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'refresh_token': this.refreshToken,
        },
      })

      if (!response.ok) {
        console.error('[API] Token refresh failed')
        logoutCallback?.()
        return false
      }

      const data = await response.json()
      const newToken = data.data?.access_token || data.access_token

      if (newToken) {
        this.setToken(newToken)
        localStorage.setItem('auth_token', newToken)
        this.onRefreshed(newToken)
        return true
      }

      return false
    } catch (error) {
      console.error('[API] Token refresh error:', error)
      logoutCallback?.()
      return false
    } finally {
      this.isRefreshing = false
    }
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
      let response = await fetch(url, {
        ...options,
        headers,
      })

      // If we get 401, try to refresh token and retry
      if (response.status === 401 && this.refreshToken) {
        console.log('[API] Got 401, attempting token refresh...')
        const refreshed = await this.refreshAccessToken()
        
        if (refreshed && this.token) {
          console.log('[API] Token refreshed, retrying request...')
          headers['Authorization'] = `Bearer ${this.token}`
          response = await fetch(url, {
            ...options,
            headers,
          })
        } else {
          return {
            message: 'Authentication failed',
            error: 'Token refresh failed',
          }
        }
      }

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

  async updateProfile(data: { address?: string; full_name?: string; email?: string; username?: string }) {
    return this.request('/me/', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
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
  async getCategories(params?: { page?: number; limit?: number; search?: string }) {
    const query = new URLSearchParams()
    if (params) {
      if (params.page !== undefined) query.append('page', String(params.page))
      if (params.limit !== undefined) query.append('limit', String(params.limit))
      if (params.search !== undefined) query.append('search', String(params.search))
    }
    return this.request(`/categories?${query.toString()}`)
  }

  async getCategory(id: string | number) {
    return this.request(`/categories/${id}`)
  }

  async createCategory(data: any) {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: string | number, data: any) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(id: string | number) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE',
    })
  }

  // Users endpoints (admin only)
  async getUsers(params?: { page?: number; limit?: number; search?: string; role?: string }) {
    const query = new URLSearchParams()
    if (params) {
      if (params.page !== undefined) query.append('page', String(params.page))
      if (params.limit !== undefined) query.append('limit', String(params.limit))
      if (params.search !== undefined) query.append('search', String(params.search))
      if (params.role !== undefined) query.append('role', String(params.role))
    }
    return this.request(`/users?${query.toString()}`)
  }

  async getUser(id: string | number) {
    return this.request(`/users/${id}`)
  }

  async updateUser(id: string | number, data: any) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string | number) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  // Orders endpoints (admin can get all)
  async getAllOrders(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params) {
      if (params.page !== undefined) query.append('page', String(params.page))
      if (params.limit !== undefined) query.append('limit', String(params.limit))
    }
    return this.request(`/orders/admin/all?${query.toString()}`)
  }

  async updateOrder(id: string | number, data: any) {
    return this.request(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteOrder(id: string | number) {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    })
  }

  // Analytics endpoints
  async getAnalyticsSummary() {
    return this.request('/analytics/summary')
  }

  async getTopProducts(metric: string = 'purchases', limit: number = 10) {
    const query = new URLSearchParams()
    query.append('metric', metric)
    query.append('limit', String(limit))
    return this.request(`/analytics/top-products?${query.toString()}`)
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
  async createOrder(order_items: Array<{ product_id: string | number; quantity: number }>) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify({ order_items }),
    })
  }

  async getOrders(params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params) {
      if (params.page !== undefined) query.append('page', String(params.page))
      if (params.limit !== undefined) query.append('limit', String(params.limit))
    }
    return this.request(`/orders?${query.toString()}`)
  }

  async getOrder(id: string | number) {
    return this.request(`/orders/${id}`)
  }
}

export const apiClient = new ApiClient()
