# Cloudinary Integration Setup Guide

This guide walks you through setting up Cloudinary for product image uploads in the e-commerce admin panel.

## Step 1: Create a Cloudinary Account

1. Go to [Cloudinary.com](https://cloudinary.com/)
2. Click "Sign Up" and create a free account
3. Verify your email

## Step 2: Get Your Cloud Name

1. After signing in, go to the [Cloudinary Dashboard](https://cloudinary.com/console/settings/upload)
2. Look for your **Cloud Name** at the top of the page (it's usually something like `dxyz123abc`)
3. Copy this value

## Step 3: Create an Upload Preset

1. In the Cloudinary Dashboard, navigate to **Settings > Upload**
2. Scroll to the **Upload presets** section
3. Click **Add upload preset**
4. Fill in the form:
   - **Name**: `product_images` (or any name you prefer)
   - **Signing Mode**: Select **Unsigned** (allows frontend uploads without backend signing)
   - **Format**: Keep defaults
   - Click **Save**
5. You'll see your upload preset created. Copy the preset name

## Step 4: Configure Environment Variables

1. In the `Ecommerce_fe` directory, create a `.env.local` file (copy from `.env.local.example` if needed)
2. Add your Cloudinary credentials:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset_here
```

Replace:

- `your_cloud_name_here` with your actual Cloudinary Cloud Name
- `your_upload_preset_here` with your Upload Preset name

Example:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dxyz123abc
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=product_images
```

## Step 5: Restart Your Development Server

1. Stop your dev server (Ctrl+C)
2. Run: `pnpm dev`
3. The environment variables will now be loaded

## Step 6: Test Image Upload

1. Go to the Admin Panel (`/admin`)
2. Click on the "Products" tab
3. Click "Add Product"
4. Under "Product Thumbnail", click the dashed area to upload an image
5. Select an image from your computer
6. The image will upload to Cloudinary and the URL will be automatically filled in
7. Complete the form and submit

## Troubleshooting

### "Upload Preset is undefined" Error

- Make sure `.env.local` exists and has the correct values
- Restart your dev server after adding environment variables
- Check that `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` is set correctly

### Images not displaying in admin or product cards

- Verify the Cloudinary URL is being stored in the database (check API response)
- Ensure the thumbnail URL is a valid, accessible Cloudinary URL
- Check browser console for image loading errors

### Upload widget not appearing

- Clear browser cache and reload
- Check that `next-cloudinary` package is installed: `pnpm list next-cloudinary`
- Verify CldUploadWidget is properly imported in AddProductDialog.tsx

## Additional Cloudinary Features

Once set up, you can:

1. **Add image transformations** - Resize, compress, or filter images automatically
2. **Enable auto-upload** - Automatically generate thumbnails and optimized versions
3. **Set storage limits** - Configure folder organization and retention policies
4. **Enable CDN** - Cloudinary automatically serves images from CDN for fast delivery

For more info, see [Cloudinary Documentation](https://cloudinary.com/documentation)
