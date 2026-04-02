'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AddProductDialog } from '@/components/AddProductDialog'
import { AddCategoryDialog } from '@/components/AddCategoryDialog'
import { apiClient } from '@/lib/apiClient'
import { Product, Category, User } from '@/lib/types'

interface Order {
  id: string | number
  user_id?: string | number
  total?: number
  total_amount?: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered'
  createdAt?: string
  created_at?: string
}

interface DashboardStats {
  total_products?: number
  total_orders?: number
  total_users?: number
  total_revenue?: number
}

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)

  // State for products
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  // State for categories
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)

  // State for orders
  const [orders, setOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // State for users
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)

  // State for dashboard stats
  const [stats, setStats] = useState<DashboardStats>({})
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      addToast('Admin access required', 'error')
      router.push('/')
    }
  }, [isAuthenticated, user, isLoading, router, addToast])

  // Load data based on active tab
  useEffect(() => {
    const loadTabData = async () => {
      if (activeTab === 'dashboard') await loadDashboardStats()
      if (activeTab === 'products') await loadProducts()
      if (activeTab === 'categories') await loadCategories()
      if (activeTab === 'orders') await loadOrders()
      if (activeTab === 'users') await loadUsers()
    }
    loadTabData()
  }, [activeTab])

  const loadDashboardStats = async () => {
    setStatsLoading(true)
    try {
      const response = await apiClient.getDashboardStats()
      if (response.data) {
        setStats(response.data)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
      addToast('Failed to load dashboard statistics', 'error')
    } finally {
      setStatsLoading(false)
    }
  }

  const loadProducts = async () => {
    setProductsLoading(true)
    try {
      const response = await apiClient.getProducts({
        page: 1,
        limit: 100,
      })
      if (response.data) {
        setProducts(Array.isArray(response.data) ? response.data : response.data.items || [])
      }
    } catch (error) {
      addToast('Failed to load products', 'error')
      console.error('Load products error:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  const loadCategories = async () => {
    setCategoriesLoading(true)
    try {
      const response = await apiClient.getCategories({
        page: 1,
        limit: 100,
      })
      if (response.data) {
        setCategories(Array.isArray(response.data) ? response.data : response.data.items || [])
      }
    } catch (error) {
      addToast('Failed to load categories', 'error')
      console.error('Load categories error:', error)
    } finally {
      setCategoriesLoading(false)
    }
  }

  const loadOrders = async () => {
    setOrdersLoading(true)
    try {
      const response = await apiClient.getAllOrders({
        page: 1,
        limit: 100,
      })
      if (response.data) {
        setOrders(Array.isArray(response.data) ? response.data : response.data.items || [])
      }
    } catch (error) {
      addToast('Failed to load orders', 'error')
      console.error('Load orders error:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const response = await apiClient.getUsers({
        page: 1,
        limit: 100,
      })
      if (response.data) {
        setUsers(Array.isArray(response.data) ? response.data : response.data.items || [])
      }
    } catch (error) {
      addToast('Failed to load users', 'error')
      console.error('Load users error:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const handleDeleteCategory = async (categoryId: string | number) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await apiClient.deleteCategory(categoryId)
        addToast('Category deleted successfully', 'success')
        setCategories(categories.filter(c => String(c.id) !== String(categoryId)))
      } catch (error) {
        addToast('Failed to delete category', 'error')
        console.error('Delete category error:', error)
      }
    }
  }

  const handleDeleteUser = async (userId: string | number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        await apiClient.deleteUser(userId)
        addToast('User deleted successfully', 'success')
        setUsers(users.filter(u => String(u.id) !== String(userId)))
      } catch (error) {
        addToast('Failed to delete user', 'error')
        console.error('Delete user error:', error)
      }
    }
  }

  const handleUpdateOrderStatus = async (orderId: string | number, newStatus: string) => {
    try {
      await apiClient.updateOrder(orderId, { status: newStatus })
      addToast('Order status updated successfully', 'success')
      setOrders(orders.map(o => String(o.id) === String(orderId) ? { ...o, status: newStatus as any } : o))
    } catch (error) {
      addToast('Failed to update order status', 'error')
      console.error('Update order error:', error)
    }
  }

  const handleDeleteOrder = async (orderId: string | number) => {
    if (confirm('Are you sure you want to delete this order?')) {
      try {
        await apiClient.deleteOrder(orderId)
        addToast('Order deleted successfully', 'success')
        setOrders(orders.filter(o => String(o.id) !== String(orderId)))
      } catch (error) {
        addToast('Failed to delete order', 'error')
        console.error('Delete order error:', error)
      }
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    )
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-heading text-lg font-bold">E</span>
            </div>
            <span className="hidden sm:inline font-heading text-lg font-semibold">Admin Panel</span>
          </Link>
          <div className="text-sm text-muted-foreground">
            Welcome, {user?.full_name}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8 border-b border-border overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'products', label: 'Products' },
            { id: 'categories', label: 'Categories' },
            { id: 'orders', label: 'Orders' },
            { id: 'users', label: 'Users' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors whitespace-nowrap ₹{
                activeTab === tab.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {statsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading statistics...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Products', value: stats.total_products || 0 },
                    { label: 'Total Orders', value: stats.total_orders || 0 },
                    { label: 'Total Users', value: stats.total_users || 0 },
                    { label: 'Revenue', value: `₹${(stats.total_revenue || 0).toFixed(2)}` },
                  ].map((stat, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-6">
                      <p className="text-muted-foreground text-sm mb-2">{stat.label}</p>
                      <p className="font-heading text-3xl font-bold text-foreground mb-2">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4">
                Recent Orders
              </h3>
              {orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div>
                        <p className="font-semibold text-foreground">Order #{order.id}</p>
                        <p className="text-sm text-muted-foreground">
                          Total: ₹{typeof order.total === 'number' ? order.total.toFixed(2) : order.total}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ₹{
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No orders yet. Orders will appear here once customers make purchases.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl font-bold text-foreground">Products</h2>
              <button 
                onClick={() => setIsAddProductOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add Product
              </button>
            </div>

            {productsLoading ? (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">Loading products...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Image</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Title</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Description</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Price</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Stock</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Rating</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-foreground">
                          {product.thumbnail ? (
                            <div className="relative w-12 h-12 rounded overflow-hidden flex items-center justify-center bg-muted">
                              <Image
                                src={product.thumbnail}
                                alt={product.title}
                                fill
                                className="object-contain p-1"
                              />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                              No image
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground font-medium">{product.title}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-xs">{product.description}</td>
                        <td className="px-6 py-4 text-sm text-foreground font-semibold">₹{product.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{product.stock}</td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-yellow-500' : 'fill-muted'}`}
                                viewBox="0 0 20 20"
                              >
                                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                              </svg>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            product.is_published 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {product.is_published ? 'Published' : 'Draft'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">
                  No products yet. Click "Add Product" to create one.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-2xl font-bold text-foreground">Categories</h2>
              <button 
                onClick={() => setIsAddCategoryOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add Category
              </button>
            </div>

            {categoriesLoading ? (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">Loading categories...</p>
              </div>
            ) : categories.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((category) => (
                  <div key={category.id} className="bg-card border border-border rounded-lg p-6">
                    {category.image && (
                      <div className="relative w-full h-32 rounded mb-4 overflow-hidden flex items-center justify-center bg-muted">
                        <Image
                          src={category.image}
                          alt={category.name}
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                    )}
                    <h3 className="font-semibold text-foreground mb-2">{category.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">Slug: {category.slug}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-sm font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">
                  No categories yet. Click "Add Category" to create one.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <h2 className="font-heading text-2xl font-bold text-foreground mb-4">Orders</h2>

            {ordersLoading ? (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">Loading orders...</p>
              </div>
            ) : orders.length > 0 ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Order ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">User ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Total</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Date</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-foreground font-medium">#{order.id}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{order.user_id}</td>
                        <td className="px-6 py-4 text-sm text-foreground font-semibold">
                          ₹{typeof order.total_amount === 'number' ? order.total_amount.toFixed(2) : order.total_amount}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            className={`px-3 py-1 rounded text-xs font-semibold border border-border ₹{
                              order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                              order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 
                           order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-xs font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">
                  No orders yet. Orders will appear here once customers complete purchases.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <h2 className="font-heading text-2xl font-bold text-foreground mb-4">Users</h2>

            {usersLoading ? (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">Loading users...</p>
              </div>
            ) : users.length > 0 ? (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">ID</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Full Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Email</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Role</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Address</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-foreground">{u.id}</td>
                        <td className="px-6 py-4 text-sm text-foreground font-medium">{u.full_name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ₹{
                            u.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-xs">{u.address || '—'}</td>
                        <td className="px-6 py-4 text-sm">
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-xs font-semibold"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-6">
                <p className="text-muted-foreground text-center py-8">
                  No users found.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Product Dialog */}
      <AddProductDialog 
        isOpen={isAddProductOpen} 
        onClose={() => {
          setIsAddProductOpen(false)
          loadProducts()
        }}
      />

      {/* Add Category Dialog */}
      <AddCategoryDialog 
        isOpen={isAddCategoryOpen} 
        onClose={() => {
          setIsAddCategoryOpen(false)
          loadCategories()
        }}
      />
    </main>
  )
}
