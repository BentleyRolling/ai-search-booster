#!/usr/bin/env node

import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const SHOP = process.env.SHOP || 'aisearch-dev.myshopify.com';
const PRODUCT_ID = process.env.PRODUCT_ID || '8292782140634';
const ARTICLE_ID = process.env.ARTICLE_ID || '9114334006874';
const BLOG_ID = process.env.BLOG_ID || '92091318319';
const COLLECTION_ID = process.env.COLLECTION_ID || '123456';
const MOCK_MODE = process.env.MOCK_MODE === 'true';

console.log('🧪 E2E Optimization Pipeline Test');
console.log(`API_BASE: ${API_BASE}`);
console.log(`SHOP: ${SHOP}`);
console.log(`PRODUCT_ID: ${PRODUCT_ID}`);
console.log(`ARTICLE_ID: ${ARTICLE_ID}`);
console.log(`BLOG_ID: ${BLOG_ID}`);
console.log(`COLLECTION_ID: ${COLLECTION_ID}`);
console.log(`MOCK_MODE: ${MOCK_MODE}`);
console.log('');

class E2ETest {
  constructor() {
    this.results = {
      product: { success: false, error: null },
      article: { success: false, error: null },
      collection: { success: false, error: null }
    };
  }

  async makeRequest(url, options = {}) {
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

  async pollForDraft(type, id, maxAttempts = 10) {
    console.log(`⏳ Polling for ${type} draft ${id}...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await this.makeRequest(`/api/draft/${type}/${id}?shop=${SHOP}`);
      
      if (response.status === 200 && response.data.hasDraft) {
        console.log(`✅ Draft found after ${attempt} attempts`);
        console.log(`📄 Draft data:`, JSON.stringify(response.data.draft, null, 2));
        return response.data;
      }
      
      console.log(`⏸️  Attempt ${attempt}/${maxAttempts}: No draft yet, waiting 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Draft not found after ${maxAttempts} attempts`);
  }

  async testProductOptimization() {
    console.log('\n🛍️  TESTING PRODUCT OPTIMIZATION');
    console.log('================================');
    
    try {
      // Use the known good product ID
      const productId = PRODUCT_ID;
      console.log(`🎯 Testing product ID: ${productId}`);
      
      // Step 2: Get original product content  
      console.log('📦 Fetching original product content...');
      const productResponse = await this.makeRequest(`/api/products?shop=${SHOP}`);
      
      if (productResponse.status !== 200) {
        throw new Error(`Failed to fetch products: ${productResponse.status}`);
      }
      
      const products = productResponse.data.products || [];
      const testProduct = products.find(p => p.id.toString() === productId.toString());
      
      if (!testProduct) {
        throw new Error(`Product ${productId} not found in store ${SHOP}`);
      }
      
      console.log(`📝 Found product: ${testProduct.title}`);
      console.log(`📝 Original body length: ${testProduct.body_html?.length || 0} chars`);
      
      // Step 3: Optimize the product
      console.log('🤖 Starting product optimization...');
      const optimizeResponse = await this.makeRequest(`/api/optimize/products?shop=${SHOP}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          shop: SHOP,
          productIds: [productId],
          settings: {
            targetLLM: 'ChatGPT',
            keywords: 'test, quality, premium',
            tone: 'professional'
          }
        }
      });
      
      if (optimizeResponse.status !== 200) {
        throw new Error(`Optimization failed: ${optimizeResponse.status} - ${JSON.stringify(optimizeResponse.data)}`);
      }
      
      console.log(`✅ Optimization response:`, optimizeResponse.data);
      
      // Step 4: Poll for draft content
      const draftData = await this.pollForDraft('product', productId);
      
      // Step 5: Publish the draft
      console.log('📤 Publishing draft...');
      const publishResponse = await this.makeRequest(`/api/publish/product/${productId}?shop=${SHOP}`, {
        method: 'POST'
      });
      
      if (publishResponse.status !== 200) {
        throw new Error(`Publish failed: ${publishResponse.status} - ${JSON.stringify(publishResponse.data)}`);
      }
      
      console.log(`✅ Publish response:`, publishResponse.data);
      
      // Step 6: Get access token for direct Shopify verification
      console.log('🔍 Getting access token for direct verification...');
      const tokenResponse = await this.makeRequest(`/api/debug/token?shop=${SHOP}`);
      
      if (tokenResponse.status !== 200) {
        throw new Error(`Failed to get access token: ${tokenResponse.status}`);
      }
      
      const accessToken = tokenResponse.data.token;
      
