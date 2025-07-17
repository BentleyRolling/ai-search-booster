import { 
  startCitationMonitoring, 
  stopCitationMonitoring, 
  isMonitoringActive,
  initCitationJobs,
  cleanupCitationJobs 
} from '../jobs/citationScheduler.js';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  destroy: jest.fn(),
}));

import cron from 'node-cron';

describe('Citation Scheduler', () => {
  let mockSchedule;
  let mockDestroy;

  beforeEach(() => {
    mockSchedule = jest.fn();
    mockDestroy = jest.fn();
    
    cron.schedule = mockSchedule;
    cron.destroy = mockDestroy;
    
    // Clear active jobs
    cleanupCitationJobs();
  });

  afterEach(() => {
    jest.clearAllMocks();
    cleanupCitationJobs();
  });

  describe('startCitationMonitoring', () => {
    it('should start monitoring with default daily interval', () => {
      const mockTask = jest.fn();
      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      const result = startCitationMonitoring('test-shop.myshopify.com', mockTask);

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 0 * * *', // Daily at midnight
        expect.any(Function),
        { scheduled: true }
      );
      expect(result.jobId).toBe('test-shop.myshopify.com');
      expect(result.interval).toBe('daily');
      expect(result.startTime).toBeDefined();
    });

    it('should start monitoring with custom hourly interval', () => {
      const mockTask = jest.fn();
      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      const result = startCitationMonitoring(
        'test-shop.myshopify.com', 
        mockTask, 
        { interval: 'hourly' }
      );

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 * * * *', // Every hour
        expect.any(Function),
        { scheduled: true }
      );
      expect(result.interval).toBe('hourly');
    });

    it('should start monitoring with custom weekly interval', () => {
      const mockTask = jest.fn();
      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      const result = startCitationMonitoring(
        'test-shop.myshopify.com', 
        mockTask, 
        { interval: 'weekly' }
      );

      expect(mockSchedule).toHaveBeenCalledWith(
        '0 0 * * 0', // Weekly on Sunday
        expect.any(Function),
        { scheduled: true }
      );
      expect(result.interval).toBe('weekly');
    });

    it('should replace existing monitoring job for same shop', () => {
      const mockTask = jest.fn();
      const mockJob1 = { destroy: mockDestroy };
      const mockJob2 = { destroy: jest.fn() };
      
      mockSchedule.mockReturnValueOnce(mockJob1).mockReturnValueOnce(mockJob2);

      // Start first job
      startCitationMonitoring('test-shop.myshopify.com', mockTask);
      
      // Start second job (should replace first)
      startCitationMonitoring('test-shop.myshopify.com', mockTask);

      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(mockSchedule).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid interval gracefully', () => {
      const mockTask = jest.fn();
      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      const result = startCitationMonitoring(
        'test-shop.myshopify.com', 
        mockTask, 
        { interval: 'invalid' }
      );

      // Should default to daily
      expect(mockSchedule).toHaveBeenCalledWith(
        '0 0 * * *',
        expect.any(Function),
        { scheduled: true }
      );
      expect(result.interval).toBe('daily');
    });
  });

  describe('stopCitationMonitoring', () => {
    it('should stop existing monitoring job', () => {
      const mockTask = jest.fn();
      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      // Start monitoring
      startCitationMonitoring('test-shop.myshopify.com', mockTask);
      
      // Stop monitoring
      const result = stopCitationMonitoring('test-shop.myshopify.com');

      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should return false for non-existent monitoring job', () => {
      const result = stopCitationMonitoring('non-existent-shop.myshopify.com');
      expect(result).toBe(false);
    });
  });

  describe('isMonitoringActive', () => {
    it('should return true for active monitoring job', () => {
      const mockTask = jest.fn();
      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      startCitationMonitoring('test-shop.myshopify.com', mockTask);
      
      const result = isMonitoringActive('test-shop.myshopify.com');
      expect(result).toBe(true);
    });

    it('should return false for inactive monitoring job', () => {
      const result = isMonitoringActive('non-existent-shop.myshopify.com');
      expect(result).toBe(false);
    });

    it('should return false after stopping monitoring', () => {
      const mockTask = jest.fn();
      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      startCitationMonitoring('test-shop.myshopify.com', mockTask);
      stopCitationMonitoring('test-shop.myshopify.com');
      
      const result = isMonitoringActive('test-shop.myshopify.com');
      expect(result).toBe(false);
    });
  });

  describe('initCitationJobs', () => {
    it('should initialize citation jobs on startup', () => {
      const mockShopData = new Map([
        ['shop1.myshopify.com', { accessToken: 'token1' }],
        ['shop2.myshopify.com', { accessToken: 'token2' }],
      ]);

      const mockJob = { destroy: mockDestroy };
      mockSchedule.mockReturnValue(mockJob);

      initCitationJobs(mockShopData);

      // Should start monitoring for all shops
      expect(mockSchedule).toHaveBeenCalledTimes(2);
      expect(isMonitoringActive('shop1.myshopify.com')).toBe(true);
      expect(isMonitoringActive('shop2.myshopify.com')).toBe(true);
    });

    it('should handle empty shop data', () => {
      const mockShopData = new Map();
      initCitationJobs(mockShopData);

      expect(mockSchedule).not.toHaveBeenCalled();
    });
  });

  describe('cleanupCitationJobs', () => {
    it('should cleanup all active jobs', () => {
      const mockTask = jest.fn();
      const mockJob1 = { destroy: jest.fn() };
      const mockJob2 = { destroy: jest.fn() };
      
      mockSchedule.mockReturnValueOnce(mockJob1).mockReturnValueOnce(mockJob2);

      // Start multiple jobs
      startCitationMonitoring('shop1.myshopify.com', mockTask);
      startCitationMonitoring('shop2.myshopify.com', mockTask);

      // Cleanup all jobs
      cleanupCitationJobs();

      expect(mockJob1.destroy).toHaveBeenCalledTimes(1);
      expect(mockJob2.destroy).toHaveBeenCalledTimes(1);
      expect(isMonitoringActive('shop1.myshopify.com')).toBe(false);
      expect(isMonitoringActive('shop2.myshopify.com')).toBe(false);
    });
  });
});