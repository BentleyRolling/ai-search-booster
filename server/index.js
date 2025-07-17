import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - Permissive CORS for embedded iframe (TEMPORARY until proxy registered)
const corsOptions = {
  origin: (origin, callback) => {
    console.log('[ASB-CORS] Origin check:', origin);
    // Allow all origins for now - will revert to restricted list once proxy works
    callback(null, true);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Shopify-Shop-Domain',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'Date'],
  optionsSuccessStatus: 200,
  // Chrome 115+ private network access
  preflightContinue: false
};

// Add CORS debugging
app.use((req, res, next) => {
  console.log('[ASB-CORS] Request from origin:', req.headers.origin);
  console.log('[ASB-CORS] Request method:', req.method);
  console.log('[ASB-CORS] Request path:', req.path);
  next();
});

app.use(cors(corsOptions));
// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));
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
const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Rate limiting for optimization endpoints
const optimizationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each shop to 10 requests per windowMs
  message: 'Too many optimization requests, please try again later.',
  keyGenerator: (req) => req.shop || req.ip
});

// Middleware to handle Shopify app proxy requests
app.use('/apps/ai-search-booster', (req, res, next) => {
  console.log('App proxy request received:', req.path, req.query);
  
  // Extract shop from query parameters (Shopify adds this automatically)
  const shop = req.query.shop;
  if (shop) {
    req.headers['x-shopify-shop-domain'] = shop;
  }
  
  // Strip the /apps/ai-search-booster prefix and continue
  req.url = req.url.replace('/apps/ai-search-booster', '');
  if (req.url === '') req.url = '/';
  
  console.log('Proxied request to:', req.url, 'for shop:', shop);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const isProxyRequest = req.headers['x-forwarded-host'] && req.headers['x-forwarded-host'].includes('myshopify.com');
  
  res.json({
    status: 'healthy',
    name: 'AI Search Booster v2',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    proxy: {
      detected: isProxyRequest,
      headers: isProxyRequest ? {
        'x-forwarded-host': req.headers['x-forwarded-host'],
        'x-forwarded-proto': req.headers['x-forwarded-proto']
      } : null
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'AI Search Booster v2',
    version: '2.0.0',
    description: 'Optimize your Shopify store for AI/LLM visibility',
    endpoints: {
      health: 'GET /health',
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
  console.log('Auth callback received:', req.query);
  
  const { shop, code, state, hmac } = req.query;
  
  if (!shop || !code || !state || !hmac) {
    console.error('Missing required parameters:', { shop, code: !!code, state: !!state, hmac: !!hmac });
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  const storedData = shopData.get(shop);
  if (!storedData || storedData.nonce !== state) {
    console.error('Invalid nonce:', { storedData, state });
    return res.status(403).json({ error: 'Invalid nonce' });
  }
  
  // Skip HMAC verification for now to test the flow
  if (!SHOPIFY_API_SECRET) {
    console.warn('SHOPIFY_API_SECRET not configured - skipping HMAC verification');
  } else {
    // HMAC verification
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
      console.error('HMAC verification failed:', { calculatedHmac, hmac });
      return res.status(403).json({ error: 'HMAC verification failed' });
    }
  }
  
  try {
    console.log('Exchanging code for access token...');
    const tokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code
    });
    
    const { access_token } = tokenResponse.data;
    console.log('Token exchange successful for shop:', shop);
    
    shopData.set(shop, { 
      ...storedData, 
      accessToken: access_token,
      installedAt: new Date().toISOString()
    });
    
    const host = Buffer.from(`${shop}/admin`).toString('base64');
    const embeddedAppUrl = `https://ai-search-booster-frontend.onrender.com/?shop=${shop}&host=${host}`;
    
    console.log('Redirecting to:', embeddedAppUrl);
    res.redirect(embeddedAppUrl);
    
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    
    // If token exchange fails, still redirect to frontend with error
    const host = Buffer.from(`${shop}/admin`).toString('base64');
    const errorUrl = `https://ai-search-booster-frontend.onrender.com/?shop=${shop}&host=${host}&error=token_exchange_failed`;
    
    console.log('Redirecting to frontend with error:', errorUrl);
    res.redirect(errorUrl);
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
  
  // If in mock mode, use fallback
  if (MOCK_MODE) {
    return {
      summary: `${content.title || content.name} - A quality product available in our store.`,
      faqs: [
        {
          question: `What is ${content.title || content.name}?`,
          answer: content.description || content.body_html || content.content || 'A premium product from our collection.'
        },
        {
          question: `What are the benefits of ${content.title || content.name}?`,
          answer: `${content.title || content.name} offers exceptional quality and value for our customers.`
        }
      ],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": type === 'product' ? "Product" : "Article",
        "name": content.title || content.name,
        "description": content.description || content.body_html || content.content || ''
      },
      llmDescription: content.description || content.body_html || content.content || `Learn about ${content.title || content.name}`
    };
  }
  
  // Real AI optimization with OpenAI API
  const prompt = `You are an expert e-commerce content optimizer. Your task is to optimize ${type} content for AI/LLM search visibility and better customer engagement.

Target LLM: ${targetLLM}
Keywords to emphasize: ${keywords.join(', ')}
Tone: ${tone}

Original content: ${JSON.stringify(content)}

Please generate optimized content that includes:
1. An optimized title (if it's a product)
2. An optimized description/body content
3. A concise summary (2-3 sentences)
4. 3-5 relevant FAQs in Q&A format
5. Structured data (JSON-LD format)
6. LLM-friendly description (plain language, keyword-rich)

Return ONLY a valid JSON object with keys: optimizedTitle, optimizedDescription, summary, faqs, jsonLd, llmDescription

Make sure the content is engaging, keyword-rich, and optimized for search engines and AI understanding.`;
  
  try {
    if (OPENAI_API_KEY) {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const aiResponse = response.data.choices[0].message.content;
      return JSON.parse(aiResponse);
    } else if (ANTHROPIC_API_KEY) {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500
      }, {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      });
      
      const aiResponse = response.data.content[0].text;
      return JSON.parse(aiResponse);
    } else {
      // Fallback when no AI API keys are available
      return {
        optimizedTitle: content.title || content.name,
        optimizedDescription: content.description || content.body_html || content.content || 'A premium product from our collection.',
        summary: `${content.title || content.name} - A quality product available in our store.`,
        faqs: [
          {
            question: `What is ${content.title || content.name}?`,
            answer: content.description || content.body_html || content.content || 'A premium product from our collection.'
          }
        ],
        jsonLd: {
          "@context": "https://schema.org",
          "@type": type === 'product' ? "Product" : "Article",
          "name": content.title || content.name,
          "description": content.description || content.body_html || content.content || ''
        },
        llmDescription: content.description || content.body_html || content.content || `Learn about ${content.title || content.name}`
      };
    }
  } catch (error) {
    console.error('AI optimization error:', error);
    // Return fallback on error
    return {
      optimizedTitle: content.title || content.name,
      optimizedDescription: content.description || content.body_html || content.content || 'A premium product from our collection.',
      summary: `${content.title || content.name} - A quality product available in our store.`,
      faqs: [
        {
          question: `What is ${content.title || content.name}?`,
          answer: content.description || content.body_html || content.content || 'A premium product from our collection.'
        }
      ],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": type === 'product' ? "Product" : "Article",
        "name": content.title || content.name,
        "description": content.description || content.body_html || content.content || ''
      },
      llmDescription: content.description || content.body_html || content.content || `Learn about ${content.title || content.name}`
    };
  }
};

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

