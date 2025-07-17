// Citation monitoring service
// Handles citation detection, storage, and analysis

// Citation storage (in production, use a database)
const citationStorage = new Map();

/**
 * Run citation monitoring for a shop
 * @param {string} shop - Shop domain
 * @param {Array} keywords - Additional keywords to monitor
 * @param {string} accessToken - Shopify access token
 */
const runCitationMonitoring = async (shop, keywords = [], accessToken) => {
  try {
    console.log(`[CITATION-MONITOR] Running citation monitoring for ${shop}`);
    
    if (!accessToken) {
      console.log(`[CITATION-MONITOR] No access token for ${shop}, skipping`);
      return [];
    }
    
    // Get optimized products for citation monitoring
    const optimizedProducts = await getOptimizedProducts(shop, accessToken);
    
    // Monitor citations for each product
    const citations = [];
    for (const product of optimizedProducts.slice(0, 10)) { // Limit to prevent API abuse
      const productCitations = await monitorProductCitations(shop, product, keywords);
      citations.push(...productCitations);
    }
    
    // Store citations
    const existingCitations = citationStorage.get(shop) || [];
    const allCitations = [...citations, ...existingCitations].slice(0, 1000); // Keep last 1000
    citationStorage.set(shop, allCitations);
    
    console.log(`[CITATION-MONITOR] Found ${citations.length} new citations for ${shop}`);
    
    return citations;
  } catch (error) {
    console.error(`[CITATION-MONITOR] Error for ${shop}:`, error);
    return [];
  }
};

/**
 * Get optimized products for citation monitoring
 */
const getOptimizedProducts = async (shop, accessToken) => {
  try {
    const response = await fetch(
      `https://${shop}/admin/api/2024-01/products.json?limit=25&fields=id,title,handle,vendor,product_type`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    );
    
    const data = await response.json();
    const products = data.products || [];
    const optimizedProducts = [];
    
    for (const product of products) {
      const metafieldsRes = await fetch(
        `https://${shop}/admin/api/2024-01/products/${product.id}/metafields.json?namespace=asb&key=enable_schema`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const metaData = await metafieldsRes.json();
      const isOptimized = metaData.metafields?.some(m => m.value === 'true');
      
      if (isOptimized) {
        optimizedProducts.push(product);
      }
    }
    
    return optimizedProducts;
  } catch (error) {
    console.error('Error fetching optimized products:', error);
    return [];
  }
};

/**
 * Monitor citations for a specific product
 */
const monitorProductCitations = async (shop, product, keywords = []) => {
  const citations = [];
  
  try {
    // Search for product mentions across different platforms
    const searchQueries = [
      `"${product.title}" site:${shop}`,
      `"${product.title}" ${product.vendor}`,
      ...keywords.map(keyword => `"${product.title}" ${keyword}`)
    ];
    
    for (const query of searchQueries) {
      const mockCitations = await searchForCitations(query, product);
      citations.push(...mockCitations);
    }
  } catch (error) {
    console.error(`Error monitoring citations for product ${product.id}:`, error);
  }
  
  return citations;
};

/**
 * Search for citations (mock implementation)
 */
const searchForCitations = async (query, product) => {
  // Mock citation data - in production would use real APIs
  const mockCitations = [];
  
  // Random chance of finding citations
  if (Math.random() > 0.7) {
    const sources = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Reddit', 'Twitter'];
    const source = sources[Math.floor(Math.random() * sources.length)];
    
    mockCitations.push({
      id: `citation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      product_id: product.id,
      product_title: product.title,
      source,
      query,
      mention_type: 'product_reference',
      context: `User asked about ${product.title} and AI mentioned it as a quality product from ${product.vendor}.`,
      url: source === 'ChatGPT' ? 'https://chat.openai.com' : 
            source === 'Claude' ? 'https://claude.ai' :
            source === 'Reddit' ? 'https://reddit.com/r/shopping' :
            `https://example.com/${source.toLowerCase()}`,
      timestamp: new Date().toISOString(),
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      sentiment: Math.random() > 0.2 ? 'positive' : 'neutral'
    });
  }
  
  return mockCitations;
};

/**
 * Get citation history for a shop
 */
const getCitationHistory = async (shop, limit = 50, offset = 0) => {
  const citations = citationStorage.get(shop) || [];
  const sorted = citations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return {
    citations: sorted.slice(offset, offset + limit),
    total: sorted.length,
    has_more: sorted.length > offset + limit
  };
};

/**
 * Get citation statistics for a shop
 */
const getCitationStats = async (shop) => {
  const citations = citationStorage.get(shop) || [];
  
  return {
    total: citations.length,
    by_source: citations.reduce((acc, c) => {
      acc[c.source] = (acc[c.source] || 0) + 1;
      return acc;
    }, {}),
    by_sentiment: citations.reduce((acc, c) => {
      acc[c.sentiment] = (acc[c.sentiment] || 0) + 1;
      return acc;
    }, {}),
    recent: citations.slice(0, 10)
  };
};

/**
 * Send citation summary
 */
const sendCitationSummary = async (shop, citations) => {
  console.log(`[CITATION-SUMMARY] ${shop}: Found ${citations.length} new citations`);
  
  const summary = {
    shop,
    total_citations: citations.length,
    by_source: citations.reduce((acc, c) => {
      acc[c.source] = (acc[c.source] || 0) + 1;
      return acc;
    }, {}),
    by_sentiment: citations.reduce((acc, c) => {
      acc[c.sentiment] = (acc[c.sentiment] || 0) + 1;
      return acc;
    }, {}),
    top_products: citations.reduce((acc, c) => {
      acc[c.product_title] = (acc[c.product_title] || 0) + 1;
      return acc;
    }, {}),
    timestamp: new Date().toISOString()
  };
  
  // In production, send email notifications, webhooks, etc.
  console.log('[CITATION-SUMMARY] Summary:', JSON.stringify(summary, null, 2));
  
  return summary;
};

export {
  runCitationMonitoring,
  getCitationHistory,
  getCitationStats,
  sendCitationSummary
};