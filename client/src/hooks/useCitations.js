import { useState, useEffect } from 'react';
import { useAuthenticatedFetch } from '../contexts/AuthContext';

/**
 * Custom hook for managing citation monitoring
 * @param {string} shop - Shop domain
 */
export const useCitations = (shop) => {
  const { authFetch } = useAuthenticatedFetch();
  const [citations, setCitations] = useState([]);
  const [stats, setStats] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = '';

  // Fetch citation status and data
  const fetchCitationData = async () => {
    console.log('fetchCitationData called: shop=', shop, 'authFetch=', !!authFetch);
    if (!shop || !authFetch) {
      console.log('fetchCitationData: Missing requirements, returning early');
      return;
    }

    try {
      console.log('fetchCitationData: Starting fetch...');
      setLoading(true);
      setError(null);

      // Fetch status and stats in parallel
      const [statusRes, statsRes] = await Promise.all([
        authFetch(`${API_BASE}/api/monitoring/status?shop=${shop}`),
        authFetch(`${API_BASE}/api/monitoring/stats?shop=${shop}`)
      ]);

      console.log('fetchCitationData: Got responses:', statusRes.status, statsRes.status);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        console.log('fetchCitationData: Status data:', statusData);
        setIsMonitoring(statusData.monitoring_active);
        setCitations(statusData.recent_citations || []);
      } else {
        console.log('fetchCitationData: Status response not ok:', statusRes.status);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log('fetchCitationData: Stats data:', statsData);
        setStats(statsData.statistics);
      } else {
        console.log('fetchCitationData: Stats response not ok:', statsRes.status);
      }
    } catch (err) {
      console.error('Error fetching citation data:', err);
      setError('Failed to fetch citation data');
    } finally {
      console.log('fetchCitationData: Setting loading to false');
      setLoading(false);
    }
  };

  // Start citation monitoring
  const startMonitoring = async (options = {}) => {
    if (!shop || !authFetch) return false;

    try {
      const response = await authFetch(`${API_BASE}/api/monitoring/start?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });

      if (response.ok) {
        setIsMonitoring(true);
        await fetchCitationData(); // Refresh data
        return true;
      }
    } catch (err) {
      console.error('Error starting monitoring:', err);
      setError('Failed to start monitoring');
    }
    return false;
  };

  // Stop citation monitoring
  const stopMonitoring = async () => {
    if (!shop || !authFetch) return false;

    try {
      const response = await authFetch(`${API_BASE}/api/monitoring/stop?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop })
      });

      if (response.ok) {
        setIsMonitoring(false);
        await fetchCitationData(); // Refresh data
        return true;
      }
    } catch (err) {
      console.error('Error stopping monitoring:', err);
      setError('Failed to stop monitoring');
    }
    return false;
  };

  // Fetch citation history with pagination
  const fetchCitationHistory = async (limit = 50, offset = 0) => {
    if (!shop || !authFetch) return { citations: [], total: 0 };

    try {
      const response = await authFetch(
        `${API_BASE}/api/monitoring/citations?shop=${shop}&limit=${limit}&offset=${offset}`
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Error fetching citation history:', err);
      setError('Failed to fetch citation history');
    }
    return { citations: [], total: 0 };
  };

  // Initialize data on mount
  useEffect(() => {
    console.log('useCitations: shop=', shop, 'authFetch=', !!authFetch, 'loading=', loading);
    if (shop && authFetch) {
      fetchCitationData();
    } else {
      // If we don't have required data, stop loading to prevent endless disabled state
      setLoading(false);
    }
  }, [shop, authFetch]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchCitationData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [shop, authFetch]);

  return {
    citations,
    stats,
    isMonitoring,
    loading,
    error,
    startMonitoring,
    stopMonitoring,
    fetchCitationHistory,
    refresh: fetchCitationData
  };
};