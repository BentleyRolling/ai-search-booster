const { shopifyApi } = require('@shopify/shopify-api');

const verifyRequest = (app) => {
  return async (req, res, next) => {
    try {
      const session = await app.sessionStorage.loadSession(req.get('authorization'));
      if (session && session.isActive()) {
        res.locals.shopify = { session };
        return next();
      }
      
      return res.status(401).json({ error: 'Unauthorized' });
    } catch (error) {
      console.error('Auth verification error:', error);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
};

module.exports = { verifyRequest };
