import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { initCitationJobs } from './jobs/citationScheduler.js';
import { initializeCitationRoutes } from './routes/citations.js';

// === Production Infrastructure Modules === 
// Deployment timestamp: 2025-07-22 Backend Force Deploy
import * as scoringUtils from './utils/scoringUtils.js';
import * as rollbackUtils from './utils/rollbackUtils.js';
import * as logger from './utils/logger.js';

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
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=asb`,
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
      namespace: 'asb',
      key: `optimized_v${version}`,
      value: JSON.stringify(content),
      type: 'json'
    },
    {
      namespace: 'asb',
      key: `optimized_v${version}_timestamp`,
      value: new Date().toISOString(),
      type: 'single_line_text_field'
    },
    {
      namespace: 'asb',
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
// Generate mock optimization for fallback
const generateMockOptimization = (content, type) => {
  const title = content.title || content.name || 'Untitled';
  const description = content.description || content.body_html || content.content || 'No description available';
  
  // Clean the description and get first 300 characters for a meaningful summary
  const cleanDescription = description.replace(/<[^>]*>/g, '').trim();
  const shortDescription = cleanDescription.substring(0, 300);
  
  return {
    optimizedTitle: title,
    optimizedDescription: cleanDescription.length > shortDescription.length ? 
      `${shortDescription}...` : cleanDescription,
    summary: `${title} - ${shortDescription.substring(0, 150)}${shortDescription.length > 150 ? '...' : ''}`,
    faqs: [
      {
        question: `Tell me about ${title}`,
        answer: cleanDescription.substring(0, 200) + (cleanDescription.length > 200 ? '...' : '')
      },
      {
        question: `What are the key features of ${title}?`,
        answer: `${title} offers quality and reliability that meets customer expectations.`
      }
    ],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": type === 'product' ? "Product" : type === 'page' ? "WebPage" : "Article",
      "name": title,
      "description": cleanDescription.substring(0, 200) + (cleanDescription.length > 200 ? '...' : '')
    },
    llmDescription: `${title}: ${cleanDescription.substring(0, 250)}${cleanDescription.length > 250 ? '...' : ''}`
  };
};

// Universal content analysis - only detects if AI terms are actually present
const analyzeContentTopic = (content) => {
  const textToAnalyze = [
    content.title || '',
    content.body_html || content.description || content.content || '',
    (content.tags || []).join(' ')
  ].join(' ').toLowerCase();
  
  // Only detect AI content if explicitly mentioned
  const aiKeywords = ['ai', 'artificial intelligence', 'llm', 'large language model', 'chatgpt', 'claude', 'openai', 'gpt', 'machine learning', 'neural network', 'embedding', 'semantic search', 'nlp'];
  
  const hasAITerms = aiKeywords.some(keyword => textToAnalyze.includes(keyword));
  
  return {
    hasAITerms,
    originalContent: content
  };
};

const optimizeContent = async (content, type, settings = {}) => {
  const { targetLLM = 'general', keywords = [], tone = 'professional' } = settings;
  
  // Ensure keywords is always an array
  const keywordsArray = Array.isArray(keywords) ? keywords : 
                       typeof keywords === 'string' ? keywords.split(',').map(k => k.trim()).filter(k => k) :
                       [];
  
  // NO MOCK MODE - Always use real AI optimization
  if (MOCK_MODE) {
    throw new Error('Mock mode disabled - only real LLM optimization allowed');
  }
  
  // Analyze content to determine if AI terms are present
  const contentAnalysis = analyzeContentTopic(content);
  
  // Universal LLM Optimization - works for any industry/store type
  let prompt;
  
  const debugInfo = {
    type: type,
    typeOf: typeof type,
    exactMatch: type === 'collection',
    stringValue: String(type),
    trimmed: String(type).trim()
  };
  console.log('🔍 PROMPT SELECTION DEBUG:', debugInfo);
  
  if (type === 'product') {
    prompt = `Generate optimized content for a Shopify product that improves its chances of being cited or understood by LLMs like ChatGPT, Claude, or Perplexity.

Product data: ${JSON.stringify(content)}

✅ REQUIRED OUTPUT STRUCTURE:
{
  "optimizedTitle": "[Product name with technical detail - e.g. 'Warm Black Wool Sweater - 250 GSM Ribbed Merino']",
  "optimizedDescription": "[One paragraph, 80–120 words, following rules below]",
  "summary": "[One sentence, max 100 characters, LLM citation style]",
  "llmDescription": "[Same as optimizedDescription or slightly more structured]",
  "faqs": [
    {"question": "What are the technical specifications?", "answer": ""},
    {"question": "Who is this suitable for?", "answer": ""},
    {"question": "How does this compare to synthetic alternatives?", "answer": ""}
  ]
}

✅ REQUIRED CONTENT RULES:
- Material specs (e.g. "250 GSM merino wool", "ribbed knit", "micron rating", specific measurements)
- Use-case context: "Best for 5–15°C weather", "ideal for commuters", specific temperature ranges
- Persona targeting: Mention user needs like warmth, breathability, long-term wear, specific conditions
- Comparative framing: Include 1–2 measurable advantages vs. synthetic alternatives
- Tone: Neutral, factual, LLM-readable, not emotional or salesy

🚫 ABSOLUTELY PROHIBITED SEO FLUFF:
- "high-quality", "timeless", "versatile", "stylish", "classic", "premium"
- "must-have", "luxurious", "incredible", "perfect for everyone"
- Vague adjectives like "great", "essential", "amazing"
- Repeating the product name in FAQ answers

EXAMPLE TARGET:
"optimizedDescription": "Made from 250 GSM merino wool with a ribbed knit construction, this black sweater provides insulation and breathability for daily use in 5–15°C climates. The fabric naturally regulates temperature and resists odors, making it ideal for cold-weather commuters and those with sensitive skin. Compared to polyester fleece, it retains heat longer while remaining more breathable."

Return ONLY this JSON with technical, factual content:`;
  } else if (type === 'collection') {
    console.log('🧠 USING CLAUDE UNIVERSAL COLLECTION OPTIMIZATION PROMPT v5.1-infra');
    
    // Analyze content to detect category if possible
    const category = content.title || content.handle || 'N/A';
    
    prompt = `🧠 CLAUDE — UNIVERSAL COLLECTION OPTIMIZATION PROMPT (v5.1-infra)

You are an LLM content optimizer for Shopify collections. Your task is to generate structured JSON content that improves visibility in LLMs, clarity for customers, and citation confidence for AI assistants.

You must obey strict field rules. Do not repeat content between fields. Use grounded, natural, product-specific language only.

---

Collection data (from Shopify):

${JSON.stringify(content)}

Optional:
Detected Category: ${category || "N/A"}

---

FIELD DEFINITIONS — ALL MUST BE DISTINCT

{
  "optimizedTitle": "Collection name + unique descriptor (e.g., use case, sizing, material)",
  "optimizedDescription": "Technical paragraph (80–120 words) for AI parsers. Include sizing, use cases, variants, materials, product types. Avoid fluff.",
  "summary": "One factual sentence (under 100 characters) describing the collection's purpose. Use plain, abstractable language. NO adjectives or SEO language.",
  "llmDescription": "Explain WHO this is for and WHEN they'd use it. Help an LLM understand the real-world scenarios, people, and needs. 2–3 sentences.",
  "content": "Human-readable persuasive copy (2–3 sentences). Use clear, emotional value propositions for a customer. Avoid generic claims.",
  "faqs": [
    { "q": "What sizes are available?", "a": "We offer sizes ranging from S to XXL." },
    { "q": "What materials are used?", "a": "Shirts are made from cotton and polyester blends." },
    { "q": "How should these be cared for?", "a": "Follow care instructions on the label." },
    { "q": "Are these suitable for formal events?", "a": "Yes, they work well for both formal and casual occasions." }
  ],
  "promptVersion": "v5.1-infra"
}

---

STRICT RULES:

- All fields must be different — NEVER repeat content or phrasing across summary, content, or llmDescription.
- Only use info found in source — Never invent features, sizes, or scenarios that are not grounded in the input.
- If source is sparse, fill with helpful domain-general info (e.g. general care tips, common sizing ranges) — do not hallucinate specifics.
- For FAQs, prefer useful questions — not SEO fluff or rhetorical "Why choose us?" type questions.

---

HALLUCINATION CHECK GUARDRAILS:

Avoid phrases like:
- "Best on the market"
- "Top-rated"
- "Perfect for everyone"
- "Award-winning"
- "Our #1 product"

If no real differentiation is available, return "N/A" for any field you cannot meaningfully complete.

---

OUTPUT FORMAT (Return ONLY this JSON):

{
  "optimizedTitle": "",
  "optimizedDescription": "",
  "summary": "",
  "llmDescription": "",
  "content": "",
  "faqs": [
    { "q": "", "a": "" },
    { "q": "", "a": "" },
    { "q": "", "a": "" },
    { "q": "", "a": "" }
  ],
  "promptVersion": "v5.1-infra"
}

Return only the JSON above. No extra commentary.`;
  } else if (type === 'page') {
    prompt = `Optimize this Shopify page for universal LLM discoverability by ChatGPT, Claude, Perplexity, and other AI assistants.

Page data: ${JSON.stringify(content)}

🎯 UNIVERSAL PAGE OPTIMIZATION GOALS:
This prompt must work for ANY page type: Contact, About, FAQs, Privacy, Shipping, Returns, Custom pages, etc.
Do NOT make assumptions about content topic or store type.
${contentAnalysis.hasAITerms ? 'Note: This page contains AI-related terms, include relevant context.' : 'Only use terminology present in the original content.'}

✅ REQUIRED OUTPUT STRUCTURE:
{
  "optimizedTitle": "[Clear, descriptive title with key function]",
  "optimizedDescription": "[80-120 words explaining page purpose and content]",
  "summary": "[One sentence, max 100 characters, citation-ready]",
  "llmDescription": "[Must clearly explain: purpose, information type, relevant interactions]",
  "faqs": [
    {"question": "What information is provided on this page?", "answer": ""},
    {"question": "When would someone need to reference this page?", "answer": ""},
    {"question": "What type of content or policies does this cover?", "answer": ""}
  ]
}

✅ LLMDESCRIPTION REQUIREMENTS:
Must ALWAYS clearly explain:
- The purpose of the page (e.g., "contains store contact information", "outlines return policies")
- The kind of information customers or AI assistants can expect to find
- Examples of relevant interactions (e.g., "used for contacting support", "references shipping timeframes")

✅ FAQ REQUIREMENTS:
- Generate 3 universal, structured FAQs based ONLY on provided content
- Valuable to LLMs for understanding page function and scope
- DO NOT reference the page title in answers
- Focus on practical information and usage scenarios

🚫 ABSOLUTELY PROHIBITED:
- Marketing fluff: "sustainable," "must-have," "comprehensive guide," "essential resource"
- SEO phrases: "great for everyone," "we value your feedback," "high-quality service"
- Generic filler or assumptions about content not present in source
- Empty or vague responses for minimal content pages

