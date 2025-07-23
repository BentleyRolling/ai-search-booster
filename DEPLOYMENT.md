# AI Search Booster - Render Deployment Guide

## 🚀 Quick Deploy to Render

This app is configured for automated deployment to Render with the included `render.yaml` file.

### Prerequisites
- GitHub repository connected to Render
- Environment variables configured in Render dashboard

### 📦 Services

**Backend API** (`ai-search-booster-backend`)
- Runtime: Node.js 18
- Build: `cd server && npm install`
- Start: `cd server && npm start`
- Port: 3000

**Frontend Client** (`ai-search-booster-frontend`) 
- Runtime: Node.js 18 (Static Site)
- Build: `cd client && npm install && npm run build`
- Serve: Static files from `./client/dist`

### 🔧 Environment Variables

#### Backend Required:
```
NODE_ENV=production
PORT=3000
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_secret
SHOPIFY_SCOPES=read_products,write_products,read_content,write_content,read_themes,write_themes
OPENAI_API_KEY=your_openai_key
APP_URL=https://your-backend-url.onrender.com
```

#### Frontend Required:
```
NODE_ENV=production
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

### 📋 Deployment Steps

1. **Connect Repository**: Link your GitHub repo to Render
2. **Set Environment Variables**: Add all required env vars in Render dashboard
3. **Deploy**: Render will auto-deploy using the `render.yaml` configuration
4. **Verify**: Both services should deploy automatically

### 🔗 Service URLs
- Backend API: `https://ai-search-booster-backend.onrender.com`
- Frontend: `https://ai-search-booster-frontend.onrender.com`

### 📊 Monitoring
- Check Render dashboard for deployment status
- View logs for troubleshooting
- Monitor service health and performance

### 🛠 Manual Deployment (Alternative)

If needed, you can also deploy manually:

**Backend:**
```bash
# In Render dashboard, create new Web Service
# Runtime: Node
# Build Command: cd server && npm install
# Start Command: cd server && npm start
```

**Frontend:**
```bash
# In Render dashboard, create new Static Site
# Build Command: cd client && npm install && npm run build
# Publish Directory: client/dist
```

### 🔒 Security Notes
- All secrets should be stored as environment variables in Render
- Never commit API keys or secrets to the repository
- Use HTTPS for all production URLs
- Configure proper CORS settings for cross-origin requests