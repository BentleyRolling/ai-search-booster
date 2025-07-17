import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../pages/Dashboard';

// Mock the hooks and context
const mockAuthFetch = jest.fn();
const mockApp = { dispatch: jest.fn() };
const mockRedirect = { dispatch: jest.fn() };

jest.mock('../contexts/AuthContext', () => ({
  useAuthenticatedFetch: () => ({
    authFetch: mockAuthFetch,
    isReady: true,
    app: mockApp,
  }),
}));

jest.mock('../hooks/useCitations', () => ({
  useCitations: () => ({
    citations: [
      {
        id: 'cit-1',
        source: 'blog.com',
        product_title: 'Premium Coffee',
        timestamp: new Date().toISOString(),
      },
    ],
    stats: {
      total: 25,
      by_source: { 'blog.com': 10, 'reddit.com': 15 },
      by_sentiment: { positive: 20, neutral: 3, negative: 2 },
    },
    isMonitoring: true,
    loading: false,
    error: null,
    startMonitoring: jest.fn(),
    stopMonitoring: jest.fn(),
    fetchCitationHistory: jest.fn(),
  }),
}));

jest.mock('@shopify/app-bridge/actions', () => ({
  Redirect: {
    create: () => mockRedirect,
  },
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock URL parameters
    Object.defineProperty(window, 'location', {
      value: {
        ...window.location,
        search: '?shop=test-shop.myshopify.com',
      },
      writable: true,
    });

    // Mock successful API responses
    mockAuthFetch.mockImplementation((url) => {
      if (url.includes('/api/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            shop: 'test-shop.myshopify.com',
            totalProducts: 100,
            optimizedProducts: 25,
            totalBlogs: 20,
            optimizedBlogs: 5,
            aiProvider: 'OpenAI',
            features: {
              productsOptimization: true,
              blogsOptimization: true,
              rollback: true,
              preview: true,
            },
          }),
        });
      }
      
      if (url.includes('/api/products')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            products: [
              {
                id: 1,
                title: 'Premium Coffee',
                handle: 'premium-coffee',
                vendor: 'AcmeStore',
                product_type: 'Beverage',
                optimized: true,
              },
              {
                id: 2,
                title: 'Organic Tea',
                handle: 'organic-tea',
                vendor: 'AcmeStore',
                product_type: 'Beverage',
                optimized: false,
              },
            ],
          }),
        });
      }
      
      if (url.includes('/api/blogs')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            blogs: [
              {
                id: 1,
                title: 'Coffee Guide',
                handle: 'coffee-guide',
                optimized: false,
                created_at: new Date().toISOString(),
              },
            ],
          }),
        });
      }
      
      if (url.includes('/api/history')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            history: [
              {
                id: 'hist-1',
                type: 'product',
                itemId: '1',
                version: 1,
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      }
      
      if (url.includes('/api/usage')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            shop: 'test-shop.myshopify.com',
            optimizations: { products: 25, blogs: 5, total: 30 },
            aiCalls: { today: 10, thisMonth: 50, total: 200 },
            limits: { monthlyOptimizations: 1000, dailyAICalls: 100 },
          }),
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe('Initial Render', () => {
    it('should render dashboard with correct header', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument(); // Total products
        expect(screen.getByText('25')).toBeInTheDocument(); // Optimized products
      });

      expect(screen.getByText('Total Products')).toBeInTheDocument();
      expect(screen.getByText('Optimized')).toBeInTheDocument();
    });

    it('should display citation monitoring status', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Monitoring')).toBeInTheDocument();
        expect(screen.getByText('25 citations')).toBeInTheDocument();
      });
    });
  });

  describe('Product Management', () => {
    it('should display products in grid layout', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
        expect(screen.getByText('Organic Tea')).toBeInTheDocument();
        expect(screen.getByText('✓ Optimized')).toBeInTheDocument();
      });
    });

    it('should allow product selection', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      const productCard = screen.getByText('Premium Coffee').closest('div');
      await user.click(productCard);

      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('should handle product optimization', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      // Select product
      const productCard = screen.getByText('Premium Coffee').closest('div');
      await user.click(productCard);

      // Mock optimization response
      mockAuthFetch.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          results: [{ status: 'success', productId: 1 }],
        }),
      }));

      // Click optimize button
      const optimizeButton = screen.getByText('Optimize Selected');
      await user.click(optimizeButton);

      await waitFor(() => {
        expect(mockAuthFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/optimize/products'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('productIds'),
          })
        );
      });
    });
  });

  describe('Draft/Publish Workflow', () => {
    it('should display preview and publish buttons', async () => {
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      const previewButtons = screen.getAllByText('Preview');
      const publishButtons = screen.getAllByText('Publish');

      expect(previewButtons.length).toBeGreaterThan(0);
      expect(publishButtons.length).toBeGreaterThan(0);
    });

    it('should handle draft preview', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      // Mock draft content response
      mockAuthFetch.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          hasDraft: true,
          hasLive: true,
          draft: {
            content: 'Draft optimized content',
            faq: {
              questions: [
                { question: 'Test question?', answer: 'Test answer' },
              ],
            },
            timestamp: new Date().toISOString(),
          },
          live: {
            content: 'Live content',
            faq: {
              questions: [
                { question: 'Live question?', answer: 'Live answer' },
              ],
            },
            timestamp: new Date().toISOString(),
          },
        }),
      }));

      const previewButton = screen.getAllByText('Preview')[0];
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Draft Preview - product 1')).toBeInTheDocument();
        expect(screen.getByText('Draft optimized content')).toBeInTheDocument();
        expect(screen.getByText('Live content')).toBeInTheDocument();
      });
    });

    it('should handle draft publishing', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      // Mock publish response
      mockAuthFetch.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: 'Draft published successfully',
        }),
      }));

      const publishButton = screen.getAllByText('Publish')[0];
      await user.click(publishButton);

      await waitFor(() => {
        expect(mockAuthFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/optimize/publish'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('resourceType'),
          })
        );
      });
    });
  });

  describe('Rollback Functionality', () => {
    it('should handle individual rollback', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      // Mock rollback response
      mockAuthFetch.mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: 'Rollback successful',
        }),
      }));

      // Mock window.confirm
      window.confirm = jest.fn(() => true);

      const rollbackButton = screen.getByText('Rollback');
      await user.click(rollbackButton);

      await waitFor(() => {
        expect(mockAuthFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rollback/product/1'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('should handle bulk rollback', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Rollback All')).toBeInTheDocument();
      });

      // Mock rollback response
      mockAuthFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          message: 'Rollback successful',
        }),
      }));

      // Mock window.confirm
      window.confirm = jest.fn(() => true);

      const rollbackAllButton = screen.getByText('Rollback All');
      await user.click(rollbackAllButton);

      await waitFor(() => {
        expect(mockAuthFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rollback/product/1'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });
  });

  describe('Settings Panel', () => {
    it('should toggle settings panel', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      expect(screen.getByText('Optimization Settings')).toBeInTheDocument();
      expect(screen.getByText('Target AI Platform')).toBeInTheDocument();
      expect(screen.getByText('Keywords (comma-separated)')).toBeInTheDocument();
      expect(screen.getByText('Tone')).toBeInTheDocument();
    });

    it('should update settings', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      const keywordsInput = screen.getByPlaceholderText('organic, sustainable, premium');
      await user.clear(keywordsInput);
      await user.type(keywordsInput, 'premium, quality, organic');

      expect(keywordsInput).toHaveValue('premium, quality, organic');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockAuthFetch.mockImplementation(() => Promise.reject(new Error('API Error')));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Sample Product 1')).toBeInTheDocument();
      });

      // Should fall back to mock data
      expect(screen.getByText('Sample Product 2')).toBeInTheDocument();
    });

    it('should display error state when critical error occurs', async () => {
      // Mock a critical error that prevents component rendering
      mockAuthFetch.mockImplementation(() => {
        throw new Error('Critical Error');
      });

      // Mock console.error to prevent test output noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
        expect(screen.getByText('Refresh Page')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('should display loading state initially', () => {
      // Mock isReady as false
      jest.mocked(require('../contexts/AuthContext').useAuthenticatedFetch).mockReturnValue({
        authFetch: mockAuthFetch,
        isReady: false,
        app: mockApp,
      });

      render(<Dashboard />);

      expect(screen.getByText('Initializing authentication...')).toBeInTheDocument();
    });

    it('should show optimization progress', async () => {
      const user = userEvent.setup();
      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Premium Coffee')).toBeInTheDocument();
      });

      // Select product
      const productCard = screen.getByText('Premium Coffee').closest('div');
      await user.click(productCard);

      // Mock slow optimization response
      mockAuthFetch.mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{ status: 'success', productId: 1 }],
          }),
        }), 100);
      }));

      const optimizeButton = screen.getByText('Optimize Selected');
      await user.click(optimizeButton);

      expect(screen.getByText('Optimizing...')).toBeInTheDocument();
    });
  });
});