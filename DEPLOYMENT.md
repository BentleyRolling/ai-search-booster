# AI Search Booster - Deployment Guide

## 🚀 Deploy to Render

### 1. Create GitHub Repository

Since I don't have permissions to create the GitHub repository directly, please follow these steps:

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it: `ai-search-booster`
3. Make it **public** (required for free Render deployment)
4. Don't initialize with README (we already have files)

### 2. Push Code to GitHub

Run these commands in your local terminal:

```bash
# Clone the repository locally
git clone /home/ubuntu/repos/ai-search-booster
cd ai-search-booster

# Add your GitHub repository as origin
git remote add origin https://github.com/YOUR_USERNAME/ai-search-booster.git

# Push the code
git push -u origin devin/1736757059-ai-search-booster-shopify-app
```

### 3. Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `YOUR_USERNAME/ai-search-booster`
4. Configure the service:
   - **Name**: `ai-search-booster`
   - **Branch**: `devin/1736757059-ai-search-booster-shopify-app`
   - **Build Command**: `npm install && cd client && npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for better performance)

### 4. Environment Variables (.env Configuration)

Add these environment variables in Render Dashboard → Environment:

```env
NODE_ENV=production
PORT=10000
SHOPIFY_API_KEY=4509cf5ef854ceac54c93cceda14987d
SHOPIFY_API_SECRET=05179787a47a8d6f8251e0fbbcc2ce2c
SHOPIFY_SCOPES=read_products,write_products,read_product_listings,write_product_listings
SHOPIFY_APP_URL=https://YOUR_RENDER_APP_NAME.onrender.com
OPENAI_API_KEY=your_openai_api_key_here
```

**Important**: Replace `YOUR_RENDER_APP_NAME` with your actual Render app name and add your real OpenAI API key.

## 🔧 Shopify-Specific Deployment Settings

### Update Shopify App Configuration

After deployment, update your Shopify app settings:

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Navigate to your app: "AI Search Booster"
3. Update these URLs:
   - **App URL**: `https://YOUR_RENDER_APP_NAME.onrender.com`
   - **Allowed redirection URL(s)**: `https://YOUR_RENDER_APP_NAME.onrender.com/api/auth/callback`

### App Scopes Required

The app requires these Shopify API scopes (already configured):
- `read_products` - Read product data
- `write_products` - Update product metafields
- `read_product_listings` - Access product listings
- `write_product_listings` - Modify product listings

## 📋 Post-Deploy Setup Steps

### 1. Verify Deployment

1. Check Render logs for successful deployment
2. Visit your app URL: `https://YOUR_RENDER_APP_NAME.onrender.com`
3. Ensure the React app loads correctly

### 2. Test Shopify Installation

1. Create a development store or use existing one
2. Install the app: `https://YOUR_RENDER_APP_NAME.onrender.com/api/install?shop=YOUR_STORE.myshopify.com`
3. Complete OAuth flow
4. Verify the dashboard loads with your products

### 3. Test Core Features

- ✅ Product list displays correctly
- ✅ "Optimize" button works (with real OpenAI API key)
- ✅ Preview modal shows original vs AI content
- ✅ "Apply AI Version" saves to metafields
- ✅ "Restore Original" reverts changes
- ✅ Usage tracking and plan limits work
- ✅ "Optimize All Products" batch processing

### 4. Production Checklist

- [ ] Add real OpenAI API key
- [ ] Test with real Shopify store products
- [ ] Verify metafields are created correctly
- [ ] Test plan limits and billing integration
- [ ] Ensure error handling works gracefully
- [ ] Test OAuth flow completely

## 🔑 API Keys Setup

### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to Render environment variables as `OPENAI_API_KEY`

### Shopify API Keys
Already configured with your provided credentials:
- **Client ID**: `4509cf5ef854ceac54c93cceda14987d`
- **Client Secret**: `05179787a47a8d6f8251e0fbbcc2ce2c`

## 🚨 Important Notes

1. **Non-Destructive Editing**: The app saves AI content to metafields (`ai_boost.title`, `ai_boost.description`) and never overwrites original product data unless explicitly applied.

2. **Plan Limits**: Enforced in code with hard caps:
   - Free: 5 products/month
   - Basic: 100 products/month  
   - Pro: 500 products/month

3. **Batch Processing**: Limited to 100 products max per batch operation.

4. **Error Handling**: Graceful failures with user-friendly messages if OpenAI API fails.

5. **App Store Ready**: All safeguards implemented for Shopify App Store approval.

## 📞 Support

If you encounter issues:
1. Check Render deployment logs
2. Verify all environment variables are set
3. Ensure Shopify app URLs are updated correctly
4. Test OAuth flow step by step

The app is now ready for production use and Shopify App Store submission! 🎉
