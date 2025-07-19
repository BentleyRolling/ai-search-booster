#!/usr/bin/env node

import axios from 'axios';

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const SHOP = process.env.SHOP || 'ai-search-booster-test.myshopify.com';
const MOCK_MODE = process.env.MOCK_MODE === 'true';

console.log('🧪 E2E Optimization Pipeline Test');
console.log(`API_BASE: ${API_BASE}`);
console.log(`SHOP: ${SHOP}`);
console.log(`MOCK_MODE: ${MOCK_MODE}`);
console.log('');

class E2ETest {
  constructor() {
    this.results = {
      product: { success: false, error: null },
      article: { success: false, error: null }
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
      // Step 1: Get a product ID
      console.log('📦 Fetching products...');
      const productsResponse = await this.makeRequest(`/api/products?shop=${SHOP}`);
      
      if (productsResponse.status !== 200) {
        throw new Error(`Failed to fetch products: ${productsResponse.status} - ${JSON.stringify(productsResponse.data)}`);
      }
      
      const products = productsResponse.data.products || [];
      if (products.length === 0) {
        throw new Error('No products found to test');
      }
      
      const testProduct = products[0];
      const productId = testProduct.id;
      console.log(`🎯 Testing product: ${testProduct.title} (ID: ${productId})`);
      
      // Step 2: Store original content for comparison
      console.log('💾 Storing original product content...');
      const originalContent = {
        title: testProduct.title,
        body_html: testProduct.body_html
      };
      console.log(`📝 Original title: ${originalContent.title}`);
      console.log(`📝 Original body length: ${originalContent.body_html?.length || 0} chars`);
      
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
      
      console.log(`✅ Optimization response:`, JSON.stringify(optimizeResponse.data, null, 2));
      
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
      
      // Step 6: Verify the product was actually updated
      console.log('🔍 Verifying product update...');
      const updatedProductResponse = await this.makeRequest(`/api/products?shop=${SHOP}`);
      
      if (updatedProductResponse.status !== 200) {
        throw new Error(`Failed to fetch updated product: ${updatedProductResponse.status}`);
      }
      
      const updatedProducts = updatedProductResponse.data.products || [];
      const updatedProduct = updatedProducts.find(p => p.id === productId);
      
      if (!updatedProduct) {
        throw new Error('Updated product not found');
      }
      
      console.log(`🔍 Updated product title: ${updatedProduct.title}`);
      console.log(`🔍 Updated body length: ${updatedProduct.body_html?.length || 0} chars`);
      
      // Step 7: Assert changes were made
      const draftContent = JSON.parse(draftData.draft.content);
      const expectedContent = draftContent.body_html || draftContent.llmDescription;
      const expectedTitle = draftContent.title;
      
      console.log(`🎯 Expected content length: ${expectedContent?.length || 0} chars`);
      console.log(`🎯 Expected title: ${expectedTitle}`);
      
      if (expectedTitle && updatedProduct.title !== expectedTitle) {
        console.log(`⚠️  Title mismatch: expected "${expectedTitle}", got "${updatedProduct.title}"`);
      }
      
      if (expectedContent && updatedProduct.body_html !== expectedContent) {
        console.log(`⚠️  Content mismatch detected`);
        console.log(`Expected: ${expectedContent.substring(0, 100)}...`);
        console.log(`Actual: ${updatedProduct.body_html?.substring(0, 100)}...`);
        throw new Error('Product content was not updated with optimized content');
      }
      
      // Step 8: Check metafields exist
      console.log('🏷️  Checking optimization metafields...');
      const metafieldsResponse = await this.makeRequest(`/api/status?shop=${SHOP}`);
      
      if (metafieldsResponse.status === 200) {
        console.log(`✅ Status check passed`);
      }
      
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
      // Step 1: Get an article ID
      console.log('📄 Fetching blogs and articles...');
      const blogsResponse = await this.makeRequest(`/api/blogs?shop=${SHOP}`);
      
      if (blogsResponse.status !== 200) {
        throw new Error(`Failed to fetch blogs: ${blogsResponse.status} - ${JSON.stringify(blogsResponse.data)}`);
      }
      
      const blogs = blogsResponse.data.blogs || [];
      if (blogs.length === 0) {
        throw new Error('No blogs found to test');
      }
      
      // Find an article in the first blog
      let testArticle = null;
      let articleId = null;
      
      for (const blog of blogs) {
        if (blog.articles && blog.articles.length > 0) {
          testArticle = blog.articles[0];
          articleId = testArticle.id;
          break;
        }
      }
      
      if (!testArticle) {
        throw new Error('No articles found to test');
      }
      
      console.log(`🎯 Testing article: ${testArticle.title} (ID: ${articleId})`);
      
      // Step 2: Store original content for comparison
      console.log('💾 Storing original article content...');
      const originalContent = {
        title: testArticle.title,
        content: testArticle.content
      };
      console.log(`📝 Original title: ${originalContent.title}`);
      console.log(`📝 Original content length: ${originalContent.content?.length || 0} chars`);
      
      // Step 3: Optimize the article
      console.log('🤖 Starting article optimization...');
      const optimizeResponse = await this.makeRequest(`/api/optimize/blogs?shop=${SHOP}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          shop: SHOP,
          blogIds: [articleId],
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
      
      console.log(`✅ Article optimization response:`, JSON.stringify(optimizeResponse.data, null, 2));
      
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
      
      // Step 6: Verify the article was actually updated
      console.log('🔍 Verifying article update...');
      const updatedBlogsResponse = await this.makeRequest(`/api/blogs?shop=${SHOP}`);
      
      if (updatedBlogsResponse.status !== 200) {
        throw new Error(`Failed to fetch updated blogs: ${updatedBlogsResponse.status}`);
      }
      
      let updatedArticle = null;
      const updatedBlogs = updatedBlogsResponse.data.blogs || [];
      
      for (const blog of updatedBlogs) {
        if (blog.articles) {
          updatedArticle = blog.articles.find(a => a.id === articleId);
          if (updatedArticle) break;
        }
      }
      
      if (!updatedArticle) {
        throw new Error('Updated article not found');
      }
      
      console.log(`🔍 Updated article title: ${updatedArticle.title}`);
      console.log(`🔍 Updated content length: ${updatedArticle.content?.length || 0} chars`);
      
      // Step 7: Assert changes were made
      const draftContent = JSON.parse(draftData.draft.content);
      const expectedContent = draftContent.content || draftContent.llmDescription;
      const expectedTitle = draftContent.title;
      
      console.log(`🎯 Expected content length: ${expectedContent?.length || 0} chars`);
      console.log(`🎯 Expected title: ${expectedTitle}`);
      
      if (expectedTitle && updatedArticle.title !== expectedTitle) {
        console.log(`⚠️  Article title mismatch: expected "${expectedTitle}", got "${updatedArticle.title}"`);
      }
      
      if (expectedContent && updatedArticle.content !== expectedContent) {
        console.log(`⚠️  Article content mismatch detected`);
        console.log(`Expected: ${expectedContent.substring(0, 100)}...`);
        console.log(`Actual: ${updatedArticle.content?.substring(0, 100)}...`);
        throw new Error('Article content was not updated with optimized content');
      }
      
      this.results.article.success = true;
      console.log('🎉 ARTICLE TEST PASSED!');
      
    } catch (error) {
      this.results.article.error = error.message;
      console.error('❌ ARTICLE TEST FAILED:', error.message);
      throw error;
    }
  }

  async run() {
    console.log('🚀 Starting E2E optimization pipeline test...\n');
    
    try {
      await this.testProductOptimization();
      await this.testArticleOptimization();
      
      console.log('\n🎊 ALL TESTS PASSED!');
      console.log('===================');
      console.log(`✅ Product optimization: ${this.results.product.success ? 'PASS' : 'FAIL'}`);
      console.log(`✅ Article optimization: ${this.results.article.success ? 'PASS' : 'FAIL'}`);
      
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
      
      console.log(`\n🔍 ROOT CAUSE ANALYSIS:`);
      console.log(`Last error: ${error.message}`);
      
      process.exit(1);
    }
  }
}

// Run the test
const test = new E2ETest();
test.run().catch(console.error);