# 🗂️ AI Search Booster - Complete Backup Instructions

## 📦 Backup File
**Filename**: `ai-search-booster-v1.0-stable-backup-20250724_214239.zip`
**Size**: 1.26 MB
**Created**: July 24, 2025 21:42

## 📋 What's Included
✅ **Complete Source Code** (frontend + backend)
✅ **Configuration Files** (render.yaml, shopify.app.toml, etc.)
✅ **Theme App Extension** (Liquid templates)
✅ **Documentation** (README, deployment guides)
✅ **Test Files** (Jest tests, E2E tests)
✅ **GitHub Workflows** (CI/CD, deployments)
✅ **Environment Examples** (.env.example)
✅ **Stable Release Tag** (v1.0-stable-optimization)

## 🚫 Excluded (for size optimization)
- `node_modules/` folders (can be restored with `npm install`)
- `.git/` folder (use GitHub for version control)
- `logs/` and `*.log` files
- Large temporary files

## 🔄 Restoration Instructions

### 1. Extract Backup
```bash
# Extract to desired location
unzip ai-search-booster-v1.0-stable-backup-20250724_214239.zip -d restored-ai-search-booster
cd restored-ai-search-booster
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies  
cd client && npm install && cd ..
```

### 3. Configure Environment
```bash
# Copy environment examples
cp env.example.txt .env
cp server/.env.example server/.env
cp client/.env.example client/.env

# Edit with your actual values:
# - SHOPIFY_API_KEY
# - SHOPIFY_API_SECRET  
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - etc.
```

### 4. Deploy to Render
```bash
# Initialize git repository
git init
git add .
git commit -m "Restore from backup v1.0-stable-optimization"

# Add GitHub remote (create new repo if needed)
git remote add origin https://github.com/YOUR-USERNAME/ai-search-booster.git
git push -u origin main

# Render will auto-deploy from GitHub
```

### 5. Shopify App Setup
```bash
# If needed, recreate Shopify app
shopify app generate
# Follow prompts and update shopify.app.toml with your app details
```

## 🏷️ Git Tags Available
- `v1.0-stable-optimization` - Stable working optimization system
- Use `git checkout v1.0-stable-optimization` after restoration

## 🛡️ Working Features (Verified)
- ✅ Blog Optimization (Chunked v6.0-chunk, NO TRUNCATION)
- ✅ Product Optimization (Universal GPT-4o-mini)
- ✅ Schema Compliance (100% JSON validation)
- ✅ FAQ Normalization (All formats supported)
- ✅ Render Deployment (Auto-deploy ready)

## 🆘 Support
If restoration fails:
1. Check environment variables are set correctly
2. Verify Shopify app credentials
3. Ensure Render.com deployment settings match render.yaml
4. Check GitHub repository permissions

## 📞 Emergency Rollback
If live system breaks, use this backup to quickly restore:
```bash
# Quick deployment trigger
echo "DEPLOY_BACKEND_$(date +%Y%m%d_%H%M%S)" > server/DEPLOY_TRIGGER.txt
echo "DEPLOY_FRONTEND_$(date +%Y%m%d_%H%M%S)" > client/DEPLOY_TRIGGER.txt
git add . && git commit -m "Emergency restore from backup" && git push origin main
```