'use client'

import React, { useState } from 'react'
import { apiClient } from '@/lib/apiClient'
import { useToast } from '@/components/Toast'

interface AddCategoryDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddCategoryDialog({ isOpen, onClose, onSuccess }: AddCategoryDialogProps) {
  const { addToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')

  const validateForm = () => {
    if (!name.trim()) {
      addToast('Category name is required', 'error')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    try {
      const payload = {
        name: name.trim(),
      }

      const response = await apiClient.createCategory(payload)
      console.log('Create category response:', response)

      if (response.data || response.id) {
        addToast('Category added successfully!', 'success')
        setName('')
        onClose()
        onSuccess?.()
      } else {
        const errorMsg = response.error || response.message || 'Failed to add category'
        console.error('Category creation error:', response)
        addToast(errorMsg, 'error')
      }
    } catch (error) {
      console.error('Category creation exception:', error)
      addToast(error instanceof Error ? error.message : 'Failed to add category', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">Add New Category</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-foreground mb-2">
              Category Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mobiles, Laptops, Tablets"
              autoFocus
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2 bg-background border border-border rounded-lg text-foreground font-semibold hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></span>
                  Adding...
                </>
              ) : (
                'Add Category'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
