const express = require('express');
const router = express.Router();

router.get('/login', async (req, res) => {
  try {
    const { shop } = req.query;
    
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }
    
    const authUrl = await res.locals.shopify.api.auth.begin({
      shop,
      callbackPath: '/api/auth/callback',
      isOnline: false,
    });
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('Auth login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const callback = await res.locals.shopify.api.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });
    
    const { session } = callback;
    
    await res.locals.shopify.sessionStorage.storeSession(session);
    
    const host = req.query.host;
    const redirectUrl = `/?shop=${session.shop}&host=${host}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication callback failed' });
  }
});

module.exports = router;
