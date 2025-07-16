import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Store for shop data (in production, use a database)
const shopData = new Map();

// Environment variables
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || '4509cf5ef854ceac54c93cceda14987d';
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SCOPES = process.env.SCOPES || 'read_products,write_products,read_content,write_content';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://ai-search-booster-backend.onrender.com/auth/callback';
const VERSIONED_OPTIMIZATION = process.env.VERSIONED_OPTIMIZATION === 'true';

// Rate limiting for optimization endpoints
const optimizationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each shop to 10 requests per windowMs
  message: 'Too many optimization requests, please try again later.',
  keyGenerator: (req) => req.shop || req.ip
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'AI Search Booster v2',
    version: '2.0.0',
    description: 'Optimize your Shopify store for AI/LLM visibility',
    endpoints: {
      auth: '/auth?shop=your-store.myshopify.com',
      optimize: {
        products: 'POST /api/optimize/products',
        blogs: 'POST /api/optimize/blogs',
        preview: 'POST /api/optimize/preview',
        status: 'GET /api/optimize/status/:type/:id'
      },
      rollback: 'POST /api/rollback/:type/:id',
      history: 'GET /api/history/:shop',
      metafields: 'GET /api/metafields/:type/:id'
    }
  });
});

// OAuth endpoints (keeping your working implementation)
app.get('/auth/status', (req, res) => {
  res.json({ 
    message: "Auth routes working!",
    apiKeyConfigured: !!SHOPIFY_API_KEY,
    secretConfigured: !!SHOPIFY_API_SECRET,
    openaiConfigured: !!OPENAI_API_KEY,
    anthropicConfigured: !!ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.get('/auth', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  const nonce = crypto.randomBytes(16).toString('hex');
  shopData.set(shop, { nonce });
  
  const authUrl = `https://${shop}/admin/oauth/authorize?` + 
    `client_id=${SHOPIFY_API_KEY}&` +
    `scope=${SCOPES}&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `state=${nonce}`;
  
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { shop, code, state, hmac } = req.query;
  
  if (!shop || !code || !state || !hmac) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  const storedData = shopData.get(shop);
  if (!storedData || storedData.nonce !== state) {
    return res.status(403).json({ error: 'Invalid nonce' });
  }
  
  // HMAC verification (using your working version)
  const rawQueryString = req.url.split('?')[1];
  if (!rawQueryString) {
    return res.status(400).json({ error: 'No query string found' });
  }
  
  const pairs = rawQueryString.split('&');
  const params = [];
  
  for (const pair of pairs) {
    const equalIndex = pair.indexOf('=');
    if (equalIndex === -1) continue;
    
    const key = pair.substring(0, equalIndex);
    
    if (key !== 'hmac' && key !== 'signature') {
      params.push({ key, original: pair });
    }
  }
  
  params.sort((a, b) => a.key.localeCompare(b.key));
  const message = params.map(p => p.original).join('&');
  
  const calculatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');
  
  if (calculatedHmac !== hmac) {
    return res.status(403).json({ error: 'HMAC verification failed' });
  }
  
  try {
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code
    });
    
    const { access_token } = tokenResponse.data;
    
    shopData.set(shop, { 
      ...storedData, 
      accessToken: access_token,
      installedAt: new Date().toISOString()
    });
    
    const embeddedAppUrl = `https://ai-search-booster-frontend.onrender.com/?shop=${shop}&host=${Buffer.from(`${shop}/admin`).toString('base64')}`;
    
    res.redirect(embeddedAppUrl);
    
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Function to verify session token
const verifySessionToken = (sessionToken) => {
  try {
    // For embedded apps, we need to verify the session token
    // This is a basic implementation - in production, use proper JWT verification
    if (!sessionToken) return false;
    
    // Session tokens start with 'Bearer ' prefix
    const token = sessionToken.replace('Bearer ', '');
    if (!token) return false;
    
    // Basic token validation - in production, verify with JWT library
    return token.length > 10; // Simple check
  } catch (error) {
    return false;
  }
};

// Middleware to verify shop authentication
const verifyShop = (req, res, next) => {
  // Get shop from different sources
  const shop = req.query.shop || req.body.shop || req.params.shop || req.headers['x-shopify-shop-domain'];
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  // For embedded apps, check session token from Authorization header
  const sessionToken = req.headers.authorization;
  if (!verifySessionToken(sessionToken)) {
    return res.status(401).json({ 
      error: 'Invalid session token', 
      shop,
      redirectUrl: `${req.protocol}://${req.get('host')}/auth?shop=${shop}`
    });
  }
  
  // Check if shop has valid access token from OAuth flow
  const shopInfo = shopData.get(shop);
  if (!shopInfo || !shopInfo.accessToken) {
    return res.status(401).json({ 
      error: 'Shop not authenticated', 
      shop,
      redirectUrl: `${req.protocol}://${req.get('host')}/auth?shop=${shop}`
    });
  }
  
  req.shopInfo = shopInfo;
  req.shop = shop;
  next();
};

// Helper: Get next version number
const getNextVersion = async (shop, resourceType, resourceId, accessToken) => {
  try {
    const endpoint = resourceType === 'product' 
      ? `products/${resourceId}/metafields`
      : `articles/${resourceId}/metafields`;
      
    const response = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=ai_search_booster`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    const metafields = response.data.metafields;
    let maxVersion = 0;
    
    metafields.forEach(mf => {
      const match = mf.key.match(/optimized_v(\d+)/);
      if (match) {
        maxVersion = Math.max(maxVersion, parseInt(match[1]));
      }
    });
    
    return maxVersion + 1;
  } catch (error) {
    return 1;
  }
};

// Helper: Store versioned metafield
const storeVersionedMetafield = async (shop, resourceType, resourceId, content, version, accessToken) => {
  const endpoint = resourceType === 'product' 
    ? `products/${resourceId}/metafields`
    : `articles/${resourceId}/metafields`;
    
  const metafields = [
    {
      namespace: 'ai_search_booster',
      key: `optimized_v${version}`,
      value: JSON.stringify(content),
      type: 'json'
    },
    {
      namespace: 'ai_search_booster',
      key: `optimized_v${version}_timestamp`,
      value: new Date().toISOString(),
      type: 'single_line_text_field'
    },
    {
      namespace: 'ai_search_booster',
      key: 'current_version',
      value: `optimized_v${version}`,
      type: 'single_line_text_field'
    }
  ];
  
  for (const metafield of metafields) {
    await axios.post(
      `https://${shop}/admin/api/2024-01/${endpoint}.json`,
      { metafield },
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
  }
};

// AI Optimization Engine
const optimizeContent = async (content, type, settings = {}) => {
  const { targetLLM = 'general', keywords = [], tone = 'professional' } = settings;
  
  const prompt = `
    Optimize this ${type} content for AI/LLM search visibility.
    Target: ${targetLLM}
    Keywords to emphasize: ${keywords.join(', ')}
    Tone: ${tone}
    
    Original content: ${JSON.stringify(content)}
    
    Generate:
    1. A concise summary (2-3 sentences)
    2. 3-5 FAQs in Q&A format
    3. Structured data (JSON-LD format)
    4. LLM-friendly description (plain language, keyword-rich)
    
    Return as JSON with keys: summary, faqs, jsonLd, llmDescription
  `;
  
  try {
    if (ANTHROPIC_API_KEY) {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      }, {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });
      
      return JSON.parse(response.data.content[0].text);
    } else if (OPENAI_API_KEY) {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } else {
      // Fallback: Simple optimization without AI
      return {
        summary: `${content.title || content.name} - A quality product available in our store.`,
        faqs: [
          {
            question: `What is ${content.title || content.name}?`,
            answer: content.description || 'A premium product from our collection.'
          }
        ],
        jsonLd: {
          "@context": "https://schema.org",
          "@type": type === 'product' ? "Product" : "Article",
          "name": content.title || content.name,
          "description": content.description || ''
        },
        llmDescription: content.description || `Learn about ${content.title || content.name}`
      };
    }
  } catch (error) {
    console.error('AI optimization error:', error);
    throw error;
  }
};

// API: Preview optimization
app.post('/api/optimize/preview', verifyShop, async (req, res) => {
  try {
    const { content, type, settings } = req.body;
    
    if (!content || !type) {
      return res.status(400).json({ error: 'Missing content or type' });
    }
    
    const optimized = await optimizeContent(content, type, settings);
    
    // Generate FAQ JSON-LD
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": optimized.faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };
    
    res.json({
      original: content,
      optimized,
      preview: {
        jsonLd: `<script type="application/ld+json">${JSON.stringify(optimized.jsonLd, null, 2)}</script>`,
        faqJsonLd: `<script type="application/ld+json">${JSON.stringify(faqJsonLd, null, 2)}</script>`,
        llmBlock: `<div data-llm style="display:none">${optimized.llmDescription}</div>`,
        faqs: optimized.faqs
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// API: Optimize products
app.post('/api/optimize/products', verifyShop, optimizationLimiter, async (req, res) => {
  try {
    const { productIds, settings } = req.body;
    const { shop, accessToken } = req.shopInfo;
    
    const results = [];
    
    for (const productId of productIds) {
      try {
        // Fetch product from Shopify
        const productResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${productId}.json`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        const product = productResponse.data.product;
        
        // Check if we need to store original backup
        const metafieldsResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json?namespace=ai_search_booster&key=original_backup`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        if (metafieldsResponse.data.metafields.length === 0) {
          // Store original as backup
          await axios.post(
            `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
            {
              metafield: {
                namespace: 'ai_search_booster',
                key: 'original_backup',
                value: JSON.stringify({
                  title: product.title,
                  description: product.body_html,
                  vendor: product.vendor,
                  product_type: product.product_type
                }),
                type: 'json'
              }
            },
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        }
        
        // Optimize content
        const optimized = await optimizeContent(product, 'product', settings);
        
        // Get next version number
        const version = VERSIONED_OPTIMIZATION 
          ? await getNextVersion(shop, 'product', productId, accessToken)
          : 1;
        
        // Store versioned optimization
        await storeVersionedMetafield(shop, 'product', productId, optimized, version, accessToken);
        
        results.push({
          productId,
          status: 'success',
          version: `v${version}`,
          optimized
        });
      } catch (error) {
        results.push({
          productId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    res.json({
      message: 'Products optimization complete',
      results
    });
  } catch (error) {
    console.error('Products optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize products' });
  }
});

// API: Optimize blogs
app.post('/api/optimize/blogs', verifyShop, optimizationLimiter, async (req, res) => {
  try {
    const { blogIds, articleIds, settings } = req.body;
    const { shop, accessToken } = req.shopInfo;
    
    const results = [];
    
    // If specific article IDs are provided
    if (articleIds && articleIds.length > 0) {
      for (const articleId of articleIds) {
        try {
          // Get article's blog ID first
          const articleResponse = await axios.get(
            `https://${shop}/admin/api/2024-01/articles/${articleId}.json`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
          
          const article = articleResponse.data.article;
          const blogId = article.blog_id;
          
          // Store original backup if not exists
          const metafieldsResponse = await axios.get(
            `https://${shop}/admin/api/2024-01/articles/${articleId}/metafields.json?namespace=ai_search_booster&key=original_backup`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
          
          if (metafieldsResponse.data.metafields.length === 0) {
            await axios.post(
              `https://${shop}/admin/api/2024-01/articles/${articleId}/metafields.json`,
              {
                metafield: {
                  namespace: 'ai_search_booster',
                  key: 'original_backup',
                  value: JSON.stringify({
                    title: article.title,
                    content: article.content,
                    summary: article.summary,
                    author: article.author,
                    tags: article.tags
                  }),
                  type: 'json'
                }
              },
              {
                headers: { 'X-Shopify-Access-Token': accessToken }
              }
            );
          }
          
          // Optimize content
          const optimized = await optimizeContent(article, 'article', settings);
          
          // Get next version number
          const version = VERSIONED_OPTIMIZATION 
            ? await getNextVersion(shop, 'article', articleId, accessToken)
            : 1;
          
          // Store versioned optimization
          await storeVersionedMetafield(shop, 'article', articleId, optimized, version, accessToken);
          
          results.push({
            articleId,
            blogId,
            status: 'success',
            version: `v${version}`,
            optimized
          });
        } catch (error) {
          results.push({
            articleId,
            status: 'error',
            error: error.message
          });
        }
      }
    }
    
    // If blog IDs are provided, get all articles from those blogs
    if (blogIds && blogIds.length > 0) {
      for (const blogId of blogIds) {
        try {
          const articlesResponse = await axios.get(
            `https://${shop}/admin/api/2024-01/blogs/${blogId}/articles.json`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
          
          const articles = articlesResponse.data.articles;
          
          for (const article of articles) {
            // Same optimization logic as above
            const articleId = article.id;
            
            try {
              // Store original backup if needed
              const metafieldsResponse = await axios.get(
                `https://${shop}/admin/api/2024-01/articles/${articleId}/metafields.json?namespace=ai_search_booster&key=original_backup`,
                {
                  headers: { 'X-Shopify-Access-Token': accessToken }
                }
              );
              
              if (metafieldsResponse.data.metafields.length === 0) {
                await axios.post(
                  `https://${shop}/admin/api/2024-01/articles/${articleId}/metafields.json`,
                  {
                    metafield: {
                      namespace: 'ai_search_booster',
                      key: 'original_backup',
                      value: JSON.stringify({
                        title: article.title,
                        content: article.content,
                        summary: article.summary,
                        author: article.author,
                        tags: article.tags
                      }),
                      type: 'json'
                    }
                  },
                  {
                    headers: { 'X-Shopify-Access-Token': accessToken }
                  }
                );
              }
              
              const optimized = await optimizeContent(article, 'article', settings);
              const version = VERSIONED_OPTIMIZATION 
                ? await getNextVersion(shop, 'article', articleId, accessToken)
                : 1;
              
              await storeVersionedMetafield(shop, 'article', articleId, optimized, version, accessToken);
              
              results.push({
                articleId,
                blogId,
                status: 'success',
                version: `v${version}`,
                optimized
              });
            } catch (error) {
              results.push({
                articleId,
                blogId,
                status: 'error',
                error: error.message
              });
            }
          }
        } catch (error) {
          results.push({
            blogId,
            status: 'error',
            error: error.message
          });
        }
      }
    }
    
    res.json({
      message: 'Blog optimization complete',
      results
    });
  } catch (error) {
    console.error('Blog optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize blogs' });
  }
});

// API: Get optimization status for specific item
app.get('/api/optimize/status/:type/:id', verifyShop, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { shop, accessToken } = req.shopInfo;
    
    const endpoint = type === 'product' 
      ? `products/${id}/metafields`
      : `articles/${id}/metafields`;
      
    const response = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=ai_search_booster`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    const metafields = response.data.metafields;
    const versions = [];
    let currentVersion = 'original';
    let hasOriginalBackup = false;
    
    metafields.forEach(mf => {
      if (mf.key === 'original_backup') {
        hasOriginalBackup = true;
      } else if (mf.key === 'current_version') {
        currentVersion = mf.value;
      } else if (mf.key.match(/optimized_v\d+$/)) {
        const timestamp = metafields.find(m => m.key === `${mf.key}_timestamp`)?.value;
        versions.push({
          version: mf.key,
          timestamp,
          size: JSON.stringify(mf.value).length
        });
      }
    });
    
    res.json({
      type,
      id,
      hasOriginalBackup,
      currentVersion,
      versions: versions.sort((a, b) => {
        const aNum = parseInt(a.version.match(/\d+/)[0]);
        const bNum = parseInt(b.version.match(/\d+/)[0]);
        return bNum - aNum;
      }),
      totalVersions: versions.length
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to fetch optimization status' });
  }
});

// API: Rollback optimization
app.post('/api/rollback/:type/:id', verifyShop, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { version = 'original' } = req.body;
    const { shop, accessToken } = req.shopInfo;
    
    const endpoint = type === 'product' 
      ? `products/${id}/metafields`
      : `articles/${id}/metafields`;
    
    // Update current version metafield
    const metafieldsResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=ai_search_booster&key=current_version`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    if (metafieldsResponse.data.metafields.length > 0) {
      const metafieldId = metafieldsResponse.data.metafields[0].id;
      await axios.put(
        `https://${shop}/admin/api/2024-01/metafields/${metafieldId}.json`,
        {
          metafield: {
            value: version,
            type: 'single_line_text_field'
          }
        },
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
    } else {
      // Create current version metafield
      await axios.post(
        `https://${shop}/admin/api/2024-01/${endpoint}.json`,
        {
          metafield: {
            namespace: 'ai_search_booster',
            key: 'current_version',
            value: version,
            type: 'single_line_text_field'
          }
        },
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
    }
    
    res.json({
      message: `Successfully rolled back to ${version}`,
      type,
      id,
      version
    });
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Failed to rollback' });
  }
});

// API: Get metafields for a resource
app.get('/api/metafields/:type/:id', verifyShop, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { shop, accessToken } = req.shopInfo;
    
    const endpoint = type === 'product' 
      ? `products/${id}/metafields`
      : `articles/${id}/metafields`;
      
    const response = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=ai_search_booster`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    const metafields = response.data.metafields;
    const result = {};
    
    metafields.forEach(mf => {
      if (mf.type === 'json') {
        result[mf.key] = JSON.parse(mf.value);
      } else {
        result[mf.key] = mf.value;
      }
    });
    
    res.json(result);
  } catch (error) {
    console.error('Metafields error:', error);
    res.status(500).json({ error: 'Failed to fetch metafields' });
  }
});

// API: Get optimization history
app.get('/api/history/:shop', verifyShop, async (req, res) => {
  try {
    const { shop } = req.params;
    const { accessToken } = req.shopInfo;
    
    const history = [];
    
    // Get recent products with our metafields
    const productsResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/products.json?limit=50&fields=id,title`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    for (const product of productsResponse.data.products) {
      const metafieldsResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=ai_search_booster`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
      
      if (metafieldsResponse.data.metafields.length > 0) {
        const versions = metafieldsResponse.data.metafields
          .filter(mf => mf.key.match(/optimized_v\d+_timestamp$/))
          .map(mf => ({
            version: mf.key.replace('_timestamp', ''),
            timestamp: mf.value
          }));
          
        if (versions.length > 0) {
          history.push({
            type: 'product',
            id: product.id,
            title: product.title,
            versions: versions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          });
        }
      }
    }
    
    res.json({
      shop,
      history: history.sort((a, b) => {
        const aLatest = a.versions[0]?.timestamp || '0';
        const bLatest = b.versions[0]?.timestamp || '0';
        return new Date(bLatest) - new Date(aLatest);
      })
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// API: Get usage statistics
app.get('/api/usage', verifyShop, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopInfo;
    
    // This is a stub - in production, track usage in database
    const usage = {
      shop,
      optimizations: {
        products: 0,
        blogs: 0,
        total: 0
      },
      aiCalls: {
        today: 0,
        thisMonth: 0,
        total: 0
      },
      limits: {
        monthlyOptimizations: 1000,
        dailyAICalls: 100
      }
    };
    
    // Count actual optimizations
    const productsResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    for (const product of productsResponse.data.products) {
      const metafieldsResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=ai_search_booster&limit=1`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
      
      if (metafieldsResponse.data.metafields.length > 0) {
        usage.optimizations.products++;
        usage.optimizations.total++;
      }
    }
    
    res.json(usage);
  } catch (error) {
    console.error('Usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// API: Get status
app.get('/api/status', verifyShop, async (req, res) => {
  try {
    const { shop, accessToken } = req.shopInfo;
    
    // Count products
    const productsResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/products/count.json`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    // Count blogs
    const blogsResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/blogs/count.json`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    res.json({
      shop,
      totalProducts: productsResponse.data.count,
      totalBlogs: blogsResponse.data.count,
      optimizedProducts: 0, // Would need to iterate through all products
      optimizedBlogs: 0, // Would need to iterate through all articles
      aiProvider: ANTHROPIC_API_KEY ? 'Claude' : OPENAI_API_KEY ? 'OpenAI' : 'Basic',
      features: {
        productsOptimization: true,
        blogsOptimization: true,
        rollback: true,
        preview: true,
        versioning: VERSIONED_OPTIMIZATION
      }
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Simplified auth middleware for mock endpoints
const simpleVerifyShop = (req, res, next) => {
  const shop = req.query.shop || req.body.shop || req.params.shop || req.headers['x-shopify-shop-domain'];
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  // Create or get shop info for mock data
  let shopInfo = shopData.get(shop);
  if (!shopInfo) {
    shopInfo = { accessToken: 'mock-token', installedAt: new Date().toISOString() };
    shopData.set(shop, shopInfo);
  }
  
  req.shopInfo = shopInfo;
  req.shop = shop;
  next();
};

// API: Get products
app.get('/api/products', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    const { limit = 50, page = 1 } = req.query;
    
    // For now, return mock data since we don't have OAuth token
    // In production, this would fetch from Shopify API
    const products = [
      {
        id: 1,
        title: 'Sample Product 1',
        handle: 'sample-product-1',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        optimized: false
      },
      {
        id: 2,
        title: 'Sample Product 2', 
        handle: 'sample-product-2',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        optimized: false
      }
    ];
    
    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: products.length
      }
    });
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// API: Get blogs
app.get('/api/blogs', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    const { limit = 50, page = 1 } = req.query;
    
    // For now, return mock data since we don't have OAuth token
    // In production, this would fetch from Shopify API
    const blogs = [
      {
        id: 1,
        title: 'Sample Blog 1',
        handle: 'sample-blog-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        articles: [
          {
            id: 101,
            title: 'Sample Article 1',
            handle: 'sample-article-1',
            optimized: false
          }
        ]
      }
    ];
    
    res.json({
      blogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: blogs.length
      }
    });
  } catch (error) {
    console.error('Blogs error:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '2.0.0',
    timestamp: new Date().toISOString() 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Search Booster v2 running on port ${PORT}`);
  console.log('Configuration:');
  console.log(`- Shopify API: ${SHOPIFY_API_KEY ? '✓' : '✗'}`);
  console.log(`- Shopify Secret: ${SHOPIFY_API_SECRET ? '✓' : '✗'}`);
  console.log(`- OpenAI API: ${OPENAI_API_KEY ? '✓' : '✗'}`);
  console.log(`- Anthropic API: ${ANTHROPIC_API_KEY ? '✓' : '✗'}`);
  console.log(`- Versioned Optimization: ${VERSIONED_OPTIMIZATION ? '✓' : '✗'}`);
});

export default app;