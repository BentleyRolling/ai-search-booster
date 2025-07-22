#!/usr/bin/env node

import axios from 'axios';

// Configuration
const API_BASE = 'https://ai-search-booster-backend.onrender.com';

console.log('🔬 Debug Endpoint Test');
console.log(`API_BASE: ${API_BASE}`);
console.log('');

async function testDebugEndpoint() {
  try {
    const testData = {
      content: {
        id: '123456',
        title: "Men's Cotton T-Shirts",
        body_html: "Test collection",
        products_count: 15
      },
      type: 'collection',
      settings: {
        targetLLM: 'ChatGPT',
        keywords: ['cotton'],
        tone: 'professional'
      }
    };
    
    console.log('🧪 Testing debug endpoint with type:', testData.type);
    
    const response = await axios.post(`${API_BASE}/api/debug/prompt-selection`, testData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.promptType === 'collection') {
      console.log('🎉 SUCCESS: Collection condition is working in debug endpoint!');
    } else {
      console.log('❌ FAILURE: Collection condition not matching:', response.data.promptType);
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testDebugEndpoint();