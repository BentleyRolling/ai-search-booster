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
    if (!shop || !authFetch) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch status and stats in parallel
      const [statusRes, statsRes] = await Promise.all([
        authFetch(`${API_BASE}/api/monitoring/status?shop=${shop}`),
        authFetch(`${API_BASE}/api/monitoring/stats?shop=${shop}`)
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIsMonitoring(statusData.monitoring_active);
        setCitations(statusData.recent_citations || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.statistics);
      }
    } catch (err) {
      console.error('Error fetching citation data:', err);
      setError('Failed to fetch citation data');
    } finally {
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
    fetchCitationData();
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