'use client'

import React, { useState } from 'react'
import { apiClient } from '@/lib/apiClient'
import { useToast } from '@/components/Toast'
import { CldUploadWidget } from 'next-cloudinary'

interface AddProductDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function AddProductDialog({ isOpen, onClose, onSuccess }: AddProductDialogProps) {
  const { addToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    discount_percentage: '',
    rating: '',
    stock: '',
    brand: '',
    thumbnail: '',
    images: '',
    is_published: true,
    category_id: '',
  })

  React.useEffect(() => {
    if (isOpen) {
      loadCategories()
    }
  }, [isOpen])

  const loadCategories = async () => {
    try {
      const response = await apiClient.getCategories()
      if (response.data) {
        setCategories(Array.isArray(response.data) ? response.data : response.data.categories || [])
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const validateForm = () => {
    if (!formData.title.trim()) {
      addToast('Product title is required', 'error')
      return false
    }
    if (!formData.description.trim()) {
      addToast('Description is required', 'error')
      return false
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      addToast('Valid price is required', 'error')
      return false
    }
    if (!formData.thumbnail.trim()) {
      addToast('Product thumbnail URL is required', 'error')
      return false
    }
    if (!formData.brand.trim()) {
      addToast('Brand is required', 'error')
      return false
    }
    if (!formData.category_id) {
      addToast('Please select a category', 'error')
      return false
    }
    if (formData.stock === '' || parseInt(formData.stock) < 0) {
      addToast('Valid stock quantity is required', 'error')
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
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : 0,
        rating: formData.rating ? parseFloat(formData.rating) : 0,
        stock: parseInt(formData.stock),
        brand: formData.brand,
        thumbnail: formData.thumbnail,
        images: formData.images ? formData.images.split(',').map(url => url.trim()) : [],
        is_published: formData.is_published,
        category_id: parseInt(formData.category_id),
        created_at: new Date().toISOString(),
      }

      const response = await apiClient.createProduct(payload)
      console.log('Create product response:', response)

      if (response.data || response.id) {
        addToast('Product added successfully!', 'success')
        setFormData({
          title: '',
          description: '',
          price: '',
          discount_percentage: '',
          rating: '',
          stock: '',
          brand: '',
          thumbnail: '',
          images: '',
          is_published: true,
          category_id: '',
        })
        onClose()
        onSuccess?.()
      } else {
        const errorMsg = response.error || response.message || 'Failed to add product'
        console.error('Product creation error:', response)
        addToast(errorMsg, 'error')
      }
    } catch (error) {
      console.error('Product creation exception:', error)
      addToast(error instanceof Error ? error.message : 'Failed to add product', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold text-foreground">Add New Product</h2>
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
          {/* Product Title and Brand */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-foreground mb-2">
                Product Title *
              </label>
              <input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Premium Gaming Headset"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="brand" className="block text-sm font-semibold text-foreground mb-2">
                Brand *
              </label>
              <input
                id="brand"
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g., Sony, Apple, Samsung"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-foreground mb-2">
              Description *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter product description..."
              rows={4}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors resize-none"
            />
          </div>

          {/* Price, Discount, and Rating */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="price" className="block text-sm font-semibold text-foreground mb-2">
                Price (₹) *
              </label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="99.99"
                step="0.01"
                min="0"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="discount_percentage" className="block text-sm font-semibold text-foreground mb-2">
                Discount (%)
              </label>
              <input
                id="discount_percentage"
                type="number"
                name="discount_percentage"
                value={formData.discount_percentage}
                onChange={handleChange}
                placeholder="10"
                step="0.01"
                min="0"
                max="100"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="rating" className="block text-sm font-semibold text-foreground mb-2">
                Rating (0-5)
              </label>
              <input
                id="rating"
                type="number"
                name="rating"
                value={formData.rating}
                onChange={handleChange}
                placeholder="4.5"
                step="0.1"
                min="0"
                max="5"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>
          </div>

          {/* Stock and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="stock" className="block text-sm font-semibold text-foreground mb-2">
                Stock Quantity *
              </label>
              <input
                id="stock"
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                placeholder="100"
                min="0"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="category_id" className="block text-sm font-semibold text-foreground mb-2">
                Category *
              </label>
              <select
                id="category_id"
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Product Thumbnail *
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent transition-colors">
              <CldUploadWidget
                uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                onSuccess={(result: any) => {
                  const uploadedUrl = result.info.secure_url
                  setFormData(prev => ({
                    ...prev,
                    thumbnail: uploadedUrl
                  }))
                  addToast('Image uploaded successfully', 'success')
                }}
                onError={(error: any) => {
                  console.error('Upload error:', error)
                  addToast(error.message || 'Failed to upload image', 'error')
                }}
              >
                {({ open }) => (
                  <div className="cursor-pointer" onClick={() => open()}>
                    <p className="text-sm text-muted-foreground mb-2">Click to upload product thumbnail</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 50MB</p>
                  </div>
                )}
              </CldUploadWidget>
            </div>
            
            {/* Image Preview */}
            {formData.thumbnail && (
              <div className="mt-4 relative group">
                <img 
                  src={formData.thumbnail} 
                  alt="Thumbnail preview"
                  className="w-full h-48 object-cover rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, thumbnail: '' }))}
                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-3 py-1 rounded text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Product Images */}
          <div>
            <label htmlFor="images" className="block text-sm font-semibold text-foreground mb-2">
              Product Images (comma-separated URLs)
            </label>
            <textarea
              id="images"
              name="images"
              value={formData.images}
              onChange={handleChange}
              placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg, https://example.com/image3.jpg"
              rows={2}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-colors resize-none"
            />
          </div>

          {/* Publish Status */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_published"
                checked={formData.is_published}
                onChange={handleChange}
                className="w-4 h-4 rounded border-border"
              />
              <span className="text-sm font-semibold text-foreground">Publish Product</span>
            </label>
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
                'Add Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
