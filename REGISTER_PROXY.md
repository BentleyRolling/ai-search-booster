# 🚨 APP PROXY REGISTRATION REQUIRED

## Problem
Embedded iframe cannot make external requests due to browser security policies. App proxy registration is required.

## Solution
Run this command to register the app proxy:

```bash
cd /Users/bentleydevilling/Documents/AI\ Search\ Booster\ Rebuild/Success
shopify app deploy --force
```

## What it does
- Registers `/apps/ai-search-booster/*` → `https://ai-search-booster-backend.onrender.com/*`
- Enables same-origin API calls from embedded iframe
- Fixes the "0 products" issue immediately

## Configuration
The `shopify.app.toml` file contains:
```toml
[app_proxy]
url = "https://ai-search-booster-backend.onrender.com"
subpath = "apps/ai-search-booster"
```

## Expected Result
After registration:
- Network tab shows `/apps/ai-search-booster/api/products` with 200 status
- Dashboard displays real product count
- All API calls work through app proxy

## Status Check
Test proxy registration:
```bash
curl -s "https://aisearch-dev.myshopify.com/apps/ai-search-booster/health"
```

Should return JSON instead of HTML redirect.