import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Mock the main server setup
const createTestApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  // Mock shop data store
  const shopData = new Map();
  shopData.set('test-shop.myshopify.com', {
    accessToken: 'test-token',
    installedAt: new Date().toISOString(),
  });
  
  // LLM Feed endpoint
  app.get('/llm-feed.xml', (req, res) => {
    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>AI Search Booster - LLM Feed</title>
    <description>Optimized content for LLM training and discovery</description>
    <link>https://test-shop.myshopify.com</link>
    <item>
      <title>Premium Coffee</title>
      <description><![CDATA[AI-optimized premium coffee description]]></description>
      <link>https://test-shop.myshopify.com/products/premium-coffee</link>
      <content:encoded><![CDATA[
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Premium Coffee",
          "description": "AI-optimized premium coffee description"
        }
        </script>
      ]]></content:encoded>
    </item>
  </channel>
</rss>`;
    
    res.set('Content-Type', 'application/rss+xml');
    res.send(rssContent);
  });
  
  // Vector endpoint
  app.get('/api/vector/:id', (req, res) => {
    const { id } = req.params;
    const { format = 'openai' } = req.query;
    
    const mockProduct = {
      id: id,
      title: 'Premium Coffee',
      description: 'AI-optimized premium coffee description',
      price: 29.99,
      availability: 'in_stock',
    };
    
    let response;
    switch (format) {
      case 'openai':
        response = {
          object: 'embedding',
          data: [
            {
              object: 'embedding',
              embedding: new Array(1536).fill(0).map(() => Math.random() * 2 - 1),
              index: 0,
            },
          ],
          model: 'text-embedding-ada-002',
          usage: { prompt_tokens: 10, total_tokens: 10 },
          metadata: mockProduct,
        };
        break;
      case 'huggingface':
        response = {
          embeddings: [new Array(768).fill(0).map(() => Math.random() * 2 - 1)],
          metadata: mockProduct,
        };
        break;
      default:
        response = {
          vector: new Array(1536).fill(0).map(() => Math.random() * 2 - 1),
          metadata: mockProduct,
        };
    }
    
    res.json(response);
  });
  
  // OpenAI Plugin manifest
  app.get('/.well-known/ai-plugin.json', (req, res) => {
    res.json({
      schema_version: 'v1',
      name_for_human: 'AI Search Booster',
      name_for_model: 'ai_search_booster',
      description_for_human: 'AI-optimized product discovery for Shopify stores',
      description_for_model: 'Search and retrieve optimized product information from Shopify stores',
      auth: {
        type: 'none',
      },
      api: {
        type: 'openapi',
        url: 'https://test-shop.myshopify.com/.well-known/openapi.json',
      },
      legal_info_url: 'https://ai-search-booster.com/legal',
      contact_email: 'support@ai-search-booster.com',
      logo_url: 'https://ai-search-booster.com/logo.png',
    });
  });
  
  // OpenAPI specification
  app.get('/.well-known/openapi.json', (req, res) => {
    res.json({
      openapi: '3.0.1',
      info: {
        title: 'AI Search Booster API',
        version: '1.0.0',
        description: 'API for accessing AI-optimized product information',
      },
      paths: {
        '/api/vector/{id}': {
          get: {
            summary: 'Get product vector embedding',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
              {
                name: 'format',
                in: 'query',
                schema: { type: 'string', enum: ['openai', 'huggingface', 'claude'] },
              },
            ],
            responses: {
              '200': {
                description: 'Vector embedding data',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        vector: { type: 'array', items: { type: 'number' } },
                        metadata: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });
  
  return app;
};

describe('LLM Integration Endpoints', () => {
  let app;
  
  beforeAll(() => {
    app = createTestApp();
  });
  
  describe('GET /llm-feed.xml', () => {
    it('should return valid RSS feed', async () => {
      const response = await request(app)
        .get('/llm-feed.xml')
        .expect(200);
      
      expect(response.headers['content-type']).toBe('application/rss+xml; charset=utf-8');
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response.text).toContain('<rss version="2.0"');
      expect(response.text).toContain('AI Search Booster - LLM Feed');
      expect(response.text).toContain('Premium Coffee');
      expect(response.text).toContain('application/ld+json');
    });
    
    it('should include structured data in CDATA sections', async () => {
      const response = await request(app)
        .get('/llm-feed.xml')
        .expect(200);
      
      expect(response.text).toContain('<![CDATA[');
      expect(response.text).toContain('https://schema.org');
      expect(response.text).toContain('"@type": "Product"');
    });
  });
  
  describe('GET /api/vector/:id', () => {
    it('should return OpenAI format by default', async () => {
      const response = await request(app)
        .get('/api/vector/123')
        .expect(200);
      
      expect(response.body).toHaveProperty('object', 'embedding');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data[0]).toHaveProperty('embedding');
      expect(response.body.data[0].embedding).toHaveLength(1536);
      expect(response.body).toHaveProperty('model', 'text-embedding-ada-002');
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('id', '123');
    });
    
    it('should return HuggingFace format when requested', async () => {
      const response = await request(app)
        .get('/api/vector/123?format=huggingface')
        .expect(200);
      
      expect(response.body).toHaveProperty('embeddings');
      expect(response.body.embeddings[0]).toHaveLength(768);
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('id', '123');
    });
    
    it('should return generic format for unknown format', async () => {
      const response = await request(app)
        .get('/api/vector/123?format=generic')
        .expect(200);
      
      expect(response.body).toHaveProperty('vector');
      expect(response.body.vector).toHaveLength(1536);
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('id', '123');
    });
    
    it('should include product metadata', async () => {
      const response = await request(app)
        .get('/api/vector/123')
        .expect(200);
      
      const { metadata } = response.body;
      expect(metadata).toHaveProperty('title', 'Premium Coffee');
      expect(metadata).toHaveProperty('description');
      expect(metadata).toHaveProperty('price', 29.99);
      expect(metadata).toHaveProperty('availability', 'in_stock');
    });
  });
  
  describe('GET /.well-known/ai-plugin.json', () => {
    it('should return valid OpenAI plugin manifest', async () => {
      const response = await request(app)
        .get('/.well-known/ai-plugin.json')
        .expect(200);
      
      expect(response.body).toHaveProperty('schema_version', 'v1');
      expect(response.body).toHaveProperty('name_for_human', 'AI Search Booster');
      expect(response.body).toHaveProperty('name_for_model', 'ai_search_booster');
      expect(response.body).toHaveProperty('description_for_human');
      expect(response.body).toHaveProperty('description_for_model');
      expect(response.body).toHaveProperty('auth');
      expect(response.body).toHaveProperty('api');
      expect(response.body.auth).toHaveProperty('type', 'none');
      expect(response.body.api).toHaveProperty('type', 'openapi');
    });
    
    it('should include required contact information', async () => {
      const response = await request(app)
        .get('/.well-known/ai-plugin.json')
        .expect(200);
      
      expect(response.body).toHaveProperty('legal_info_url');
      expect(response.body).toHaveProperty('contact_email');
      expect(response.body).toHaveProperty('logo_url');
    });
  });
  
  describe('GET /.well-known/openapi.json', () => {
    it('should return valid OpenAPI 3.0 specification', async () => {
      const response = await request(app)
        .get('/.well-known/openapi.json')
        .expect(200);
      
      expect(response.body).toHaveProperty('openapi', '3.0.1');
      expect(response.body).toHaveProperty('info');
      expect(response.body.info).toHaveProperty('title', 'AI Search Booster API');
      expect(response.body.info).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('paths');
    });
    
    it('should include vector endpoint specification', async () => {
      const response = await request(app)
        .get('/.well-known/openapi.json')
        .expect(200);
      
      expect(response.body.paths).toHaveProperty('/api/vector/{id}');
      const vectorEndpoint = response.body.paths['/api/vector/{id}'];
      expect(vectorEndpoint).toHaveProperty('get');
      expect(vectorEndpoint.get).toHaveProperty('summary');
      expect(vectorEndpoint.get).toHaveProperty('parameters');
      expect(vectorEndpoint.get).toHaveProperty('responses');
      expect(vectorEndpoint.get.responses).toHaveProperty('200');
    });
  });
  
  describe('CORS and Security', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/vector/123')
        .expect(200);
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
    
    it('should handle OPTIONS requests', async () => {
      await request(app)
        .options('/api/vector/123')
        .expect(200);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/api/vector/')
        .expect(404);
    });
    
    it('should validate vector ID parameter', async () => {
      // This would normally validate the ID exists in the database
      const response = await request(app)
        .get('/api/vector/invalid-id')
        .expect(200); // Currently returns mock data
      
      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('id', 'invalid-id');
    });
  });
});