// API: Preview optimization
app.post('/api/optimize/preview', simpleVerifyShop, async (req, res) => {
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
app.post('/api/optimize/products', async (req, res) => {
  try {
    const { productIds, settings } = req.body;
    const shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    // Get shop info for access token
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ 
        error: 'Shop not authenticated', 
        redirectUrl: `/auth?shop=${shop}`
      });
    }
    
    const { accessToken } = shopInfo;
    const results = [];
    
    for (const productId of productIds) {
      try {
        // Fetch product from Shopify API
        const productResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${productId}.json`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        const product = productResponse.data.product;
        
        // Store original as backup if not already stored
        const metafieldsResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json?namespace=ai_search_booster&key=original_backup`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        if (metafieldsResponse.data.metafields.length === 0) {
          await axios.post(
            `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
            {
              metafield: {
                namespace: 'ai_search_booster',
                key: 'original_backup',
                value: JSON.stringify({
                  title: product.title,
                  body_html: product.body_html,
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
        
        // Optimize content using AI
        const optimized = await optimizeContent(product, 'product', settings);
        
        // Update the product with optimized content
        const updateData = {
          product: {
            id: productId
          }
        };
        
        // Only update if we have optimized content
        if (optimized.optimizedTitle) {
          updateData.product.title = optimized.optimizedTitle;
        }
        if (optimized.optimizedDescription) {
          updateData.product.body_html = optimized.optimizedDescription;
        }
        
        // Update product in Shopify
        await axios.put(
          `https://${shop}/admin/api/2024-01/products/${productId}.json`,
          updateData,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        // Store optimization metadata
        await axios.post(
          `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
          {
            metafield: {
              namespace: 'ai_search_booster',
              key: 'optimization_data',
              value: JSON.stringify({
                optimized,
                settings,
                timestamp: new Date().toISOString()
              }),
              type: 'json'
            }
          },
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        results.push({
          productId,
          status: 'success',
          version: 'v1',
          optimized,
          originalTitle: product.title,
          newTitle: optimized.optimizedTitle || product.title
        });
      } catch (error) {
        console.error(`Error optimizing product ${productId}:`, error);
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
app.post('/api/optimize/blogs', simpleVerifyShop, optimizationLimiter, async (req, res) => {
  try {
    const { blogIds, articleIds, settings } = req.body;
    const { shop } = req;
    
    const results = [];
    
    // If specific article IDs are provided
    if (articleIds && articleIds.length > 0) {
      for (const articleId of articleIds) {
        try {
          // Use mock article data instead of Shopify API
          const article = {
            id: articleId,
            title: 'Sample Article ' + articleId,
            content: 'This is a sample blog article with valuable content about our products and services.',
            summary: 'A helpful article',
            author: 'Blog Author',
            tags: 'tips, advice, products'
          };
          
          // Optimize content
          const optimized = await optimizeContent(article, 'article', settings);
          
          results.push({
            articleId,
            blogId: 1,
            status: 'success',
            version: 'v1',
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
    
    // If blog IDs are provided, create mock articles
    if (blogIds && blogIds.length > 0) {
      for (const blogId of blogIds) {
        try {
          // Mock article for each blog
          const article = {
            id: blogId * 100 + 1,
            title: 'Sample Blog Article for Blog ' + blogId,
            content: 'This is a sample blog article with valuable content.',
            summary: 'A helpful article',
            author: 'Blog Author',
            tags: 'tips, advice'
          };
          
          const optimized = await optimizeContent(article, 'article', settings);
          
          results.push({
            articleId: article.id,
            blogId,
            status: 'success',
            version: 'v1',
            optimized
          });
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
app.get('/api/optimize/status/:type/:id', simpleVerifyShop, async (req, res) => {
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
app.post('/api/rollback/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { version = 'original' } = req.body;
    const shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    // Get shop info for access token
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ 
        error: 'Shop not authenticated', 
        redirectUrl: `/auth?shop=${shop}`
      });
    }
    
    const { accessToken } = shopInfo;
    
    if (type === 'product') {
      // Get original backup from metafields
      const metafieldsResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/products/${id}/metafields.json?namespace=ai_search_booster&key=original_backup`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
      
      if (metafieldsResponse.data.metafields.length > 0) {
        const originalData = JSON.parse(metafieldsResponse.data.metafields[0].value);
        
        // Restore original product content
        const updateData = {
          product: {
            id: parseInt(id),
            title: originalData.title,
            body_html: originalData.body_html,
            vendor: originalData.vendor,
            product_type: originalData.product_type
          }
        };
        
        await axios.put(
          `https://${shop}/admin/api/2024-01/products/${id}.json`,
          updateData,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        // Remove optimization metadata
        const optimizationMetafields = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${id}/metafields.json?namespace=ai_search_booster&key=optimization_data`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        for (const metafield of optimizationMetafields.data.metafields) {
          await axios.delete(
            `https://${shop}/admin/api/2024-01/metafields/${metafield.id}.json`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        }
        
        res.json({
          message: `Successfully rolled back product ${id} to original version`,
          type,
          id,
          version: 'original',
          restoredData: originalData
        });
      } else {
        res.status(404).json({ error: 'No original backup found for this product' });
      }
    } else {
      res.status(400).json({ error: 'Rollback for articles not implemented yet' });
    }
  } catch (error) {
    console.error('Rollback error:', error);
    res.status(500).json({ error: 'Failed to rollback: ' + error.message });
  }
});

// API: Get metafields for a resource
app.get('/api/metafields/:type/:id', simpleVerifyShop, async (req, res) => {
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
app.get('/api/history/:shop', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req.params;
    
    // Return mock history data - no Shopify API calls
    const history = [];
    
    res.json({
      shop,
      history
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// API: Get usage statistics
app.get('/api/usage', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    
    // Return mock usage data - no Shopify API calls
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
    
    res.json(usage);
  } catch (error) {
    console.error('Usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

// API: Get status
app.get('/api/status', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    
    // Return mock data - no Shopify API calls
    res.json({
      shop,
      totalProducts: 25,
      totalBlogs: 3,
      optimizedProducts: 0,
      optimizedBlogs: 0,
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

// API: Get products
app.get('/api/products', async (req, res) => {
  try {
    const shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    const { limit = 50, page = 1 } = req.query;
    
    // Log proxy detection for debugging
    const isProxyRequest = req.headers['x-forwarded-host'] && req.headers['x-forwarded-host'].includes('myshopify.com');
    const userAgent = req.headers['user-agent'] || '';
    const isEmbeddedApp = userAgent.includes('Shopify') || req.headers['sec-fetch-site'] === 'same-origin';
    
    console.log('[ASB-DEBUG] Products API called:', {
      shop,
      isProxyRequest,
      isEmbeddedApp,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: userAgent.substring(0, 100),
      forwardedHost: req.headers['x-forwarded-host']
    });
    
    if (isEmbeddedApp && !isProxyRequest) {
      console.log('[ASB-CI] ⚠️ WARNING: Embedded app request without proxy detected!');
      console.log('[ASB-CI] This suggests the Shopify app proxy is not configured correctly.');
      console.log('[ASB-CI] Expected: x-forwarded-host should contain myshopify.com');
      console.log('[ASB-CI] Actual headers:', JSON.stringify(req.headers, null, 2));
    }
    
    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    // Check if shop has valid access token from OAuth flow
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      console.log('No valid OAuth token, returning mock data for shop:', shop);
      // Return mock data when no OAuth token
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
      
      return res.json({
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: products.length
        }
      });
    }
    
    // Fetch real products from Shopify API
    console.log('Fetching real products from Shopify for shop:', shop);
    const { accessToken } = shopInfo;
    
    const response = await axios.get(
      `https://${shop}/admin/api/2024-01/products.json?limit=${limit}&page=${page}&fields=id,title,handle,status,created_at,updated_at`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    const shopifyProducts = response.data.products.map(product => ({
      id: product.id,
      title: product.title,
      handle: product.handle,
      status: product.status,
      created_at: product.created_at,
      updated_at: product.updated_at,
      optimized: false // TODO: Check if product has optimization metafields
    }));
    
    console.log(`Fetched ${shopifyProducts.length} real products from Shopify`);
    
    res.json({
      products: shopifyProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: shopifyProducts.length
      }
    });
  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({ error: 'Failed to fetch products: ' + error.message });
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