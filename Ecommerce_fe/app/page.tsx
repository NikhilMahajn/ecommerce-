'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ProductCard } from '@/components/ProductCard'
import { useToast } from '@/components/Toast'
import { Product, CartItem } from '@/lib/types'
import { apiClient } from '@/lib/apiClient'
import { useAuth } from '@/lib/AuthContext'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartId, setCartId] = useState<string | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { addToast } = useToast()

  // Load products
  useEffect(() => {
    loadProducts()
  }, [searchTerm, selectedCategory])

  // Load cart when authenticated (wait for auth to finish loading)
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadCart()
    }
  }, [isAuthenticated, authLoading])

  const loadCart = async () => {
    try {
      const response = await apiClient.getCart({
        page: 1,
        limit: 10,
      })
      console.log('[v0] Cart API response:', response)
      
      if (response.data) {
        let cartItems: CartItem[] = []
        let cartId: string | null = null
        
        // Handle array of carts - extract cart_items from the first cart
        if (Array.isArray(response.data) && response.data.length > 0) {
          const firstCart = response.data[0]
          cartId = String(firstCart.id)
          
          // If cart has cart_items array (nested structure from API)
          if (firstCart.cart_items && Array.isArray(firstCart.cart_items)) {
            cartItems = firstCart.cart_items.map((item: any) => ({
              productId: String(item.product_id),
              product: item.product,
              quantity: Number(item.quantity),
            }))
          }
          // Otherwise treat the array items as direct cart items
          else if (firstCart.product_id && firstCart.product) {
            cartItems = response.data.map((item: any) => ({
              productId: String(item.product_id),
              product: item.product,
              quantity: Number(item.quantity),
            }))
          }
        }
        // Handle paginated object response with items property
        else if (response.data.items && Array.isArray(response.data.items)) {
          cartItems = response.data.items.map((item: any) => ({
            productId: String(item.product_id),
            product: item.product,
            quantity: Number(item.quantity),
          }))
        }
        
        console.log('[v0] Parsed cart items:', cartItems)
        console.log('[v0] Cart ID:', cartId)
        setCart(cartItems)
        setCartId(cartId)
      }
    } catch (error) {
      console.error('[v0] Load cart error:', error)
    }
  }

  // Helper to format cart items for API
  const formatCartItemsForAPI = (items: CartItem[]) => {
    return items
      .filter((item) => item.productId && typeof item.quantity === 'number')
      .map((item) => ({
        product_id: String(item.productId),
        quantity: Number(item.quantity),
      }))
  }

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.getProducts({
        search: searchTerm || undefined,
        categoryId: selectedCategory || undefined,
      })
      if (response.data) {
        setProducts(response.data)
      }
    } catch (error) {
      addToast('Failed to load products', 'error')
      console.error('[v0] Load products error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCart = (product: Product) => {
    if (!isAuthenticated) {
      addToast('Please log in to add items to cart', 'error')
      router.push('/login')
      return
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      let updatedCart: CartItem[]
      
      if (existing) {
        updatedCart = prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        updatedCart = [...prev, { productId: product.id, product, quantity: 1 }]
      }

      // Send to API with validated data
      const cartItems = formatCartItemsForAPI(updatedCart)
      console.log('[v0] Sending cart to API:', cartItems)

      apiClient
        .addToCart(cartItems)
        .then((response) => {
          if (response.error) {
            addToast('Failed to add to cart', 'error')
            console.error('[v0] Add to cart error:', response.error)
          } else {
            addToast(`${product.title} added to cart`, 'success')
            // Reload cart to get updated cartId
            loadCart()
          }
        })
        .catch((error) => {
          addToast('Failed to add to cart', 'error')
          console.error('[v0] Add to cart error:', error)
        })

      return updatedCart
    })
  }

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => {
      const updatedCart = prev.filter((item) => item.productId !== productId)

      // If cart is now empty, delete the entire cart
      if (updatedCart.length === 0) {
        if (cartId) {
          console.log('[v0] Cart is empty, deleting cart with ID:', cartId)
          apiClient
            .deleteCart(cartId)
            .then((response) => {
              if (response.error) {
                addToast('Failed to delete cart', 'error')
                console.error('[v0] Delete cart error:', response.error)
              } else {
                addToast('Cart cleared', 'success')
                setCartId(null)
              }
            })
            .catch((error) => {
              addToast('Failed to delete cart', 'error')
              console.error('[v0] Delete cart error:', error)
            })
        }
      } else {
        // Cart still has items, update it
        const cartItems = formatCartItemsForAPI(updatedCart)
        console.log('[v0] Updating cart after removing item, CartID:', cartId, 'Items:', cartItems)
        
        if (cartId) {
          apiClient
            .updateCart(cartId, cartItems)
            .then((response) => {
              if (response.error) {
                addToast('Failed to remove from cart', 'error')
                console.error('[v0] Remove from cart error:', response.error)
              } else {
                addToast('Removed from cart', 'success')
              }
            })
            .catch((error) => {
              addToast('Failed to remove from cart', 'error')
              console.error('[v0] Remove from cart error:', error)
            })
        }
      }

      return updatedCart
    })
  }

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId)
    } else {
      setCart((prev) => {
        const updatedCart = prev.map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        )

        // Send to API with validated data
        if (!cartId) {
          addToast('Loading cart, please try again', 'error')
          loadCart()
          return updatedCart
        }

        const cartItems = formatCartItemsForAPI(updatedCart)
        console.log('[v0] Updating cart with ID:', cartId, 'Items:', cartItems)

        apiClient
          .updateCart(cartId, cartItems)
          .then((response) => {
            if (response.error) {
              addToast('Failed to update cart', 'error')
              console.error('[v0] Update cart error:', response.error)
              // Reload cart to refresh cartId
              loadCart()
            } else {
              console.log('[v0] Cart updated successfully')
            }
          })
          .catch((error) => {
            addToast('Failed to update cart', 'error')
            console.error('[v0] Update cart error:', error)
            // Reload cart to refresh cartId
            loadCart()
          })

        return updatedCart
      })
    }
  }

  const cartTotal = cart.reduce((sum, item) => {
    if (!item.product) return sum
    return sum + item.product.price * item.quantity
  }, 0)

  return (
    <main className="min-h-screen bg-background">
      <Navbar cartItemCount={cart.length} onCartClick={() => setShowCart(!showCart)} />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-background to-background py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-foreground mb-4 text-balance">
            Premium Electronics & Gadgets
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            Discover cutting-edge technology and innovative gadgets curated for the discerning tech enthusiast
          </p>

          {/* Search Bar */}
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <svg className="absolute right-3 top-3 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="md:col-span-1">
            <div className="bg-card rounded-lg border border-border p-6 sticky top-20">
              <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                Categories
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedCategory === null
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  All Products
                </button>
                {['Smartphones', 'Laptops', 'Accessories', 'Wearables'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                      selectedCategory === cat
                        ? 'bg-accent text-accent-foreground font-semibold'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <div className="md:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-card rounded-lg border border-border animate-pulse h-80" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-lg text-muted-foreground">No products found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowCart(false)} />
      )}
      <div
        className={`fixed right-0 top-0 h-screen w-full md:w-96 bg-card border-l border-border transform transition-transform duration-300 overflow-y-auto z-50 ${
          showCart ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-heading text-2xl font-bold text-foreground">Shopping Cart</h2>
            <button
              onClick={() => setShowCart(false)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {cart.length > 0 ? (
            <>
              <div className="space-y-4 mb-6">
                {cart.filter((item) => item.product).map((item) => (
                  <div key={item.productId} className="border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-foreground">{item.product?.name || 'Product'}</h3>
                      <button
                        onClick={() => handleRemoveFromCart(item.productId)}
                        className="text-destructive hover:bg-destructive/10 p-1 rounded"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      ${item.product?.price?.toFixed(2) || '0.00'} each
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        className="px-2 py-1 border border-border rounded hover:bg-muted"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 1)}
                        className="w-12 text-center border border-border rounded py-1"
                      />
                      <button
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        className="px-2 py-1 border border-border rounded hover:bg-muted"
                      >
                        +
                      </button>
                      <span className="ml-auto font-semibold text-foreground">
                        ${(item.product?.price && typeof item.product.price === 'number' ? item.product.price * item.quantity : 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-heading text-lg font-bold text-foreground">Total:</span>
                  <span className="font-heading text-2xl font-bold text-accent">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>
                <button className="w-full px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                  Checkout
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10 0l2 8m-12 0h12M9 21a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              <p className="text-muted-foreground">Your cart is empty</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