EXAMPLE TARGETS:
Contact Page: "Contains store contact information including email, phone, and business hours for customer inquiries and support requests."
Privacy Page: "Outlines data collection practices, cookie usage, and customer privacy rights as required by applicable regulations."
About Page: "Provides background information about the company, founding story, mission, and key personnel or values."

MINIMAL CONTENT FALLBACK:
If page has minimal content, still provide structured, LLM-friendly descriptions based on page handle/title context.

Return ONLY this JSON with factual, universal content:
{
  "optimizedTitle": "",
  "optimizedDescription": "",
  "summary": "",
  "llmDescription": "",
  "faqs": [
    {"question": "What information is provided on this page?", "answer": ""},
    {"question": "When would someone need to reference this page?", "answer": ""},
    {"question": "What type of content or policies does this cover?", "answer": ""}
  ]
}`;
  } else {
    prompt = `Optimize this blog article for LLMs to understand, summarize, and recommend.

Article data: ${JSON.stringify(content)}

${contentAnalysis.hasAITerms ? 'This content mentions AI-related terms, so include relevant technical context.' : 'Do NOT assume it\'s about AI or content marketing unless explicitly stated.'}

Your output should:
- Explain the topic factually and clearly
- Include real insights, use cases, or comparisons
- Be free from SEO/marketing fluff

🚫 PROHIBITED:
- "This article sheds light…"
- "must-read content," "essential guide," "helpful for everyone"
- Vague sentences without practical info

✅ REQUIRED:
- Structured, factual summary of the topic
- 3 FAQs with technical, practical, or strategic value
- Mention tools or methods only if in the source

Return ONLY this JSON:
{
  "optimizedTitle": "",
  "optimizedDescription": "",
  "summary": "",
  "llmDescription": "",
  "faqs": [
    {"question": "What specific insight does this article offer?", "answer": ""},
    {"question": "How can this information be applied?", "answer": ""},
    {"question": "Who would benefit from reading this?", "answer": ""}
  ]
}`;
  }
  
  try {
    console.log('[AI-OPTIMIZATION] Starting optimization:', {
      type,
      hasOpenAI: !!OPENAI_API_KEY,
      hasAnthropic: !!ANTHROPIC_API_KEY,
      mockMode: MOCK_MODE,
      contentTitle: content.title || content.name
    });
    
    if (OPENAI_API_KEY) {
      console.log('[AI-OPTIMIZATION] Using OpenAI API');
      console.log('🧠 FINAL PROMPT SENT TO OPENAI:', prompt);
      console.log('🔍 CONTENT TYPE:', type);
      console.log('🔍 CONTENT TITLE:', content?.title || content?.name || 'No title');
      console.log('🕐 DEPLOYMENT TIMESTAMP: 2025-01-22-15:47');
      
      // 🎯 COST-OPTIMIZED MODEL SELECTION
      let selectedModel;
      if (type === 'collection') {
        selectedModel = 'gpt-4o-mini-2024-07-18'; // Cost-effective 4.1 mini - post-processing corruption was the real issue
      } else if (['product', 'page', 'article'].includes(type)) {
        selectedModel = 'gpt-4o-mini-2024-07-18'; // Cost-effective 4.1 mini for simpler tasks
      } else {
        selectedModel = 'gpt-4o-mini-2024-07-18'; // Default to mini for unknown types
        console.log(`⚠️ WARNING: Unknown type '${type}', defaulting to gpt-4o-mini`);
      }
      
      console.log(`🤖 SELECTED MODEL: ${selectedModel} for type: ${type}`);
      
      // Add a race condition with timeout - increased for GPT-4
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenAI API timeout after 30 seconds')), 30000);
      });
      
      const apiPromise = axios.post('https://api.openai.com/v1/chat/completions', {
        model: selectedModel, // 🎯 DYNAMIC MODEL SELECTION BASED ON TYPE
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent output
        max_tokens: 1200 // Increased for more detailed responses
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000 // 25 second timeout for GPT-4
      });
      
      try {
        console.log('[AI-OPTIMIZATION] Making OpenAI API call...');
        const response = await Promise.race([apiPromise, timeoutPromise]);
        console.log('[AI-OPTIMIZATION] OpenAI API response status:', response.status);
        console.log('[AI-OPTIMIZATION] OpenAI API response structure:', {
          hasData: !!response.data,
          hasChoices: !!response.data?.choices,
          choicesLength: response.data?.choices?.length || 0,
          hasMessage: !!response.data?.choices?.[0]?.message,
          hasContent: !!response.data?.choices?.[0]?.message?.content
        });
        
        if (!response.data?.choices?.[0]?.message?.content) {
          console.error('[AI-OPTIMIZATION] Invalid OpenAI response structure:', response.data);
          throw new Error('OpenAI returned invalid response structure');
        }
        
        const aiResponse = response.data.choices[0].message.content;
        console.log('[AI-OPTIMIZATION] OpenAI response:', aiResponse);
        
        try {
          // 🔧 Clean JSON response - remove code block markers if present
          let cleanResponse = aiResponse.trim();
          if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/```$/, '').trim();
            console.log('[AI-OPTIMIZATION] Cleaned code block markers from response');
          }
          
          const parsedResponse = JSON.parse(cleanResponse);
          console.log('[AI-OPTIMIZATION] Parsed OpenAI response:', parsedResponse);
          
          // === PRODUCTION SCORING & SAFETY INFRASTRUCTURE ===
          console.log('[SCORING] Calculating content quality scores...');
          
          // Calculate hallucination risk and visibility scores
          const riskScore = scoringUtils.calculateHallucinationRisk(parsedResponse, content, keywordsArray);
          const visibilityScore = scoringUtils.calculateVisibilityScore(parsedResponse);
          
          console.log(`[SCORING] Risk Score: ${riskScore}, Visibility Score: ${visibilityScore}`);
          
          // Add scores to response for draft storage
          parsedResponse.riskScore = riskScore;
          parsedResponse.visibilityScore = visibilityScore;
          parsedResponse.promptVersion = parsedResponse.promptVersion || 'v5.1-infra';
          
          // Log optimization session
          await logger.logOptimizationSession({
            shop: 'system', // Will be overridden by calling endpoint
            contentType: type,
            title: content.title || content.name || 'untitled',
            modelUsed: selectedModel,
            promptVersion: parsedResponse.promptVersion,
            riskScore,
            visibilityScore,
            rollbackTriggered: false,
            tokenEstimate: aiResponse.length / 4, // Rough token estimate
            processingTime: Date.now() - Date.now(), // Will be calculated by calling endpoint
            success: true
          });
          
          // Check if rollback is needed
          if (rollbackUtils.shouldRollback(riskScore)) {
            console.warn(`[ROLLBACK] High risk detected (${riskScore}) - content may need review`);
            await logger.logWarning('High hallucination risk detected', {
              contentType: type,
              title: content.title || content.name,
              riskScore,
              visibilityScore
            });
          }
          
          // Validate required fields
          if (!parsedResponse.optimizedTitle || !parsedResponse.optimizedDescription || !parsedResponse.summary) {
            console.error('[AI-OPTIMIZATION] Missing required fields in OpenAI response:', {
              hasTitle: !!parsedResponse.optimizedTitle,
              hasDescription: !!parsedResponse.optimizedDescription,
              hasSummary: !!parsedResponse.summary,
              hasFaqs: !!parsedResponse.faqs,
              faqsLength: parsedResponse.faqs?.length || 0
            });
            throw new Error('OpenAI response missing required fields');
          }
          
          // Validate FAQs structure
          if (!parsedResponse.faqs || !Array.isArray(parsedResponse.faqs) || parsedResponse.faqs.length === 0) {
            console.error('[AI-OPTIMIZATION] Invalid FAQs in OpenAI response:', parsedResponse.faqs);
            parsedResponse.faqs = [
              {
                question: `What is ${content.title || content.name}?`,
                answer: parsedResponse.summary || 'A quality product from our collection.'
              }
            ];
          } else {
            // Clean up any empty or malformed FAQ entries - handle both q/a and question/answer formats
            parsedResponse.faqs = parsedResponse.faqs.filter(faq => {
              if (!faq) return false;
              
              // Handle both formats: {q: "", a: ""} and {question: "", answer: ""}
              const question = faq.question || faq.q;
              const answer = faq.answer || faq.a;
              
              return typeof question === 'string' && 
                     typeof answer === 'string' && 
                     question.trim() && 
                     answer.trim() &&
                     question !== '' &&
                     answer !== '';
            });
            
            // If all FAQs were filtered out, add a default one
            if (parsedResponse.faqs.length === 0) {
              parsedResponse.faqs = [
                {
                  question: `What is ${content.title || content.name}?`,
                  answer: parsedResponse.summary || 'A quality product from our collection.'
                }
              ];
            }
          }
          
          return parsedResponse;
        } catch (parseError) {
          console.error('[AI-OPTIMIZATION] Failed to parse OpenAI response as JSON:', parseError);
          console.log('[AI-OPTIMIZATION] Raw unparseable response:', aiResponse);
          throw new Error(`OpenAI JSON parsing failed: ${parseError.message}`);
        }
      } catch (apiError) {
        console.error('[AI-OPTIMIZATION] OpenAI API call failed:', apiError.message);
        console.error('[AI-OPTIMIZATION] Full API error:', apiError);
        throw new Error(`OpenAI API failed: ${apiError.message}`);
      }
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
      
      // 🔧 Clean JSON response - remove code block markers if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        console.log('[AI-OPTIMIZATION] Cleaned code block markers from Anthropic response');
      }
      
      return JSON.parse(cleanResponse);
    } else {
      // No AI API keys available - throw error instead of fallback
      throw new Error('No AI API keys configured (OpenAI or Anthropic required)');
    }
  } catch (error) {
    console.error('[AI-OPTIMIZATION] AI optimization error:', error);
    console.error('[AI-OPTIMIZATION] Error details:', error.response?.data);
    // NO FALLBACK - throw the error to prevent garbage content
    throw error;
  }
};

// Simplified auth middleware for mock endpoints
const simpleVerifyShop = (req, res, next) => {
  const shop = req.query.shop || req.body.shop || req.params.shop || req.headers['x-shopify-shop-domain'];
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  // Get existing shop info or create minimal entry
  let shopInfo = shopData.get(shop);
  if (!shopInfo) {
    // Don't set mock-token - let endpoints handle authentication properly
    shopInfo = { installedAt: new Date().toISOString() };
    shopData.set(shop, shopInfo);
  }
  
  req.shopInfo = shopInfo;
  req.shop = shop;
  next();
};

