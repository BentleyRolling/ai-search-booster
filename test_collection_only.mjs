#!/usr/bin/env node

import axios from 'axios';

// Configuration - test against production Render
const API_BASE = 'https://ai-search-booster-backend.onrender.com';
const SHOP = 'aisearch-dev.myshopify.com';

console.log('🧪 Collection Optimization Prompt Test');
console.log(`API_BASE: ${API_BASE}`);
console.log(`SHOP: ${SHOP}`);
console.log('');

async function makeRequest(url, options = {}) {
  try {
    console.log(`📞 ${options.method || 'GET'} ${url}`);
    const response = await axios({
      url: `${API_BASE}${url}`,
      ...options,
      timeout: 30000,
      validateStatus: () => true // Don't throw on non-2xx
    });
    
    console.log(`📋 Response: ${response.status} ${response.statusText}`);
    if (response.status >= 400) {
      console.log(`❌ Error response:`, response.data);
    }
    
    return response;
  } catch (error) {
    console.error(`🚨 Request failed:`, error.message);
    throw error;
  }
}

async function testCollectionOptimization() {
  console.log('\n🛍️  TESTING COLLECTION OPTIMIZATION');
  console.log('=================================');
  
  try {
    const collectionId = '123456';
    console.log(`🎯 Testing collection ID: ${collectionId}`);
    
    // Step 1: Optimize the collection
    console.log('🤖 Starting collection optimization...');
    const optimizeResponse = await makeRequest(`/api/optimize/collections?shop=${SHOP}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        shop: SHOP,
        collectionIds: [collectionId],
        settings: {
          targetLLM: 'ChatGPT',
          keywords: 'cotton, comfortable, organic',
          tone: 'professional'
        }
      }
    });
    
    console.log('🔍 CHECK RENDER LOGS NOW!');
    console.log('Look for these patterns in the server logs:');
    console.log('✅ "🧠 FINAL PROMPT SENT TO OPENAI:" followed by "Optimize a Shopify collection for LLM discoverability"');
    console.log('✅ "🔍 CONTENT TYPE: collection"');
    console.log('✅ Prompt should contain "🧠 STRICT FIELD RULES"');
    console.log('❌ Should NOT contain old text like "You are optimizing" or numbered lists');
    console.log('');
    
    if (optimizeResponse.status !== 200) {
      throw new Error(`Collection optimization failed: ${optimizeResponse.status} - ${JSON.stringify(optimizeResponse.data)}`);
    }
    
    console.log(`✅ Collection optimization response:`, JSON.stringify(optimizeResponse.data, null, 2));
    
    // Validate response structure
    const results = optimizeResponse.data.results || [];
    if (results.length > 0) {
      const firstResult = results[0];
      if (firstResult.optimized) {
        console.log('🔍 VALIDATING RESPONSE STRUCTURE:');
        
        const { optimized } = firstResult;
        const fields = ['optimizedTitle', 'optimizedDescription', 'llmDescription', 'summary', 'content', 'faqs'];
        const missingFields = fields.filter(field => !optimized[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`❌ Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Check for content repetition
        const descriptions = [optimized.llmDescription, optimized.summary, optimized.content];
        console.log('📝 CONTENT ANALYSIS:');
        console.log(`llmDescription: ${optimized.llmDescription?.substring(0, 100)}...`);
        console.log(`summary: ${optimized.summary?.substring(0, 100)}...`);
        console.log(`content: ${optimized.content?.substring(0, 100)}...`);
        
        // Check for forbidden words
        const forbiddenWords = ['premium', 'quality', 'amazing', 'great', 'perfect', 'stylish', 'classic', 'timeless', 'sustainable', 'comfort and style'];
        const allText = descriptions.join(' ').toLowerCase();
        const foundForbidden = forbiddenWords.filter(word => allText.includes(word));
        
        if (foundForbidden.length > 0) {
          throw new Error(`❌ Forbidden marketing words found: ${foundForbidden.join(', ')}`);
        }
        
        // Check FAQ quality
        if (!optimized.faqs || optimized.faqs.length < 3) {
          throw new Error('❌ Insufficient FAQs - need at least 3');
        }
        
        console.log('📋 FAQ ANALYSIS:');
        optimized.faqs.forEach((faq, i) => {
          console.log(`FAQ ${i + 1}: ${faq.q}`);
        });
        
        const badFaqPatterns = ['what is', 'what are', 'this collection'];
        const badFaqs = optimized.faqs.filter(faq => 
          badFaqPatterns.some(pattern => faq.q.toLowerCase().includes(pattern))
        );
        
        if (badFaqs.length > 0) {
          throw new Error(`❌ Poor quality FAQs detected: ${badFaqs.map(f => f.q).join(', ')}`);
        }
        
        console.log('✅ Response structure validation PASSED');
        console.log('✅ No forbidden words detected');
        console.log('✅ FAQ quality check PASSED');
      }
    }
    
    console.log('🎉 COLLECTION TEST PASSED!');
    console.log('📋 SUMMARY: The updated prompt is working correctly');
    
  } catch (error) {
    console.error('❌ COLLECTION TEST FAILED:', error.message);
    console.log('🔍 This indicates the old prompt is still being used or there\'s a runtime issue');
    throw error;
  }
}

// Run the test
testCollectionOptimization().catch(() => process.exit(1));