      // Step 7: Direct Shopify API verification
      console.log('🔍 Verifying product update directly from Shopify...');
      const shopifyResponse = await axios.get(
        `https://${SHOP}/admin/api/2024-01/products/${productId}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      if (shopifyResponse.status !== 200) {
        throw new Error(`Failed to fetch product from Shopify: ${shopifyResponse.status}`);
      }
      
      const shopifyProduct = shopifyResponse.data.product;
      
      console.log(`🔍 Shopify product title: ${shopifyProduct.title}`);
      console.log(`🔍 Shopify body_html length: ${shopifyProduct.body_html?.length || 0} chars`);
      
      // Step 8: Assert changes were made
      const draftContent = JSON.parse(draftData.draft.content);
      const expectedContent = draftContent.body_html || draftContent.llmDescription;
      const expectedTitle = draftContent.title;
      
      console.log(`🎯 Expected content length: ${expectedContent?.length || 0} chars`);
      console.log(`🎯 Expected title: ${expectedTitle}`);
      
      if (expectedTitle && shopifyProduct.title !== expectedTitle) {
        throw new Error(`Title mismatch: expected "${expectedTitle}", got "${shopifyProduct.title}"`);
      }
      
      if (expectedContent && !shopifyProduct.body_html?.includes(expectedContent.substring(0, 50))) {
        console.log(`⚠️  Content mismatch detected`);
        console.log(`Expected: ${expectedContent.substring(0, 100)}...`);
        console.log(`Actual: ${shopifyProduct.body_html?.substring(0, 100)}...`);
        throw new Error('Product content was not updated with optimized content');
      }
      
      // Step 9: Check metafields exist
      console.log('🏷️  Checking optimization metafields...');
      const metafieldsResponse = await axios.get(
        `https://${SHOP}/admin/api/2024-01/products/${productId}/metafields.json?namespace=asb`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const metafields = metafieldsResponse.data.metafields;
      const currentVersionMetafield = metafields.find(m => m.key === 'current_version' || m.key === 'published_timestamp');
      
      if (!currentVersionMetafield) {
        throw new Error('Required metafield asb.current_version not found');
      }
      
      console.log(`✅ Found metafield: ${currentVersionMetafield.key}`);
      
      this.results.product.success = true;
      console.log('🎉 PRODUCT TEST PASSED!');
      
    } catch (error) {
      this.results.product.error = error.message;
      console.error('❌ PRODUCT TEST FAILED:', error.message);
      throw error;
    }
  }

  async testArticleOptimization() {
    console.log('\n📝 TESTING ARTICLE OPTIMIZATION');
    console.log('===============================');
    
    try {
      // Use the known good article ID
      const articleId = ARTICLE_ID;
      console.log(`🎯 Testing article ID: ${articleId}`);
      
      // Step 2: Get original article content
      console.log('📄 Fetching original article content...');
      const blogsResponse = await this.makeRequest(`/api/blogs?shop=${SHOP}`);
      
      if (blogsResponse.status !== 200) {
        throw new Error(`Failed to fetch blogs: ${blogsResponse.status}`);
      }
      
      const blogs = blogsResponse.data.blogs || [];
      let testArticle = null;
      
      for (const blog of blogs) {
        if (blog.articles) {
          testArticle = blog.articles.find(a => a.id.toString() === articleId.toString());
          if (testArticle) break;
        }
      }
      
      if (!testArticle) {
        throw new Error(`Article ${articleId} not found in store ${SHOP}`);
      }
      
      console.log(`📝 Found article: ${testArticle.title}`);
      console.log(`📝 Original body_html length: ${testArticle.body_html?.length || 0} chars`);
      
      // Step 3: Optimize the article
      console.log('🤖 Starting article optimization...');
      const optimizeResponse = await this.makeRequest(`/api/optimize/blogs?shop=${SHOP}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          shop: SHOP,
          blogIds: [BLOG_ID],
          settings: {
            targetLLM: 'ChatGPT',
            keywords: 'test, quality, premium',
            tone: 'professional'
          }
        }
      });
      
      if (optimizeResponse.status !== 200) {
        throw new Error(`Article optimization failed: ${optimizeResponse.status} - ${JSON.stringify(optimizeResponse.data)}`);
      }
      
      console.log(`✅ Article optimization response:`, optimizeResponse.data);
      
      // Step 4: Poll for draft content
      const draftData = await this.pollForDraft('article', articleId);
      
      // Step 5: Publish the draft
      console.log('📤 Publishing article draft...');
      const publishResponse = await this.makeRequest(`/api/publish/article/${articleId}?shop=${SHOP}`, {
        method: 'POST'
      });
      
      if (publishResponse.status !== 200) {
        throw new Error(`Article publish failed: ${publishResponse.status} - ${JSON.stringify(publishResponse.data)}`);
      }
      
      console.log(`✅ Article publish response:`, publishResponse.data);
      
      // Step 6: Get access token for direct Shopify verification
      console.log('🔍 Getting access token for direct verification...');
      const tokenResponse = await this.makeRequest(`/api/debug/token?shop=${SHOP}`);
      
      if (tokenResponse.status !== 200) {
        throw new Error(`Failed to get access token: ${tokenResponse.status}`);
      }
      
      const accessToken = tokenResponse.data.token;
      
      // Step 7: Direct Shopify API verification
      console.log('🔍 Verifying article update directly from Shopify...');
      const shopifyResponse = await axios.get(
        `https://${SHOP}/admin/api/2024-01/articles/${articleId}.json`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      if (shopifyResponse.status !== 200) {
        throw new Error(`Failed to fetch article from Shopify: ${shopifyResponse.status}`);
      }
      
      const shopifyArticle = shopifyResponse.data.article;
      
      console.log(`🔍 Shopify article title: ${shopifyArticle.title}`);
      console.log(`🔍 Shopify body_html length: ${shopifyArticle.body_html?.length || 0} chars`);
      
      // Step 8: Assert changes were made
      const draftContent = JSON.parse(draftData.draft.content);
      const expectedContent = draftContent.body_html || draftContent.llmDescription;
      const expectedTitle = draftContent.title;
      
      console.log(`🎯 Expected content length: ${expectedContent?.length || 0} chars`);
      console.log(`🎯 Expected title: ${expectedTitle}`);
      
      if (expectedTitle && shopifyArticle.title !== expectedTitle) {
        throw new Error(`Article title mismatch: expected "${expectedTitle}", got "${shopifyArticle.title}"`);
      }
      
      if (expectedContent && !shopifyArticle.body_html?.includes(expectedContent.substring(0, 50))) {
        console.log(`⚠️  Article content mismatch detected`);
        console.log(`Expected: ${expectedContent.substring(0, 100)}...`);
        console.log(`Actual: ${shopifyArticle.body_html?.substring(0, 100)}...`);
        throw new Error('Article content was not updated with optimized content');
      }
      
      // Step 9: Check metafields exist
      console.log('🏷️  Checking optimization metafields...');
      const metafieldsResponse = await axios.get(
        `https://${SHOP}/admin/api/2024-01/articles/${articleId}/metafields.json?namespace=asb`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      
      const metafields = metafieldsResponse.data.metafields;
      const currentVersionMetafield = metafields.find(m => m.key === 'current_version' || m.key === 'published_timestamp');
      
      if (!currentVersionMetafield) {
        throw new Error('Required metafield asb.current_version not found');
      }
      
      console.log(`✅ Found metafield: ${currentVersionMetafield.key}`);
      
      this.results.article.success = true;
      console.log('🎉 ARTICLE TEST PASSED!');
      
    } catch (error) {
      this.results.article.error = error.message;
      console.error('❌ ARTICLE TEST FAILED:', error.message);
      throw error;
    }
  }

  async testCollectionOptimization() {
    console.log('\n🛍️  TESTING COLLECTION OPTIMIZATION');
    console.log('=================================');
    
    try {
      // Use the known good collection ID
      const collectionId = COLLECTION_ID;
      console.log(`🎯 Testing collection ID: ${collectionId}`);
      
      // Step 2: Get original collection content  
      console.log('📦 Fetching original collection content...');
      const collectionsResponse = await this.makeRequest(`/api/collections?shop=${SHOP}`);
      
      if (collectionsResponse.status !== 200) {
        throw new Error(`Failed to fetch collections: ${collectionsResponse.status}`);
      }
      
      const collections = collectionsResponse.data.collections || [];
      const testCollection = collections.find(c => c.id.toString() === collectionId.toString()) || {
        id: collectionId,
        title: "Men's Cotton T-Shirts",
        body_html: "Comfortable cotton t-shirts for everyday wear. Made from 100% organic cotton.",
        products_count: 15
      };
      
      console.log(`📝 Found/Using collection: ${testCollection.title}`);
      console.log(`📝 Original body length: ${testCollection.body_html?.length || 0} chars`);
      
      // Step 3: Optimize the collection
      console.log('🤖 Starting collection optimization...');
      const optimizeResponse = await this.makeRequest(`/api/optimize/collections?shop=${SHOP}`, {
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
      
      console.log('🔍 CHECKING SERVER LOGS FOR PROMPT VERIFICATION...');
      console.log('Look for these log patterns:');
      console.log('✅ "🧠 FINAL PROMPT SENT TO OPENAI:" followed by "Optimize a Shopify collection for LLM discoverability"');
      console.log('✅ "🔍 CONTENT TYPE: collection"');
      console.log('✅ Prompt should contain "🧠 STRICT FIELD RULES"');
      console.log('❌ Should NOT contain old text like "You are optimizing" or numbered lists');
      
      if (optimizeResponse.status !== 200) {
        throw new Error(`Collection optimization failed: ${optimizeResponse.status} - ${JSON.stringify(optimizeResponse.data)}`);
      }
      
      console.log(`✅ Collection optimization response:`, optimizeResponse.data);
      
      // Check the response structure matches our strict requirements
      const results = optimizeResponse.data.results || [];
      if (results.length > 0) {
        const firstResult = results[0];
        if (firstResult.optimized) {
          console.log('🔍 VALIDATING RESPONSE STRUCTURE:');
          
          const { optimized } = firstResult;
          const fields = ['optimizedTitle', 'optimizedDescription', 'llmDescription', 'summary', 'content', 'faqs'];
          const missingFields = fields.filter(field => !optimized[field]);
          
          if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
          }
          
          // Check for content repetition
          const descriptions = [optimized.llmDescription, optimized.summary, optimized.content];
          const normalizedDescriptions = descriptions.map(d => d?.toLowerCase().replace(/[^\w\s]/g, '').trim());
          
          for (let i = 0; i < normalizedDescriptions.length; i++) {
            for (let j = i + 1; j < normalizedDescriptions.length; j++) {
              if (normalizedDescriptions[i] && normalizedDescriptions[j]) {
                const similarity = this.calculateSimilarity(normalizedDescriptions[i], normalizedDescriptions[j]);
                if (similarity > 0.7) {
                  console.log(`⚠️  HIGH SIMILARITY DETECTED between fields ${i} and ${j}: ${similarity}`);
                  console.log(`Field ${i}: ${descriptions[i]?.substring(0, 100)}...`);
                  console.log(`Field ${j}: ${descriptions[j]?.substring(0, 100)}...`);
                  throw new Error('Content repetition detected - fields are too similar');
                }
              }
            }
          }
          
          // Check for forbidden words
          const forbiddenWords = ['premium', 'quality', 'amazing', 'great', 'perfect', 'stylish', 'classic', 'timeless', 'sustainable'];
          const allText = descriptions.join(' ').toLowerCase();
          const foundForbidden = forbiddenWords.filter(word => allText.includes(word));
          
          if (foundForbidden.length > 0) {
            throw new Error(`Forbidden marketing words found: ${foundForbidden.join(', ')}`);
          }
          
          // Check FAQ quality
          if (!optimized.faqs || optimized.faqs.length < 3) {
            throw new Error('Insufficient FAQs - need at least 3');
          }
          
          const badFaqPatterns = ['what is', 'what are', 'this collection'];
          const badFaqs = optimized.faqs.filter(faq => 
            badFaqPatterns.some(pattern => faq.q.toLowerCase().includes(pattern))
          );
          
          if (badFaqs.length > 0) {
            throw new Error(`Poor quality FAQs detected: ${badFaqs.map(f => f.q).join(', ')}`);
          }
          
          console.log('✅ Response structure validation PASSED');
        }
      }
      
      this.results.collection.success = true;
      console.log('🎉 COLLECTION TEST PASSED!');
      
    } catch (error) {
      this.results.collection.error = error.message;
      console.error('❌ COLLECTION TEST FAILED:', error.message);
      throw error;
    }
  }
  
  calculateSimilarity(str1, str2) {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  async run() {
    console.log('🚀 Starting E2E optimization pipeline test...\n');
    
    try {
      await this.testProductOptimization();
      await this.testArticleOptimization();
      await this.testCollectionOptimization();
      
      console.log('\n🎊 ALL TESTS PASSED!');
      console.log('===================');
      console.log(`✅ Product optimization: ${this.results.product.success ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Article optimization: ${this.results.article.success ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Collection optimization: ${this.results.collection.success ? 'PASS' : 'FAIL'}`);
      
      process.exit(0);
      
    } catch (error) {
      console.log('\n💥 TEST SUITE FAILED');
      console.log('===================');
      console.log(`❌ Product optimization: ${this.results.product.success ? 'PASS' : 'FAIL'}`);
      if (this.results.product.error) {
        console.log(`   Error: ${this.results.product.error}`);
      }
      console.log(`❌ Article optimization: ${this.results.article.success ? 'PASS' : 'FAIL'}`);
      if (this.results.article.error) {
        console.log(`   Error: ${this.results.article.error}`);
      }
      console.log(`❌ Collection optimization: ${this.results.collection.success ? 'PASS' : 'FAIL'}`);
      if (this.results.collection.error) {
        console.log(`   Error: ${this.results.collection.error}`);
      }
      
      console.log(`\n🔍 ROOT CAUSE ANALYSIS:`);
      console.log(`Last error: ${error.message}`);
      
      process.exit(1);
    }
  }
}

// Run the test
const test = new E2ETest();
test.run().catch(console.error);