// API: Debug endpoint to test prompt selection
app.post('/api/debug/prompt-selection', async (req, res) => {
  try {
    const { content, type, settings } = req.body;
    
    const debugInfo = {
      type: type,
      typeOf: typeof type,
      exactMatch: type === 'collection',
      stringValue: String(type),
      trimmed: String(type).trim(),
      inputType: req.body.type,
      bodyKeys: Object.keys(req.body)
    };
    
    console.log('🔍 DEBUG ENDPOINT - PROMPT SELECTION:', debugInfo);
    
    // Test the condition directly
    let promptType = 'unknown';
    if (type === 'product') {
      promptType = 'product';
    } else if (type === 'collection') {
      promptType = 'collection';
      console.log('🚨🚨🚨 COLLECTION CONDITION MATCHED IN DEBUG! 🚨🚨🚨');
    } else if (type === 'page') {
      promptType = 'page';
    } else {
      promptType = 'article/fallback';
    }
    
    res.json({
      debug: debugInfo,
      promptType: promptType,
      message: 'Debug information captured'
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
        value: JSON.stringify({
          title: optimized.optimizedTitle,
          optimizedDescription: optimized.optimizedDescription,
          content: optimized.content,
          llmDescription: optimized.llmDescription,
          summary: optimized.summary,
          faqs: optimized.faqs,
          optimizedAt: new Date().toISOString()
        }),
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
      : resourceType === 'page'
      ? `pages/${resourceId}/metafields`
      : resourceType === 'collection'
      ? `custom_collections/${resourceId}/metafields`  // Collections need custom_collections endpoint
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
        `https://${shop}/admin/api/2024-01/${resourceType === 'product' ? 'products' : resourceType === 'page' ? 'pages' : resourceType === 'collection' ? 'custom_collections' : 'articles'}/${resourceId}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const originalData = resourceType === 'collection' 
        ? originalResponse.data.custom_collection 
        : originalResponse.data[resourceType];
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
      },
      {
        namespace: 'asb',
        key: 'optimization_data',
        value: JSON.stringify({
          optimized: true,
          settings: draftSettings ? JSON.parse(draftSettings) : {},
          timestamp: new Date().toISOString()
        }),
        type: 'json'
      }
    ];
    
    console.log('[PUBLISH] Publishing draft content for', resourceType, resourceId);
    console.log('[PUBLISH] Draft content found:', !!draftContent);
    console.log('[PUBLISH] FAQ data found:', !!draftFaq);
    console.log('[PUBLISH] Settings found:', !!draftSettings);
    
    // Update the actual product/article content with optimized content
    if (draftContent) {
      try {
        const updateEndpoint = resourceType === 'product' ? 'products' : resourceType === 'page' ? 'pages' : resourceType === 'collection' ? 'custom_collections' : 'articles';
        
        // Parse draft content to extract the optimized content
        const parsedDraft = JSON.parse(draftContent);
        const optimizedContent = parsedDraft.body_html || parsedDraft.content || parsedDraft.llmDescription;
        const optimizedTitle = parsedDraft.title;
        
        // Parse FAQ data and format for inclusion in description
        let faqHtml = '';
        if (draftFaq) {
          try {
            const faqData = JSON.parse(draftFaq);
            if (faqData && faqData.questions && Array.isArray(faqData.questions) && faqData.questions.length > 0) {
              faqHtml = '\n\n<div class="ai-optimization-faqs">\n<h3>Frequently Asked Questions</h3>\n';
              faqData.questions.forEach(faq => {
                if (faq && faq.question && faq.answer && faq.question !== 'undefined' && faq.answer !== 'undefined') {
                  faqHtml += `<div class="faq-item">\n<h4>${faq.question}</h4>\n<p>${faq.answer}</p>\n</div>\n`;
                }
              });
              faqHtml += '</div>';
            }
          } catch (error) {
            console.error('[PUBLISH] Error parsing FAQ data:', error);
          }
        }
        
        // Combine optimized content with FAQs for LLM discovery
        const finalContent = optimizedContent + faqHtml;
        
        console.log(`[PUBLISH] Updating ${resourceType} content for ID ${resourceId}`);
        console.log(`[PUBLISH] Optimized content length:`, optimizedContent?.length || 0);
        console.log(`[PUBLISH] FAQ HTML length:`, faqHtml.length);
        console.log(`[PUBLISH] Final content length:`, finalContent.length);
        console.log(`[PUBLISH] Optimized title:`, optimizedTitle);
        
        const updatePayload = resourceType === 'product' 
          ? { 
              product: { 
                id: resourceId, 
                body_html: finalContent,
                ...(optimizedTitle && { title: optimizedTitle })
              } 
            }
          : resourceType === 'page'
          ? {
              page: {
                id: resourceId,
                body_html: finalContent,
                ...(optimizedTitle && { title: optimizedTitle })
              }
            }
          : resourceType === 'collection'
          ? {
              custom_collection: {
                id: resourceId,
                body_html: finalContent,
                ...(optimizedTitle && { title: optimizedTitle })
              }
            }
          : { 
              article: { 
                id: resourceId, 
                body_html: finalContent,
                ...(optimizedTitle && { title: optimizedTitle })
              } 
            };
            
        await axios.put(
          `https://${shop}/admin/api/2024-01/${updateEndpoint}/${resourceId}.json`,
          updatePayload,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        console.log(`[PUBLISH] Successfully updated ${resourceType} content`);
      } catch (contentError) {
        console.error(`[PUBLISH] Failed to update ${resourceType} content:`, contentError.response?.data || contentError.message);
        throw new Error(`Failed to update ${resourceType} content: ${contentError.response?.data?.errors || contentError.message}`);
      }
    }
    
    // Create/update live metafields one by one
    for (const metafield of liveMetafields) {
      try {
        const metafieldEndpoint = resourceType === 'product' 
          ? `products/${resourceId}/metafields`
          : resourceType === 'page'
          ? `pages/${resourceId}/metafields`
          : resourceType === 'collection'
          ? `custom_collections/${resourceId}/metafields`
          : `articles/${resourceId}/metafields`;
          
        await axios.post(
          `https://${shop}/admin/api/2024-01/${metafieldEndpoint}.json`,
          { metafield },
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        console.log(`[PUBLISH] Created live metafield: ${metafield.key}`);
      } catch (error) {
        console.error(`[PUBLISH] Error creating metafield ${metafield.key}:`, error.response?.data || error.message);
        // Don't fail the entire publish for metafield errors
      }
    }
    
    // Clean up draft metafields after successful publish
    try {
      const draftMetafieldIds = metafields
        .filter(m => ['optimized_content_draft', 'faq_data_draft', 'optimization_settings_draft'].includes(m.key))
        .map(m => m.id);
      
      for (const metafieldId of draftMetafieldIds) {
        try {
          await axios.delete(
            `https://${shop}/admin/api/2024-01/metafields/${metafieldId}.json`,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
          );
          console.log(`[PUBLISH] Deleted draft metafield ${metafieldId}`);
        } catch (deleteError) {
          console.error(`[PUBLISH] Failed to delete draft metafield ${metafieldId}:`, deleteError.response?.data || deleteError.message);
        }
      }
    } catch (cleanupError) {
      console.error('[PUBLISH] Draft cleanup error:', cleanupError);
      // Don't fail the publish if cleanup fails
    }
    
    res.json({
      message: 'Draft optimization published successfully',
      resourceType,
      resourceId,
      published: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[PUBLISH] Publish error:', error);
    console.error('[PUBLISH] Error message:', error.message);
    console.error('[PUBLISH] Error stack:', error.stack);
    console.error('[PUBLISH] Error response:', error.response?.data);
    console.error('[PUBLISH] Error status:', error.response?.status);
    console.error('[PUBLISH] Request body:', req.body);
    res.status(500).json({ 
      error: 'Failed to publish draft optimization',
      details: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
});

// API: RESTful publish endpoints for E2E testing
app.post('/api/publish/product/:id', simpleVerifyShop, async (req, res) => {
  try {
    const { id: resourceId } = req.params;
    const { shop } = req;
    
    // Forward to the main publish endpoint
    req.body = { resourceType: 'product', resourceId };
    
    // Get shop info for access token
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ 
        error: 'Shop not authenticated', 
        redirectUrl: `/auth?shop=${shop}`
      });
    }
    
    const { accessToken } = shopInfo;
    
    const endpoint = `products/${resourceId}/metafields`;
    
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
    
    // Parse and update the actual product content with optimized content
    if (draftContent) {
      try {
        // Parse the draft content (stored as JSON object)
        const draftData = JSON.parse(draftContent);
        const optimizedContent = draftData.body_html || draftData.llmDescription || draftData.content;
        const optimizedTitle = draftData.title;
        
        // Parse FAQ data and format for inclusion in description
        let faqHtml = '';
        if (draftFaq) {
          try {
            const faqData = JSON.parse(draftFaq);
            if (faqData && faqData.questions && Array.isArray(faqData.questions) && faqData.questions.length > 0) {
              faqHtml = '\n\n<div class="ai-optimization-faqs">\n<h3>Frequently Asked Questions</h3>\n';
              faqData.questions.forEach(faq => {
                if (faq && faq.question && faq.answer && faq.question !== 'undefined' && faq.answer !== 'undefined') {
                  faqHtml += `<div class="faq-item">\n<h4>${faq.question}</h4>\n<p>${faq.answer}</p>\n</div>\n`;
                }
              });
              faqHtml += '</div>';
            }
          } catch (error) {
            console.error('[PUBLISH] Error parsing FAQ data:', error);
          }
        }
        
        // Combine optimized content with FAQs for LLM discovery
        const finalContent = optimizedContent + faqHtml;
        
        console.log(`[PUBLISH] Parsed draft data:`, draftData);
        console.log(`[PUBLISH] Optimized content length:`, optimizedContent?.length);
        console.log(`[PUBLISH] FAQ HTML length:`, faqHtml.length);
        console.log(`[PUBLISH] Final content length:`, finalContent.length);
        console.log(`[PUBLISH] Optimized title:`, optimizedTitle);
        
        if (optimizedContent) {
          const updatePayload = { 
            product: { 
              id: resourceId, 
              body_html: finalContent,
              ...(optimizedTitle && { title: optimizedTitle })
            } 
          };
              
          console.log(`[PUBLISH] Updating product content for ID ${resourceId}`);
          console.log(`[PUBLISH] PUT URL: https://${shop}/admin/api/2024-01/products/${resourceId}.json`);
          console.log(`[PUBLISH] PUT Payload:`, JSON.stringify(updatePayload, null, 2));
          
          const putResponse = await axios.put(
            `https://${shop}/admin/api/2024-01/products/${resourceId}.json`,
            updatePayload,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
          );
          console.log(`[PUBLISH] Shopify PUT Response Status:`, putResponse.status);
          console.log(`[PUBLISH] Shopify PUT Response Data:`, JSON.stringify(putResponse.data, null, 2));
          console.log(`[PUBLISH] Successfully updated product content and title`);
        } else {
          console.warn(`[PUBLISH] No optimized content found in draft data`);
        }
      } catch (contentError) {
        console.error(`[PUBLISH] Failed to update product content:`, contentError.response?.data || contentError.message);
        console.error(`[PUBLISH] Draft content that failed:`, draftContent);
        throw new Error(`Failed to update product content: ${contentError.response?.data?.errors || contentError.message}`);
      }
    }
    
    // Create live metafields
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
    
    // Create/update live metafields
    for (const metafield of liveMetafields) {
      try {
        await axios.post(
          `https://${shop}/admin/api/2024-01/products/${resourceId}/metafields.json`,
          { metafield },
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        console.log(`[PUBLISH] Created live metafield: ${metafield.key}`);
      } catch (error) {
        console.error(`[PUBLISH] Error creating metafield ${metafield.key}:`, error.response?.data || error.message);
      }
    }
    
    // Clean up draft metafields
    try {
      const draftMetafieldIds = metafields
        .filter(m => ['optimized_content_draft', 'faq_data_draft', 'optimization_settings_draft'].includes(m.key))
        .map(m => m.id);
      
      for (const metafieldId of draftMetafieldIds) {
        try {
          await axios.delete(
            `https://${shop}/admin/api/2024-01/metafields/${metafieldId}.json`,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
          );
          console.log(`[PUBLISH] Deleted draft metafield ${metafieldId}`);
        } catch (deleteError) {
          console.error(`[PUBLISH] Failed to delete draft metafield ${metafieldId}:`, deleteError.response?.data || deleteError.message);
        }
      }
    } catch (cleanupError) {
      console.error('[PUBLISH] Draft cleanup error:', cleanupError);
    }
    
    res.json({
      message: 'Product draft published successfully',
      resourceType: 'product',
      resourceId,
      published: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Product publish error:', error);
    res.status(500).json({ error: 'Failed to publish product draft' });
  }
});

app.post('/api/publish/article/:id', simpleVerifyShop, async (req, res) => {
  try {
    const { id: resourceId } = req.params;
    const { shop } = req;
    
    // Similar implementation for articles
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ 
        error: 'Shop not authenticated', 
        redirectUrl: `/auth?shop=${shop}`
      });
    }
    
    const { accessToken } = shopInfo;
    
    const endpoint = `articles/${resourceId}/metafields`;
    
    // Get draft metafields
    const draftResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=asb`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    
    const metafields = draftResponse.data.metafields;
    const draftContent = metafields.find(m => m.key === 'optimized_content_draft')?.value;
    const draftFaq = metafields.find(m => m.key === 'faq_data_draft')?.value;
    
    if (!draftContent) {
      return res.status(404).json({ error: 'No draft content found to publish' });
    }
    
    // Parse and update the actual article content
    if (draftContent) {
      try {
        const draftData = JSON.parse(draftContent);
        const optimizedContent = draftData.body_html || draftData.content || draftData.llmDescription;
        const optimizedTitle = draftData.title;
        
        // Parse FAQ data and format for inclusion in description
        let faqHtml = '';
        if (draftFaq) {
          try {
            const faqData = JSON.parse(draftFaq);
            if (faqData && faqData.questions && Array.isArray(faqData.questions) && faqData.questions.length > 0) {
              faqHtml = '\n\n<div class="ai-optimization-faqs">\n<h3>Frequently Asked Questions</h3>\n';
              faqData.questions.forEach(faq => {
                if (faq && faq.question && faq.answer && faq.question !== 'undefined' && faq.answer !== 'undefined') {
                  faqHtml += `<div class="faq-item">\n<h4>${faq.question}</h4>\n<p>${faq.answer}</p>\n</div>\n`;
                }
              });
              faqHtml += '</div>';
            }
          } catch (error) {
            console.error('[PUBLISH] Error parsing FAQ data:', error);
          }
        }
        
        // Combine optimized content with FAQs for LLM discovery
        const finalContent = optimizedContent + faqHtml;
        
        console.log(`[PUBLISH] Optimized content length:`, optimizedContent?.length);
        console.log(`[PUBLISH] FAQ HTML length:`, faqHtml.length);
        console.log(`[PUBLISH] Final content length:`, finalContent.length);
        
        if (optimizedContent) {
          const updatePayload = { 
            article: { 
              id: resourceId, 
              body_html: finalContent,
              ...(optimizedTitle && { title: optimizedTitle })
            } 
          };
              
          await axios.put(
            `https://${shop}/admin/api/2024-01/articles/${resourceId}.json`,
            updatePayload,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
          );
          console.log(`[PUBLISH] Successfully updated article content and title`);
        }
      } catch (contentError) {
        console.error(`[PUBLISH] Failed to update article content:`, contentError.response?.data || contentError.message);
        throw new Error(`Failed to update article content: ${contentError.response?.data?.errors || contentError.message}`);
      }
    }
    
    // Create live metafields for article
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
    
    for (const metafield of liveMetafields) {
      try {
        await axios.post(
          `https://${shop}/admin/api/2024-01/articles/${resourceId}/metafields.json`,
          { metafield },
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
      } catch (error) {
        console.error(`[PUBLISH] Error creating article metafield ${metafield.key}:`, error.response?.data || error.message);
      }
    }
    
    // Clean up draft metafields
    try {
      const draftMetafieldIds = metafields
        .filter(m => ['optimized_content_draft', 'faq_data_draft', 'optimization_settings_draft'].includes(m.key))
        .map(m => m.id);
      
      for (const metafieldId of draftMetafieldIds) {
        try {
          await axios.delete(
            `https://${shop}/admin/api/2024-01/metafields/${metafieldId}.json`,
            { headers: { 'X-Shopify-Access-Token': accessToken } }
          );
        } catch (deleteError) {
          console.error(`[PUBLISH] Failed to delete article draft metafield ${metafieldId}:`, deleteError.response?.data || deleteError.message);
        }
      }
    } catch (cleanupError) {
      console.error('[PUBLISH] Article draft cleanup error:', cleanupError);
    }
    
    res.json({
      message: 'Article draft published successfully',
      resourceType: 'article',
      resourceId,
      published: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Article publish error:', error);
    res.status(500).json({ error: 'Failed to publish article draft' });
  }
});

// TEMPORARY: Debug endpoint to get access token for E2E testing
app.get('/api/debug/token', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    const shopInfo = shopData.get(shop);
    console.log('[DEBUG-TOKEN] Shop:', shop);
    console.log('[DEBUG-TOKEN] ShopInfo:', shopInfo);
    console.log('[DEBUG-TOKEN] All shopData keys:', Array.from(shopData.keys()));
    
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ 
        error: 'No access token found',
        shop,
        shopInfoExists: !!shopInfo,
        accessTokenExists: shopInfo?.accessToken ? 'yes' : 'no',
        allShops: Array.from(shopData.keys())
      });
    }
    res.json({ token: shopInfo.accessToken });
  } catch (error) {
    console.error('[DEBUG-TOKEN] Error:', error);
    res.status(500).json({ error: 'Failed to get token', details: error.message });
  }
});

