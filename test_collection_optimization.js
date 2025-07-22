const axios = require('axios');

// Test collection optimization to verify prompt usage
async function testCollectionOptimization() {
  const testCollection = {
    id: 123456,
    title: "Men's Cotton T-Shirts",
    body_html: "Comfortable cotton t-shirts for everyday wear. Made from 100% organic cotton.",
    products_count: 15
  };

  const payload = {
    collectionIds: [123456],
    settings: {
      targetLLM: 'general',
      keywords: ['cotton', 'comfortable', 'organic'],
      tone: 'professional'
    }
  };

  try {
    console.log('🧪 Testing collection optimization...');
    console.log('📦 Test collection:', testCollection.title);
    
    // Test locally first if server is running
    const response = await axios.post('http://localhost:3000/api/optimize/collections?shop=test-shop.myshopify.com', payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': 'test-shop.myshopify.com'
      },
      timeout: 30000
    }).catch(async (localError) => {
      console.log('❌ Local server not available, trying Render...');
      
      // Try Render deployment
      return await axios.post('https://ai-search-booster-backend.onrender.com/api/optimize/collections?shop=test-shop.myshopify.com', payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': 'test-shop.myshopify.com'
        },
        timeout: 30000
      });
    });

    console.log('✅ Response status:', response.status);
    console.log('📝 Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('📄 Error response:', error.response.data);
    }
  }
}

// Mock collection data for direct optimizeContent test
async function testDirectOptimization() {
  console.log('\n🔬 Testing direct optimizeContent function...');
  
  // This would require importing the function directly
  // For now, just document what we expect to see in logs
  console.log('Expected log patterns:');
  console.log('✅ "🧠 FINAL PROMPT SENT TO OPENAI:" followed by "Optimize a Shopify collection for LLM discoverability"');
  console.log('✅ "🔍 CONTENT TYPE: collection"');
  console.log('✅ Prompt should contain "🧠 STRICT FIELD RULES"');
  console.log('❌ Should NOT contain old text like "You are optimizing" or numbered lists');
}

if (require.main === module) {
  testCollectionOptimization().then(() => {
    testDirectOptimization();
  });
}

module.exports = { testCollectionOptimization, testDirectOptimization };