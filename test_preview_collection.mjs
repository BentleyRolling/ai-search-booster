#!/usr/bin/env node

import axios from 'axios';

// Configuration - test against production Render
const API_BASE = 'https://ai-search-booster-backend.onrender.com';
const SHOP = 'test-shop.myshopify.com';

console.log('🧪 Collection Optimization Preview Test');
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

async function testCollectionPreview() {
  console.log('\n🛍️  TESTING COLLECTION PREVIEW OPTIMIZATION');
  console.log('==========================================');
  
  try {
    const testCollection = {
      id: '123456',
      title: "Men's Cotton T-Shirts",
      body_html: "Comfortable cotton t-shirts for everyday wear. Made from 100% organic cotton.",
      products_count: 15,
      handle: "mens-cotton-tshirts"
    };
    
    console.log(`🎯 Testing collection: ${testCollection.title}`);
    
    // Step 1: Test preview optimization 
    console.log('🤖 Starting collection preview optimization...');
    const previewResponse = await makeRequest(`/api/optimize/preview?shop=${SHOP}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': SHOP
      },
      data: {
        content: testCollection,
        type: 'collection',
        settings: {
          targetLLM: 'ChatGPT',
          keywords: ['cotton', 'comfortable', 'organic'],
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
    
    if (previewResponse.status !== 200) {
      throw new Error(`Preview optimization failed: ${previewResponse.status} - ${JSON.stringify(previewResponse.data)}`);
    }
    
    console.log(`✅ Preview response received`);
    const optimized = previewResponse.data.optimized;
    
    if (!optimized) {
      throw new Error('❌ No optimized content in response');
    }
    
    // Validate response structure
    console.log('🔍 VALIDATING RESPONSE STRUCTURE:');
    
    const fields = ['optimizedTitle', 'optimizedDescription', 'llmDescription', 'summary', 'content', 'faqs'];
    const missingFields = fields.filter(field => !optimized[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`❌ Missing required fields: ${missingFields.join(', ')}`);
    }
    
    console.log('✅ All required fields present');
    
    // Check for content repetition
    const descriptions = [optimized.llmDescription, optimized.summary, optimized.content];
    console.log('📝 CONTENT ANALYSIS:');
    console.log(`llmDescription: "${optimized.llmDescription?.substring(0, 100)}..."`);
    console.log(`summary: "${optimized.summary?.substring(0, 100)}..."`);
    console.log(`content: "${optimized.content?.substring(0, 100)}..."`);
    
    // Simple repetition check
    const hasRepetition = descriptions.some((desc1, i) => 
      descriptions.some((desc2, j) => 
        i !== j && desc1 && desc2 && desc1.toLowerCase().includes(desc2.toLowerCase().substring(0, 30))
      )
    );
    
    if (hasRepetition) {
      console.log('⚠️  WARNING: Possible content repetition detected');
    } else {
      console.log('✅ No obvious content repetition');
    }
    
    // Check for forbidden words
    const forbiddenWords = ['premium', 'quality', 'amazing', 'great', 'perfect', 'stylish', 'classic', 'timeless', 'sustainable'];
    const allText = descriptions.join(' ').toLowerCase();
    const foundForbidden = forbiddenWords.filter(word => allText.includes(word));
    
    if (foundForbidden.length > 0) {
      console.log(`⚠️  WARNING: Forbidden marketing words found: ${foundForbidden.join(', ')}`);
    } else {
      console.log('✅ No forbidden words detected');
    }
    
    // Check FAQ quality
    if (!optimized.faqs || optimized.faqs.length < 3) {
      throw new Error('❌ Insufficient FAQs - need at least 3');
    }
    
    console.log('📋 FAQ ANALYSIS:');
    optimized.faqs.forEach((faq, i) => {
      console.log(`FAQ ${i + 1}: "${faq.q || faq.question}"`);
    });
    
    const badFaqPatterns = ['what is', 'what are', 'this collection'];
    const badFaqs = optimized.faqs.filter(faq => {
      const question = faq.q || faq.question || '';
      return badFaqPatterns.some(pattern => question.toLowerCase().includes(pattern));
    });
    
    if (badFaqs.length > 0) {
      console.log(`⚠️  WARNING: Poor quality FAQs detected: ${badFaqs.map(f => f.q || f.question).join(', ')}`);
    } else {
      console.log('✅ FAQ quality check PASSED');
    }
    
    console.log('\n🎉 COLLECTION PREVIEW TEST COMPLETED!');
    console.log('====================================');
    
    // Final verdict
    const hasIssues = hasRepetition || foundForbidden.length > 0 || badFaqs.length > 0;
    if (hasIssues) {
      console.log('⚠️  RESULT: Updated prompt may not be fully working - issues detected');
      console.log('🔍 Check server logs to confirm which prompt was actually sent to OpenAI');
    } else {
      console.log('✅ RESULT: Updated prompt appears to be working correctly!');
    }
    
  } catch (error) {
    console.error('❌ COLLECTION PREVIEW TEST FAILED:', error.message);
    console.log('🔍 This indicates the old prompt is still being used or there\'s a runtime issue');
    throw error;
  }
}

// Run the test
testCollectionPreview().catch(() => process.exit(1));