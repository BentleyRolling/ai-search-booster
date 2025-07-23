# 🚀 Render Deployment Setup Instructions

## Step 1: Connect GitHub Repository to Render

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Blueprint"
3. Connect your GitHub account if not already connected
4. Select the repository: `BentleyRolling/ai-search-booster`
5. Render will automatically detect the `render.yaml` file

## Step 2: Configure Environment Variables

### Backend Service Environment Variables
Go to the backend service settings and add:

```
NODE_ENV=production
PORT=3000
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_secret_here
SHOPIFY_SCOPES=read_products,write_products,read_content,write_content,read_themes,write_themes
OPENAI_API_KEY=your_openai_api_key_here
APP_URL=https://ai-search-booster-backend.onrender.com
```

### Frontend Service Environment Variables
Go to the frontend service settings and add:

```
NODE_ENV=production
VITE_API_BASE_URL=https://ai-search-booster-backend.onrender.com
```

## Step 3: Deploy Services

1. Click "Create Blueprint" - this will create both services automatically
2. Monitor the deployment logs for both services
3. Wait for both services to complete deployment

## Step 4: Update Shopify App Settings

Once deployed, update your Shopify app configuration:

1. **App URL**: `https://ai-search-booster-frontend.onrender.com`
2. **Allowed redirection URLs**: 
   - `https://ai-search-booster-frontend.onrender.com/auth/callback`
   - `https://ai-search-booster-backend.onrender.com/auth/callback`

## Step 5: Test the Deployment

1. **Backend Health Check**: Visit `https://ai-search-booster-backend.onrender.com/health`
2. **Frontend**: Visit `https://ai-search-booster-frontend.onrender.com`
3. **Full Integration**: Install the app on a test Shopify store

## 📝 Notes

- **Free Tier Limitations**: Render free tier spins down after 15 minutes of inactivity
- **Cold Starts**: First request after spin-down may take 30-60 seconds
- **Monitoring**: Check Render dashboard for logs and metrics
- **SSL**: Both services get automatic HTTPS certificates

## 🔧 Troubleshooting

**If backend fails to start:**
- Check environment variables are set correctly
- Review deployment logs for specific error messages
- Ensure all required API keys are valid

**If frontend fails to build:**
- Check that `VITE_API_BASE_URL` points to the correct backend URL
- Verify Node.js version compatibility

**If services can't communicate:**
- Ensure CORS is properly configured in backend
- Check that frontend is using the correct backend URL

## 🎯 Expected Service URLs

- **Backend**: `https://ai-search-booster-backend.onrender.com`
- **Frontend**: `https://ai-search-booster-frontend.onrender.com`

Your deployment should be ready once both services show "Live" status in the Render dashboard!