// TEMPORARY: Debug endpoint to check shop data
app.get('/api/debug/shopdata', (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.json({
      allShops: Array.from(shopData.keys()),
      totalShops: shopData.size
    });
  }
  
  const shopInfo = shopData.get(shop);
  res.json({
    shop,
    shopInfo: shopInfo ? {
      hasAccessToken: !!shopInfo.accessToken,
      accessToken: shopInfo.accessToken === 'mock-token' ? 'mock-token' : 'real-token',
      installedAt: shopInfo.installedAt,
      proxyRegistered: shopInfo.proxyRegistered,
      nonce: shopInfo.nonce
    } : null,
    allShops: Array.from(shopData.keys())
  });
});

// TEMPORARY: Debug endpoint to clear shop data and force re-auth
app.post('/api/debug/clear-shop/:shop', (req, res) => {
  const { shop } = req.params;
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  const hadData = shopData.has(shop);
  shopData.delete(shop);
  
  res.json({
    message: `Shop data cleared for ${shop}`,
    hadData,
    authUrl: `${req.protocol}://${req.get('host')}/auth?shop=${shop}`
  });
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
      : type === 'page'
      ? `pages/${id}/metafields`
      : type === 'collection'
      ? `custom_collections/${id}/metafields`
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
        content: draftContent ? (function() {
          try {
            console.log('[DRAFT-FETCH] Raw draftContent:', draftContent);
            const parsed = JSON.parse(draftContent);
            console.log('[DRAFT-FETCH] Parsed as JSON:', parsed);
            return parsed;
          } catch (e) {
            console.log('[DRAFT-FETCH] JSON parse failed, treating as plain text:', e.message);
            // Handle plain text content (Products/Blogs store as string)
            return { description: draftContent };
          }
        })() : null,
        faq: draftFaq ? JSON.parse(draftFaq) : null,
        settings: draftSettings ? JSON.parse(draftSettings) : null,
        timestamp: draftTimestamp
      },
      live: {
        content: liveContent ? (function() {
          try {
            return JSON.parse(liveContent);
          } catch (e) {
            // Handle plain text content (Products/Blogs store as string)
            return { description: liveContent };
          }
        })() : null,
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
app.post('/api/optimize/products', simpleVerifyShop, optimizationLimiter, async (req, res) => {
  try {
    const { productIds, settings } = req.body;
    const { shop } = req;
    
    console.log(`[PRODUCTS-OPTIMIZE] Starting optimization for shop: ${shop}, products: ${productIds}`);
    
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
        console.log(`[PRODUCTS-OPTIMIZE] Fetching product ${productId} from Shopify`);
        // Fetch product from Shopify API
        const productResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${productId}.json`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken },
            timeout: 10000 // 10 second timeout
          }
        );
        console.log(`[PRODUCTS-OPTIMIZE] Product ${productId} fetched successfully`);
        
        const product = productResponse.data.product;
        
        // Store original as backup if not already stored
        console.log(`[PRODUCTS-OPTIMIZE] Checking for existing backup for product ${productId}`);
        const metafieldsResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json?namespace=asb&key=original_backup`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken },
            timeout: 10000 // 10 second timeout
          }
        );
        console.log(`[PRODUCTS-OPTIMIZE] Backup check completed for product ${productId}`);
        
        if (metafieldsResponse.data.metafields.length === 0) {
          await axios.post(
            `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
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
        const sessionStart = Date.now();
        console.log(`[PRODUCTS-OPTIMIZE] Starting AI optimization for product ${productId}`);
        
        const optimized = await optimizeContent(product, 'product', settings);
        console.log(`[PRODUCTS-OPTIMIZE] AI optimization completed for product ${productId}`);
        
        // === PRODUCTION ROLLBACK SAFETY CHECK ===
        const riskScore = optimized.riskScore || 0;
        const visibilityScore = optimized.visibilityScore || 0;
        
        console.log(`[PRODUCTS-OPTIMIZE] Quality scores - Risk: ${riskScore}, Visibility: ${visibilityScore}`);
        
        // Create rollback save function for this product
        const rollbackSaveFn = async (draftId, originalContent) => {
          await axios.post(
            `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'optimized_content_draft',
                value: JSON.stringify({
                  title: originalContent.title,
                  body_html: originalContent.body_html || 'Original description preserved due to safety rollback',
                  summary: `${originalContent.title} - ${originalContent.product_type || 'product'}`,
                  llmDescription: originalContent.body_html || `Original product: ${originalContent.title}`,
                  rolledBack: true,
                  rollbackAt: new Date().toISOString()
                }),
                type: 'json'
              }
            },
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        };
        
        // Execute rollback if high risk detected
        const rollbackExecuted = await rollbackUtils.executeRollbackIfNeeded({
          riskScore,
          draftId: productId,
          originalContent: product,
          saveFn: rollbackSaveFn,
          shop,
          contentType: 'product',
          title: product.title
        });
        
        if (!rollbackExecuted) {
          // Safe to store optimized content as draft
          console.log(`[PRODUCTS-OPTIMIZE] Storing optimization as draft for product ${productId}`);
          
          await axios.post(
            `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'optimized_content_draft',
                value: JSON.stringify({
                  title: optimized.optimizedTitle,
                  body_html: optimized.optimizedDescription,
                  summary: optimized.summary,
                  llmDescription: optimized.llmDescription,
                  riskScore: optimized.riskScore,
                  visibilityScore: optimized.visibilityScore,
                  promptVersion: optimized.promptVersion,
                  optimizedAt: new Date().toISOString()
                }),
                type: 'json'
              }
            },
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        }
        
        // Log optimization session with complete metadata
        await logger.logOptimizationSession({
          shop,
          contentType: 'product',
          title: product.title,
          modelUsed: 'gpt-4o-mini-2024-07-18',
          promptVersion: optimized.promptVersion || 'v5.1-product',
          riskScore,
          visibilityScore,
          rollbackTriggered: rollbackExecuted,
          tokenEstimate: JSON.stringify(optimized).length / 4,
          processingTime: Date.now() - sessionStart,
          success: !rollbackExecuted
        });
        
        // Store FAQ data as draft
        await axios.post(
          `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
          {
            metafield: {
              namespace: 'asb',
              key: 'faq_data_draft',
              value: JSON.stringify({ questions: optimized.faqs }),
              type: 'json'
            }
          },
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        // Store optimization settings as draft
        await axios.post(
          `https://${shop}/admin/api/2024-01/products/${productId}/metafields.json`,
          {
            metafield: {
              namespace: 'asb',
              key: 'optimization_settings_draft',
              value: JSON.stringify({
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
        
        console.log(`[PRODUCTS-OPTIMIZE] Draft optimization stored for product ${productId}`);
        
        results.push({
          productId,
          status: 'success',
          version: 'v1',
          optimized,
          originalTitle: product.title,
          newTitle: optimized.optimizedTitle || product.title,
          riskScore,
          visibilityScore,
          rollbackTriggered: rollbackExecuted
        });
      } catch (error) {
        console.error(`Error optimizing product ${productId}:`, error.message);
        console.error('Full error details:', error);
        results.push({
          productId,
          status: 'error',
          error: error.message || 'Unknown error occurred'
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

// API: Optimize pages
app.post('/api/optimize/pages', simpleVerifyShop, optimizationLimiter, async (req, res) => {
  try {
    const { pageIds, settings } = req.body;
    const { shop } = req;
    
    console.log(`[PAGES-OPTIMIZE] Starting optimization for shop: ${shop}, pages: ${pageIds}`);
    
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
    
    // Process each page ID
    for (const pageId of pageIds) {
      try {
        console.log(`[PAGES-OPTIMIZE] Processing page ${pageId}`);
        
        // Fetch page from Shopify API
        const pageResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/pages/${pageId}.json`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        const page = pageResponse.data.page;
        console.log(`Found page: ${page.title}`);
        
        // Store original as backup if not already stored
        const metafieldsResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/pages/${pageId}/metafields.json?namespace=asb&key=original_backup`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        if (metafieldsResponse.data.metafields.length === 0) {
          await axios.post(
            `https://${shop}/admin/api/2024-01/pages/${pageId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'original_backup',
                value: JSON.stringify({
                  title: page.title,
                  body_html: page.body_html,
                  handle: page.handle
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
        const sessionStart = Date.now();
        console.log(`[PAGES-OPTIMIZE] Starting AI optimization for page ${pageId}`);
        
        const optimized = await optimizeContent(page, 'page', settings);
        console.log(`[PAGES-OPTIMIZE] AI optimization completed for page ${pageId}`);
        
        // === PRODUCTION ROLLBACK SAFETY CHECK ===
        const riskScore = optimized.riskScore || 0;
        const visibilityScore = optimized.visibilityScore || 0;
        
        console.log(`[PAGES-OPTIMIZE] Quality scores - Risk: ${riskScore}, Visibility: ${visibilityScore}`);
        
        // Create rollback save function for this page
        const rollbackSaveFn = async (draftId, originalContent) => {
          await axios.post(
            `https://${shop}/admin/api/2024-01/pages/${pageId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'optimized_content_draft',
                value: JSON.stringify({
                  title: originalContent.title,
                  body_html: originalContent.body_html || 'Original content preserved due to safety rollback',
                  llmDescription: originalContent.body_html || `Original page: ${originalContent.title}`,
                  summary: `${originalContent.title} page`,
                  rolledBack: true,
                  rollbackAt: new Date().toISOString()
                }),
                type: 'json'
              }
            },
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        };
        
        // Execute rollback if high risk detected
        const rollbackExecuted = await rollbackUtils.executeRollbackIfNeeded({
          riskScore,
          draftId: pageId,
          originalContent: page,
          saveFn: rollbackSaveFn,
          shop,
          contentType: 'page',
          title: page.title
        });
        
        if (!rollbackExecuted) {
          // Safe to store optimized content as draft
          console.log(`[PAGES-OPTIMIZE] Storing optimization as draft for page ${page.id}`);
          
          await axios.post(
            `https://${shop}/admin/api/2024-01/pages/${pageId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'optimized_content_draft',
                value: JSON.stringify({
                  title: optimized.optimizedTitle,
                  body_html: optimized.optimizedDescription,
                  llmDescription: optimized.llmDescription,
                  summary: optimized.summary,
                  riskScore: optimized.riskScore,
                  visibilityScore: optimized.visibilityScore,
                  promptVersion: optimized.promptVersion,
                  timestamp: new Date().toISOString()
                }),
                type: 'json'
              }
            },
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        // Store FAQ data as draft
        await axios.post(
          `https://${shop}/admin/api/2024-01/pages/${pageId}/metafields.json`,
          {
            metafield: {
              namespace: 'asb',
              key: 'faq_data_draft',
              value: JSON.stringify(optimized.faqs || []),
              type: 'json'
            }
          },
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        }
        
        // Store optimization settings as draft
        await axios.post(
          `https://${shop}/admin/api/2024-01/pages/${pageId}/metafields.json`,
          {
            metafield: {
              namespace: 'asb',
              key: 'optimization_settings_draft',
              value: JSON.stringify({
                settings,
                timestamp: new Date().toISOString(),
                optimizationType: 'page'
              }),
              type: 'json'
            }
          },
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        // Log optimization session with complete metadata
        await logger.logOptimizationSession({
          shop,
          contentType: 'page',
          title: page.title,
          modelUsed: 'gpt-4o-mini-2024-07-18',
          promptVersion: optimized.promptVersion || 'v5.1-page',
          riskScore,
          visibilityScore,
          rollbackTriggered: rollbackExecuted,
          tokenEstimate: JSON.stringify(optimized).length / 4,
          processingTime: Date.now() - sessionStart,
          success: !rollbackExecuted
        });
        
        results.push({
          pageId,
          status: 'success',
          optimized,
          originalTitle: page.title,
          newTitle: optimized.optimizedTitle || page.title,
          riskScore,
          visibilityScore,
          rollbackTriggered: rollbackExecuted
        });
      } catch (error) {
        console.error(`Error optimizing page ${pageId}:`, error.message);
        console.error('Full error details:', error);
        results.push({
          pageId,
          status: 'error',
          error: error.message || 'Unknown error occurred'
        });
      }
    }
    
    console.log(`Page optimization completed: ${results.filter(r => r.status === 'success').length} successful, ${results.filter(r => r.status === 'error').length} failed`);
    
    res.json({
      shop,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    });
  } catch (error) {
    console.error('Page optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize pages: ' + error.message });
  }
});

// API: Optimize blogs
app.post('/api/optimize/blogs', simpleVerifyShop, optimizationLimiter, async (req, res) => {
  try {
    const { blogIds, settings } = req.body;
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
    const results = [];
    
    // Process each blog ID
    for (const blogId of blogIds) {
      try {
        // Fetch articles from this blog
        const articlesResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/blogs/${blogId}/articles.json?limit=50&fields=id,title,body_html,summary,author,tags,handle,created_at,updated_at`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        const articles = articlesResponse.data.articles;
        console.log(`Found ${articles.length} articles in blog ${blogId}`);
        
        // Optimize each article in this blog
        for (const article of articles) {
          try {
            // Store original as backup if not already stored
            const metafieldsResponse = await axios.get(
              `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json?namespace=asb&key=original_backup`,
              {
                headers: { 'X-Shopify-Access-Token': accessToken }
              }
            );
            
            if (metafieldsResponse.data.metafields.length === 0) {
              await axios.post(
                `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json`,
                {
                  metafield: {
                    namespace: 'asb',
                    key: 'original_backup',
                    value: JSON.stringify({
                      title: article.title,
                      body_html: article.body_html,
                      summary: article.summary,
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
            
            // Optimize content using AI
            const sessionStart = Date.now();
            console.log(`[BLOGS-OPTIMIZE] Starting AI optimization for article ${article.id}`);
            
            const optimized = await optimizeContent(article, 'article', settings);
            console.log(`[BLOGS-OPTIMIZE] AI optimization completed for article ${article.id}`);
            
            // === PRODUCTION ROLLBACK SAFETY CHECK ===
            const riskScore = optimized.riskScore || 0;
            const visibilityScore = optimized.visibilityScore || 0;
            
            console.log(`[BLOGS-OPTIMIZE] Quality scores - Risk: ${riskScore}, Visibility: ${visibilityScore}`);
            
            // Create rollback save function for this article
            const rollbackSaveFn = async (draftId, originalContent) => {
              await axios.post(
                `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json`,
                {
                  metafield: {
                    namespace: 'asb',
                    key: 'optimized_content_draft',
                    value: JSON.stringify({
                      title: originalContent.title,
                      body_html: originalContent.body_html || 'Original content preserved due to safety rollback',
                      summary: originalContent.summary || `${originalContent.title} article`,
                      llmDescription: originalContent.body_html || `Original article: ${originalContent.title}`,
                      rolledBack: true,
                      rollbackAt: new Date().toISOString()
                    }),
                    type: 'json'
                  }
                },
                {
                  headers: { 'X-Shopify-Access-Token': accessToken }
                }
              );
            };
            
            // Execute rollback if high risk detected
            const rollbackExecuted = await rollbackUtils.executeRollbackIfNeeded({
              riskScore,
              draftId: article.id,
              originalContent: article,
              saveFn: rollbackSaveFn,
              shop,
              contentType: 'article',
              title: article.title
            });
            
            if (!rollbackExecuted) {
              // Safe to store optimized content as draft
              console.log(`[BLOGS-OPTIMIZE] Storing optimization as draft for article ${article.id}`);
              
              await axios.post(
                `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json`,
                {
                  metafield: {
                    namespace: 'asb',
                    key: 'optimized_content_draft',
                    value: JSON.stringify({
                      title: optimized.optimizedTitle,
                      body_html: optimized.optimizedDescription,
                      summary: optimized.summary,
                      llmDescription: optimized.llmDescription,
                      riskScore: optimized.riskScore,
                      visibilityScore: optimized.visibilityScore,
                      promptVersion: optimized.promptVersion,
                      optimizedAt: new Date().toISOString()
                    }),
                    type: 'json'
                  }
                },
              {
                headers: { 'X-Shopify-Access-Token': accessToken }
              }
            );
            
            // Store FAQ data as draft
            await axios.post(
              `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json`,
              {
                metafield: {
                  namespace: 'asb',
                  key: 'faq_data_draft',
                  value: JSON.stringify({ questions: optimized.faqs }),
                  type: 'json'
                }
              },
              {
                headers: { 'X-Shopify-Access-Token': accessToken }
              }
            );
            }
            
            // Store optimization settings as draft
            await axios.post(
              `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json`,
              {
                metafield: {
                  namespace: 'asb',
                  key: 'optimization_settings_draft',
                  value: JSON.stringify({
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
            
            // Log optimization session with complete metadata
            await logger.logOptimizationSession({
              shop,
              contentType: 'article',
              title: article.title,
              modelUsed: 'gpt-4o-mini-2024-07-18',
              promptVersion: optimized.promptVersion || 'v5.1-article',
              riskScore,
              visibilityScore,
              rollbackTriggered: rollbackExecuted,
              tokenEstimate: JSON.stringify(optimized).length / 4,
              processingTime: Date.now() - sessionStart,
              success: !rollbackExecuted
            });
            
            console.log(`[BLOGS-OPTIMIZE] Draft optimization stored for article ${article.id}`);
            
            results.push({
              articleId: article.id,
              blogId,
              status: 'success',
              message: `Successfully optimized article: ${article.title}`,
              optimized,
              riskScore,
              visibilityScore,
              rollbackTriggered: rollbackExecuted
            });
            
          } catch (articleError) {
            console.error(`Failed to optimize article ${article.id}:`, articleError.message);
            results.push({
              articleId: article.id,
              blogId,
              status: 'error',
              error: `Failed to optimize article: ${articleError.message}`
            });
          }
        }
        
      } catch (blogError) {
        console.error(`Failed to fetch articles for blog ${blogId}:`, blogError.message);
        results.push({
          blogId,
          status: 'error',
          error: `Failed to fetch blog articles: ${blogError.message}`
        });
      }
    }
    
    console.log(`Blog optimization completed: ${results.filter(r => r.status === 'success').length} successful, ${results.filter(r => r.status === 'error').length} failed`);
    
    res.json({
      shop,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    });
  } catch (error) {
    console.error('Blog optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize blogs: ' + error.message });
  }
});

// API: Optimize collections
app.post('/api/optimize/collections', simpleVerifyShop, optimizationLimiter, async (req, res) => {
  try {
    const { collectionIds, settings } = req.body;
    const { shop } = req;
    
    console.log(`[COLLECTIONS-OPTIMIZE] Starting optimization for shop: ${shop}, collections: ${collectionIds}`);
    
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
    
    // Process each collection ID
    for (const collectionId of collectionIds) {
      try {
        console.log(`[COLLECTIONS-OPTIMIZE] Processing collection ${collectionId}`);
        
        // Fetch collection from Shopify API
        const collectionResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/collections/${collectionId}.json`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        const collection = collectionResponse.data.collection;
        console.log(`Found collection: ${collection.title}`);
        
        // Store original as backup if not already stored
        const metafieldsResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/custom_collections/${collectionId}/metafields.json?namespace=asb&key=original_backup`,
          {
            headers: { 'X-Shopify-Access-Token': accessToken }
          }
        );
        
        if (metafieldsResponse.data.metafields.length === 0) {
          await axios.post(
            `https://${shop}/admin/api/2024-01/custom_collections/${collectionId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'original_backup',
                value: JSON.stringify({
                  title: collection.title,
                  description: collection.description,
                  handle: collection.handle
                }),
                type: 'json'
              }
            },
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        }
        
        // Optimize content using AI (collection-specific prompt)
        const sessionStart = Date.now();
        console.log(`[COLLECTIONS-OPTIMIZE] Starting AI optimization for collection ${collection.title}`);
        
        const optimized = await optimizeContent(collection, 'collection', settings);
        
        // === PRODUCTION ROLLBACK SAFETY CHECK ===
        const riskScore = optimized.riskScore || 0;
        const visibilityScore = optimized.visibilityScore || 0;
        
        console.log(`[COLLECTIONS-OPTIMIZE] Quality scores - Risk: ${riskScore}, Visibility: ${visibilityScore}`);
        
        // Create rollback save function for this collection
        const rollbackSaveFn = async (draftId, originalContent) => {
          await axios.post(
            `https://${shop}/admin/api/2024-01/custom_collections/${collectionId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'optimized_content_draft',
                value: JSON.stringify({
                  title: originalContent.title,
                  optimizedDescription: originalContent.description || 'Original description preserved due to safety rollback',
                  content: originalContent.description || 'Original content preserved',
                  llmDescription: `Original collection: ${originalContent.title}`,
                  summary: `${originalContent.title} collection`,
                  faqs: [{
                    q: "What is this collection about?",
                    a: originalContent.description || `Information about ${originalContent.title}`
                  }],
                  rolledBack: true,
                  rollbackAt: new Date().toISOString()
                }),
                type: 'json'
              }
            },
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        };
        
        // Execute rollback if high risk detected
        const rollbackExecuted = await rollbackUtils.executeRollbackIfNeeded({
          riskScore,
          draftId: collectionId,
          originalContent: collection,
          saveFn: rollbackSaveFn,
          shop,
          contentType: 'collection',
          title: collection.title
        });
        
        if (!rollbackExecuted) {
          // Safe to store optimized content as draft
          console.log(`[COLLECTIONS-OPTIMIZE] Storing optimization as draft for collection ${collection.id}`);
          
          await axios.post(
            `https://${shop}/admin/api/2024-01/custom_collections/${collectionId}/metafields.json`,
            {
              metafield: {
                namespace: 'asb',
                key: 'optimized_content_draft',
                value: JSON.stringify({
                  title: optimized.optimizedTitle,
                  optimizedDescription: optimized.optimizedDescription,
                  content: optimized.content,
                  llmDescription: optimized.llmDescription,
                  summary: optimized.summary,
                  faqs: optimized.faqs,
                  riskScore: optimized.riskScore,
                  visibilityScore: optimized.visibilityScore,
                  promptVersion: optimized.promptVersion,
                  optimizedAt: new Date().toISOString()
                }),
                type: 'json'
              }
            },
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
        }
        
        // Log optimization session with complete metadata
        await logger.logOptimizationSession({
          shop,
          contentType: 'collection',
          title: collection.title,
          modelUsed: 'gpt-4o-mini-2024-07-18',
          promptVersion: optimized.promptVersion || 'v5.1-infra',
          riskScore,
          visibilityScore,
          rollbackTriggered: rollbackExecuted,
          tokenEstimate: JSON.stringify(optimized).length / 4,
          processingTime: Date.now() - sessionStart,
          success: !rollbackExecuted
        });
        
        results.push({
          id: collectionId,
          title: collection.title,
          status: 'success',
          optimized: optimized,
          riskScore,
          visibilityScore,
          rollbackTriggered: rollbackExecuted
        });
        
      } catch (error) {
        console.error(`[COLLECTIONS-OPTIMIZE] Error processing collection ${collectionId}:`, error);
        results.push({
          id: collectionId,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`[COLLECTIONS-OPTIMIZE] Completed optimization for ${collectionIds.length} collections`);
    res.json({
      success: true,
      results: results,
      summary: {
        total: collectionIds.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      }
    });
  } catch (error) {
    console.error('Collections optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize collections: ' + error.message });
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
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=asb`,
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
app.post('/api/rollback/:type/:id', simpleVerifyShop, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { version = 'original' } = req.body;
    const { shop } = req;
    
    console.log(`[ROLLBACK] Starting rollback for ${type} ${id} in shop ${shop}`);
    
    // Get shop info for access token
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ 
        error: 'Shop not authenticated', 
        redirectUrl: `/auth?shop=${shop}`
      });
    }
    
    const { accessToken } = shopInfo;
    
    // Handle blog rollback - need to rollback all articles in the blog
    if (type === 'blog') {
      console.log(`[ROLLBACK] Rolling back all articles in blog ${id}`);
      
      // Get all articles in the blog
      const articlesResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/blogs/${id}/articles.json?limit=50&fields=id,title,content,summary`,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
      
      const articles = articlesResponse.data.articles;
      console.log(`[ROLLBACK] Found ${articles.length} articles in blog ${id}`);
      
      let rolledBackCount = 0;
      for (const article of articles) {
        try {
          // Get metafields for this article
          const metafieldsResponse = await axios.get(
            `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json?namespace=asb`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
          
          const metafields = metafieldsResponse.data.metafields;
          const originalBackup = metafields.find(m => m.key === 'original_backup');
          
          if (originalBackup) {
            console.log(`[ROLLBACK] Rolling back article ${article.id}`);
            const originalData = JSON.parse(originalBackup.value);
            
            // Restore original content
            const updateData = {
              article: {
                id: parseInt(article.id),
                title: originalData.title,
                content: originalData.content,
                summary: originalData.summary || null
              }
            };
            
            await axios.put(
              `https://${shop}/admin/api/2024-01/articles/${article.id}.json`,
              updateData,
              {
                headers: { 'X-Shopify-Access-Token': accessToken }
              }
            );
            
            // Remove optimization metafields
            const optimizationKeys = [
              'optimized_content',
              'optimized_content_draft',
              'faq_data',
              'faq_data_draft',
              'optimization_settings',
              'optimization_settings_draft',
              'optimization_data',
              'current_version',
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
                } catch (deleteError) {
                  console.error(`Error deleting metafield ${metafield.key}:`, deleteError.message);
                }
              }
            }
            
            rolledBackCount++;
          }
        } catch (articleError) {
          console.error(`Error rolling back article ${article.id}:`, articleError.message);
        }
      }
      
      console.log(`[ROLLBACK] Rolled back ${rolledBackCount} articles in blog ${id}`);
      
      return res.json({
        message: `Successfully rolled back ${rolledBackCount} articles in blog ${id}`,
        type: 'blog',
        id,
        rolledBackCount,
        totalArticles: articles.length,
        rollbackTimestamp: new Date().toISOString()
      });
    }
    
    // Handle product, page, and collection rollback (existing logic)
    const endpoint = type === 'product' 
      ? `products/${id}/metafields`
      : type === 'page'
      ? `pages/${id}/metafields`
      : type === 'collection'
      ? `custom_collections/${id}/metafields`  // Fix: use custom_collections not collections
      : `articles/${id}/metafields`;
    
    console.log(`[ROLLBACK] Getting metafields for ${type} ${id}`);
    
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
      // For products, restore the actual product content
      const updateData = {
        product: {
          id: parseInt(id),
          title: originalData.title,
          body_html: originalData.body_html
        }
      };
      
      console.log(`Restoring product ${id} with data:`, updateData);
      await axios.put(
        `https://${shop}/admin/api/2024-01/products/${id}.json`,
        updateData,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
    } else if (type === 'page') {
      // For pages, restore the original content
      const updateData = {
        page: {
          id: parseInt(id),
          title: originalData.title,
          body_html: originalData.body_html
        }
      };
      
      console.log(`Restoring page ${id} with data:`, updateData);
      await axios.put(
        `https://${shop}/admin/api/2024-01/pages/${id}.json`,
        updateData,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
    } else if (type === 'collection') {
      // For collections, restore the original content
      const updateData = {
        custom_collection: {  // Fix: use custom_collection not collection
          id: parseInt(id),
          title: originalData.title,
          body_html: originalData.body_html  // Fix: use body_html for collections like other resources
        }
      };
      
      console.log(`Restoring collection ${id} with data:`, updateData);
      await axios.put(
        `https://${shop}/admin/api/2024-01/custom_collections/${id}.json`,  // Fix: use custom_collections endpoint
        updateData,
        {
          headers: { 'X-Shopify-Access-Token': accessToken }
        }
      );
    } else if (type === 'blog') {
      // For blog articles, restore the original content
      const updateData = {
        article: {
          id: parseInt(id),
          title: originalData.title,
          content: originalData.content,
          summary: originalData.summary || null
        }
      };
      
      console.log(`Restoring blog article ${id} with data:`, updateData);
      await axios.put(
        `https://${shop}/admin/api/2024-01/articles/${id}.json`,
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
      'optimization_data',
      'current_version',
      'enable_schema',
      'published_timestamp',
      'draft_timestamp'
    ];
    
    let deletedCount = 0;
    for (const metafield of metafields) {
      if (optimizationKeys.includes(metafield.key)) {
        try {
          console.log(`Deleting metafield ${metafield.key} (ID: ${metafield.id})`);
          await axios.delete(
            `https://${shop}/admin/api/2024-01/metafields/${metafield.id}.json`,
            {
              headers: { 'X-Shopify-Access-Token': accessToken }
            }
          );
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting metafield ${metafield.key}:`, error.message);
        }
      }
    }
    
    console.log(`Deleted ${deletedCount} optimization metafields for ${type} ${id}`);
    
    console.log(`Successfully rolled back ${type} ${id} to original version`);
    console.log('Metafields deleted:', optimizationKeys.filter(key => 
      metafields.some(m => m.key === key)
    ));
    
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
    console.error('Error details:', error.response?.data);
    res.status(500).json({ 
      error: 'Failed to rollback: ' + error.message,
      details: error.response?.data
    });
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
      `https://${shop}/admin/api/2024-01/${endpoint}.json?namespace=asb`,
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

// API: Check consent status
app.get('/api/consent/status', async (req, res) => {
  try {
    let shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }
    
    // Clean shop domain
    shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
    console.log('[CONSENT] Checking consent for shop:', shop);
    
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      console.log('[CONSENT] No valid session for shop:', shop);
      return res.json({ hasConsent: false });
    }
    
    try {
      // Check for disclaimer_accepted metafield
      const metafieldsResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/metafields.json?namespace=aisearchbooster&key=disclaimer_accepted`,
        { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
      );
      
      const hasConsent = metafieldsResponse.data.metafields.length > 0 && 
                        metafieldsResponse.data.metafields[0].value === 'true';
      
      console.log('[CONSENT] Consent status:', hasConsent);
      res.json({ hasConsent });
      
    } catch (error) {
      console.error('[CONSENT] Error checking metafields:', error.message);
      res.json({ hasConsent: false });
    }
  } catch (error) {
    console.error('[CONSENT] Status check error:', error);
    res.status(500).json({ error: 'Failed to check consent status' });
  }
});

// API: Record consent acceptance
app.post('/api/consent/accept', express.json(), async (req, res) => {
  try {
    let shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }
    
    // Clean shop domain
    shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
    console.log('[CONSENT] Recording consent acceptance for shop:', shop);
    
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const timestamp = new Date().toISOString();
    const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    
    try {
      // Store in Shopify metafields
      await axios.post(
        `https://${shop}/admin/api/2024-01/metafields.json`,
        {
          metafield: {
            namespace: 'aisearchbooster',
            key: 'disclaimer_accepted',
            value: 'true',
            type: 'single_line_text_field'
          }
        },
        { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
      );
      
      await axios.post(
        `https://${shop}/admin/api/2024-01/metafields.json`,
        {
          metafield: {
            namespace: 'aisearchbooster',
            key: 'disclaimer_accepted_at',
            value: timestamp,
            type: 'single_line_text_field'
          }
        },
        { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
      );
      
      // Log for legal protection
      console.log(`[CONSENT-LOG] Shop: ${shop}, Timestamp: ${timestamp}, IP: ${clientIP}, UserAgent: ${req.headers['user-agent']}`);
      
      res.json({ 
        success: true, 
        timestamp,
        message: 'Consent recorded successfully' 
      });
      
    } catch (error) {
      console.error('[CONSENT] Error storing consent:', error.message);
      res.status(500).json({ error: 'Failed to record consent' });
    }
  } catch (error) {
    console.error('[CONSENT] Accept error:', error);
    res.status(500).json({ error: 'Failed to process consent acceptance' });
  }
});

// API: Reset consent (for testing)
app.delete('/api/consent/reset', async (req, res) => {
  try {
    let shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }
    
    // Clean shop domain
    shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
    console.log('[CONSENT] Resetting consent for shop:', shop);
    
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      // Get existing metafields
      const metafieldsResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/metafields.json?namespace=aisearchbooster`,
        { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
      );
      
      // Delete consent metafields
      for (const metafield of metafieldsResponse.data.metafields) {
        if (metafield.key === 'disclaimer_accepted' || metafield.key === 'disclaimer_accepted_at') {
          await axios.delete(
            `https://${shop}/admin/api/2024-01/metafields/${metafield.id}.json`,
            { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
          );
        }
      }
      
      console.log('[CONSENT] Consent reset successfully for shop:', shop);
      res.json({ success: true, message: 'Consent reset - modal will show on next visit' });
      
    } catch (error) {
      console.error('[CONSENT] Error resetting consent:', error.message);
      res.status(500).json({ error: 'Failed to reset consent' });
    }
  } catch (error) {
    console.error('[CONSENT] Reset error:', error);
    res.status(500).json({ error: 'Failed to process consent reset' });
  }
});

// API: Get consent records (for legal verification)
app.get('/api/consent/records', async (req, res) => {
  try {
    let shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }
    
    // Clean shop domain
    shop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
    console.log('[CONSENT] Fetching consent records for shop:', shop);
    
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      // Get consent metafields from Shopify
      const metafieldsResponse = await axios.get(
        `https://${shop}/admin/api/2024-01/metafields.json?namespace=aisearchbooster`,
        { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
      );
      
      const consentMetafields = metafieldsResponse.data.metafields.filter(m => 
        m.key === 'disclaimer_accepted' || m.key === 'disclaimer_accepted_at'
      );
      
      // Format the response for legal verification
      const records = {
        shop: shop,
        shopifyMetafields: consentMetafields.map(m => ({
          id: m.id,
          key: m.key,
          value: m.value,
          created_at: m.created_at,
          updated_at: m.updated_at,
          type: m.type
        })),
        serverLogs: `Check server logs for: [CONSENT-LOG] Shop: ${shop}`,
        legalNote: 'Dual-layer storage: Shopify metafields (persistent) + server logs (audit trail)',
        retrievedAt: new Date().toISOString()
      };
      
      console.log('[CONSENT] Retrieved consent records for legal verification:', records);
      res.json(records);
      
    } catch (error) {
      console.error('[CONSENT] Error fetching consent records:', error.message);
      res.status(500).json({ error: 'Failed to fetch consent records' });
    }
  } catch (error) {
    console.error('[CONSENT] Records error:', error);
    res.status(500).json({ error: 'Failed to process consent records request' });
  }
});

// API: Get status
app.get('/api/status', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    
    // Get real counts from Shopify if authenticated
    let totalProducts = 0;
    let totalBlogs = 0;
    let optimizedProducts = 0;
    let optimizedBlogs = 0;
    
    const shopInfo = shopData.get(shop);
    if (shopInfo && shopInfo.accessToken) {
      try {
        // Count real products
        const productsRes = await axios.get(
          `https://${shop}/admin/api/2024-01/products/count.json`,
          { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
        );
        totalProducts = productsRes.data.count;
        
        // Count real articles (not blogs)
        const blogsListRes = await axios.get(
          `https://${shop}/admin/api/2024-01/blogs.json?limit=250&fields=id`,
          { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
        );
        
        let totalArticleCount = 0;
        for (const blog of blogsListRes.data.blogs) {
          try {
            const articlesRes = await axios.get(
              `https://${shop}/admin/api/2024-01/blogs/${blog.id}/articles/count.json`,
              { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
            );
            totalArticleCount += articlesRes.data.count;
          } catch (error) {
            console.log(`Could not count articles for blog ${blog.id}:`, error.message);
          }
        }
        totalBlogs = totalArticleCount;
        
        // Count optimized products by checking metafields (published + drafts)
        const productsWithMetaRes = await axios.get(
          `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id`,
          { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
        );
        
        const optimizedChecks = await Promise.all(
          productsWithMetaRes.data.products.map(async (product) => {
            try {
              const metafieldsRes = await axios.get(
                `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=asb`,
                { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
              );
              const metafields = metafieldsRes.data.metafields;
              // Count as optimized if it has either published optimization_data OR draft content
              return metafields.some(m => m.key === 'optimization_data' || m.key === 'optimized_content_draft');
            } catch {
              return false;
            }
          })
        );
        
        optimizedProducts = optimizedChecks.filter(Boolean).length;
        
        // Count optimized blogs by checking article metafields (published + drafts)
        const blogsWithMetaRes = await axios.get(
          `https://${shop}/admin/api/2024-01/blogs.json?limit=250&fields=id`,
          { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
        );
        
        let optimizedArticleCount = 0;
        for (const blog of blogsWithMetaRes.data.blogs) {
          try {
            const articlesRes = await axios.get(
              `https://${shop}/admin/api/2024-01/blogs/${blog.id}/articles.json?limit=250&fields=id`,
              { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
            );
            
            const articleOptimizedChecks = await Promise.all(
              articlesRes.data.articles.map(async (article) => {
                try {
                  const metafieldsRes = await axios.get(
                    `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json?namespace=asb`,
                    { headers: { 'X-Shopify-Access-Token': shopInfo.accessToken } }
                  );
                  const metafields = metafieldsRes.data.metafields;
                  // Count as optimized if it has either published optimization_data OR draft content
                  return metafields.some(m => m.key === 'optimization_data' || m.key === 'optimized_content_draft');
                } catch {
                  return false;
                }
              })
            );
            
            optimizedArticleCount += articleOptimizedChecks.filter(Boolean).length;
          } catch (blogError) {
            console.log(`Could not fetch articles for blog ${blog.id}:`, blogError.message);
          }
        }
        
        optimizedBlogs = optimizedArticleCount;
        
      } catch (countError) {
        console.log('Could not fetch counts, using defaults:', countError.message);
        totalProducts = 1; // Fallback based on what we know
        totalBlogs = 1; // Total articles fallback
      }
    }
    
    res.json({
      shop,
      totalProducts,
      totalBlogs,
      optimizedProducts,
      optimizedBlogs,
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
          optimized: false,
          hasDraft: false
        },
        {
          id: 2,
          title: 'Sample Product 2', 
          handle: 'sample-product-2',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false,
          hasDraft: true
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
      let hasDraft = false;
      try {
        const metafieldsRes = await axios.get(
          `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=asb`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        const metafields = metafieldsRes.data.metafields;
        optimized = metafields.some(m => m.key === 'optimization_data');
        hasDraft = metafields.some(m => m.key === 'optimized_content_draft');
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
        optimized,
        hasDraft
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

// API: Get pages
app.get('/api/pages', simpleVerifyShop, async (req, res) => {
  try {
    const { shop } = req;
    const { limit = 50, page = 1 } = req.query;
    
    // Check if shop has valid access token from OAuth flow
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      console.log('No valid OAuth token, returning mock data for pages:', shop);
      // Return mock data when no OAuth token
      const pages = [
        {
          id: 1,
          title: 'About Us',
          handle: 'about',
          body_html: '<h1>About Our Store</h1><p>We are a premium retailer...</p>',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false,
          hasDraft: false
        },
        {
          id: 2,
          title: 'Shipping FAQ',
          handle: 'shipping-faq',
          body_html: '<h1>Shipping Information</h1><p>We ship worldwide...</p>',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false,
          hasDraft: false
        }
      ];
      
      return res.json({
        pages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: pages.length
        }
      });
    }
    
    // Fetch real pages from Shopify API
    console.log('Fetching real pages from Shopify for shop:', shop);
    const { accessToken } = shopInfo;
    
    const response = await axios.get(
      `https://${shop}/admin/api/2024-01/pages.json?limit=${limit}&fields=id,title,handle,body_html,created_at,updated_at`,
      {
        headers: { 'X-Shopify-Access-Token': accessToken }
      }
    );
    
    // Check metafields for optimization status
    const shopifyPages = await Promise.all(response.data.pages.map(async (page) => {
      let optimized = false;
      let hasDraft = false;
      try {
        const metafieldsRes = await axios.get(
          `https://${shop}/admin/api/2024-01/pages/${page.id}/metafields.json?namespace=asb`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        const metafields = metafieldsRes.data.metafields;
        optimized = metafields.some(m => m.key === 'optimized_content');
        hasDraft = metafields.some(m => m.key === 'optimized_content_draft');
      } catch (metaError) {
        console.log(`Could not fetch metafields for page ${page.id}:`, metaError.message);
      }
      
      return {
        id: page.id,
        title: page.title,
        handle: page.handle,
        body_html: page.body_html,
        created_at: page.created_at,
        updated_at: page.updated_at,
        optimized,
        hasDraft
      };
    }));
    
    res.json({
      pages: shopifyPages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: shopifyPages.length
      }
    });
  } catch (error) {
    console.error('Pages error:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// API: Get collections (EXACT COPY OF WORKING PRODUCTS API)
app.get('/api/collections', async (req, res) => {
  try {
    // Extract shop from query, body, or session token
    let shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
    
    // For embedded apps, check session token from Authorization header
    const sessionToken = req.headers.authorization;
    if (sessionToken && !shop) {
      // Extract shop from session token if needed
      shop = req.headers['x-shopify-shop-domain'];
    }
    
    console.log('[COLLECTIONS-API] Request details:', {
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
    
    console.log('[COLLECTIONS-DEBUG] Collections API called:', {
      shop,
      isProxyRequest,
      isEmbeddedApp,
      origin: req.headers.origin,
      referer: req.headers.referer,
      userAgent: userAgent.substring(0, 100),
      forwardedHost: req.headers['x-forwarded-host']
    });
    
    if (isEmbeddedApp && !isProxyRequest) {
      console.log('[COLLECTIONS-CI] ⚠️ WARNING: Embedded app request without proxy detected!');
      console.log('[COLLECTIONS-CI] This suggests the Shopify app proxy is not configured correctly.');
      console.log('[COLLECTIONS-CI] Expected: x-forwarded-host should contain myshopify.com');
      console.log('[COLLECTIONS-CI] Actual headers:', JSON.stringify(req.headers, null, 2));
    }
    
    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }
    
    // Check if shop has valid access token from OAuth flow
    const shopInfo = shopData.get(shop);
    if (!shopInfo || !shopInfo.accessToken) {
      console.log('[COLLECTIONS] No valid OAuth token, returning mock data for shop:', shop);
      // Return mock data when no OAuth token
      const collections = [
        {
          id: 1,
          title: 'Sample Collection 1',
          handle: 'sample-collection-1',
          description: 'Sample collection description',
          published_scope: 'web',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false,
          hasDraft: false
        },
        {
          id: 2,
          title: 'Sample Collection 2', 
          handle: 'sample-collection-2',
          description: 'Another sample collection',
          published_scope: 'web',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false,
          hasDraft: true
        }
      ];
      
      return res.json({
        collections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: collections.length
        }
      });
    }
    
    // Fetch real collections from Shopify API
    console.log('[COLLECTIONS] Fetching real collections from Shopify for shop:', shop);
    const { accessToken } = shopInfo;
    
    // Fetch custom collections first
    console.log('[COLLECTIONS] Fetching custom collections...');
    const customResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/custom_collections.json?limit=${limit}&fields=id,title,handle,body_html,published_scope,created_at,updated_at`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    
    // Add small delay to prevent rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Then fetch smart collections
    console.log('[COLLECTIONS] Fetching smart collections...');
    const smartResponse = await axios.get(
      `https://${shop}/admin/api/2024-01/smart_collections.json?limit=${limit}&fields=id,title,handle,body_html,published_scope,created_at,updated_at`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    
    // Combine both types of collections
    const allCollections = [
      ...(customResponse.data.custom_collections || []),
      ...(smartResponse.data.smart_collections || [])
    ];
    
    console.log(`[COLLECTIONS] Fetched ${allCollections.length} collections (${customResponse.data.custom_collections?.length || 0} custom, ${smartResponse.data.smart_collections?.length || 0} smart)`);
    
    // Check metafields for optimization status (same as products)
    const shopifyCollections = await Promise.all(allCollections.map(async (collection) => {
      let optimized = false;
      let hasDraft = false;
      
      try {
        // Determine collection type for correct metafields endpoint
        const collectionType = customResponse.data.custom_collections?.find(c => c.id === collection.id) ? 'custom_collections' : 'smart_collections';
        const metafieldsResponse = await axios.get(
          `https://${shop}/admin/api/2024-01/${collectionType}/${collection.id}/metafields.json?namespace=asb`,
          { headers: { 'X-Shopify-Access-Token': accessToken } }
        );
        
        const metafields = metafieldsResponse.data.metafields || [];
        optimized = metafields.some(m => m.key === 'optimized_content');
        hasDraft = metafields.some(m => m.key === 'optimized_content_draft');
      } catch (metaError) {
        console.log(`Error checking metafields for collection ${collection.id}:`, metaError.message);
      }
      
      return {
        ...collection,
        optimized,
        hasDraft
      };
    }));
    
    res.json({
      collections: shopifyCollections,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: shopifyCollections.length
      }
    });
  } catch (error) {
    console.error('[COLLECTIONS] Collections error:', error);
    console.error('[COLLECTIONS] Error message:', error.message);
    console.error('[COLLECTIONS] Error stack:', error.stack);
    console.error('[COLLECTIONS] Error response:', error.response?.data);
    console.error('[COLLECTIONS] Error status:', error.response?.status);
    res.status(500).json({ 
      error: 'Failed to fetch collections',
      details: error.message,
      stack: error.stack
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
          optimized: false,
          hasDraft: false,
          articles: [
            {
              id: 101,
              title: 'Sample Article 1',
              handle: 'sample-article-1',
              optimized: false,
              hasDraft: true
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
      `https://${shop}/admin/api/2024-01/blogs.json?limit=${limit}&fields=id,title,handle,created_at,updated_at`,
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
          let hasDraft = false;
          try {
            const metafieldsRes = await axios.get(
              `https://${shop}/admin/api/2024-01/articles/${article.id}/metafields.json?namespace=asb`,
              { headers: { 'X-Shopify-Access-Token': accessToken } }
            );
            const metafields = metafieldsRes.data.metafields;
            optimized = metafields.some(m => m.key === 'optimization_data');
            hasDraft = metafields.some(m => m.key === 'optimized_content_draft');
          } catch (metaError) {
            console.log(`Could not fetch metafields for article ${article.id}:`, metaError.message);
          }
          
          return {
            id: article.id,
            title: article.title,
            handle: article.handle,
            created_at: article.created_at,
            updated_at: article.updated_at,
            optimized,
            hasDraft
          };
        }));
        
        return {
          id: blog.id,
          title: blog.title,
          handle: blog.handle,
          created_at: blog.created_at,
          updated_at: blog.updated_at,
          optimized: articles.some(article => article.optimized),
          hasDraft: articles.some(article => article.hasDraft),
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
          optimized: false,
          hasDraft: false,
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

export default app;// Collections API deployment marker Mon Jul 21 02:48:34 PDT 2025
// Force deployment Mon Jul 21 03:20:57 PDT 2025
// Deployment trigger Mon Jul 21 03:34:25 PDT 2025
// Force backend deployment Mon Jul 21 04:08:13 PDT 2025
// Deploy all pending fixes Mon Jul 21 04:08:47 PDT 2025
// All fixes deployment Mon Jul 21 04:23:49 PDT 2025
// Backend deployment Mon Jul 21 13:47:09 PDT 2025
// Force all deployments Mon Jul 21 14:07:12 PDT 2025
// FORCE BACKEND DEPLOYMENT Mon Jul 21 14:14:27 PDT 2025
// BACKEND DEPLOYMENT TOO Mon Jul 21 14:20:34 PDT 2025
/* Force backend deployment Mon Jul 21 14:39:48 PDT 2025 */
/* Force backend deployment Mon Jul 21 15:02:48 PDT 2025 */
/* Backend debug deployment Mon Jul 21 15:18:28 PDT 2025 */
/* Debug collections frontend Mon Jul 21 15:27:12 PDT 2025 */
/* Debug collections simplified Mon Jul 21 15:33:23 PDT 2025 */
/* Fix collections auth Mon Jul 21 16:10:08 PDT 2025 */
/* Collections exact copy Mon Jul 21 16:16:52 PDT 2025 */
/* Show real error Mon Jul 21 16:25:06 PDT 2025 */
/* Fix collections endpoints Mon Jul 21 16:35:18 PDT 2025 */
/* Debug publish errors Mon Jul 21 16:44:37 PDT 2025 */
/* Fix publish endpoints Mon Jul 21 16:53:44 PDT 2025 */
/* Update pages/collections state Mon Jul 21 17:06:05 PDT 2025 */
/* Fix rollback collections Mon Jul 21 17:12:52 PDT 2025 */
/* Fix rollback UI updates Mon Jul 21 17:24:36 PDT 2025 */
/* Fix rate limiting Mon Jul 21 17:46:10 PDT 2025 */
/* Fix collections rate limit Mon Jul 21 18:04:38 PDT 2025 */
/* Updated collection prompt Mon Jul 21 18:14:36 PDT 2025 */
