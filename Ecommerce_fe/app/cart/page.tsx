'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/lib/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import Image from 'next/image'

interface CartItem {
  id: number
  product_id: number
  quantity: number
  subtotal: number
  product: {
    id: number
    title: string
    price: number
    thumbnail: string
    discount_percentage: number
  }
}

interface Cart {
  id: number
  user_id: number
  total_amount: number
  cart_items: CartItem[]
}

export default function CartPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const { addToast } = useToast()
  
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [address, setAddress] = useState('')
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, authLoading, router])

  // Load cart and user profile on mount
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadCartAndProfile()
    }
  }, [isAuthenticated, authLoading])

  const loadCartAndProfile = async () => {
    try {
      setIsLoading(true)
      
      // Load user profile for address
      const profileRes = await apiClient.getMe()
      if (profileRes.data) {
        const userData = profileRes.data.data || profileRes.data
        setAddress(userData.address || '')
      }
      
      // Load cart
      const cartRes = await apiClient.getCart({ page: 1, limit: 100 })
      if (cartRes.data && Array.isArray(cartRes.data) && cartRes.data.length > 0) {
        setCart(cartRes.data[0])
      } else if (cartRes.data?.cart_items) {
        setCart(cartRes.data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      addToast('Error loading cart data', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveAddress = async () => {
    if (!address.trim()) {
      addToast('Please enter an address', 'error')
      return
    }

    try {
      setIsSavingAddress(true)
      const res = await apiClient.updateProfile({ address })
      
      if (res.error) {
        addToast(res.error || 'Failed to save address', 'error')
      } else {
        addToast('Address saved successfully', 'success')
      }
    } catch (error) {
      console.error('Error saving address:', error)
      addToast('Error saving address', 'error')
    } finally {
      setIsSavingAddress(false)
    }
  }

  const handleCheckout = async () => {
    if (!cart || cart.cart_items.length === 0) {
      addToast('Cart is empty', 'error')
      return
    }

    if (!address.trim()) {
      addToast('Please enter and save an address first', 'error')
      return
    }

    try {
      setIsCheckingOut(true)
      
      // Create order from cart items
      const order_items = cart.cart_items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))

      const res = await apiClient.createOrder(order_items)
      
      if (res.error) {
        addToast(res.error || 'Failed to create order', 'error')
      } else {
        addToast('Order placed successfully!', 'success')
        // Clear cart from state immediately
        setCart(null)
        // Redirect to orders page or home
        setTimeout(() => {
          router.push('/')
        }, 1500)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      addToast('Error placing order', 'error')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const handleRemoveItem = async (cartItemId: number) => {
    if (!cart) return

    try {
      // Update local state immediately for better UX
      const updatedItems = cart.cart_items.filter(item => item.id !== cartItemId)
      
      if (updatedItems.length === 0) {
        setCart(null)
      } else {
        const updatedCart = {
          ...cart,
          cart_items: updatedItems,
          total_amount: updatedItems.reduce((sum, item) => sum + item.subtotal, 0)
        }
        setCart(updatedCart)
      }

      // Update cart on server
      if (updatedItems.length === 0) {
        await apiClient.deleteCart(cart.id)
        addToast('Cart cleared', 'success')
      } else {
        const newCartItems = updatedItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
        }))
        await apiClient.updateCart(cart.id, newCartItems)
        addToast('Item removed from cart', 'success')
      }
    } catch (error) {
      console.error('Error removing item:', error)
      await loadCartAndProfile() // Reload to sync state if error
      addToast('Error removing item', 'error')
    }
  }

  const handleUpdateQuantity = async (cartItemId: number, newQuantity: number) => {
    if (!cart || newQuantity < 1) return

    try {
      // Update local state immediately for better UX
      const updatedCart = {
        ...cart,
        cart_items: cart.cart_items.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: newQuantity, subtotal: item.product.price * (1 - item.product.discount_percentage / 100) * newQuantity }
            : item
        )
      }
      
      // Recalculate cart total
      updatedCart.total_amount = updatedCart.cart_items.reduce((sum, item) => sum + item.subtotal, 0)
      setCart(updatedCart)

      // Update cart on server
      const newCartItems = updatedCart.cart_items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))

      await apiClient.updateCart(cart.id, newCartItems)
      addToast('Quantity updated', 'success')
    } catch (error) {
      console.error('Error updating quantity:', error)
      await loadCartAndProfile() // Reload to sync state if error
      addToast('Error updating quantity', 'error')
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
          <div className="text-xl font-semibold text-slate-600">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Shopping Cart</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            {!cart || cart.cart_items.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-slate-600 text-lg mb-4">Your cart is empty</p>
                <Button
                  onClick={() => router.push('/')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue Shopping
                </Button>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="space-y-4">
                  {cart.cart_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 items-center p-4 border-b border-slate-200 last:border-b-0 hover:bg-slate-50 rounded"
                    >
                      {/* Product Image */}
                      <div className="relative w-24 h-24 flex-shrink-0 bg-slate-200 rounded">
                        {item.product.thumbnail && (
                          <Image
                            src={item.product.thumbnail}
                            alt={item.product.title}
                            fill
                            className="object-cover rounded"
                          />
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-grow">
                        <h3 className="font-semibold text-slate-900">
                          {item.product.title}
                        </h3>
                        <p className="text-slate-600 text-sm">
                          Price: ₹{item.product.price}
                          {item.product.discount_percentage > 0 && (
                            <span className="ml-2 text-green-600">
                              ({item.product.discount_percentage}% off)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            item.quantity === 1
                              ? handleRemoveItem(item.id)
                              : handleUpdateQuantity(item.id, item.quantity - 1)
                          }
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                        >
                          −
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() =>
                            handleUpdateQuantity(item.id, item.quantity + 1)
                          }
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal */}
                      <div className="text-right min-w-24">
                        <p className="font-semibold text-slate-900">
                          ₹{item.subtotal.toFixed(2)}
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-700 font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Order Summary & Address */}
          <div className="lg:col-span-1 space-y-4">
            {/* Order Summary */}
            {cart && cart.cart_items.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">
                  Order Summary
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-slate-700">
                    <span>Subtotal:</span>
                    <span>₹{cart.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Shipping:</span>
                    <span>Free</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex justify-between font-semibold text-lg text-slate-900">
                      <span>Total:</span>
                      <span>₹{cart.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Address Section */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Delivery Address
              </h2>
              <div className="space-y-3">
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your delivery address (House No., Street, City, State, ZIP Code)"
                  className="min-h-32 resize-none"
                />
                <Button
                  onClick={handleSaveAddress}
                  disabled={isSavingAddress}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isSavingAddress ? 'Saving...' : 'Save Address'}
                </Button>
              </div>
            </Card>

            {/* Checkout Button */}
            {cart && cart.cart_items.length > 0 && (
              <Button
                onClick={handleCheckout}
                disabled={isCheckingOut || !address.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg font-semibold"
              >
                {isCheckingOut ? 'Processing...' : 'Proceed to Checkout'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
