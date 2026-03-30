'use client'

import React, { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import Link from 'next/link'

interface NavbarProps {
  cartItemCount?: number
  onCartClick?: () => void
}

export function Navbar({ cartItemCount = 0, onCartClick }: NavbarProps) {
  const { user, logout, isAuthenticated } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-heading text-lg font-bold">E</span>
            </div>
            <span className="hidden sm:inline font-heading text-lg font-semibold text-foreground">
              EliteGear
            </span>
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex gap-8">
            <Link
              href="/"
              className="text-foreground hover:text-accent transition-colors"
            >
              Shop
            </Link>
            <Link
              href="/"
              className="text-foreground hover:text-accent transition-colors"
            >
              Categories
            </Link>
            <Link
              href="/"
              className="text-foreground hover:text-accent transition-colors"
            >
              About
            </Link>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Cart Button */}
            <button
              onClick={onCartClick}
              className="relative p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 8m10 0l2 8m-12 0h12M9 21a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-accent rounded-full flex items-center justify-center text-xs font-bold text-accent-foreground">
                  {cartItemCount}
                </span>
              )}
            </button>

            {/* Auth Links */}
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  {user?.name}
                </span>
                {user?.role === 'admin' && (
                  <Link
                    href="/admin"
                    className="text-sm font-semibold text-accent hover:text-accent/80"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm font-semibold text-foreground hover:text-accent transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-semibold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 hover:bg-muted rounded-lg"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 border-t border-border">
            <Link href="/" className="block px-4 py-2 text-foreground hover:bg-muted">
              Shop
            </Link>
            <Link href="/" className="block px-4 py-2 text-foreground hover:bg-muted">
              Categories
            </Link>
            <Link href="/" className="block px-4 py-2 text-foreground hover:bg-muted">
              About
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
