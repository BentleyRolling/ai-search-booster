import axios from 'axios';
import { 
  runCitationMonitoring, 
  getCitationHistory, 
  getCitationStats, 
  sendCitationSummary,
  detectCitations,
  analyzeSentiment 
} from '../services/citations.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('Citation Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectCitations', () => {
    it('should detect citations in search results', async () => {
      const mockSearchResults = [
        {
          title: 'Best Coffee Brands 2024',
          url: 'https://tech-blog.com/coffee-review',
          snippet: 'Premium Organic Coffee from AcmeStore is the best choice for coffee lovers.',
        },
        {
          title: 'Top Tea Products',
          url: 'https://lifestyle.com/tea-guide',
          snippet: 'We tried various tea brands but nothing beats their Organic Tea selection.',
        },
      ];

      const mockProducts = [
        { id: '1', title: 'Premium Organic Coffee', handle: 'premium-coffee' },
        { id: '2', title: 'Organic Tea', handle: 'organic-tea' },
      ];

      mockedAxios.get.mockResolvedValue({
        data: { organic_results: mockSearchResults },
      });

      const citations = await detectCitations('test-shop.myshopify.com', mockProducts);

      expect(citations).toHaveLength(2);
      expect(citations[0]).toMatchObject({
        source: 'tech-blog.com',
        product_id: '1',
        product_title: 'Premium Organic Coffee',
        url: 'https://tech-blog.com/coffee-review',
        context: expect.stringContaining('Premium Organic Coffee'),
        confidence: expect.any(Number),
      });
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const citations = await detectCitations('test-shop.myshopify.com', []);

      expect(citations).toEqual([]);
    });

    it('should filter out low-confidence matches', async () => {
      const mockSearchResults = [
        {
          title: 'Random Article',
          url: 'https://example.com/article',
          snippet: 'This is a random article with no product mentions.',
        },
      ];

      const mockProducts = [
        { id: '1', title: 'Premium Organic Coffee', handle: 'premium-coffee' },
      ];

      mockedAxios.get.mockResolvedValue({
        data: { organic_results: mockSearchResults },
      });

      const citations = await detectCitations('test-shop.myshopify.com', mockProducts);

      expect(citations).toHaveLength(0);
    });
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment', () => {
      const text = 'This product is amazing and I love it! Best purchase ever.';
      const sentiment = analyzeSentiment(text);

      expect(sentiment).toBe('positive');
    });

    it('should analyze negative sentiment', () => {
      const text = 'Terrible product, worst experience ever. Hate it.';
      const sentiment = analyzeSentiment(text);

      expect(sentiment).toBe('negative');
    });

    it('should analyze neutral sentiment', () => {
      const text = 'The product arrived yesterday and it works as expected.';
      const sentiment = analyzeSentiment(text);

      expect(sentiment).toBe('neutral');
    });

    it('should handle empty text', () => {
      const sentiment = analyzeSentiment('');
      expect(sentiment).toBe('neutral');
    });
  });

  describe('runCitationMonitoring', () => {
    it('should run complete citation monitoring process', async () => {
      const mockProducts = [
        { id: '1', title: 'Premium Coffee', handle: 'premium-coffee' },
      ];

      const mockSearchResults = [
        {
          title: 'Coffee Review',
          url: 'https://blog.com/review',
          snippet: 'Premium Coffee from TestStore is excellent.',
        },
      ];

      // Mock Shopify API call
      mockedAxios.get.mockResolvedValueOnce({
        data: { products: mockProducts },
      });

      // Mock search API call
      mockedAxios.get.mockResolvedValueOnce({
        data: { organic_results: mockSearchResults },
      });

      const citations = await runCitationMonitoring(
        'test-shop.myshopify.com',
        ['premium', 'coffee'],
        'test-access-token'
      );

      expect(citations).toHaveLength(1);
      expect(citations[0]).toMatchObject({
        source: 'blog.com',
        product_id: '1',
        product_title: 'Premium Coffee',
        sentiment: expect.any(String),
      });
    });

    it('should handle Shopify API errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Shopify API Error'));

      const citations = await runCitationMonitoring(
        'test-shop.myshopify.com',
        ['premium'],
        'test-access-token'
      );

      expect(citations).toEqual([]);
    });
  });

  describe('getCitationHistory', () => {
    it('should return paginated citation history', async () => {
      const mockCitations = [
        {
          id: 'cit-1',
          shop: 'test-shop.myshopify.com',
          source: 'blog.com',
          product_id: '1',
          product_title: 'Premium Coffee',
          url: 'https://blog.com/review',
          timestamp: new Date().toISOString(),
          sentiment: 'positive',
        },
        {
          id: 'cit-2',
          shop: 'test-shop.myshopify.com',
          source: 'reddit.com',
          product_id: '2',
          product_title: 'Organic Tea',
          url: 'https://reddit.com/r/tea/post',
          timestamp: new Date().toISOString(),
          sentiment: 'neutral',
        },
      ];

      // Mock database call (in real implementation, this would be a database query)
      const result = await getCitationHistory('test-shop.myshopify.com', 10, 0);

      expect(result).toHaveProperty('citations');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('has_more');
      expect(typeof result.total).toBe('number');
      expect(typeof result.has_more).toBe('boolean');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const result = await getCitationHistory('invalid-shop', 10, 0);

      expect(result).toEqual({
        citations: [],
        total: 0,
        has_more: false,
      });
    });
  });

  describe('getCitationStats', () => {
    it('should return citation statistics', async () => {
      const stats = await getCitationStats('test-shop.myshopify.com');

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('recent');
      expect(stats).toHaveProperty('by_source');
      expect(stats).toHaveProperty('by_sentiment');
      expect(stats).toHaveProperty('by_product');
      expect(typeof stats.total).toBe('number');
      expect(Array.isArray(stats.recent)).toBe(true);
      expect(typeof stats.by_source).toBe('object');
      expect(typeof stats.by_sentiment).toBe('object');
    });

    it('should handle empty statistics', async () => {
      const stats = await getCitationStats('empty-shop.myshopify.com');

      expect(stats.total).toBe(0);
      expect(stats.recent).toHaveLength(0);
      expect(Object.keys(stats.by_source)).toHaveLength(0);
      expect(Object.keys(stats.by_sentiment)).toHaveLength(0);
    });
  });

  describe('sendCitationSummary', () => {
    it('should send citation summary email', async () => {
      const mockCitations = [
        {
          id: 'cit-1',
          source: 'blog.com',
          product_title: 'Premium Coffee',
          url: 'https://blog.com/review',
          sentiment: 'positive',
        },
      ];

      // Mock email service
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await sendCitationSummary('test-shop.myshopify.com', mockCitations);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('email'),
        expect.objectContaining({
          to: expect.any(String),
          subject: expect.stringContaining('Citation'),
          html: expect.stringContaining('Premium Coffee'),
        })
      );
    });

    it('should handle email service errors', async () => {
      const mockCitations = [
        {
          id: 'cit-1',
          source: 'blog.com',
          product_title: 'Premium Coffee',
        },
      ];

      mockedAxios.post.mockRejectedValue(new Error('Email service error'));

      // Should not throw error
      await expect(sendCitationSummary('test-shop.myshopify.com', mockCitations))
        .resolves.not.toThrow();
    });

    it('should skip sending empty citation summaries', async () => {
      await sendCitationSummary('test-shop.myshopify.com', []);

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});