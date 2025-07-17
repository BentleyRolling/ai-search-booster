import { renderHook, act } from '@testing-library/react';
import { useCitations } from '../hooks/useCitations';

// Mock AuthContext
const mockAuthFetch = jest.fn();
jest.mock('../contexts/AuthContext', () => ({
  useAuthenticatedFetch: () => ({
    authFetch: mockAuthFetch,
  }),
}));

describe('useCitations Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      expect(result.current.citations).toEqual([]);
      expect(result.current.stats).toBeNull();
      expect(result.current.isMonitoring).toBe(false);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Fetch Citation Data', () => {
    it('should fetch citation data successfully', async () => {
      const mockStatusResponse = {
        monitoring_active: true,
        recent_citations: [
          {
            id: 'cit-1',
            source: 'blog.com',
            product_title: 'Premium Coffee',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const mockStatsResponse = {
        statistics: {
          total: 25,
          by_source: { 'blog.com': 10, 'reddit.com': 15 },
          by_sentiment: { positive: 20, neutral: 3, negative: 2 },
        },
      };

      mockAuthFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatusResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockStatsResponse),
        });

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      // Wait for initial fetch
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.isMonitoring).toBe(true);
      expect(result.current.citations).toHaveLength(1);
      expect(result.current.stats).toEqual(mockStatsResponse.statistics);
      expect(result.current.error).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      mockAuthFetch.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to fetch citation data');
    });

    it('should handle HTTP errors', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to fetch citation data');
    });
  });

  describe('Start Monitoring', () => {
    it('should start monitoring successfully', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        const success = await result.current.startMonitoring({
          interval: 'daily',
          keywords: ['premium', 'organic'],
        });
        expect(success).toBe(true);
      });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/monitoring/start?shop=test-shop.myshopify.com',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interval: 'daily',
            keywords: ['premium', 'organic'],
          }),
        }
      );
    });

    it('should handle start monitoring errors', async () => {
      mockAuthFetch.mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        const success = await result.current.startMonitoring();
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe('Failed to start monitoring');
    });
  });

  describe('Stop Monitoring', () => {
    it('should stop monitoring successfully', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        const success = await result.current.stopMonitoring();
        expect(success).toBe(true);
      });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/monitoring/stop?shop=test-shop.myshopify.com',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop: 'test-shop.myshopify.com' }),
        }
      );
    });

    it('should handle stop monitoring errors', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        const success = await result.current.stopMonitoring();
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe('Failed to stop monitoring');
    });
  });

  describe('Fetch Citation History', () => {
    it('should fetch citation history with pagination', async () => {
      const mockResponse = {
        citations: [
          {
            id: 'cit-1',
            source: 'blog.com',
            product_title: 'Premium Coffee',
            timestamp: new Date().toISOString(),
          },
          {
            id: 'cit-2',
            source: 'reddit.com',
            product_title: 'Organic Tea',
            timestamp: new Date().toISOString(),
          },
        ],
        total: 25,
      };

      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        const history = await result.current.fetchCitationHistory(10, 0);
        expect(history).toEqual(mockResponse);
      });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/monitoring/citations?shop=test-shop.myshopify.com&limit=10&offset=0'
      );
    });

    it('should handle citation history errors', async () => {
      mockAuthFetch.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      await act(async () => {
        const history = await result.current.fetchCitationHistory();
        expect(history).toEqual({ citations: [], total: 0 });
      });

      expect(result.current.error).toBe('Failed to fetch citation history');
    });
  });

  describe('Auto-refresh', () => {
    it('should auto-refresh data every 5 minutes', async () => {
      mockAuthFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          monitoring_active: true,
          recent_citations: [],
        }),
      });

      renderHook(() => useCitations('test-shop.myshopify.com'));

      // Initial fetch
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockAuthFetch).toHaveBeenCalledTimes(2); // status + stats

      // Fast-forward 5 minutes
      act(() => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      });

      // Should trigger another fetch
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockAuthFetch).toHaveBeenCalledTimes(4); // 2 initial + 2 refresh
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing shop parameter', () => {
      const { result } = renderHook(() => useCitations(''));

      expect(result.current.loading).toBe(true);
      expect(mockAuthFetch).not.toHaveBeenCalled();
    });

    it('should handle missing authFetch', () => {
      mockAuthFetch.mockReturnValue(undefined);

      const { result } = renderHook(() => useCitations('test-shop.myshopify.com'));

      expect(result.current.loading).toBe(true);
      expect(mockAuthFetch).not.toHaveBeenCalled();
    });

    it('should cleanup interval on unmount', () => {
      const { unmount } = renderHook(() => useCitations('test-shop.myshopify.com'));

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});