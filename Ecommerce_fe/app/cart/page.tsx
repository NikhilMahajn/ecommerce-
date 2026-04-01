'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/lib/AuthContext'
import { apiClient } from '@/lib/apiClient'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
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
      if (cartRes.data) {
        let cartToShow = null
        
        const cartsArray = cartRes.data.data || (Array.isArray(cartRes.data) ? cartRes.data : [])
        
        if (Array.isArray(cartsArray) && cartsArray.length > 0) {
          const firstCart = cartsArray[0]
          const mergedItemsMap = new Map<number, CartItem>()
          
          cartsArray.forEach(cart => {
            if (cart.cart_items && Array.isArray(cart.cart_items)) {
              cart.cart_items.forEach(item => {
                if (mergedItemsMap.has(item.product_id)) {
                  const existingItem = mergedItemsMap.get(item.product_id)!
                  existingItem.quantity += item.quantity
                  existingItem.subtotal += item.subtotal
                } else {
                  mergedItemsMap.set(item.product_id, { ...item })
                }
              })
            }
          })
          
          const allCartItems = Array.from(mergedItemsMap.values())
          const totalAmount = allCartItems.reduce((sum, item) => sum + item.subtotal, 0)
          
          cartToShow = {
            ...firstCart,
            cart_items: allCartItems,
            total_amount: totalAmount
          }
        } 
        else if (cartRes.data?.id && cartRes.data?.cart_items) {
          cartToShow = cartRes.data
        }
        
        setCart(cartToShow)
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
      
      const order_items = cart.cart_items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))

      const res = await apiClient.createOrder(order_items)
      
      if (res.error) {
        addToast(res.error || 'Failed to create order', 'error')
      } else {
        addToast('Order placed successfully!', 'success')
        setCart(null)
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
      await loadCartAndProfile()
      addToast('Error removing item', 'error')
    }
  }

  const handleUpdateQuantity = async (cartItemId: number, newQuantity: number) => {
    if (!cart || newQuantity < 1) return

    try {
      const updatedCart = {
        ...cart,
        cart_items: cart.cart_items.map(item =>
          item.id === cartItemId
            ? { ...item, quantity: newQuantity, subtotal: item.product.price * (1 - item.product.discount_percentage / 100) * newQuantity }
            : item
        )
      }
      
      updatedCart.total_amount = updatedCart.cart_items.reduce((sum, item) => sum + item.subtotal, 0)
      setCart(updatedCart)

      const newCartItems = updatedCart.cart_items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))

      await apiClient.updateCart(cart.id, newCartItems)
    } catch (error) {
      console.error('Error updating quantity:', error)
      await loadCartAndProfile()
      addToast('Error updating quantity', 'error')
    }
  }

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen bg-background flex flex-col">
        <Navbar cartItemCount={0} />
        <div className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-medium text-muted-foreground">Loading your cart...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Navbar cartItemCount={cart?.cart_items.length || 0} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-8 text-balance">
          Shopping Cart
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2">
            {!cart || cart.cart_items.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
                <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10 0l2 8m-12 0h12M9 21a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                <h3 className="text-xl font-heading font-semibold text-foreground mb-2">Your cart is empty</h3>
                <p className="text-muted-foreground mb-8">Looks like you haven't added anything to your cart yet.</p>
                <Button
                  onClick={() => router.push('/')}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-2 rounded-lg transition-colors"
                >
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 space-y-6">
                  {cart.cart_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row gap-6 items-start sm:items-center pb-6 border-b border-border last:border-b-0 last:pb-0"
                    >
                      {/* Product Image */}
                      <div className="relative w-24 h-24 flex-shrink-0 bg-muted rounded-md overflow-hidden border border-border">
                        {item.product.thumbnail ? (
                          <Image
                            src={item.product.thumbnail}
                            alt={item.product.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-grow min-w-0">
                        <h3 className="font-heading font-semibold text-foreground text-lg truncate">
                          {item.product.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-muted-foreground font-medium">
                            ₹{item.product.price}
                          </p>
                          {item.product.discount_percentage > 0 && (
                            <span className="text-xs font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                              {item.product.discount_percentage}% OFF
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controls (Qty & Remove) */}
                      <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:gap-8">
                        {/* Quantity */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              item.quantity === 1
                                ? handleRemoveItem(item.id)
                                : handleUpdateQuantity(item.id, item.quantity - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center border border-border rounded-md hover:bg-muted text-foreground transition-colors"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-semibold text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateQuantity(item.id, item.quantity + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center border border-border rounded-md hover:bg-muted text-foreground transition-colors"
                          >
                            +
                          </button>
                        </div>

                        {/* Subtotal & Delete */}
                        <div className="flex items-center gap-4 text-right">
                          <p className="font-heading font-bold text-foreground text-lg min-w-[4rem]">
                            ₹{item.subtotal.toFixed(2)}
                          </p>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-muted-foreground hover:text-destructive p-2 rounded-md hover:bg-destructive/10 transition-colors"
                            aria-label="Remove item"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Order Summary & Address */}
          <div className="lg:col-span-1 space-y-6">
            {/* Order Summary */}
            {cart && cart.cart_items.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6 shadow-sm sticky top-20">
                <h2 className="font-heading text-xl font-bold text-foreground mb-6">
                  Order Summary
                </h2>
                
                <div className="space-y-4 text-sm md:text-base">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="text-foreground font-medium">₹{cart.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Shipping</span>
                    <span className="text-foreground font-medium">Free</span>
                  </div>
                  
                  <div className="border-t border-border pt-4 mt-4">
                    <div className="flex justify-between items-center mb-6">
                      <span className="font-heading text-lg font-bold text-foreground">Total</span>
                      <span className="font-heading text-2xl font-bold text-primary">
                        ₹{cart.total_amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Embedded Address Section to keep checkout flow tight */}
                <div className="border-t border-border pt-6 mt-2">
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                    Delivery Details
                  </h3>
                  <div className="space-y-3">
                    <Textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter full delivery address..."
                      className="min-h-[100px] resize-none bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    />
                    <Button
                      onClick={handleSaveAddress}
                      disabled={isSavingAddress || !address.trim()}
                      variant="outline"
                      className="w-full border-border text-foreground hover:bg-muted transition-colors"
                    >
                      {isSavingAddress ? 'Saving...' : 'Save Address'}
                    </Button>
                  </div>
                </div>

                {/* Checkout Action */}
                <Button
                  onClick={handleCheckout}
                  disabled={isCheckingOut || !address.trim()}
                  className="w-full mt-6 py-6 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCheckingOut ? 'Processing Order...' : 'Proceed to Checkout'}
                </Button>
                
                {!address.trim() && (
                  <p className="text-xs text-destructive text-center mt-3">
                    *Please save a delivery address to checkout
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}