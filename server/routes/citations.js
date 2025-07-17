// Citation monitoring REST API routes
import express from 'express';
import { 
  startCitationMonitoring, 
  stopCitationMonitoring, 
  isMonitoringActive 
} from '../jobs/citationScheduler.js';
import { 
  runCitationMonitoring, 
  getCitationHistory, 
  getCitationStats,
  sendCitationSummary 
} from '../services/citations.js';

const router = express.Router();

// Store for shop data access (will be injected)
let shopDataStore = null;

/**
 * Initialize routes with shop data store
 */
const initializeCitationRoutes = (shopData) => {
  shopDataStore = shopData;
  return router;
};

// Simple auth middleware for citation routes
const verifyCitationAuth = (req, res, next) => {
  const shop = req.query.shop || req.body.shop || req.headers['x-shopify-shop-domain'];
  
  if (!shop) {
    return res.status(400).json({ error: 'Missing shop parameter' });
  }
  
  if (!shopDataStore) {
    return res.status(500).json({ error: 'Shop data store not initialized' });
  }
  
  // Create or get shop info
  let shopInfo = shopDataStore.get(shop);
  if (!shopInfo) {
    shopInfo = { accessToken: 'mock-token', installedAt: new Date().toISOString() };
    shopDataStore.set(shop, shopInfo);
  }
  
  req.shopInfo = shopInfo;
  req.shop = shop;
  next();
};

/**
 * Start citation monitoring for a shop
 * POST /api/monitoring/start
 */
router.post('/start', verifyCitationAuth, async (req, res) => {
  try {
    const { shop, shopInfo } = req;
    const { interval = 'daily', keywords = [] } = req.body;
    
    // Create monitoring function with shop context
    const monitoringFunction = async (shopDomain, keywordList) => {
      const citations = await runCitationMonitoring(shopDomain, keywordList, shopInfo.accessToken);
      if (citations.length > 0) {
        await sendCitationSummary(shopDomain, citations);
      }
    };
    
    // Start monitoring
    const result = startCitationMonitoring(shop, monitoringFunction, { interval, keywords });
    
    res.json({
      message: 'Citation monitoring started successfully',
      ...result
    });
  } catch (error) {
    console.error('Citation monitoring start error:', error);
    res.status(500).json({ error: 'Failed to start citation monitoring' });
  }
});

/**
 * Stop citation monitoring for a shop
 * POST /api/monitoring/stop
 */
router.post('/stop', verifyCitationAuth, async (req, res) => {
  try {
    const { shop } = req;
    
    const stopped = stopCitationMonitoring(shop);
    
    if (stopped) {
      res.json({
        message: 'Citation monitoring stopped successfully',
        shop
      });
    } else {
      res.json({
        message: 'No citation monitoring job found for this shop',
        shop
      });
    }
  } catch (error) {
    console.error('Citation monitoring stop error:', error);
    res.status(500).json({ error: 'Failed to stop citation monitoring' });
  }
});

/**
 * Get citation monitoring status
 * GET /api/monitoring/status
 */
router.get('/status', verifyCitationAuth, async (req, res) => {
  try {
    const { shop } = req;
    
    const monitoring_active = isMonitoringActive(shop);
    const stats = await getCitationStats(shop);
    
    res.json({
      shop,
      monitoring_active,
      total_citations: stats.total,
      recent_citations: stats.recent,
      last_check: stats.recent[0]?.timestamp || null,
      stats: {
        by_source: stats.by_source,
        by_sentiment: stats.by_sentiment
      }
    });
  } catch (error) {
    console.error('Citation monitoring status error:', error);
    res.status(500).json({ error: 'Failed to get citation monitoring status' });
  }
});

/**
 * Get citation history with pagination
 * GET /api/monitoring/citations
 */
router.get('/citations', verifyCitationAuth, async (req, res) => {
  try {
    const { shop } = req;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await getCitationHistory(shop, parseInt(limit), parseInt(offset));
    
    res.json({
      shop,
      citations: result.citations,
      total: result.total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: result.has_more
      }
    });
  } catch (error) {
    console.error('Citation history error:', error);
    res.status(500).json({ error: 'Failed to get citation history' });
  }
});

/**
 * Get citation statistics and aggregation
 * GET /api/monitoring/stats
 */
router.get('/stats', verifyCitationAuth, async (req, res) => {
  try {
    const { shop } = req;
    
    const stats = await getCitationStats(shop);
    
    res.json({
      shop,
      statistics: stats,
      monitoring_active: isMonitoringActive(shop)
    });
  } catch (error) {
    console.error('Citation stats error:', error);
    res.status(500).json({ error: 'Failed to get citation statistics' });
  }
});

export { router as citationRoutes, initializeCitationRoutes };