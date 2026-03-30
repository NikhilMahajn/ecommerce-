'use client'

import React, { useState, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { useToast } from '@/components/Toast'
import { Product, CartItem } from '@/lib/types'
import { apiClient } from '@/lib/apiClient'
import Link from 'next/link'

interface ProductDetailPageProps {
  params: {
    slug: string
  }
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadProduct()
  }, [params.slug])

  const loadProduct = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.getProduct(params.slug)
      if (response.data?.product) {
        setProduct(response.data.product)
      } else {
        addToast('Product not found', 'error')
      }
    } catch (error) {
      addToast('Failed to load product', 'error')
      console.error('[v0] Load product error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToCart = () => {
    if (!product) return

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      }
      return [...prev, { productId: product.id, product, quantity }]
    })
    addToast(`Added ${quantity} to cart`, 'success')
    setQuantity(1)
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar cartItemCount={cart.length} onCartClick={() => setShowCart(!showCart)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-muted rounded-lg h-96 animate-pulse" />
            <div className="space-y-6">
              <div className="h-8 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-6 bg-muted rounded w-1/4 animate-pulse" />
              <div className="h-12 bg-muted rounded w-1/3 animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-background">
        <Navbar cartItemCount={cart.length} onCartClick={() => setShowCart(!showCart)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground mb-4">Product Not Found</h1>
          <Link href="/" className="text-accent hover:underline">
            Back to Shopping
          </Link>
        </div>
      </main>
    )
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

  return (
    <main className="min-h-screen bg-background">
      <Navbar cartItemCount={cart.length} onCartClick={() => setShowCart(!showCart)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span>/</span>
          <Link href="/" className="hover:text-foreground">
            Products
          </Link>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        {/* Product Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          {/* Image */}
          <div className="bg-muted rounded-lg h-96 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>{product.name}</p>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">{product.category?.name}</p>
                <h1 className="font-heading text-4xl font-bold text-foreground mb-4">
                  {product.name}
                </h1>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 ${i < Math.floor(product.rating) ? 'fill-accent' : 'fill-muted'}`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <span className="text-muted-foreground">({product.reviews} reviews)</span>
              </div>

              {/* Price */}
              <div className="mb-6">
                <p className="text-5xl font-heading font-bold text-accent">
                  ${product.price.toFixed(2)}
                </p>
              </div>

              {/* Description */}
              <p className="text-foreground text-lg leading-relaxed mb-8">
                {product.description}
              </p>

              {/* Specs */}
              {Object.keys(product.specs).length > 0 && (
                <div className="mb-8">
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                    Specifications
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2 border-b border-border">
                        <span className="text-muted-foreground capitalize">{key}</span>
                        <span className="font-semibold text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border border-border rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 hover:bg-muted transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-16 text-center border-0 bg-transparent py-2"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 hover:bg-muted transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="text-muted-foreground">
                  {product.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className="w-full py-4 bg-primary text-primary-foreground font-heading text-lg font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>
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
                {cart.map((item) => (
                  <div key={item.productId} className="border border-border rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">{item.product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      ${item.product.price.toFixed(2)} x {item.quantity}
                    </p>
                    <div className="text-right font-semibold text-foreground">
                      ${(item.product.price * item.quantity).toFixed(2)}
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
            <p className="text-muted-foreground text-center py-8">Your cart is empty</p>
          )}
        </div>
      </div>
    </main>
  )
}
