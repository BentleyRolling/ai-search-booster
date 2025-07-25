# 🎯 AI Search Booster - Theme App Extension

## Overview
This Theme App Extension injects AI-optimized content into Shopify storefronts in a way that is **invisible to customers but fully visible to AI crawlers** (ChatGPT, Claude, Perplexity).

## 🏗️ File Structure
```
extensions/theme-app-extension/
├── shopify.extension.toml          # Extension configuration
├── blocks/
│   └── ai-search-booster-inject.liquid  # Main injection block
├── snippets/
│   ├── asb-product-inject.liquid   # Product page injection
│   └── asb-article-inject.liquid   # Article page injection
└── README.md                       # This file
```

## ✅ Features

### 🔍 Content Injection
- **Products**: Optimized titles, descriptions, content, FAQs
- **Articles**: Blog post optimization with semantic markup
- **Collections**: Category and product group optimization
- **Pages**: Static page content enhancement

### 🎭 Invisible to Customers
- Uses `display: none !important` and `aria-hidden="true"`
- Positioned off-screen with `left: -9999px`
- Zero impact on layout, SEO, or accessibility
- Wrapped in HTML comments for easy identification

### 🤖 LLM-Optimized Markup
- Semantic HTML (`<article>`, `<section>`, `<h2>`, `<ul>`, `<p>`)
- Schema.org structured data (JSON-LD)
- Proper heading hierarchy for AI readability
- Rich metadata for enhanced understanding

### ⚙️ Configuration Options
- Enable/disable injection globally
- Toggle specific content types (blog, product, collection, page)
- Control JSON-LD schema inclusion
- Theme editor integration

## 🚀 Installation Flow

### 1. App Bridge Activation
```javascript
// Auto-triggers on app install/open
app.dispatch({
  type: 'APP::APP_EMBED_BLOCK::ENABLE',
  payload: { type: 'ai-search-booster-inject' }
});
```

### 2. Theme Integration
The extension automatically injects into:
- **All pages** via `app-embed-block`
- **Specific templates** via template detection
- **Metafield-driven** content from backend optimization

### 3. Fallback Options
- Manual activation button in app dashboard
- Theme editor toggle controls
- Safe removal with comment markers

## 🔧 Backend Integration

### Metafield Structure
```javascript
// Optimized content stored in shop metafields
shop.metafields.asb_optimized['product_123'] = {
  optimizedTitle: "...",
  optimizedDescription: "...", 
  llmDescription: "...",
  summary: "...",
  content: "...",
  faqs: [
    { q: "...", a: "..." }
  ]
}
```

### Template Detection
```liquid
{% if template contains 'product' and enable_product and product %}
  {% assign product_id = product.id %}
  {% assign optimized_content = shop.metafields.asb_optimized['product_' | append: product_id] %}
  <!-- Inject optimized content -->
{% endif %}
```

## 📱 App Bridge Integration

### Components
- `AppBridgeActivation.jsx` - Handles extension activation
- Auto-modal on first app open
- Status tracking and manual activation
- Toast notifications for feedback

### Activation States
- `pending` - Waiting for activation
- `activated` - Successfully enabled
- `skipped` - User chose to skip
- `error` - Activation failed

## 🛡️ Safety Features

### Performance Protection
- Only injects when optimized content exists
- No placeholder or empty content injection
- Minimal DOM impact with hidden containers

### Theme Compatibility
- Works with all Online Store 2.0 themes
- No theme file modifications required
- Safe removal without breaking theme

### Accessibility Compliance
- `aria-hidden="true"` for screen readers
- `role="presentation"` for assistive technology
- Zero impact on site accessibility scores

## 🎨 CSS Hiding Strategy
```css
#ai-search-booster {
  display: none !important;
  visibility: hidden !important;
  position: absolute !important;
  left: -9999px !important;
  width: 0 !important;
  height: 0 !important;
}
```

## 📊 Schema.org Integration

### Supported Types
- `BlogPosting` for articles
- `Product` for products
- `CollectionPage` for collections
- `WebPage` for static pages

### Rich Metadata
- Publication dates and authors
- Product SKUs and pricing
- Collection item counts
- Semantic content structure

## 🔄 Deployment

### Development
```bash
shopify app dev
```

### Production
```bash
shopify app deploy
```

### Theme Extension Publish
```bash
shopify app publish
```

## 🧪 Testing

### Verification Steps
1. Check hidden div exists: `document.getElementById('ai-search-booster')`
2. Verify invisible to users: Element should not affect layout
3. Confirm content injection: Optimized content appears in hidden div
4. Validate schema: JSON-LD structured data present

### AI Crawler Testing
- Use browser dev tools to view injected content
- Verify semantic markup structure
- Check schema.org validation
- Test with AI search engines

## 📋 Troubleshooting

### Common Issues
1. **Extension not activating**: Check App Bridge integration
2. **Content not injecting**: Verify metafield data exists
3. **Theme compatibility**: Ensure Online Store 2.0 theme
4. **Performance impact**: Monitor page load times

### Debug Mode
Enable console logging in production:
```javascript
console.log('[AI Search Booster] Extension status:', status);
```

## 🔗 Integration Points

### Frontend Components
- Dashboard integration for activation status
- Settings panel for configuration
- Toast notifications for feedback

### Backend Endpoints
- Metafield storage for optimized content
- Template detection and content serving
- Analytics and usage tracking