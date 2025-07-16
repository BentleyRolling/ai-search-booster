AI Search Booster v2
🚀 Optimize your Shopify store for AI/LLM visibility - Help your products appear in ChatGPT, Claude, Perplexity, and other AI search results.
🎯 What It Does
AI Search Booster helps Shopify merchants increase their store's visibility in AI-powered search results by:
	•	Generating AI-optimized content using Claude or OpenAI
	•	Injecting structured data (JSON-LD) for better parsing
	•	Adding hidden LLM-friendly blocks that AI can understand
	•	Versioning all changes (v1, v2, etc.) with full rollback support
	•	Never destroying original content - everything is reversible
🏗️ Architecture
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Shopify App   │────▶│  Backend API    │────▶│  AI Provider    │
│   (React SPA)   │     │  (Express.js)   │     │ (Claude/OpenAI) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Theme Extension │     │   Metafields    │
│   (Liquid)      │     │  (Versioned)    │
└─────────────────┘     └─────────────────┘
🚀 Quick Start
Prerequisites
	•	Node.js 18+
	•	Shopify Partner account
	•	Shopify development store
	•	OpenAI or Anthropic API key
	•	Render account (or similar hosting)
1. Clone & Setup
git clone https://github.com/yourusername/ai-search-booster.git
cd ai-search-booster

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
2. Environment Configuration
Copy .env.example to .env and fill in your values:
# Backend (.env)
SHOPIFY_API_KEY=4509cf5ef854ceac54c93cceda14987d
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Choose AI provider (at least one required)
ANTHROPIC_API_KEY=sk-ant-your-key  # Recommended
OPENAI_API_KEY=sk-your-key

# Server
PORT=3000
BACKEND_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-frontend.onrender.com
3. Deploy Backend
Deploy to Render (or your preferred platform):
# Push to GitHub first
git add .
git commit -m "Initial deployment"
git push origin main

# On Render:
1. Create new Web Service
2. Connect GitHub repo
3. Set build command: cd server && npm install
4. Set start command: cd server && npm start
5. Add environment variables
6. Deploy
4. Deploy Frontend
# Build frontend
cd client
npm run build

# Deploy to Render Static Site:
1. Create new Static Site
2. Connect same GitHub repo
3. Set build command: cd client && npm install && npm run build
4. Set publish directory: client/dist
5. Deploy
5. Configure Shopify App
In Shopify Partners dashboard:
	1	App Setup → URLs
	◦	App URL: https://your-backend.onrender.com/auth
	◦	Allowed redirection URLs:
	▪	https://your-backend.onrender.com/auth/callback
	▪	https://your-frontend.onrender.com/
	2	App Setup → API access
	◦	Enable these scopes:
	▪	read_products
	▪	write_products
	▪	read_content
	▪	write_content
	3	Distribution
	◦	Choose "Custom distribution" for development
	◦	Add your development store
6. Install Theme Extension
# In your app directory
shopify app generate extension

# Choose: Theme app extension
# Name: ai-search-booster

# Copy the liquid file
cp theme-app-extension/blocks/ai-search-booster.liquid \
   extensions/ai-search-booster/blocks/

# Deploy
shopify app deploy
📖 Usage Guide
For Merchants
	1	Install the app on your Shopify store
	2	Configure settings:
	◦	Target AI platform (ChatGPT, Claude, Perplexity, or All)
	◦	Keywords to emphasize
	◦	Tone of voice
	3	Select products/blogs to optimize
	4	Preview changes before applying
	5	Monitor progress with visual tracking
	6	Rollback anytime to any previous version
For Developers
API Endpoints
// Authentication
GET  /auth?shop={shop-domain}
GET  /auth/callback
GET  /auth/status

// Optimization
POST /api/optimize/products
POST /api/optimize/blogs
POST /api/optimize/preview

// Management
POST /api/rollback/:type/:id
GET  /api/history/:shop
GET  /api/usage/:shop
GET  /api/status

// Resources
GET  /api/products
GET  /api/blogs

// Webhooks
POST /webhooks/product_updated
POST /webhooks/app_uninstalled
Frontend Components
// Main dashboard with tabs
<Dashboard />
  ├── <StatusCards />      // Overview metrics
  ├── <SettingsPanel />    // AI configuration
  ├── <ProductsTab />      // Product selection
  ├── <BlogsTab />         // Blog selection
  ├── <PreviewSection />   // Preview optimizations
  └── <HistoryTable />     // Version history
Metafield Structure
{
  "namespace": "ai_search_booster",
  "keys": {
    "original_backup": {},      // Original content
    "optimized_v1": {},         // Version 1
    "optimized_v2": {},         // Version 2
    "current_version": 2        // Active version
  }
}
🔧 Configuration
AI Providers
Claude (Anthropic) - Recommended
	•	Better context understanding
	•	More reliable structured output
	•	Superior for complex content
OpenAI (GPT-3.5/4)
	•	Faster response times
	•	More cost-effective
	•	Good for simple optimizations
Rate Limiting
// Default limits (configurable)
const limits = {
  api: 50,        // requests per 15 minutes
  optimize: 100,  // products per hour
  preview: 200    // previews per hour
};
Billing Tiers
const plans = {
  free: {
    optimizations: 50,    // per month
    rollbacks: unlimited,
    previews: unlimited
  },
  pro: {
    optimizations: 500,
    priority: true,
    support: true
  }
};
🛡️ Security
	•	OAuth 2.0 for Shopify authentication
	•	HMAC verification for webhooks
	•	Rate limiting on all endpoints
	•	Authenticated fetch for frontend API calls
	•	Environment variables for secrets
	•	Non-destructive operations only
📊 Monitoring
Key Metrics
	•	Optimization success rate
	•	AI API response times
	•	Rollback frequency
	•	Version distribution
	•	Usage by plan
Recommended Tools
	•	APM: New Relic, DataDog
	•	Errors: Sentry
	•	Analytics: Mixpanel
	•	Uptime: Pingdom
🐛 Troubleshooting
Common Issues
"Cannot GET /auth"
	•	Check backend deployment
	•	Verify environment variables
	•	Ensure OAuth URLs are correct
AI optimization fails
	•	Verify API keys are valid
	•	Check rate limits
	•	Ensure sufficient credits
Metafields not saving
	•	Verify app scopes
	•	Check API version
	•	Ensure proper authentication
Theme extension not showing
	•	Publish theme extension
	•	Check template targeting
	•	Verify metafield namespace
🤝 Contributing
	1	Fork the repository
	2	Create feature branch (git checkout -b feature/amazing)
	3	Commit changes (git commit -m 'Add amazing feature')
	4	Push to branch (git push origin feature/amazing)
	5	Open Pull Request
📄 License
MIT License - see LICENSE file for details
🆘 Support
	•	Documentation: docs.aisearchbooster.com
	•	Issues: GitHub Issues
	•	Email: support@aisearchbooster.com
	•	Discord: Join our community

Built with ❤️ for Shopify merchants who want to win at AI search
