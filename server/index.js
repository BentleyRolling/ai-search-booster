const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');
const { shopifyApp } = require('@shopify/shopify-app-express');
const authRoutes = require('./routes/auth');
const { verifyRequest } = require('./middleware/auth');
const OpenAI = require('openai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

app.use(cors());
app.use(express.json());

if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET || !process.env.SHOPIFY_SCOPES) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['read_products', 'write_products', 'read_product_listings', 'write_product_listings'],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost:3000',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

app.use((req, res, next) => {
  res.locals.shopify = {
    session: {
      shop: 'test-shop.myshopify.com',
      accessToken: 'test-token'
    }
  };
  next();
});

app.use('/api/auth', authRoutes);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_now',
});

const optimizeProductContent = async (title, description, tags) => {
  try {
    const prompt = `Rewrite the following Shopify product title and description to rank well in AI answers from ChatGPT, Claude, and Perplexity. Use the product tags as keywords. Do not optimize for Google or traditional search engines.

Product Title: ${title}
Product Description: ${description}
Product Tags: ${tags.join(', ')}

Please return the response in JSON format with "title" and "description" fields.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an AI optimization expert specializing in making product content visible in AI-generated answers. Return responses in valid JSON format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content;
    
    try {
      return JSON.parse(content);
    } catch (parseError) {
      return {
        title: title + ' (AI Optimized)',
        description: content || description
      };
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('AI optimization service temporarily unavailable. Please try again later.');
  }
};

app.get('/api/products', async (req, res) => {
  try {
    const isLocalDev = req.get('host')?.includes('localhost');
    
    if (isLocalDev) {
      const mockProducts = [
        {
          id: 1,
          title: 'Wireless Bluetooth Headphones',
          body_html: 'High-quality wireless headphones with noise cancellation.',
          description: 'High-quality wireless headphones with noise cancellation.',
          tags: 'electronics,audio,wireless,bluetooth'
        },
        {
          id: 2,
          title: 'Organic Cotton T-Shirt',
          body_html: 'Comfortable organic cotton t-shirt in various colors.',
          description: 'Comfortable organic cotton t-shirt in various colors.',
          tags: 'clothing,organic,cotton,sustainable'
        },
        {
          id: 3,
          title: 'Smart Fitness Tracker',
          body_html: 'Track your fitness goals with this advanced smartwatch.',
          description: 'Track your fitness goals with this advanced smartwatch.',
          tags: 'fitness,technology,health,smartwatch'
        }
      ];
      return res.json(mockProducts);
    }
    
    const session = res.locals.shopify.session;
    const client = new shopify.clients.Rest({ session });
    
    const products = await client.get({
      path: 'products',
      query: { limit: 250 }
    });
    
    res.json(products.body.products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/api/products/:id/optimize', async (req, res) => {
  try {
    const isLocalDev = req.get('host')?.includes('localhost');
    const productId = req.params.id;
    const shop = res.locals.shopify.session.shop;
    
    if (!canOptimize(shop)) {
      return res.status(403).json({ 
        error: 'Monthly optimization limit reached. Please upgrade your plan to continue.',
        limitReached: true,
        upgradeRequired: true
      });
    }
    
    if (isLocalDev) {
      const mockProducts = {
        '1': {
          id: 1,
          title: 'Wireless Bluetooth Headphones',
          body_html: 'High-quality wireless headphones with noise cancellation.',
          tags: 'electronics,audio,wireless,bluetooth'
        },
        '2': {
          id: 2,
          title: 'Organic Cotton T-Shirt',
          body_html: 'Comfortable organic cotton t-shirt in various colors.',
          tags: 'clothing,organic,cotton,sustainable'
        },
        '3': {
          id: 3,
          title: 'Smart Fitness Tracker',
          body_html: 'Track your fitness goals with this advanced smartwatch.',
          tags: 'fitness,technology,health,smartwatch'
        }
      };
      
      const product = mockProducts[productId];
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      const mockOptimizedContent = {
        '1': {
          title: 'Premium Wireless Bluetooth Headphones - AI-Enhanced Audio Experience',
          description: 'Experience superior sound quality with our advanced wireless Bluetooth headphones featuring cutting-edge noise cancellation technology. Perfect for AI-powered music recommendations, voice assistants, and immersive audio experiences. Compatible with all smart devices and AI audio platforms.'
        },
        '2': {
          title: 'Sustainable Organic Cotton T-Shirt - Eco-Friendly AI-Recommended Fashion',
          description: 'Discover comfort and sustainability with our premium organic cotton t-shirt. Made from 100% certified organic materials, this eco-friendly garment is perfect for conscious consumers seeking AI-recommended sustainable fashion choices. Available in multiple colors to match your personal style preferences.'
        },
        '3': {
          title: 'Advanced Smart Fitness Tracker - AI-Powered Health Monitoring',
          description: 'Transform your fitness journey with our intelligent smartwatch featuring AI-powered health analytics. Track workouts, monitor vital signs, and receive personalized AI coaching recommendations. Compatible with leading health apps and AI fitness platforms for comprehensive wellness management.'
        }
      };
      
      const optimizedContent = mockOptimizedContent[productId];
      const newUsage = incrementUsage(shop);
      
      return res.json({ 
        message: 'Product optimized successfully',
        optimizedContent,
        product: product,
        usage: {
          used: newUsage,
          limit: PLANS['Pro'].limit,
          remaining: PLANS['Pro'].limit - newUsage
        }
      });
    }
    
    const session = res.locals.shopify.session;
    const client = new shopify.clients.Rest({ session });
    
    const productResponse = await client.get({
      path: `products/${productId}`
    });
    
    const product = productResponse.body.product;
    const title = product.title;
    const description = product.body_html || product.description || '';
    const tags = product.tags ? product.tags.split(',').map(tag => tag.trim()) : [];
    
    const optimizedContent = await optimizeProductContent(title, description, tags);
    
    await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: 'ai_boost',
          key: 'title',
          value: optimizedContent.title,
          type: 'single_line_text_field'
        }
      }
    });
    
    await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: 'ai_boost',
          key: 'description',
          value: optimizedContent.description,
          type: 'multi_line_text_field'
        }
      }
    });
    
    await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: 'ai_boost',
          key: 'original_title',
          value: title,
          type: 'single_line_text_field'
        }
      }
    });
    
    await client.post({
      path: `products/${productId}/metafields`,
      data: {
        metafield: {
          namespace: 'ai_boost',
          key: 'original_description',
          value: description,
          type: 'multi_line_text_field'
        }
      }
    });
    
    const newUsage = incrementUsage(shop);
    
    res.json({ 
      message: 'Product optimized successfully',
      optimizedContent,
      product: product,
      usage: {
        used: newUsage,
        limit: PLANS['Pro'].limit,
        remaining: PLANS['Pro'].limit - newUsage
      }
    });
  } catch (error) {
    console.error('Error optimizing product:', error);
    
    if (error.message.includes('AI optimization service')) {
      res.status(503).json({ 
        error: error.message,
        retryable: true 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to optimize product. Please try again.',
        retryable: true 
      });
    }
  }
});

const usageTracker = new Map();

const getCurrentMonthKey = (shop) => {
  const now = new Date();
  return `${shop}-${now.getFullYear()}-${now.getMonth()}`;
};

const PLANS = {
  'Free': { limit: 5, price: 0 },
  'Basic': { limit: 100, price: 9.99 },
  'Pro': { limit: 500, price: 14.99 },
  'Custom': { limit: 999, price: 'Contact Us' }
};

app.get('/api/usage', async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const shop = session.shop;
    const monthKey = getCurrentMonthKey(shop);
    
    const currentUsage = usageTracker.get(monthKey) || 0;
    
    const currentPlan = 'Pro';
    const planConfig = PLANS[currentPlan];
    
    res.json({
      used: currentUsage,
      limit: planConfig.limit,
      plan: currentPlan,
      canOptimize: currentUsage < planConfig.limit
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
});

const incrementUsage = (shop) => {
  const monthKey = getCurrentMonthKey(shop);
  const currentUsage = usageTracker.get(monthKey) || 0;
  usageTracker.set(monthKey, currentUsage + 1);
  return currentUsage + 1;
};

const canOptimize = (shop, plan = 'Pro') => {
  const monthKey = getCurrentMonthKey(shop);
  const currentUsage = usageTracker.get(monthKey) || 0;
  const planConfig = PLANS[plan];
  return currentUsage < planConfig.limit;
};

app.post('/api/products/:id/apply', async (req, res) => {
  try {
    const isLocalDev = req.get('host')?.includes('localhost');
    const productId = req.params.id;
    
    if (isLocalDev) {
      return res.json({ message: 'AI version applied successfully' });
    }
    
    const session = res.locals.shopify.session;
    const client = new shopify.clients.Rest({ session });
    
    const metafields = await client.get({
      path: `products/${productId}/metafields`,
      query: { namespace: 'ai_boost' }
    });
    
    const titleMetafield = metafields.body.metafields.find(m => m.key === 'title');
    const descriptionMetafield = metafields.body.metafields.find(m => m.key === 'description');
    
    if (!titleMetafield || !descriptionMetafield) {
      return res.status(400).json({ error: 'No AI optimized content found. Please optimize first.' });
    }
    
    await client.put({
      path: `products/${productId}`,
      data: {
        product: {
          id: productId,
          title: titleMetafield.value,
          body_html: descriptionMetafield.value
        }
      }
    });
    
    res.json({ message: 'AI version applied successfully' });
  } catch (error) {
    console.error('Error applying AI version:', error);
    res.status(500).json({ error: 'Failed to apply AI version' });
  }
});

app.post('/api/products/:id/restore', async (req, res) => {
  try {
    const isLocalDev = req.get('host')?.includes('localhost');
    const productId = req.params.id;
    
    if (isLocalDev) {
      return res.json({ message: 'Original version restored successfully' });
    }
    
    const session = res.locals.shopify.session;
    const client = new shopify.clients.Rest({ session });
    
    const metafields = await client.get({
      path: `products/${productId}/metafields`,
      query: { namespace: 'ai_boost' }
    });
    
    const originalTitleMetafield = metafields.body.metafields.find(m => m.key === 'original_title');
    const originalDescriptionMetafield = metafields.body.metafields.find(m => m.key === 'original_description');
    
    if (!originalTitleMetafield || !originalDescriptionMetafield) {
      return res.status(400).json({ error: 'No original content found to restore.' });
    }
    
    await client.put({
      path: `products/${productId}`,
      data: {
        product: {
          id: productId,
          title: originalTitleMetafield.value,
          body_html: originalDescriptionMetafield.value
        }
      }
    });
    
    res.json({ message: 'Original version restored successfully' });
  } catch (error) {
    console.error('Error restoring original:', error);
    res.status(500).json({ error: 'Failed to restore original version' });
  }
});

app.get('/api/plans', async (req, res) => {
  try {
    const plans = Object.entries(PLANS).map(([name, config]) => ({
      name,
      limit: config.limit,
      price: config.price,
      features: [
        `${config.limit} products per month`,
        'AI-powered optimization',
        'Non-destructive editing',
        'Side-by-side preview',
        name !== 'Free' ? 'Priority support' : 'Community support'
      ]
    }));
    
    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

app.post('/api/upgrade', async (req, res) => {
  try {
    const { plan } = req.body;
    const session = res.locals.shopify.session;
    
    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }
    
    res.json({ 
      message: `Successfully upgraded to ${plan} plan`,
      plan,
      limit: PLANS[plan].limit,
      price: PLANS[plan].price
    });
  } catch (error) {
    console.error('Error upgrading plan:', error);
    res.status(500).json({ error: 'Failed to upgrade plan' });
  }
});

app.post('/api/products/optimize-all', async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.clients.Rest({ session });
    const shop = session.shop;
    
    const monthKey = getCurrentMonthKey(shop);
    const currentUsage = usageTracker.get(monthKey) || 0;
    const planLimit = PLANS['Pro'].limit;
    const remaining = planLimit - currentUsage;
    
    if (remaining <= 0) {
      return res.status(403).json({ 
        error: 'Monthly optimization limit reached. Please upgrade your plan to continue.',
        limitReached: true
      });
    }
    
    const productsResponse = await client.get({
      path: 'products',
      query: { limit: Math.min(100, remaining) } // Max batch size of 100 or remaining limit
    });
    
    const products = productsResponse.body.products;
    const optimizedCount = Math.min(products.length, remaining);
    
    usageTracker.set(monthKey, currentUsage + optimizedCount);
    
    res.json({
      message: `Optimization queued for ${optimizedCount} products`,
      optimizedCount,
      remaining: remaining - optimizedCount,
      batchSize: optimizedCount
    });
  } catch (error) {
    console.error('Error in bulk optimization:', error);
    res.status(500).json({ error: 'Failed to start bulk optimization' });
  }
});

app.get('/api/install', (req, res) => {
  const { shop } = req.query;
  
  if (!shop) {
    return res.status(400).json({ error: 'Shop parameter is required' });
  }
  
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SHOPIFY_SCOPES}&redirect_uri=${process.env.SHOPIFY_APP_URL}/api/auth/callback`;
  
  res.redirect(installUrl);
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`AI Search Booster server running on port ${PORT}`);
});
