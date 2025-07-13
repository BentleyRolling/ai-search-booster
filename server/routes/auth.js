import '@shopify/shopify-api/adapters/node';
import express from 'express';
import { shopifyApi } from '@shopify/shopify-api';

const router = express.Router();

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_products', 'write_products'],
  hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'localhost',
  apiVersion: '2023-10',
  isEmbeddedApp: true,
});

router.get('/', async (req, res) => {
  try {
    const { shop } = req.query;
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' });
    }

    const authRoute = await shopify.auth.begin({
      shop: shop.toString(),
      callbackPath: '/api/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });

    res.redirect(authRoute);
  } catch (error) {
    console.error('Auth initiation error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callback;
    
    console.log('Session created:', session);
    
    const host = req.query.host;
    const redirectUrl = `/?shop=${session.shop}&host=${host}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication callback failed' });
  }
});

export default router;
