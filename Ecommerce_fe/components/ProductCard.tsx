'use client'

import React from 'react'
import { Product } from '@/lib/types'
import Link from 'next/link'
import Image from 'next/image'

interface ProductCardProps {
  product: Product
  onAddToCart?: (product: Product) => void
  isAuthenticated?: boolean
}

export function ProductCard({ product, onAddToCart, isAuthenticated = false }: ProductCardProps) {
  return (
    <div className="group bg-card rounded-lg overflow-hidden border border-border hover:border-accent transition-all duration-300 hover:shadow-lg">
      {/* Image Container */}
      <Link href={`/product/${product.slug}`} className="block relative h-64 overflow-hidden bg-muted">
        {product.thumbnail ? (
          <Image
            src={product.thumbnail}
            alt={product.title}
            fill
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-muted-foreground text-center p-4">
              <div className="w-16 h-16 mx-auto mb-2 bg-muted-foreground/20 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm">{product.title}</p>
            </div>
          </div>
        )}

        {/* In Stock Badge */}
        {product.stock == 0 && (
          <div className="absolute top-3 right-3 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-semibold">
            Out of Stock
          </div>
        )}
      </Link>

      {/* Product Info */}
      <div className="p-4">
        <div className="mb-2">
          <h3 className="font-heading text-lg font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-2">
            {product.title}
          </h3>
          <p className="text-sm text-muted-foreground">{product.category?.name || 'Uncategorized'}</p>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <svg
                key={i}
                className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-accent' : 'fill-muted'}`}
                viewBox="0 0 20 20"
              >
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">({product.reviews})</span>
        </div>

        {/* Price and Button */}
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xl font-heading font-bold text-accent">
            ${product.price.toFixed(2)}
          </div>
          <button
            onClick={() => onAddToCart?.(product)}
            disabled={product.stock == 0 || !isAuthenticated}
            className="flex-1 px-3 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            title={!isAuthenticated ? 'Log in to add to cart' : product.stock == 0 ? 'Out of stock' : ''}
          >
            {!isAuthenticated ? 'Log in to Buy' : product.stock != 0 ? 'Add' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  )
}
