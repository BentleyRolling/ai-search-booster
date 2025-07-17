// Citation monitoring job scheduler
// Handles periodic citation monitoring for optimized content

const citationMonitoringJobs = new Map();

/**
 * Initialize citation monitoring scheduler
 * @param {Function} monitoringFunction - Function to run citation monitoring
 */
const initCitationJobs = (monitoringFunction) => {
  console.log('[CITATION-SCHEDULER] Initializing citation monitoring jobs...');
  
  // Clean up existing jobs
  citationMonitoringJobs.forEach(jobId => clearInterval(jobId));
  citationMonitoringJobs.clear();
  
  // Start monitoring will be handled by API endpoints
  console.log('[CITATION-SCHEDULER] Citation scheduler ready');
};

/**
 * Start citation monitoring for a shop
 * @param {string} shop - Shop domain
 * @param {Function} monitoringFunction - Function to run monitoring
 * @param {Object} options - Monitoring options
 */
const startCitationMonitoring = (shop, monitoringFunction, options = {}) => {
  const { interval = 'daily', keywords = [] } = options;
  
  // Stop existing monitoring if running
  if (citationMonitoringJobs.has(shop)) {
    clearInterval(citationMonitoringJobs.get(shop));
  }
  
  // Start new monitoring job
  const intervalMs = interval === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const jobId = setInterval(() => {
    monitoringFunction(shop, keywords);
  }, intervalMs);
  
  citationMonitoringJobs.set(shop, jobId);
  
  // Run initial monitoring after 5 seconds
  setTimeout(() => monitoringFunction(shop, keywords), 5000);
  
  return {
    shop,
    interval,
    keywords,
    next_run: new Date(Date.now() + intervalMs).toISOString()
  };
};

/**
 * Stop citation monitoring for a shop
 * @param {string} shop - Shop domain
 */
const stopCitationMonitoring = (shop) => {
  if (citationMonitoringJobs.has(shop)) {
    clearInterval(citationMonitoringJobs.get(shop));
    citationMonitoringJobs.delete(shop);
    return true;
  }
  return false;
};

/**
 * Check if monitoring is active for a shop
 * @param {string} shop - Shop domain
 */
const isMonitoringActive = (shop) => {
  return citationMonitoringJobs.has(shop);
};

/**
 * Get all active monitoring jobs
 */
const getActiveJobs = () => {
  return Array.from(citationMonitoringJobs.keys());
};

/**
 * Cleanup all monitoring jobs
 */
const cleanupJobs = () => {
  citationMonitoringJobs.forEach(jobId => clearInterval(jobId));
  citationMonitoringJobs.clear();
  console.log('[CITATION-SCHEDULER] All monitoring jobs stopped');
};

module.exports = {
  initCitationJobs,
  startCitationMonitoring,
  stopCitationMonitoring,
  isMonitoringActive,
  getActiveJobs,
  cleanupJobs
};