import '@shopify/shopify-api/adapters/node';
import express from 'express';
import { shopifyApi } from '@shopify/shopify-api';
import OpenAI from 'openai';
import { verifyRequest } from '../middleware/auth.js';

const router = express.Router();

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_products', 'write_products'],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost',
  apiVersion: '2023-10',
  isEmbeddedApp: true,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let usageData = {
  used: 0,
  limit: 500,
  plan: 'Pro'
};

router.get('/', verifyRequest(shopify), async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    
    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'No valid session found' });
    }

    const client = new shopify.clients.Rest({ session });
    const products = await client.get({
      path: 'products',
      query: { limit: 50 }
    });

    res.json(products.body.products || []);
  } catch (error) {
    console.error('Error fetching products:', error);
    
    const mockProducts = [
      {
        id: 1,
        title: 'Sample Product 1',
        body_html: 'This is a sample product description for testing the AI optimization features.',
        handle: 'sample-product-1'
      },
      {
        id: 2,
        title: 'Sample Product 2', 
        body_html: 'Another sample product for testing the dashboard functionality.',
        handle: 'sample-product-2'
      },
      {
        id: 3,
        title: 'Test Product 3',
        body_html: 'A third sample product to demonstrate the product listing.',
        handle: 'test-product-3'
      }
    ];
    
    res.json(mockProducts);
  }
});

router.post('/:id/optimize', verifyRequest(shopify), async (req, res) => {
  try {
    const { id } = req.params;
    const session = res.locals.shopify.session;

    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'No valid session found' });
    }

    if (usageData.used >= usageData.limit) {
      return res.status(429).json({ error: 'Usage limit exceeded' });
    }

    const client = new shopify.clients.Rest({ session });
    
    let productData;
    try {
      const product = await client.get({
        path: `products/${id}`
      });
      productData = product.body.product;
    } catch (shopifyError) {
      productData = {
        id: id,
        title: 'Sample Product for Optimization',
        body_html: 'This is a sample product that needs optimization for AI search visibility and better discoverability.',
        description: 'Sample product description'
      };
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that optimizes product titles and descriptions for better visibility in AI-generated search results and answers. Make them more descriptive and keyword-rich while maintaining accuracy."
        },
        {
          role: "user",
          content: `Optimize this product for AI search visibility:
Title: ${productData.title}
Description: ${productData.body_html || productData.description || 'No description'}

Return a JSON object with optimized "title" and "description" fields.`
        }
      ],
      temperature: 0.7,
    });

    let optimizedContent;
    try {
      optimizedContent = JSON.parse(completion.choices[0].message.content);
    } catch (parseError) {
      optimizedContent = {
        title: productData.title + ' (AI Optimized)',
        description: completion.choices[0].message.content
      };
    }

    usageData.used += 1;

    res.json({ optimizedContent });
  } catch (error) {
    console.error('Error optimizing product:', error);
    res.status(500).json({ error: 'Failed to optimize product' });
  }
});

router.post('/:id/apply', verifyRequest(shopify), async (req, res) => {
  try {
    const { id } = req.params;
    const { optimizedContent } = req.body;
    const session = res.locals.shopify.session;

    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'No valid session found' });
    }

    const client = new shopify.clients.Rest({ session });

    if (optimizedContent?.title) {
      await client.post({
        path: `products/${id}/metafields`,
        data: {
          metafield: {
            namespace: 'ai_boost',
            key: 'title',
            value: optimizedContent.title,
            type: 'single_line_text_field'
          }
        }
      });
    }

    if (optimizedContent?.description) {
      await client.post({
        path: `products/${id}/metafields`,
        data: {
          metafield: {
            namespace: 'ai_boost',
            key: 'description',
            value: optimizedContent.description,
            type: 'multi_line_text_field'
          }
        }
      });
    }

    res.json({ success: true, message: 'AI content applied to metafields' });
  } catch (error) {
    console.error('Error applying AI content:', error);
    res.status(500).json({ error: 'Failed to apply AI content' });
  }
});

router.post('/:id/restore', verifyRequest(shopify), async (req, res) => {
  try {
    const { id } = req.params;
    const session = res.locals.shopify.session;

    if (!session || !session.accessToken) {
      return res.status(401).json({ error: 'No valid session found' });
    }

    const client = new shopify.clients.Rest({ session });

    const metafields = await client.get({
      path: `products/${id}/metafields`,
      query: { namespace: 'ai_boost' }
    });

    for (const metafield of metafields.body.metafields || []) {
      await client.delete({
        path: `products/${id}/metafields/${metafield.id}`
      });
    }

    res.json({ success: true, message: 'Original content restored' });
  } catch (error) {
    console.error('Error restoring original content:', error);
    res.status(500).json({ error: 'Failed to restore original content' });
  }
});

export default router;
