import request from 'supertest';
import express from 'express';
import { initializeCitationRoutes } from '../routes/citations.js';
import { 
  startCitationMonitoring, 
  stopCitationMonitoring, 
  isMonitoringActive 
} from '../jobs/citationScheduler.js';
import { 
  runCitationMonitoring, 
  getCitationHistory, 
  getCitationStats 
} from '../services/citations.js';

// Mock dependencies
jest.mock('../jobs/citationScheduler.js');
jest.mock('../services/citations.js');

describe('Citation Monitoring API', () => {
  let app;
  let shopDataStore;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock shop data store
    shopDataStore = new Map();
    shopDataStore.set('test-shop.myshopify.com', {
      accessToken: 'test-token',
      installedAt: new Date().toISOString(),
    });
    
    // Initialize routes
    app.use('/api/monitoring', initializeCitationRoutes(shopDataStore));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/monitoring/start', () => {
    it('should start citation monitoring successfully', async () => {
      const mockResult = {
        jobId: 'test-job-123',
        interval: 'daily',
        startTime: new Date().toISOString(),
      };

      startCitationMonitoring.mockReturnValue(mockResult);

      const response = await request(app)
        .post('/api/monitoring/start')
        .query({ shop: 'test-shop.myshopify.com' })
        .send({
          interval: 'daily',
          keywords: ['premium', 'organic'],
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Citation monitoring started successfully');
      expect(response.body.jobId).toBe('test-job-123');
      expect(startCitationMonitoring).toHaveBeenCalledWith(
        'test-shop.myshopify.com',
        expect.any(Function),
        { interval: 'daily', keywords: ['premium', 'organic'] }
      );
    });

    it('should return 400 for missing shop parameter', async () => {
      const response = await request(app)
        .post('/api/monitoring/start')
        .send({
          interval: 'daily',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing shop parameter');
    });

    it('should handle errors gracefully', async () => {
      startCitationMonitoring.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .post('/api/monitoring/start')
        .query({ shop: 'test-shop.myshopify.com' })
        .send({
          interval: 'daily',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to start citation monitoring');
    });
  });

  describe('POST /api/monitoring/stop', () => {
    it('should stop citation monitoring successfully', async () => {
      stopCitationMonitoring.mockReturnValue(true);

      const response = await request(app)
        .post('/api/monitoring/stop')
        .query({ shop: 'test-shop.myshopify.com' })
        .send({
          shop: 'test-shop.myshopify.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Citation monitoring stopped successfully');
      expect(stopCitationMonitoring).toHaveBeenCalledWith('test-shop.myshopify.com');
    });

    it('should handle non-existent monitoring job', async () => {
      stopCitationMonitoring.mockReturnValue(false);

      const response = await request(app)
        .post('/api/monitoring/stop')
        .query({ shop: 'test-shop.myshopify.com' })
        .send({
          shop: 'test-shop.myshopify.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('No citation monitoring job found for this shop');
    });
  });

  describe('GET /api/monitoring/status', () => {
    it('should return monitoring status successfully', async () => {
      const mockStats = {
        total: 25,
        recent: [
          {
            id: 'citation-1',
            source: 'tech-blog.com',
            product_title: 'Premium Coffee',
            timestamp: new Date().toISOString(),
          },
        ],
        by_source: {
          'tech-blog.com': 10,
          'reddit.com': 15,
        },
        by_sentiment: {
          positive: 20,
          neutral: 3,
          negative: 2,
        },
      };

      isMonitoringActive.mockReturnValue(true);
      getCitationStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/monitoring/status')
        .query({ shop: 'test-shop.myshopify.com' });

      expect(response.status).toBe(200);
      expect(response.body.shop).toBe('test-shop.myshopify.com');
      expect(response.body.monitoring_active).toBe(true);
      expect(response.body.total_citations).toBe(25);
      expect(response.body.recent_citations).toHaveLength(1);
      expect(response.body.stats.by_source).toEqual(mockStats.by_source);
    });

    it('should handle inactive monitoring', async () => {
      isMonitoringActive.mockReturnValue(false);
      getCitationStats.mockResolvedValue({
        total: 0,
        recent: [],
        by_source: {},
        by_sentiment: {},
      });

      const response = await request(app)
        .get('/api/monitoring/status')
        .query({ shop: 'test-shop.myshopify.com' });

      expect(response.status).toBe(200);
      expect(response.body.monitoring_active).toBe(false);
      expect(response.body.total_citations).toBe(0);
    });
  });

  describe('GET /api/monitoring/citations', () => {
    it('should return citation history with pagination', async () => {
      const mockResult = {
        citations: [
          {
            id: 'citation-1',
            source: 'tech-blog.com',
            product_title: 'Premium Coffee',
            url: 'https://tech-blog.com/article-1',
            timestamp: new Date().toISOString(),
            sentiment: 'positive',
          },
          {
            id: 'citation-2',
            source: 'reddit.com',
            product_title: 'Organic Tea',
            url: 'https://reddit.com/r/tea/post-2',
            timestamp: new Date().toISOString(),
            sentiment: 'neutral',
          },
        ],
        total: 25,
        has_more: true,
      };

      getCitationHistory.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/monitoring/citations')
        .query({ 
          shop: 'test-shop.myshopify.com',
          limit: 10,
          offset: 0,
        });

      expect(response.status).toBe(200);
      expect(response.body.citations).toHaveLength(2);
      expect(response.body.total).toBe(25);
      expect(response.body.pagination.has_more).toBe(true);
      expect(getCitationHistory).toHaveBeenCalledWith('test-shop.myshopify.com', 10, 0);
    });

    it('should handle empty citation history', async () => {
      getCitationHistory.mockResolvedValue({
        citations: [],
        total: 0,
        has_more: false,
      });

      const response = await request(app)
        .get('/api/monitoring/citations')
        .query({ shop: 'test-shop.myshopify.com' });

      expect(response.status).toBe(200);
      expect(response.body.citations).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });
  });

  describe('GET /api/monitoring/stats', () => {
    it('should return citation statistics', async () => {
      const mockStats = {
        total: 50,
        recent: [],
        by_source: {
          'tech-blog.com': 20,
          'reddit.com': 15,
          'twitter.com': 10,
          'youtube.com': 5,
        },
        by_sentiment: {
          positive: 35,
          neutral: 10,
          negative: 5,
        },
        by_product: {
          'product-1': 25,
          'product-2': 15,
          'product-3': 10,
        },
      };

      getCitationStats.mockResolvedValue(mockStats);
      isMonitoringActive.mockReturnValue(true);

      const response = await request(app)
        .get('/api/monitoring/stats')
        .query({ shop: 'test-shop.myshopify.com' });

      expect(response.status).toBe(200);
      expect(response.body.statistics).toEqual(mockStats);
      expect(response.body.monitoring_active).toBe(true);
    });
  });
});