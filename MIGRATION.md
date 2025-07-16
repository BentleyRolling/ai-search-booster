Migration Guide: v1 to v2
This guide helps you migrate from AI Search Booster v1 to v2.
🚨 Breaking Changes
Backend Changes
	1	New API Endpoints
	◦	/api/optimize → /api/optimize/products and /api/optimize/blogs
	◦	Added versioning support to all optimization endpoints
	◦	New webhook handlers for product updates
	2	Environment Variables # New in v2
	3	SHOPIFY_WEBHOOK_SECRET=required_for_webhooks
	4	BACKEND_URL=https://your-backend-url.com
	5	
	6	# Optional billing
	7	STRIPE_SECRET_KEY=sk_test_...
	8	BILLING_WEBHOOK_SECRET=whsec_...
	9	
	10	Metafield Structure
	◦	Changed from single optimized_content to versioned optimized_v1, optimized_v2, etc.
	◦	Added current_version pointer
	◦	Added original_backup for rollback support
Frontend Changes
	1	Authentication
	◦	Now uses authenticatedFetch from App Bridge
	◦	Proper session token handling
	◦	Redirect fallback support
	2	New Features
	◦	Product/Blog selection UI
	◦	Version display in history
	◦	Usage tracking dashboard
	◦	Real product fetching (no hardcoded IDs)
📋 Migration Steps
Step 1: Backup Everything
# Backup your database
pg_dump your_database > backup_$(date +%Y%m%d).sql

# Export metafields
shopify api export metafields --namespace ai_search_booster
Step 2: Update Backend
	1	Update Dependencies cd server
	2	npm install express-rate-limit
	3	npm update
	4	
	5	Update Environment Variables # Add to .env
	6	SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
	7	BACKEND_URL=https://your-backend.onrender.com
	8	
	9	Deploy New Backend git pull origin v2
	10	git push heroku main  # or your deployment method
	11	
Step 3: Migrate Metafields
Run this migration script to convert v1 metafields to v2 format:
// migrate-metafields.js
const migrateMetafields = async (shop, accessToken) => {
  // Get all products with v1 metafields
  const products = await fetch(`https://${shop}/admin/api/2024-01/products.json?fields=id`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  });
  
  for (const product of products.data.products) {
    // Get existing metafield
    const metafields = await fetch(
      `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=ai_search_booster&key=optimized_content`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    
    if (metafields.data.metafields.length > 0) {
      const oldContent = metafields.data.metafields[0].value;
      
      // Create v1 metafield
      await fetch(`https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metafield: {
            namespace: 'ai_search_booster',
            key: 'optimized_v1',
            value: oldContent,
            type: 'json'
          }
        })
      });
      
      // Set current version
      await fetch(`https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metafield: {
            namespace: 'ai_search_booster',
            key: 'current_version',
            value: '1',
            type: 'number_integer'
          }
        })
      });
      
      console.log(`Migrated product ${product.id}`);
    }
  }
};
Step 4: Update Frontend
	1	Install New Dependencies cd client
	2	npm install @shopify/app-bridge-utils
	3	npm update
	4	
	5	Update Components
	◦	Replace old Dashboard with new version
	◦	Update App.jsx with authenticated fetch
	◦	Add new routing structure
	6	Deploy Frontend npm run build
	7	# Deploy to your hosting
	8	
Step 5: Update Theme Extension
	1	Update Liquid File
	◦	Replace with new version that supports versioning
	◦	Update namespace handling
	◦	Add toggle settings
	2	Republish Extension shopify app deploy
	3	
Step 6: Register Webhooks
The new version automatically registers webhooks on install. For existing installations:
# Via Shopify CLI
shopify app generate webhook

# Or manually via API
curl -X POST "https://{shop}/admin/api/2024-01/webhooks.json" \
  -H "X-Shopify-Access-Token: {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "products/update",
      "address": "https://your-backend.com/webhooks/product_updated",
      "format": "json"
    }
  }'
✅ Post-Migration Checklist
	•	[ ] All environment variables updated
	•	[ ] Backend deployed and healthy
	•	[ ] Frontend showing new UI
	•	[ ] Metafields migrated to v2 format
	•	[ ] Theme extension updated
	•	[ ] Webhooks registered
	•	[ ] Test optimization on one product
	•	[ ] Test rollback functionality
	•	[ ] Verify version tracking works
🆘 Rollback Plan
If issues occur, you can rollback:
	1	Restore Backend git checkout v1
	2	git push --force
	3	
	4	Restore Database psql your_database < backup_20240115.sql
	5	
	6	Revert Metafields
	◦	Keep both v1 and v2 formats during transition
	◦	Theme extension can read both formats
📞 Support
Having issues with migration? Contact us:
	•	Email: support@aisearchbooster.com
	•	Slack: #migration-help
	•	Documentation: docs.aisearchbooster.com/migration
