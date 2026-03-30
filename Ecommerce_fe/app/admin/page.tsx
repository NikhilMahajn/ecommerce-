'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AddProductDialog } from '@/components/AddProductDialog'
import { AddCategoryDialog } from '@/components/AddCategoryDialog'

export default function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      addToast('Admin access required', 'error')
      router.push('/')
    }
  }, [isAuthenticated, user, isLoading, router, addToast])

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
            Welcome, {user?.name}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8 border-b border-border">
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
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Products', value: '0', change: '+0%' },
                { label: 'Total Orders', value: '0', change: '+0%' },
                { label: 'Total Users', value: '0', change: '+0%' },
                { label: 'Revenue', value: '$0', change: '+0%' },
              ].map((stat, i) => (
                <div key={i} className="bg-card border border-border rounded-lg p-6">
                  <p className="text-muted-foreground text-sm mb-2">{stat.label}</p>
                  <p className="font-heading text-3xl font-bold text-foreground mb-2">
                    {stat.value}
                  </p>
                  <p className="text-sm text-green-600">{stat.change}</p>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-heading text-lg font-bold text-foreground mb-4">
                Recent Orders
              </h3>
              <p className="text-muted-foreground text-center py-8">
                No orders yet. Orders will appear here once customers make purchases.
              </p>
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
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-muted-foreground text-center py-8">
                No products yet. Use the API to add products.
              </p>
            </div>
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
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-muted-foreground text-center py-8">
                No categories yet. Use the API to add categories.
              </p>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground mb-4">Orders</h2>
            <div className="bg-card border border-border rounded-lg p-6">
              <p className="text-muted-foreground text-center py-8">
                No orders yet. Orders will appear here once customers complete purchases.
              </p>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground mb-4">Users</h2>
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                <span className="px-3 py-1 bg-accent text-accent-foreground rounded-full text-sm font-semibold">
                  Admin
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Dialog */}
      <AddProductDialog 
        isOpen={isAddProductOpen} 
        onClose={() => setIsAddProductOpen(false)}
      />

      {/* Add Category Dialog */}
      <AddCategoryDialog 
        isOpen={isAddCategoryOpen} 
        onClose={() => setIsAddCategoryOpen(false)}
      />
    </main>
  )
}
