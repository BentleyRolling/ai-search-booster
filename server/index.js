import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initCitationJobs } from './jobs/citationScheduler.js';
import { initializeCitationRoutes } from './routes/citations.js';

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

// Initialize citation monitoring routes
app.use('/api/monitoring', initializeCitationRoutes(shopData));

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
      metafields: 'GET /api/metafields/:type/:id',
      llmFeed: 'GET /llm-feed.xml?shop=your-store.myshopify.com',
      vector: 'GET /api/vector/:id?type=product&format=openai',
      aiPlugin: 'GET /.well-known/ai-plugin.json',
      openapi: 'GET /.well-known/openapi.yaml',
      monitoring: {
        start: 'POST /api/monitoring/start',
        stop: 'POST /api/monitoring/stop',
        status: 'GET /api/monitoring/status',
        citations: 'GET /api/monitoring/citations',
        stats: 'GET /api/monitoring/stats'
      }
    }
  });
});

// OAuth endpoints (keeping your working implementation)
app.get('/auth/status', (req, res) => {
  const shop = req.query.shop;
  const shopInfo = shop ? shopData.get(shop) : null;
  
  res.json({ 
    message: "Auth routes working!",
    apiKeyConfigured: !!SHOPIFY_API_KEY,
    secretConfigured: !!SHOPIFY_API_SECRET,
    openaiConfigured: !!OPENAI_API_KEY,
    anthropicConfigured: !!ANTHROPIC_API_KEY,
    shop: shop || 'not provided',
    shopAuthenticated: !!shopInfo,
    hasAccessToken: !!(shopInfo && shopInfo.accessToken),
    shopData: shopInfo ? { installedAt: shopInfo.installedAt, tokenLength: shopInfo.accessToken ? shopInfo.accessToken.length : 0 } : null,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to clear shop session
app.get('/auth/clear', (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  shopData.delete(shop);
  res.json({ 
    message: `Cleared session data for ${shop}`,
    timestamp: new Date().toISOString()
  });
});

app.get('/auth', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  console.log('[OAUTH] Starting auth flow for shop:', shop);
  const nonce = crypto.randomBytes(16).toString('hex');
  shopData.set(shop, { nonce });
  
  const authUrl = `https://${shop}/admin/oauth/authorize?` + 
    `client_id=${SHOPIFY_API_KEY}&` +
    `scope=${SCOPES}&` +
    `redirect_uri=${REDIRECT_URI}&` +
    `state=${nonce}`;
  
  console.log('[OAUTH] Redirecting to:', authUrl);
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
    
    // AUTO-REGISTER APP PROXY to fix embedded iframe CORS blocking
    try {
      console.log('[ASB-PROXY] Auto-registering app proxy for shop:', shop);
      const proxyResponse = await axios.post(`https://${shop}/admin/api/2024-01/script_tags.json`, {
        script_tag: {
          event: 'onload',
          src: `${process.env.SHOPIFY_APP_URL || 'https://ai-search-booster-backend.onrender.com'}/proxy-registration-marker.js`
        }
      }, {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('[ASB-PROXY] ✅ App proxy marker installed successfully');
      
      // Store proxy registration status
      const currentData = shopData.get(shop);
      shopData.set(shop, { 
        ...currentData, 
        proxyRegistered: true,
        proxyRegisteredAt: new Date().toISOString()
      });
      
    } catch (proxyError) {
      console.error('[ASB-PROXY] ❌ App proxy auto-registration failed:', proxyError.response?.data || proxyError.message);
      console.error('[ASB-PROXY] Will fall back to manual registration via Shopify CLI');
    }
    
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

// API: Save draft optimization
app.post('/api/optimize/draft', simpleVerifyShop, async (req, res) => {
  try {
    const { resourceType, resourceId, content, settings } = req.body;
    const { shop } = req;
    
    if (!resourceType || !resourceId || !content) {
      return res.status(400).json({ error: 'Missing required parameters' });
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
    
    // Optimize the content
    const optimized = await optimizeContent(content, resourceType, settings);
    
    // Store as draft metafields
    const draftMetafields = [
      {
        namespace: 'asb',
        key: 'optimized_content_draft',
        value: optimized.optimizedDescription || optimized.summary,
        type: 'multi_line_text_field'
      },
      {
        namespace: 'asb',
        key: 'faq_data_draft',
        value: JSON.stringify({ questions: optimized.faqs }),
        type: 'json'
      },
      {
        namespace: 'asb',
        key: 'optimization_settings_draft',
        value: JSON.stringify(settings),
        type: 'json'
      },
      {
        namespace: 'asb',
        key: 'draft_timestamp',
        value: new Date().toISOString(),
        type: 'single_line_text_field'
      }
    ];
    
    const endpoint = resourceType === 'product' 
      ? `products/${resourceId}/metafields`
      : `articles/${resourceId}/metafields`;
    
    // Save all draft metafields
    for (const metafield of draftMetafields) {
      try {
        await axios.post(
          `https://${shop}/admin/api/2024-01/${endpoint}.json`,
          { metafield },
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
      } catch (error) {
        console.error(`Error saving draft metafield ${metafield.key}:`, error);
      }
    }
    
    res.json({
      message: 'Draft optimization saved successfully',
      resourceType,
      resourceId,
      optimized,
      draftSaved: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Draft save error:', error);
    res.status(500).json({ error: 'Failed to save draft optimization' });
  }
});

// API: Publish draft optimization
app.post('/api/optimize/publish', simpleVerifyShop, async (req, res) => {
  try {
    const { resourceType, resourceId } = req.body;
    const { shop } = req;
    
    if (!resourceType || !resourceId) {
      return res.status(400).json({ error: 'Missing required parameters' });
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
    
    const endpoint = resourceType === 'product' 
      ? `products/${resourceId}/metafields`
      : `articles/${resourceId}/metafields`;
    
    // Get draft metafields
    const draftResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=asb`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    
    const metafields = draftResponse.data.metafields;
    const draftContent = metafields.find(m => m.key === 'optimized_content_draft')?.value;
    const draftFaq = metafields.find(m => m.key === 'faq_data_draft')?.value;
    const draftSettings = metafields.find(m => m.key === 'optimization_settings_draft')?.value;
    
    if (!draftContent) {
      return res.status(404).json({ error: 'No draft content found to publish' });
    }
    
    // Store original content as backup (if not already stored)
    const originalBackup = metafields.find(m => m.key === 'original_backup');
    if (!originalBackup) {
      // Fetch original content
      const originalResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/${resourceType === 'product' ? 'products' : 'articles'}/${resourceId}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const originalData = originalResponse.data[resourceType];
      await axios.post(
        `https://${shop}/admin/api/2024-01/${endpoint}.json`,
        {
          metafield: {
            namespace: 'asb',
            key: 'original_backup',
            value: JSON.stringify({
              title: originalData.title,
              description: originalData.body_html || originalData.content,
              backup_timestamp: new Date().toISOString()
            }),
            type: 'json'
          }
        },
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
    }
    
    // Publish draft to live metafields
    const liveMetafields = [
      {
        namespace: 'asb',
        key: 'optimized_content',
        value: draftContent,
        type: 'multi_line_text_field'
      },
      {
        namespace: 'asb',
        key: 'faq_data',
        value: draftFaq,
        type: 'json'
      },
      {
        namespace: 'asb',
        key: 'optimization_settings',
        value: draftSettings,
        type: 'json'
      },
      {
        namespace: 'asb',
        key: 'enable_schema',
        value: 'true',
        type: 'boolean'
      },
      {
        namespace: 'asb',
        key: 'published_timestamp',
        value: new Date().toISOString(),
        type: 'single_line_text_field'
      }
    ];
    
    // Save live metafields
    for (const metafield of liveMetafields) {
      try {
        await axios.post(
          `https://${shop}/admin/api/2024-01/${endpoint}.json`,
          { metafield },
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
      } catch (error) {
        console.error(`Error publishing metafield ${metafield.key}:`, error);
      }
    }
    
    res.json({
      message: 'Draft optimization published successfully',
      resourceType,
      resourceId,
      published: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Failed to publish draft optimization' });
  }
});

// API: Get draft content for preview
app.get('/api/draft/:type/:id', simpleVerifyShop, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { shop } = req;
    
    // Get shop info for access token
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ 
        error: 'Shop not authenticated', 
        redirectUrl: `/auth?shop=${shop}`
      });
    }
    
    const { accessToken } = shopInfo;
    
    const endpoint = type === 'product' 
      ? `products/${id}/metafields`
      : `articles/${id}/metafields`;
    
    // Get draft metafields
    const draftResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=asb`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    
    const metafields = draftResponse.data.metafields;
    const draftContent = metafields.find(m => m.key === 'optimized_content_draft')?.value;
    const draftFaq = metafields.find(m => m.key === 'faq_data_draft')?.value;
    const draftSettings = metafields.find(m => m.key === 'optimization_settings_draft')?.value;
    const draftTimestamp = metafields.find(m => m.key === 'draft_timestamp')?.value;
    
    // Get live content for comparison
    const liveContent = metafields.find(m => m.key === 'optimized_content')?.value;
    const liveFaq = metafields.find(m => m.key === 'faq_data')?.value;
    const publishedTimestamp = metafields.find(m => m.key === 'published_timestamp')?.value;
    
    res.json({
      type,
      id,
      hasDraft: !!draftContent,
      hasLive: !!liveContent,
      draft: {
        content: draftContent,
        faq: draftFaq ? JSON.parse(draftFaq) : null,
        settings: draftSettings ? JSON.parse(draftSettings) : null,
        timestamp: draftTimestamp
      },
      live: {
        content: liveContent,
        faq: liveFaq ? JSON.parse(liveFaq) : null,
        timestamp: publishedTimestamp
      }
    });
  } catch (error) {
    console.error('Draft fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch draft content' });
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
      // Handle mock optimization for development
      console.log('No access token for optimization, using mock data for shop:', shop);
      
      const mockResults = productIds.map(productId => ({
        productId,
        status: 'success',
        message: `Mock optimization completed for product ${productId}`,
        optimized: {
          title: `Sample Product ${productId}`,
          description: 'AI-optimized description with enhanced keywords and compelling copy.',
          faq: [
            {
              question: `What makes Sample Product ${productId} special?`,
              answer: `Sample Product ${productId} is designed with premium features and exceptional quality.`
            }
          ]
        }
      }));
      
      return res.json({
        shop,
        results: mockResults,
        summary: {
          total: productIds.length,
          successful: productIds.length,
          failed: 0
        },
        mock: true
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

// API: Rollback to original content
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
    
    const endpoint = type === 'product' 
      ? `products/${id}/metafields`
      : `articles/${id}/metafields`;
    
    // Get all metafields for this resource
    const metafieldsResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=asb`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    const metafields = metafieldsResponse.data.metafields;
    const originalBackup = metafields.find(m => m.key === 'original_backup');
    
    if (!originalBackup) {
      return res.status(404).json({ error: 'No original backup found for this resource' });
    }
    
    const originalData = JSON.parse(originalBackup.value);
    
    // Restore original content (if applicable)
    if (type === 'product') {
      // For products, we can restore the actual product content
      const updateData = {
        product: {
          id: parseInt(id),
          title: originalData.title,
          body_html: originalData.description
        }
      };
      
      await axios.put(
        `https://${shop}/admin/api/2024-01/products/${id}.json`,
        updateData,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
    }
    
    // Remove all optimization metafields (both draft and live)
    const optimizationKeys = [
      'optimized_content',
      'optimized_content_draft',
      'faq_data',
      'faq_data_draft',
      'optimization_settings',
      'optimization_settings_draft',
      'enable_schema',
      'published_timestamp',
      'draft_timestamp'
    ];
    
    for (const metafield of metafields) {
      if (optimizationKeys.includes(metafield.key)) {
        try {
          await axios.delete(
            `https://${shop}/admin/api/2024-01/metafields/${metafield.id}.json`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        } catch (error) {
          console.error(`Error deleting metafield ${metafield.key}:`, error);
        }
      }
    }
    
    res.json({
      message: `Successfully rolled back ${type} ${id} to original version`,
      type,
      id,
      version: 'original',
      restoredData: originalData,
      rollbackTimestamp: new Date().toISOString()
    });
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
    // Extract shop from query, body, or session token
    let shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    // For embedded apps, check session token from Authorization header
    const sessionToken = req.headers.authorization;
    if (sessionToken && !shop) {
      // Extract shop from session token if needed
      shop = req.headers['x-shopify-shop-domain'];
    }
    
    console.log('[PRODUCTS-API] Request details:', {
      shop,
      hasSessionToken: !!sessionToken,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      origin: req.headers.origin
    });
    
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
      `https://${shop}/admin/api/2024-01/products.json?limit=${limit}&fields=id,title,handle,status,created_at,updated_at`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    // Check metafields for optimization status
    const shopifyProducts = await Promise.all(response.data.products.map(async (product) => {
      let optimized = false;
      try {
        const metafieldsRes = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=ai_search_booster`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        optimized = metafieldsRes.data.metafields.some(m => m.key === 'current_version');
      } catch (metaError) {
        console.log(`Could not fetch metafields for product ${product.id}:`, metaError.message);
      }
      
      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        created_at: product.created_at,
        updated_at: product.updated_at,
        optimized
      };
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
    console.error('Error response data:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Error headers:', error.response?.headers);
    res.status(500).json({ 
      error: 'Failed to fetch products: ' + error.message,
      shopifyError: error.response?.data,
      status: error.response?.status
    });
  }
});

// API: Get blogs
app.get('/api/blogs', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    const { limit = 50, page = 1 } = req.query;
    
    // Check if shop has valid access token from OAuth flow
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      console.log('No valid OAuth token, returning mock data for blogs:', shop);
      // Return mock data when no OAuth token
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
      
      return res.json({
        blogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: blogs.length
        }
      });
    }
    
    // Fetch real blogs from Shopify API
    console.log('Fetching real blogs from Shopify for shop:', shop);
    const { accessToken } = shopInfo;
    
    const response = await axios.get(
      `https://${shop}/admin/api/2024-01/blogs.json?limit=${limit}&page=${page}&fields=id,title,handle,created_at,updated_at`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    const shopifyBlogs = await Promise.all(response.data.blogs.map(async (blog) => {
      // Fetch articles for each blog
      try {
        const articlesRes = await axios.get(
          `https://${shop}/admin/api/2024-01/blogs/${blog.id}/articles.json?limit=10&fields=id,title,handle,created_at,updated_at`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        
        // Check metafields for optimization status
        const articles = await Promise.all(articlesRes.data.articles.map(async (article) => {
          let optimized = false;
          try {
            const metafieldsRes = await axios.get(
              `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json?namespace=ai_search_booster`,
              { headers: { 'X-Shopify-Access-Token': accessToken } }
            );
            optimized = metafieldsRes.data.metafields.some(m => m.key === 'current_version');
          } catch (metaError) {
            console.log(`Could not fetch metafields for article ${article.id}:`, metaError.message);
          }
          
          return {
            id: article.id,
            title: article.title,
            handle: article.handle,
            created_at: article.created_at,
            updated_at: article.updated_at,
            optimized
          };
        }));
        
        return {
          id: blog.id,
          title: blog.title,
          handle: blog.handle,
          created_at: blog.created_at,
          updated_at: blog.updated_at,
          articles
        };
      } catch (articleError) {
        console.error(`Failed to fetch articles for blog ${blog.id}:`, articleError);
        return {
          id: blog.id,
          title: blog.title,
          handle: blog.handle,
          created_at: blog.created_at,
          updated_at: blog.updated_at,
          articles: []
        };
      }
    }));
    
    console.log(`Fetched ${shopifyBlogs.length} real blogs from Shopify`);
    
    res.json({
      blogs: shopifyBlogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: shopifyBlogs.length
      }
    });
  } catch (error) {
    console.error('Blogs error:', error);
    res.status(500).json({ error: 'Failed to fetch blogs: ' + error.message });
  }
});

// LLM Feed RSS endpoint for crawler discovery
app.get('/llm-feed.xml', async (req, res) => {
  try {
    const shop = req.query.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    // Get shop info for access token
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      // Return basic feed without shop data
      const basicFeed = generateBasicLLMFeed(shop);
      res.set('Content-Type', 'application/rss+xml');
      return res.send(basicFeed);
    }
    
    const { accessToken } = shopInfo;
    
    // Fetch optimized products and articles
    const [productsRes, blogsRes] = await Promise.allSettled([
      axios.get(`https://${shop}/admin/api/2024-01/products.json?limit=50&fields=id,title,handle,body_html,updated_at,vendor,product_type,status`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }),
      axios.get(`https://${shop}/admin/api/2024-01/blogs.json?limit=10`, {
        headers: { 'X-Shopify-Access-Token': accessToken }
      })
    ]);
    
    const products = productsRes.status === 'fulfilled' ? productsRes.value.data.products : [];
    const blogs = blogsRes.status === 'fulfilled' ? blogsRes.value.data.blogs : [];
    
    // Get articles from blogs
    const articles = [];
    for (const blog of blogs) {
      try {
        const articlesRes = await axios.get(
          `https://${shop}/admin/api/2024-01/blogs/${blog.id}/articles.json?limit=20&fields=id,title,handle,content,summary,updated_at,author,tags`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        articles.push(...articlesRes.data.articles.map(a => ({ ...a, blog_handle: blog.handle })));
      } catch (error) {
        console.error(`Error fetching articles for blog ${blog.id}:`, error);
      }
    }
    
    // Fetch optimization metafields for products
    const optimizedProducts = [];
    for (const product of products.slice(0, 25)) { // Limit to prevent timeout
      try {
        const metafieldsRes = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=asb`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        
        const metafields = metafieldsRes.data.metafields;
        const optimizedContent = metafields.find(m => m.key === 'optimized_content')?.value;
        const faqData = metafields.find(m => m.key === 'faq_data')?.value;
        const isOptimized = metafields.find(m => m.key === 'enable_schema')?.value === 'true';
        
        if (isOptimized) {
          optimizedProducts.push({
            ...product,
            optimized_content: optimizedContent,
            faq_data: faqData ? JSON.parse(faqData) : null
          });
        }
      } catch (error) {
        console.error(`Error fetching metafields for product ${product.id}:`, error);
      }
    }
    
    // Generate RSS feed
    const rss = generateLLMFeed(shop, optimizedProducts, articles);
    res.set('Content-Type', 'application/rss+xml');
    res.send(rss);
    
  } catch (error) {
    console.error('LLM Feed error:', error);
    res.status(500).json({ error: 'Failed to generate LLM feed' });
  }
});

// API: Test LLM Feed generation
app.get('/api/llm-feed/test', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    
    // Generate a test feed URL
    const feedUrl = `${req.protocol}://${req.get('host')}/llm-feed.xml?shop=${shop}`;
    
    // Test the feed by making a request to it
    const response = await axios.get(feedUrl);
    
    res.json({
      success: true,
      feedUrl,
      contentType: response.headers['content-type'],
      contentLength: response.data.length,
      preview: response.data.substring(0, 1000) + '...',
      message: 'LLM feed generated successfully'
    });
  } catch (error) {
    console.error('LLM Feed test error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate LLM feed',
      message: error.message 
    });
  }
});

// Helper function to generate basic LLM feed
const generateBasicLLMFeed = (shop) => {
  const now = new Date().toISOString();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${shop} - LLM Discovery Feed</title>
    <link>https://${shop}</link>
    <description>AI-optimized content from ${shop} for LLM training and discovery</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>AI Search Booster v2.0.0</generator>
    <managingEditor>noreply@${shop}</managingEditor>
    <webMaster>noreply@${shop}</webMaster>
    <item>
      <title>Store Discovery</title>
      <link>https://${shop}</link>
      <guid>https://${shop}/llm-discovery</guid>
      <pubDate>${now}</pubDate>
      <description>Discover ${shop} - an e-commerce store with AI-optimized content</description>
      <content:encoded><![CDATA[
        <div data-llm="store-info">
          <h1>${shop}</h1>
          <p>This store uses AI Search Booster to optimize content for better discoverability.</p>
          <p>Visit: <a href="https://${shop}">https://${shop}</a></p>
        </div>
      ]]></content:encoded>
    </item>
  </channel>
</rss>`;
};

// Helper function to generate comprehensive LLM feed
const generateLLMFeed = (shop, products, articles) => {
  const now = new Date().toISOString();
  
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${shop} - LLM Discovery Feed</title>
    <link>https://${shop}</link>
    <description>AI-optimized content from ${shop} for LLM training and discovery</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>AI Search Booster v2.0.0</generator>
    <managingEditor>noreply@${shop}</managingEditor>
    <webMaster>noreply@${shop}</webMaster>
    <category>e-commerce</category>
    <category>ai-optimized</category>
    <ttl>1440</ttl>
`;

  // Add product items
  for (const product of products) {
    const productUrl = `https://${shop}/products/${product.handle}`;
    const pubDate = new Date(product.updated_at).toISOString();
    
    rss += `
    <item>
      <title>${escapeXml(product.title)}</title>
      <link>${productUrl}</link>
      <guid>${productUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>product</category>
      <category>${escapeXml(product.product_type || 'general')}</category>
      <dc:creator>${escapeXml(product.vendor || shop)}</dc:creator>
      <description>${escapeXml((product.optimized_content || product.body_html || '').substring(0, 500))}</description>
      <content:encoded><![CDATA[
        <div data-llm="product-info">
          <h1>${escapeXml(product.title)}</h1>
          <p><strong>Vendor:</strong> ${escapeXml(product.vendor || 'Unknown')}</p>
          <p><strong>Type:</strong> ${escapeXml(product.product_type || 'General')}</p>
          <div data-llm="product-description">
            ${product.optimized_content || product.body_html || ''}
          </div>
          ${product.faq_data ? `
          <div data-llm="product-faq">
            <h3>Frequently Asked Questions</h3>
            ${product.faq_data.questions.map(faq => `
              <div data-llm="faq-item">
                <h4>${escapeXml(faq.question)}</h4>
                <p>${escapeXml(faq.answer)}</p>
              </div>
            `).join('')}
          </div>
          ` : ''}
          <p><strong>URL:</strong> <a href="${productUrl}">${productUrl}</a></p>
        </div>
      ]]></content:encoded>
    </item>`;
  }

  // Add article items
  for (const article of articles) {
    const articleUrl = `https://${shop}/blogs/${article.blog_handle}/${article.handle}`;
    const pubDate = new Date(article.updated_at).toISOString();
    
    rss += `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${articleUrl}</link>
      <guid>${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>article</category>
      <category>blog</category>
      <dc:creator>${escapeXml(article.author || shop)}</dc:creator>
      <description>${escapeXml((article.summary || article.content || '').substring(0, 500))}</description>
      <content:encoded><![CDATA[
        <div data-llm="article-info">
          <h1>${escapeXml(article.title)}</h1>
          <p><strong>Author:</strong> ${escapeXml(article.author || 'Unknown')}</p>
          ${article.tags ? `<p><strong>Tags:</strong> ${escapeXml(article.tags)}</p>` : ''}
          <div data-llm="article-content">
            ${article.content || ''}
          </div>
          <p><strong>URL:</strong> <a href="${articleUrl}">${articleUrl}</a></p>
        </div>
      ]]></content:encoded>
    </item>`;
  }

  rss += `
  </channel>
</rss>`;

  return rss;
};

// Helper function to escape XML characters
const escapeXml = (unsafe) => {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Generate mock vector data for different formats
const generateMockVectorData = (resourceData, format) => {
  // Create a simple hash-based mock embedding (1536 dimensions for OpenAI compatibility)
  const text = `${resourceData.title} ${resourceData.description} ${resourceData.vendor}`;
  const mockEmbedding = [];
  
  for (let i = 0; i < 1536; i++) {
    // Generate deterministic but realistic-looking embeddings
    const seed = text.charCodeAt(i % text.length) * (i + 1);
    mockEmbedding.push((Math.sin(seed) * 0.5));
  }
  
  switch (format) {
    case 'openai':
      return {
        object: 'embedding',
        model: 'text-embedding-ada-002',
        data: [{
          object: 'embedding',
          index: 0,
          embedding: mockEmbedding
        }],
        usage: {
          prompt_tokens: text.split(' ').length,
          total_tokens: text.split(' ').length
        }
      };
      
    case 'huggingface':
      return {
        embeddings: [mockEmbedding],
        model: 'sentence-transformers/all-MiniLM-L6-v2'
      };
      
    case 'claude':
      return {
        type: 'embedding',
        embedding: mockEmbedding,
        model: 'claude-3-haiku',
        dimensions: 1536
      };
      
    case 'generic':
    default:
      return {
        vector: mockEmbedding,
        dimensions: 1536,
        model: 'mock-embedding-v1'
      };
  }
};

// API: Vector endpoint for OpenAI embedding format
app.get('/api/vector/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'product', format = 'openai' } = req.query;
    const shop = req.query.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    // Get shop info for access token
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      // Return mock vector data for development
      console.log('No access token for vector endpoint, returning mock data for shop:', shop);
      
      const mockProducts = {
        '1': {
          id: 1,
          title: 'Sample Product 1',
          description: 'High-quality sample product perfect for testing AI optimization features.',
          vendor: 'Sample Store',
          product_type: 'Test Product',
          handle: 'sample-product-1',
          variants: [{ price: '29.99', compare_at_price: '39.99' }],
          tags: ['sample', 'test', 'ai-optimized']
        },
        '2': {
          id: 2,
          title: 'Sample Product 2',
          description: 'Another excellent sample product with premium features and quality.',
          vendor: 'Sample Store',
          product_type: 'Test Product',
          handle: 'sample-product-2',
          variants: [{ price: '49.99', compare_at_price: '59.99' }],
          tags: ['sample', 'premium', 'ai-optimized']
        }
      };
      
      const mockProduct = mockProducts[id];
      if (!mockProduct) {
        return res.status(404).json({ error: 'Product not found in mock data' });
      }
      
      const resourceData = {
        id: mockProduct.id,
        type: 'product',
        title: mockProduct.title,
        description: mockProduct.description,
        vendor: mockProduct.vendor,
        product_type: mockProduct.product_type,
        handle: mockProduct.handle,
        variants: mockProduct.variants,
        tags: mockProduct.tags,
        url: `https://${shop}/products/${mockProduct.handle}`,
        optimized: true,
        faq_data: [
          {
            question: `What makes ${mockProduct.title} special?`,
            answer: `${mockProduct.title} is designed with premium features and quality materials for exceptional performance.`
          },
          {
            question: `Is ${mockProduct.title} suitable for beginners?`,
            answer: `Yes, ${mockProduct.title} is perfect for both beginners and advanced users.`
          }
        ]
      };
      
      // Generate mock vector data based on format
      const vectorData = generateMockVectorData(resourceData, format);
      
      return res.json({
        id: mockProduct.id,
        type: 'product',
        shop,
        format,
        data: resourceData,
        vector: vectorData,
        generated_at: new Date().toISOString(),
        mock: true
      });
    }
    
    const { accessToken } = shopInfo;
    
    let resourceData;
    let vectorData;
    
    if (type === 'product') {
      // Fetch product data
      const productRes = await axios.get(
        `https://${shop}/admin/api/2024-01/products/${id}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const product = productRes.data.product;
      
      // Fetch optimization metafields
      const metafieldsRes = await axios.get(
        `https://${shop}/admin/api/2024-01/products/${id}/metafields.json?namespace=asb`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const metafields = metafieldsRes.data.metafields;
      const optimizedContent = metafields.find(m => m.key === 'optimized_content')?.value;
      const faqData = metafields.find(m => m.key === 'faq_data')?.value;
      const isOptimized = metafields.find(m => m.key === 'enable_schema')?.value === 'true';
      
      resourceData = {
        id: product.id,
        type: 'product',
        title: product.title,
        description: optimizedContent || product.body_html || '',
        vendor: product.vendor,
        product_type: product.product_type,
        handle: product.handle,
        url: `https://${shop}/products/${product.handle}`,
        price: product.variants?.[0]?.price || '0.00',
        currency: 'USD', // Default, would need to fetch from shop settings
        availability: product.variants?.[0]?.inventory_quantity > 0 ? 'in_stock' : 'out_of_stock',
        tags: product.tags ? product.tags.split(',').map(t => t.trim()) : [],
        images: product.images?.map(img => img.src) || [],
        variants: product.variants?.map(v => ({
          id: v.id,
          title: v.title,
          price: v.price,
          sku: v.sku,
          available: v.inventory_quantity > 0
        })) || [],
        faq: faqData ? JSON.parse(faqData) : null,
        optimized: isOptimized,
        updated_at: product.updated_at
      };
      
    } else if (type === 'article') {
      // Fetch article data
      const articleRes = await axios.get(
        `https://${shop}/admin/api/2024-01/articles/${id}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const article = articleRes.data.article;
      
      // Fetch optimization metafields
      const metafieldsRes = await axios.get(
        `https://${shop}/admin/api/2024-01/articles/${id}/metafields.json?namespace=asb`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const metafields = metafieldsRes.data.metafields;
      const optimizedContent = metafields.find(m => m.key === 'optimized_content')?.value;
      const faqData = metafields.find(m => m.key === 'faq_data')?.value;
      const isOptimized = metafields.find(m => m.key === 'enable_schema')?.value === 'true';
      
      resourceData = {
        id: article.id,
        type: 'article',
        title: article.title,
        description: optimizedContent || article.content || '',
        author: article.author,
        handle: article.handle,
        url: `https://${shop}/blogs/${article.blog_id}/${article.handle}`,
        tags: article.tags ? article.tags.split(',').map(t => t.trim()) : [],
        summary: article.summary || '',
        faq: faqData ? JSON.parse(faqData) : null,
        optimized: isOptimized,
        updated_at: article.updated_at
      };
      
    } else {
      return res.status(400).json({ error: 'Invalid type parameter. Must be "product" or "article"' });
    }
    
    // Generate vector data based on format
    if (format === 'openai') {
      vectorData = generateOpenAIEmbeddingFormat(resourceData);
    } else if (format === 'huggingface') {
      vectorData = generateHuggingFaceFormat(resourceData);
    } else if (format === 'claude') {
      vectorData = generateClaudeFormat(resourceData);
    } else {
      vectorData = generateGenericFormat(resourceData);
    }
    
    res.json({
      success: true,
      format,
      data: vectorData,
      metadata: {
        shop,
        resource_type: type,
        resource_id: id,
        optimized: resourceData.optimized,
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Vector endpoint error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request params:', { id: req.params.id, query: req.query });
    res.status(500).json({ 
      error: 'Failed to generate vector data',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Helper functions for different vector formats
const generateOpenAIEmbeddingFormat = (data) => {
  const text = buildEmbeddingText(data);
  
  return {
    object: 'embedding',
    model: 'text-embedding-ada-002',
    data: [{
      object: 'embedding',
      index: 0,
      embedding: null, // Would be computed by OpenAI API
      text: text
    }],
    usage: {
      prompt_tokens: text.split(' ').length,
      total_tokens: text.split(' ').length
    },
    metadata: {
      id: data.id,
      type: data.type,
      title: data.title,
      url: data.url,
      optimized: data.optimized
    }
  };
};

const generateHuggingFaceFormat = (data) => {
  const text = buildEmbeddingText(data);
  
  return {
    inputs: text,
    parameters: {
      task: 'feature-extraction',
      model: 'sentence-transformers/all-MiniLM-L6-v2'
    },
    metadata: {
      id: data.id,
      type: data.type,
      title: data.title,
      url: data.url,
      optimized: data.optimized
    }
  };
};

const generateClaudeFormat = (data) => {
  const text = buildEmbeddingText(data);
  
  return {
    content: text,
    format: 'claude-training',
    metadata: {
      id: data.id,
      type: data.type,
      title: data.title,
      url: data.url,
      optimized: data.optimized,
      schema: data.type === 'product' ? 'product' : 'article'
    },
    structured_data: {
      title: data.title,
      description: data.description,
      url: data.url,
      ...(data.type === 'product' && {
        price: data.price,
        vendor: data.vendor,
        product_type: data.product_type,
        variants: data.variants
      }),
      ...(data.type === 'article' && {
        author: data.author,
        summary: data.summary
      }),
      faq: data.faq,
      tags: data.tags
    }
  };
};

const generateGenericFormat = (data) => {
  const text = buildEmbeddingText(data);
  
  return {
    text: text,
    metadata: data,
    embedding_ready: true,
    format: 'generic'
  };
};

const buildEmbeddingText = (data) => {
  let text = `${data.title}\n\n`;
  
  if (data.description) {
    text += `${data.description}\n\n`;
  }
  
  if (data.type === 'product') {
    text += `Vendor: ${data.vendor}\n`;
    text += `Product Type: ${data.product_type}\n`;
    text += `Price: ${data.price}\n`;
    text += `Availability: ${data.availability}\n`;
    
    if (data.variants && data.variants.length > 0) {
      text += `Variants: ${data.variants.map(v => v.title).join(', ')}\n`;
    }
  } else if (data.type === 'article') {
    text += `Author: ${data.author}\n`;
    if (data.summary) {
      text += `Summary: ${data.summary}\n`;
    }
  }
  
  if (data.tags && data.tags.length > 0) {
    text += `Tags: ${data.tags.join(', ')}\n`;
  }
  
  if (data.faq && data.faq.questions) {
    text += `\nFrequently Asked Questions:\n`;
    data.faq.questions.forEach(faq => {
      text += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    });
  }
  
  text += `\nURL: ${data.url}`;
  
  return text.trim();
};

// OpenAI Plugin Manifest
app.get('/.well-known/ai-plugin.json', (req, res) => {
  const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'example-store.myshopify.com';
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const manifest = {
    schema_version: "v1",
    name_for_human: "AI Search Booster",
    name_for_model: "ai_search_booster",
    description_for_human: "Optimize Shopify store content for AI/LLM visibility with structured data, RSS feeds, and vector endpoints.",
    description_for_model: "Plugin for optimizing e-commerce content for AI/LLM discoverability. Provides structured product data, FAQ generation, RSS feeds for LLM training, and vector endpoints for embedding models. Supports non-destructive editing with rollback capabilities.",
    auth: {
      type: "none"
    },
    api: {
      type: "openapi",
      url: `${baseUrl}/.well-known/openapi.yaml`,
      is_user_authenticated: false
    },
    logo_url: `${baseUrl}/logo.png`,
    contact_email: "support@ai-search-booster.com",
    legal_info_url: `${baseUrl}/legal`,
    capabilities: [
      "product_optimization",
      "content_generation",
      "structured_data",
      "rss_feeds",
      "vector_embeddings",
      "faq_generation",
      "rollback_safety"
    ],
    endpoints: {
      llm_feed: `${baseUrl}/llm-feed.xml?shop=${shop}`,
      vector_data: `${baseUrl}/api/vector/{id}?type=product&format=openai&shop=${shop}`,
      product_optimization: `${baseUrl}/api/optimize/products?shop=${shop}`,
      content_preview: `${baseUrl}/api/optimize/preview?shop=${shop}`,
      rollback: `${baseUrl}/api/rollback/{type}/{id}?shop=${shop}`
    },
    privacy_policy_url: `${baseUrl}/privacy`,
    terms_of_service_url: `${baseUrl}/terms`
  };
  
  res.json(manifest);
});

// OpenAPI specification for AI Plugin
app.get('/.well-known/openapi.yaml', (req, res) => {
  const shop = req.query.shop || req.headers['x-shopify-shop-domain'] || 'example-store.myshopify.com';
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  const openapi = `openapi: 3.0.1
info:
  title: AI Search Booster Plugin
  description: Optimize Shopify store content for AI/LLM visibility
  version: 'v2.0.0'
  contact:
    email: support@ai-search-booster.com
servers:
  - url: ${baseUrl}
paths:
  /llm-feed.xml:
    get:
      operationId: getLLMFeed
      summary: Get LLM training RSS feed
      description: Retrieve RSS feed with AI-optimized content for LLM training
      parameters:
        - name: shop
          in: query
          required: true
          schema:
            type: string
          description: Shopify store domain
      responses:
        '200':
          description: RSS feed content
          content:
            application/rss+xml:
              schema:
                type: string
  /api/vector/{id}:
    get:
      operationId: getVectorData
      summary: Get vector embedding data
      description: Retrieve product or article data formatted for embedding models
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: Resource ID
        - name: type
          in: query
          schema:
            type: string
            enum: [product, article]
            default: product
          description: Resource type
        - name: format
          in: query
          schema:
            type: string
            enum: [openai, huggingface, claude, generic]
            default: openai
          description: Output format
        - name: shop
          in: query
          required: true
          schema:
            type: string
          description: Shopify store domain
      responses:
        '200':
          description: Vector data
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  format:
                    type: string
                  data:
                    type: object
                  metadata:
                    type: object
  /api/optimize/preview:
    post:
      operationId: previewOptimization
      summary: Preview content optimization
      description: Generate AI-optimized content preview without saving
      parameters:
        - name: shop
          in: query
          required: true
          schema:
            type: string
          description: Shopify store domain
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                content:
                  type: object
                  description: Content to optimize
                type:
                  type: string
                  enum: [product, article]
                settings:
                  type: object
                  description: Optimization settings
      responses:
        '200':
          description: Optimization preview
          content:
            application/json:
              schema:
                type: object
                properties:
                  original:
                    type: object
                  optimized:
                    type: object
                  preview:
                    type: object
  /api/rollback/{type}/{id}:
    post:
      operationId: rollbackOptimization
      summary: Rollback content optimization
      description: Restore original content and remove all optimizations
      parameters:
        - name: type
          in: path
          required: true
          schema:
            type: string
            enum: [product, article]
          description: Resource type
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: Resource ID
        - name: shop
          in: query
          required: true
          schema:
            type: string
          description: Shopify store domain
      responses:
        '200':
          description: Rollback completed
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                  type:
                    type: string
                  id:
                    type: string
                  version:
                    type: string
                  restoredData:
                    type: object
components:
  schemas:
    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string`;

  res.set('Content-Type', 'application/x-yaml');
  res.send(openapi);
});

// Legal/Privacy endpoints for AI Plugin compliance
app.get('/legal', (req, res) => {
  res.json({
    name: 'AI Search Booster',
    version: '2.0.0',
    legal_info: 'Legal information and terms of service',
    contact: 'support@ai-search-booster.com',
    message: 'AI Search Booster is a Shopify app that optimizes store content for AI/LLM visibility while maintaining non-destructive editing and rollback capabilities.'
  });
});

app.get('/privacy', (req, res) => {
  res.json({
    name: 'AI Search Booster',
    version: '2.0.0',
    privacy_policy: 'Privacy policy information',
    data_handling: 'We only process shop product data for optimization purposes. No personal customer data is stored.',
    contact: 'support@ai-search-booster.com',
    message: 'AI Search Booster respects user privacy and follows GDPR compliance standards.'
  });
});

app.get('/terms', (req, res) => {
  res.json({
    name: 'AI Search Booster',
    version: '2.0.0',
    terms_of_service: 'Terms of service information',
    usage: 'This service is provided for optimizing e-commerce content for AI/LLM discoverability.',
    contact: 'support@ai-search-booster.com',
    message: 'By using AI Search Booster, you agree to use it responsibly for content optimization purposes.'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '2.0.0',
    timestamp: new Date().toISOString() 
  });
});

// GDPR Compliance Webhooks
app.post('/webhooks/customers/data_request', express.raw({ type: 'application/json' }), (req, res) => {
  console.log('[COMPLIANCE] Customer data request received');
  
  // For AI Search Booster: We don't store personal customer data
  // We only store shop-level optimization history and settings
  const response = {
    message: 'AI Search Booster does not store personal customer data',
    data_stored: 'None - app only stores shop-level product optimization history',
    contact: 'support@ai-search-booster.com'
  };
  
  console.log('[COMPLIANCE] Customer data request response:', response);
  res.status(200).json(response);
});

app.post('/webhooks/customers/redact', express.raw({ type: 'application/json' }), (req, res) => {
  console.log('[COMPLIANCE] Customer redaction request received');
  
  // For AI Search Booster: We don't store personal customer data to redact
  const response = {
    message: 'No customer data to redact - AI Search Booster does not store personal customer information',
    action_taken: 'N/A - no personal data stored'
  };
  
  console.log('[COMPLIANCE] Customer redaction response:', response);
  res.status(200).json(response);
});

app.post('/webhooks/shop/redact', express.raw({ type: 'application/json' }), (req, res) => {
  console.log('[COMPLIANCE] Shop redaction request received');
  
  try {
    const payload = JSON.parse(req.body);
    const shopDomain = payload.shop_domain;
    
    if (shopDomain && shopData.has(shopDomain)) {
      // Remove shop data from memory store
      shopData.delete(shopDomain);
      console.log(`[COMPLIANCE] Deleted data for shop: ${shopDomain}`);
    }
    
    const response = {
      message: 'Shop data redacted successfully',
      shop: shopDomain,
      action_taken: 'Removed optimization history and access tokens',
      timestamp: new Date().toISOString()
    };
    
    console.log('[COMPLIANCE] Shop redaction response:', response);
    res.status(200).json(response);
    
  } catch (error) {
    console.error('[COMPLIANCE] Shop redaction error:', error);
    res.status(500).json({ error: 'Failed to process redaction request' });
  }
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
  console.log('- GDPR Compliance webhooks: ✓');
  
  // Initialize citation monitoring jobs
  initCitationJobs();
});

export default app;