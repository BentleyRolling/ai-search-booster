import React, { useState, useEffect } from 'react';
import QuotaToast from '../components/QuotaToast';
import AppBridgeActivation from '../components/AppBridgeActivation';
import AutoOptimizeToggle from '../components/AutoOptimizeToggle';
import UpgradeModal from '../components/UpgradeModal';
import ChatAssistant from '../components/ChatAssistant';
import SecureAdminDebug from './SecureAdminDebug';
import { AlertCircle, CheckCircle, RefreshCw, Eye, RotateCcw, Settings, Search, Sparkles, BookOpen, Package, X, Info, Monitor, Bell, TrendingUp, FileText, Globe, ChevronDown, HelpCircle, MessageSquare, Zap, Menu, ChevronLeft, ChevronRight, PanelLeft, Loader, Play, Square, Target, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useAuthenticatedFetch } from '../contexts/AuthContext';
import { Redirect } from '@shopify/app-bridge/actions';
import { useCitations } from '../hooks/useCitations';

const Dashboard = () => {
  const { authFetch, isReady, app } = useAuthenticatedFetch();
  const redirect = app ? Redirect.create(app) : null;
  
  // Add error state for better debugging
  const [error, setError] = useState(null);
  
  const [shop, setShop] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [articles, setArticles] = useState([]);
  const [pages, setPages] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedBlogs, setSelectedBlogs] = useState([]);
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [usage, setUsage] = useState(null);
  const [tierUsage, setTierUsage] = useState(null);
  const [settings, setSettings] = useState({
    targetLLM: 'general',
    keywords: '',
    tone: 'professional'
  });
  // Removed showSettings state - now handled by activeTab
  const [activeTab, setActiveTab] = useState('products');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);
  // Developer/admin toggle for Risk Score display (hidden from customers)
  const [showAdvancedDebugUI, setShowAdvancedDebugUI] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentCheckbox, setConsentCheckbox] = useState(false);
  const [checkingConsent, setCheckingConsent] = useState(true);
  const [showTermsPopup, setShowTermsPopup] = useState(false);
  const [showLegalRecords, setShowLegalRecords] = useState(false);
  const [legalRecordsData, setLegalRecordsData] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [optimizationProgress, setOptimizationProgress] = useState(null);
  const [autoOptimizeEnabled, setAutoOptimizeEnabled] = useState(false);
  const [autoOptimizeLoading, setAutoOptimizeLoading] = useState(false);
  const [autoOptimizeStatus, setAutoOptimizeStatus] = useState(null);
  const [testTier, setTestTier] = useState('Free');
  const [testTierLoading, setTestTierLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSecureAdmin, setShowSecureAdmin] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftContent, setDraftContent] = useState(new Map());
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  
  // Boost AI Discovery state
  const [boostAiCompletions, setBoostAiCompletions] = useState(() => {
    const saved = localStorage.getItem('boostAiCompletions');
    return saved ? JSON.parse(saved) : {};
  });

  // Handle Boost AI checkbox changes
  const handleBoostAiToggle = (sectionId) => {
    const newCompletions = {
      ...boostAiCompletions,
      [sectionId]: !boostAiCompletions[sectionId]
    };
    setBoostAiCompletions(newCompletions);
    localStorage.setItem('boostAiCompletions', JSON.stringify(newCompletions));
  };
  
  // Global error handler to prevent error boundary
  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      addNotification('An unexpected error occurred. Please try again.', 'error');
      event.preventDefault();
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Citation monitoring hook
  const { 
    citations, 
    stats, 
    isMonitoring, 
    loading: citationLoading,
    error: citationError,
    startMonitoring,
    stopMonitoring,
    fetchCitationHistory
  } = useCitations(shop);

  // Confirmation modal helper
  const showConfirmation = (title, message, onConfirm) => {
    setConfirmConfig({
      title,
      message,
      onConfirm
    });
    setShowConfirmModal(true);
  };

  const handleConfirmClose = () => {
    setShowConfirmModal(false);
    setConfirmConfig(null);
  };

  const handleConfirmAction = async () => {
    if (confirmConfig?.onConfirm) {
      try {
        await confirmConfig.onConfirm();
        // Always close the modal after successful operation
        handleConfirmClose();
      } catch (error) {
        console.error('Confirmation action error:', error);
        addNotification('Operation failed. Please try again.', 'error');
        // Close modal even if error occurred
        handleConfirmClose();
      }
    } else {
      handleConfirmClose();
    }
  };

  // Always use relative paths - AuthContext will convert to absolute backend URLs
  const API_BASE = '';

  // Notification system
  const addNotification = (message, type = 'info', duration = 5000) => {
    const id = Date.now().toString();
    const notification = { id, message, type, timestamp: new Date() };
    setNotifications(prev => [...prev, notification]);
    
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Consent management functions
  const checkConsentStatus = async (shopParam) => {
    try {
      const response = await authFetch(`${API_BASE}/api/consent/status?shop=${shopParam}`);
      if (!response.ok) {
        console.log('Consent status check failed, showing modal');
        return false;
      }
      const data = await response.json();
      return data.hasConsent === true;
    } catch (error) {
      console.error('Error checking consent status:', error);
      return false;
    }
  };

  const handleConsentAccept = async () => {
    if (!consentCheckbox) {
      addNotification('Please check the confirmation box to continue', 'warning');
      return;
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shopParam = urlParams.get('shop');
      
      const response = await authFetch(`${API_BASE}/api/consent/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopParam })
      });

      if (response.ok) {
        setShowConsentModal(false);
        addNotification('Terms accepted. Welcome to AI Search Booster!', 'success');
      } else {
        throw new Error('Failed to record consent');
      }
    } catch (error) {
      console.error('Error accepting consent:', error);
      addNotification('Failed to record consent. Please try again.', 'error');
    }
  };

  const resetConsent = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shopParam = urlParams.get('shop');
      
      const response = await authFetch(`${API_BASE}/api/consent/reset?shop=${shopParam}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        addNotification('Consent reset successfully. Refresh to see the modal again.', 'success');
      } else {
        throw new Error('Failed to reset consent');
      }
    } catch (error) {
      console.error('Error resetting consent:', error);
      addNotification('Failed to reset consent. Please try again.', 'error');
    }
  };

  const viewConsentRecords = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const shopParam = urlParams.get('shop');
      
      const response = await authFetch(`${API_BASE}/api/consent/records?shop=${shopParam}`);

      if (response.ok) {
        const data = await response.json();
        console.log('=== CONSENT RECORDS FOR LEGAL VERIFICATION ===');
        console.log('Shop:', data.shop);
        console.log('Retrieved at:', data.retrievedAt);
        console.log('Shopify Metafields:', data.shopifyMetafields);
        console.log('Server Logs:', data.serverLogs);
        console.log('Legal Note:', data.legalNote);
        console.log('============================================');
        
        // Store data and show popup
        setLegalRecordsData(data);
        setShowLegalRecords(true);
        
      } else {
        throw new Error('Failed to fetch consent records');
      }
    } catch (error) {
      console.error('Error fetching consent records:', error);
      addNotification('Failed to fetch consent records. Please try again.', 'error');
    }
  };

  useEffect(() => {
    try {
      // Get shop from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const shopParam = urlParams.get('shop');
      console.log('[ASB-DEBUG] Dashboard: Shop parameter:', shopParam);
      console.log('[ASB-DEBUG] Dashboard: Auth fetch ready:', isReady);
      console.log('[ASB-DEBUG] Dashboard: Auth fetch function:', typeof authFetch);
      console.log('[ASB-DEBUG] Dashboard: window.authenticatedFetch type:', typeof window.authenticatedFetch);
      
      if (shopParam) {
        setShop(shopParam);
        
        // Wait for authFetch to be ready before checking consent and loading data
        if (isReady && authFetch) {
          console.log('[ASB-DEBUG] Dashboard: Checking consent status first');
          
          // Check consent status first
          checkConsentStatus(shopParam).then(hasConsent => {
            setCheckingConsent(false);
            
            if (!hasConsent) {
              console.log('No consent found, showing modal');
              setShowConsentModal(true);
              setLoading(false);
              return;
            }
            
            console.log('[ASB-DEBUG] Dashboard: Consent verified, loading data');
            
            // Set loading to false after a timeout to prevent endless loading
            const loadingTimeout = setTimeout(() => {
              console.log('Dashboard: Setting loading to false after timeout');
              setLoading(false);
            }, 5000);
            
            // Fetch data with individual error handling
            Promise.allSettled([
            fetchStatus(shopParam),
            fetchHistory(shopParam),
            fetchProducts(shopParam),
            fetchBlogs(shopParam),
            fetchPages(shopParam),
            fetchCollections(shopParam),
            fetchUsage(shopParam),
            fetchAutoOptimizeSettings(shopParam),
            fetchTestTier(shopParam)
          ]).then(() => {
            clearTimeout(loadingTimeout);
            setLoading(false);
            console.log('Dashboard: All data fetched, loading complete');
          }).catch(error => {
            console.error('[ASB-DEBUG] Dashboard: Promise.allSettled error:', error);
            clearTimeout(loadingTimeout);
            setLoading(false);
            setError(error);
          });
          }).catch(error => {
            console.error('Error checking consent:', error);
            setCheckingConsent(false);
            setLoading(false);
          });
        } else {
          console.log('Dashboard: Waiting for auth fetch to be ready...');
        }
      } else {
        console.log('Dashboard: No shop parameter found');
        setLoading(false);
      }
    } catch (error) {
      console.error('[ASB-DEBUG] Dashboard: useEffect error:', error);
      setError(error);
      setLoading(false);
    }
  }, [isReady, authFetch]); // Re-run when authFetch becomes ready

  // Clear optimization progress when switching tabs
  useEffect(() => {
    setOptimizationProgress(null);
  }, [activeTab]);

  // Make debug UI toggle available in console for developers
  useEffect(() => {
    window.enableDebugUI = () => {
      setShowAdvancedDebugUI(true);
      console.log('🔧 Advanced Debug UI enabled - Risk Score now visible in previews');
    };
    window.disableDebugUI = () => {
      setShowAdvancedDebugUI(false);
      console.log('🔧 Advanced Debug UI disabled - Risk Score hidden from customers');
    };
    return () => {
      delete window.enableDebugUI;
      delete window.disableDebugUI;
    };
  }, []);

  // Refresh auto-optimize status when enabled
  useEffect(() => {
    if (autoOptimizeEnabled && shop) {
      const interval = setInterval(() => {
        fetchAutoOptimizeStatus();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [autoOptimizeEnabled, shop]);

  // Utility function to add timeout to requests
  const fetchWithTimeout = async (url, options = {}, timeout = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await authFetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      throw error;
    }
  };

  // ContentCard component matching exact reference design
  const ContentCard = ({ 
    item, 
    type, 
    isSelected, 
    onToggleSelect, 
    onPreview, 
    onPublish, 
    onRollback,
    title,
    subtitle
  }) => (
    <div 
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected 
          ? 'border-blue-500 bg-blue-900/20' 
          : 'border-dark-border hover:border-gray-300'
      }`}
      onClick={() => onToggleSelect(item.id)}
    >
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1"
        />
        <div className="flex-1">
          <h4 className="font-medium text-white">{title}</h4>
          {subtitle && <p className="text-sm text-gray-300 mt-1">{subtitle}</p>}
          
          {/* Responsive badges and buttons */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Status Badges */}
            {item.rollbackTriggered && (
              <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded font-medium">
                <AlertCircle className="w-3 h-3 mr-1" />
                ⚠️ Rolled Back
              </span>
            )}
            {item.optimized && !item.rollbackTriggered && (
              <span className="inline-flex items-center px-3 py-1.5 bg-green-900 text-green-300 border border-green-500 text-xs rounded-full font-medium hover:bg-green-800 transition-colors">
                ✓ Optimized
              </span>
            )}
            {item.hasDraft && !item.rollbackTriggered && !item.optimized && (
              <span className="inline-flex items-center px-3 py-1.5 bg-white/10 text-white text-xs rounded-full font-medium border border-white/20 hover:bg-white/20 transition-all duration-200">
                <FileText className="w-3 h-3 mr-1" />
                Draft Ready
              </span>
            )}
            
            {/* Action Buttons */}
            {item.hasDraft && !item.optimized && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(type, item.id);
                }}
                className="inline-flex items-center px-3 py-1.5 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 text-xs rounded-full font-medium border border-blue-700/50 hover:border-blue-500/50 transition-all duration-200"
                title="Preview draft content"
              >
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </button>
            )}
            {item.hasDraft && !item.optimized && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPublish(type, item.id);
                }}
                className="inline-flex items-center px-3 py-1.5 bg-green-900/30 text-green-300 hover:bg-green-900/50 text-xs rounded-full font-medium border border-green-700/50 hover:border-green-500/50 transition-all duration-200"
                title="Publish draft content"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Publish
              </button>
            )}
            {item.optimized && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRollback(type, item.id);
                }}
                className="inline-flex items-center px-3 py-1.5 bg-red-900 text-red-300 border border-red-500 text-xs rounded-full font-medium hover:bg-red-800 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-200"
                title="Rollback to original content"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Rollback
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const fetchStatus = async (shopName) => {
    try {
      console.log('[ASB-DEBUG] Dashboard: Fetching status for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/status?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('[ASB-DEBUG] Dashboard: Status data received:', data);
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      // Set fallback status to prevent blocking
      setStatus({
        shop: shopName,
        totalProducts: 0,
        totalBlogs: 0,
        optimizedProducts: 0,
        optimizedBlogs: 0,
        aiProvider: 'Unknown',
        features: {
          productsOptimization: true,
          blogsOptimization: true,
          rollback: true,
          preview: true,
          versioning: false
        }
      });
    }
  };

  const fetchHistory = async (shopName) => {
    try {
      const response = await authFetch(`${API_BASE}/api/history/${shopName}?shop=${shopName}`);
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchProducts = async (shopName) => {
    try {
      const url = `${API_BASE}/api/products?shop=${shopName}`;
      console.log('[ASB-DEBUG] Dashboard: Fetching products for shop:', shopName);
      console.log('[ASB-DEBUG] Dashboard: Full URL being fetched:', url);
      console.log('[ASB-DEBUG] Dashboard: API_BASE:', API_BASE);
      console.log('[ASB-DEBUG] Dashboard: authFetch function:', typeof authFetch);
      
      console.log('[ASB-DEBUG] Dashboard: About to call authFetch...');
      const response = await authFetch(url);
      console.log('[ASB-DEBUG] Dashboard: authFetch response received:', response);
      console.log('[ASB-DEBUG] Dashboard: Response status:', response.status, response.statusText);
      console.log('[ASB-DEBUG] Dashboard: Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ASB-DEBUG] Dashboard: Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      console.log('[ASB-DEBUG] Dashboard: Products data received:', data);
      setProducts(data.products || []);
    } catch (error) {
      console.error('[ASB-DEBUG] Dashboard: fetchProducts error:', error);
      console.error('[ASB-DEBUG] Dashboard: Error stack:', error.stack);
      
      // Don't clear products on fetch error - keep existing products displayed
      console.log('[ASB-DEBUG] Dashboard: Keeping existing products due to fetch error');
      addNotification('Failed to refresh products. Data may be outdated.', 'warning');
    }
  };

  const fetchBlogs = async (shopName) => {
    try {
      console.log('Dashboard: Fetching blogs for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/blogs?shop=${shopName}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Dashboard: Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      const data = await response.json();
      console.log('Dashboard: Blogs data received:', data);
      setBlogs(data.blogs || []);
      
      // Extract individual articles from blogs for the articles tab
      const allArticles = [];
      (data.blogs || []).forEach(blog => {
        if (blog.articles && blog.articles.length > 0) {
          blog.articles.forEach(article => {
            allArticles.push({
              ...article,
              blogId: blog.id,
              blogTitle: blog.title
            });
          });
        }
      });
      setArticles(allArticles);
      console.log('Dashboard: Extracted articles:', allArticles);
    } catch (error) {
      console.error('Failed to fetch blogs:', error);
      
      // Don't clear blogs on fetch error - keep existing blogs displayed
      console.log('Dashboard: Keeping existing blogs due to fetch error');
      addNotification('Failed to refresh blogs. Data may be outdated.', 'warning');
    }
  };

  const fetchPages = async (shopName) => {
    try {
      console.log('Dashboard: Fetching pages for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/pages?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dashboard: Pages data received:', data);
      setPages(data.pages || []);
    } catch (error) {
      console.error('Failed to fetch pages:', error);
      setPages([]);
    }
  };

  const fetchCollections = async (shopName) => {
    try {
      console.log('=== COLLECTIONS FRONTEND DEBUG ===');
      console.log('Shop name:', shopName);
      console.log('API_BASE:', API_BASE);
      console.log('Full URL:', `${API_BASE}/api/collections?shop=${shopName}`);
      
      const response = await authFetch(`${API_BASE}/api/collections?shop=${shopName}`);
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Collections response data:', JSON.stringify(data, null, 2));
      console.log('Collections array:', data.collections);
      console.log('Collections length:', data.collections?.length);
      console.log('Setting collections state to:', data.collections || []);
      
      setCollections(data.collections || []);
      
      // Debug state immediately after setting
      setTimeout(() => {
        console.log('Collections state after setState:', collections.length);
      }, 100);
    } catch (error) {
      console.error('Collections fetch error:', error);
      console.error('Error stack:', error.stack);
      // Don't clear existing collections on error - keep current state
      console.log('Keeping existing collections due to fetch error');
    }
  };

  const fetchUsage = async (shopName) => {
    try {
      console.log('Dashboard: Fetching tier-based usage for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/usage?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dashboard: Tier usage data received:', data);
      console.log('Dashboard: Setting tierUsage to:', {
        usageThisMonth: data.usageThisMonth,
        monthlyLimit: data.monthlyLimit,
        currentTier: data.currentTier,
        hasQuota: data.hasQuota
      });
      setTierUsage(data);
      
      // Keep legacy usage for backward compatibility
      setUsage({
        shop: shopName,
        optimizations: { products: 0, blogs: 0, total: data.usageThisMonth || 0 },
        aiCalls: { today: 0, thisMonth: 0, total: 0 },
        limits: { monthlyOptimizations: data.monthlyLimit || 10, dailyAICalls: 100 }
      });
    } catch (error) {
      console.error('Failed to fetch usage:', error);
      setTierUsage({
        usageThisMonth: 0,
        monthlyLimit: 25,
        currentTier: 'Free',
        hasQuota: true
      });
      setUsage({
        shop: shopName,
        optimizations: { products: 0, blogs: 0, total: 0 },
        aiCalls: { today: 0, thisMonth: 0, total: 0 },
        limits: { monthlyOptimizations: 25, dailyAICalls: 100 }
      });
    }
  };

  // Auto-optimization functions
  const fetchAutoOptimizeSettings = async (shopName) => {
    try {
      const response = await authFetch(`${API_BASE}/api/settings/auto-optimize?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setAutoOptimizeEnabled(data.autoOptimizeEnabled);
      return data;
    } catch (error) {
      console.error('Failed to fetch auto-optimize settings:', error);
      return { autoOptimizeEnabled: false, requiresPaidPlan: true };
    }
  };

  const toggleAutoOptimize = async (enabled) => {
    setAutoOptimizeLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/api/settings/auto-optimize?shop=${shop}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update auto-optimize setting');
      }

      const data = await response.json();
      setAutoOptimizeEnabled(enabled);
      addNotification(data.message, 'success');
      
      if (enabled) {
        fetchAutoOptimizeStatus();
      }
    } catch (error) {
      console.error('Failed to toggle auto-optimize:', error);
      addNotification(error.message, 'error');
    } finally {
      setAutoOptimizeLoading(false);
    }
  };

  const fetchAutoOptimizeStatus = async () => {
    try {
      const response = await authFetch(`${API_BASE}/api/auto-optimize/status?shop=${shop}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setAutoOptimizeStatus(data);
    } catch (error) {
      console.error('Failed to fetch auto-optimize status:', error);
    }
  };

  // Test tier functions
  const fetchTestTier = async (shopName) => {
    try {
      const response = await authFetch(`${API_BASE}/api/test/get-tier?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setTestTier(data.tier);
      return data;
    } catch (error) {
      console.error('Failed to fetch test tier:', error);
      return { tier: 'Free', isTestTier: false };
    }
  };

  const changeTestTier = async (newTier) => {
    setTestTierLoading(true);
    try {
      const response = await authFetch(`${API_BASE}/api/test/set-tier?shop=${shop}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier: newTier }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to set test tier');
      }

      const data = await response.json();
      setTestTier(newTier);
      
      // Refresh tier usage data to reflect new tier
      await fetchUsage(shop);
      
      // Refresh auto-optimize settings since tier changed
      await fetchAutoOptimizeSettings(shop);
      
      addNotification(`Test tier changed to ${newTier}`, 'success');
    } catch (error) {
      console.error('Failed to change test tier:', error);
      addNotification(error.message, 'error');
    } finally {
      setTestTierLoading(false);
    }
  };

  // Test function to verify app proxy routing
  const testProxyRouting = async () => {
    console.log('\n=== TESTING API ROUTING ===');
    console.log('1. Environment detection:');
    console.log('   - hostname:', window.location.hostname);
    console.log('   - API_BASE:', API_BASE);
    const envMode = import.meta.env.MODE;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    console.log('   - Environment mode:', envMode);
    console.log('   - Backend URL:', backendUrl);
    
    if (!isReady || !authFetch) {
      console.log('⚠️ Cannot test: Auth not ready yet');
      return;
    }
    
    const testUrl = `${API_BASE}/api/products?shop=${shop}`;
    console.log('2. Testing API call:');
    console.log('   - Relative URL passed to authFetch:', testUrl);
    console.log('   - Should be converted by AuthContext to backend URL');
    
    try {
      console.log('3. Making authenticated request...');
      const response = await authFetch(testUrl);
      console.log('4. Response received:');
      console.log('   - Status:', response.status);
      console.log('   - Response URL (where request actually went):', response.url);
      console.log('   - Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('5. ✅ SUCCESS - API call worked!');
        console.log('   - Data received:', data);
        console.log('   - Products count:', data.products?.length || 0);
        
        // Update products immediately to test the fix
        if (data.products) {
          setProducts(data.products);
          console.log('   - Updated products in state!');
        }
      } else {
        console.log('5. ❌ FAILED - Response not OK');
        const text = await response.text();
        console.log('   - Response body:', text);
      }
    } catch (error) {
      console.log('5. ❌ ERROR - Request failed:', error);
    }
    
    console.log('=== END TEST ===\n');
  };

  const optimizeProducts = async () => {
    console.log('optimizeProducts called, selectedProducts:', selectedProducts);
    console.log('selectedProducts.length:', selectedProducts.length);
    
    if (selectedProducts.length === 0) {
      console.log('No products selected, showing warning');
      addNotification('Please select products to optimize', 'warning');
      return;
    }
    
    console.log('Starting optimization for products:', selectedProducts);
    setOptimizing(true);
    setOptimizationProgress({ type: 'products', current: 0, total: selectedProducts.length });
    addNotification(`Starting optimization of ${selectedProducts.length} products...`, 'info');
    
    try {
      let successCount = 0;
      let failedCount = 0;
      
      // Process each product individually to show real progress
      for (let i = 0; i < selectedProducts.length; i++) {
        const productId = selectedProducts[i];
        
        try {
          console.log(`Optimizing product ${i + 1}/${selectedProducts.length}: ${productId}`);
          const response = await fetchWithTimeout(`${API_BASE}/api/optimize/products?shop=${shop}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop,
              productIds: [productId], // Send one product at a time
              settings: {
                targetLLM: settings.targetLLM,
                keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
                tone: settings.tone
              }
            })
          }, 60000); // 60 second timeout for AI optimization
          
          console.log(`Product ${productId} response status:`, response.status);
          
          if (!response.ok) {
            console.error(`Product ${productId} failed with status:`, response.status);
            failedCount++;
            continue;
          }
          
          const data = await response.json();
          console.log(`Product ${productId} response data:`, data);
          
          if (data.results && data.results[0]?.status === 'success') {
            successCount++;
            
            // Log quality scores for user awareness
            const result = data.results[0];
            if (result.riskScore !== undefined || result.visibilityScore !== undefined) {
              console.log(`Product ${productId} quality scores:`, {
                risk: result.riskScore,
                visibility: result.visibilityScore,
                rolledBack: result.rollbackTriggered
              });
              
              // Show specific feedback for high-risk items
              if (result.rollbackTriggered) {
                addNotification(`Product ID ${productId}: High-risk content detected, original preserved`, 'warning');
              } else if (showAdvancedDebugUI && result.riskScore > 0.5) {
                addNotification(`Product ID ${productId}: Optimized with medium risk score (${(result.riskScore * 100).toFixed(0)}%)`, 'info');
              }
            }
          } else {
            console.error(`Product ${productId} optimization failed:`, data);
            failedCount++;
          }
        } catch (itemError) {
          console.error(`Failed to optimize product ${productId}:`, itemError);
          failedCount++;
        }
        
        // Update progress AFTER processing each item
        setOptimizationProgress({ type: 'products', current: i + 1, total: selectedProducts.length });
      }
      
      // Progress is already at 100% from the loop
      
      // Show final results with quality summary
      if (successCount > 0) {
        addNotification(`Successfully optimized ${successCount} products with AI safety checks!`, 'success');
      }
      if (failedCount > 0) {
        addNotification(`${failedCount} products failed to optimize`, 'error');
      }
      
      // Refresh all data to update status
      fetchStatus(shop);
      fetchProducts(shop);
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedProducts([]);
    } catch (error) {
      console.error('Optimization error:', error);
      if (error.message.includes('timeout')) {
        addNotification('Request timed out. Please check your connection and try again.', 'error');
      } else {
        addNotification('Failed to optimize products. Please try again.', 'error');
      }
    } finally {
      setOptimizing(false);
      // Always clear progress, even on errors
      setTimeout(() => setOptimizationProgress(null), 1000);
    }
  };

  const optimizePages = async () => {
    console.log('optimizePages called, selectedPages:', selectedPages);
    
    if (selectedPages.length === 0) {
      addNotification('Please select pages to optimize', 'warning');
      return;
    }
    
    setOptimizing(true);
    setOptimizationProgress({ type: 'pages', current: 0, total: selectedPages.length });
    addNotification(`Starting optimization of ${selectedPages.length} pages...`, 'info');
    
    try {
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < selectedPages.length; i++) {
        const pageId = selectedPages[i];
        
        try {
          console.log(`Optimizing page ${i + 1}/${selectedPages.length}: ${pageId}`);
          const response = await fetchWithTimeout(`${API_BASE}/api/optimize/pages?shop=${shop}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop,
              pageIds: [pageId],
              settings: {
                targetLLM: settings.targetLLM,
                keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
                tone: settings.tone
              }
            })
          }, 60000);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Page optimization failed for ${pageId}:`, response.status, errorText);
            failedCount++;
            continue;
          }
          
          const data = await response.json();
          
          if (data.results && data.results[0]?.status === 'success') {
            successCount++;
          } else {
            console.error(`Page optimization returned non-success for ${pageId}:`, data);
            failedCount++;
          }
        } catch (itemError) {
          if (itemError.name === 'AbortError') {
            console.error(`Page optimization timed out for ${pageId}`);
            addNotification(`Page optimization timed out for page ${pageId}`, 'error');
          } else {
            console.error(`Failed to optimize page ${pageId}:`, itemError);
          }
          failedCount++;
        }
        
        setOptimizationProgress({ type: 'pages', current: i + 1, total: selectedPages.length });
      }
      
      if (successCount > 0) {
        addNotification(`Successfully optimized ${successCount} pages!`, 'success');
      }
      if (failedCount > 0) {
        addNotification(`${failedCount} pages failed to optimize`, 'error');
      }
      
      fetchStatus(shop);
      fetchPages(shop);
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedPages([]);
    } catch (error) {
      console.error('Page optimization error:', error);
      addNotification('Failed to optimize pages. Please try again.', 'error');
    } finally {
      setOptimizing(false);
      setTimeout(() => setOptimizationProgress(null), 1000);
    }
  };

  const optimizeCollections = async () => {
    console.log('optimizeCollections called, selectedCollections:', selectedCollections);
    
    if (selectedCollections.length === 0) {
      addNotification('Please select collections to optimize', 'warning');
      return;
    }
    
    setOptimizing(true);
    setOptimizationProgress({ type: 'collections', current: 0, total: selectedCollections.length });
    addNotification(`Starting optimization of ${selectedCollections.length} collections...`, 'info');
    
    try {
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < selectedCollections.length; i++) {
        const collectionId = selectedCollections[i];
        
        try {
          console.log(`Optimizing collection ${i + 1}/${selectedCollections.length}: ${collectionId}`);
          const response = await fetchWithTimeout(`${API_BASE}/api/optimize/collections?shop=${shop}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop,
              collectionIds: [collectionId],
              settings: {
                targetLLM: settings.targetLLM,
                keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
                tone: settings.tone
              }
            })
          }, 60000);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Collection optimization failed for ${collectionId}:`, response.status, errorText);
            failedCount++;
            continue;
          }
          
          const data = await response.json();
          
          if (data.results && data.results[0]?.status === 'success') {
            successCount++;
            
            // Log quality scores for user awareness
            const result = data.results[0];
            if (result.riskScore !== undefined || result.visibilityScore !== undefined) {
              console.log(`Collection ${collectionId} quality scores:`, {
                risk: result.riskScore,
                visibility: result.visibilityScore,
                rolledBack: result.rollbackTriggered
              });
              
              // Show specific feedback for high-risk items
              if (result.rollbackTriggered) {
                addNotification(`Collection ID ${collectionId}: High-risk content detected, original preserved`, 'warning');
              } else if (showAdvancedDebugUI && result.riskScore > 0.5) {
                addNotification(`Collection ID ${collectionId}: Optimized with medium risk score (${(result.riskScore * 100).toFixed(0)}%)`, 'info');
              }
            }
          } else {
            console.error(`Collection optimization returned non-success for ${collectionId}:`, data);
            failedCount++;
          }
        } catch (itemError) {
          if (itemError.name === 'AbortError') {
            console.error(`Collection optimization timed out for ${collectionId}`);
            addNotification(`Collection optimization timed out for collection ${collectionId}`, 'error');
          } else {
            console.error(`Failed to optimize collection ${collectionId}:`, itemError);
          }
          failedCount++;
        }
        
        setOptimizationProgress({ type: 'collections', current: i + 1, total: selectedCollections.length });
      }
      
      if (successCount > 0) {
        addNotification(`Successfully optimized ${successCount} collections!`, 'success');
      }
      if (failedCount > 0) {
        addNotification(`${failedCount} collections failed to optimize`, 'error');
      }
      
      fetchStatus(shop);
      fetchCollections(shop);
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedCollections([]);
    } catch (error) {
      console.error('Collections optimization error:', error);
      addNotification('Failed to optimize collections. Please try again.', 'error');
    } finally {
      setOptimizing(false);
      setTimeout(() => setOptimizationProgress(null), 1000);
    }
  };

  const optimizeBlogs = async () => {
    if (selectedBlogs.length === 0) {
      addNotification('Please select blogs to optimize', 'warning');
      return;
    }
    
    setOptimizing(true);
    setOptimizationProgress({ type: 'blogs', current: 0, total: selectedBlogs.length });
    addNotification(`Starting optimization of ${selectedBlogs.length} blogs...`, 'info');
    
    try {
      let successCount = 0;
      let failedCount = 0;
      
      // Process each blog individually to show real progress
      for (let i = 0; i < selectedBlogs.length; i++) {
        const blogId = selectedBlogs[i];
        
        try {
          console.log(`Optimizing blog ${i + 1}/${selectedBlogs.length}: ${blogId}`);
          const response = await fetchWithTimeout(`${API_BASE}/api/optimize/blogs?shop=${shop}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop,
              blogIds: [blogId], // Send one blog at a time
              settings: {
                targetLLM: settings.targetLLM,
                keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
                tone: settings.tone
              }
            })
          }, 60000);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Blog optimization failed for ${blogId}:`, response.status, errorText);
            failedCount++;
            continue;
          }
          
          const data = await response.json();
          
          if (data.results && data.results[0]?.status === 'success') {
            successCount++;
            
            // Log quality scores for user awareness
            const result = data.results[0];
            if (result.riskScore !== undefined || result.visibilityScore !== undefined) {
              console.log(`Blog ${blogId} quality scores:`, {
                risk: result.riskScore,
                visibility: result.visibilityScore,
                rolledBack: result.rollbackTriggered
              });
              
              // Show specific feedback for high-risk items
              if (result.rollbackTriggered) {
                addNotification(`Blog ID ${blogId}: High-risk content detected, original preserved`, 'warning');
              } else if (showAdvancedDebugUI && result.riskScore > 0.5) {
                addNotification(`Blog ID ${blogId}: Optimized with medium risk score (${(result.riskScore * 100).toFixed(0)}%)`, 'info');
              }
            }
          } else {
            console.error(`Blog optimization returned non-success for ${blogId}:`, data);
            failedCount++;
          }
        } catch (itemError) {
          if (itemError.name === 'AbortError') {
            console.error(`Blog optimization timed out for ${blogId}`);
            addNotification(`Blog optimization timed out for blog ${blogId}`, 'error');
          } else {
            console.error(`Failed to optimize blog ${blogId}:`, itemError);
          }
          failedCount++;
        }
        
        // Update progress AFTER processing each item
        setOptimizationProgress({ type: 'blogs', current: i + 1, total: selectedBlogs.length });
      }
      
      // Progress is already at 100% from the loop
      
      // Show final results
      if (successCount > 0) {
        addNotification(`Successfully optimized ${successCount} blog articles!`, 'success');
      }
      if (failedCount > 0) {
        addNotification(`${failedCount} blogs failed to optimize`, 'error');
      }
      
      // Refresh all data to update status
      fetchStatus(shop);
      fetchBlogs(shop);
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedBlogs([]);
    } catch (error) {
      console.error('Blog optimization error:', error);
      addNotification('Failed to optimize blogs. Please try again.', 'error');
    } finally {
      setOptimizing(false);
      setTimeout(() => setOptimizationProgress(null), 1000); // Keep progress visible for a moment
    }
  };

  const optimizeArticles = async () => {
    if (selectedArticles.length === 0) {
      addNotification('Please select articles to optimize', 'warning');
      return;
    }
    
    setOptimizing(true);
    setOptimizationProgress({ type: 'articles', current: 0, total: selectedArticles.length });
    addNotification(`Starting optimization of ${selectedArticles.length} articles...`, 'info');
    
    try {
      // Prepare article data with blog IDs for efficient backend processing
      const articlesWithBlogIds = selectedArticles.map(articleId => {
        const article = articles.find(a => a.id.toString() === articleId.toString());
        return {
          articleId: articleId,
          blogId: article ? article.blogId : null
        };
      }).filter(item => item.blogId !== null);
      
      console.log('Optimizing individual articles:', articlesWithBlogIds);
      const response = await authFetch(`${API_BASE}/api/optimize/articles?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          articles: articlesWithBlogIds,
          settings: {
            targetLLM: settings.targetLLM,
            keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
            tone: settings.tone
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        let successCount = 0;
        let failedCount = 0;
        
        data.results.forEach(result => {
          if (result.status === 'success') {
            successCount++;
            
            // Log quality scores for user awareness
            if (result.riskScore !== undefined || result.visibilityScore !== undefined) {
              console.log(`Article ${result.id} quality scores:`, {
                risk: result.riskScore,
                visibility: result.visibilityScore,
                rolledBack: result.rollbackTriggered
              });
              
              // Show specific feedback for high-risk items
              if (result.rollbackTriggered) {
                addNotification(`Article "${result.title}": High-risk content detected, original preserved`, 'warning');
              } else if (showAdvancedDebugUI && result.riskScore > 0.5) {
                addNotification(`Article "${result.title}": Optimized with medium risk score (${(result.riskScore * 100).toFixed(0)}%)`, 'info');
              }
            }
          } else {
            failedCount++;
            // Show specific error message if available
            if (result.error) {
              addNotification(`Article ${result.id}: ${result.error}`, 'error');
            }
          }
        });
        
        // Show final results
        if (successCount > 0) {
          addNotification(`Successfully optimized ${successCount} articles!`, 'success');
        }
        if (failedCount > 0) {
          addNotification(`${failedCount} articles failed to optimize`, 'error');
        }
      } else {
        addNotification('No articles were processed', 'warning');
      }
      
      // Update progress
      setOptimizationProgress({ type: 'articles', current: selectedArticles.length, total: selectedArticles.length });
      
      // Refresh all data to update status
      fetchStatus(shop);
      fetchBlogs(shop);
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedArticles([]);
    } catch (error) {
      console.error('Article optimization error:', error);
      // Show specific error message to user
      const errorMessage = error.message || 'Failed to optimize articles. Please try again.';
      addNotification(`Article optimization failed: ${errorMessage}`, 'error');
    } finally {
      setOptimizing(false);
      setTimeout(() => setOptimizationProgress(null), 1000);
    }
  };

  const previewOptimization = async () => {
    setPreviewLoading(true);
    addNotification('Generating product preview...', 'info');
    
    try {
      const sampleProduct = products[0] || {
        name: 'Sample Product',
        title: 'Premium Organic Coffee Beans',
        description: 'Expertly roasted coffee beans from sustainable farms'
      };
      
      const response = await authFetch(`${API_BASE}/api/optimize/preview?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          content: sampleProduct,
          type: 'product',
          settings: {
            targetLLM: settings.targetLLM,
            keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
            tone: settings.tone
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPreview(data);
      addNotification('Product preview generated successfully!', 'success');
    } catch (error) {
      console.error('Preview error:', error);
      addNotification(`Failed to generate preview: ${error.message}`, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewBlogOptimization = async (blog) => {
    setPreviewLoading(true);
    addNotification('Generating blog preview...', 'info');
    
    try {
      const sampleBlog = blog || blogs[0] || {
        title: 'Sample Blog Post',
        content: 'This is a sample blog post content for preview purposes.'
      };
      
      const response = await authFetch(`${API_BASE}/api/optimize/preview?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          content: sampleBlog,
          type: 'blog',
          settings: {
            targetLLM: settings.targetLLM,
            keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
            tone: settings.tone
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPreview(data);
      addNotification('Blog preview generated successfully!', 'success');
    } catch (error) {
      console.error('Blog preview error:', error);
      addNotification(`Failed to generate blog preview: ${error.message}`, 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const rollback = async (type, id, version = null) => {
    // Show confirmation dialog
    const itemName = type === 'product' ? 'product' : 'blog article';
    
    setConfirmConfig({
      title: `Rollback ${itemName}`,
      message: `Are you sure you want to rollback this ${itemName}?`,
      details: [
        'Restore original content',
        'Remove all AI optimizations', 
        'Delete generated FAQs'
      ],
      warning: 'This action cannot be undone.',
      onConfirm: async () => {
        addNotification('Processing rollback...', 'info');
        
        try {
          setOptimizing(true);
          const response = await authFetch(`${API_BASE}/api/rollback/${type}/${id}?shop=${shop}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop, version })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          console.log('[ROLLBACK] Success response:', data);
          addNotification(data.message, 'success');
          
          // Close modal immediately after successful API call
          setOptimizing(false);
          
          // Update the product/blog/page/collection status to reflect the rollback
          if (type === 'product') {
            setProducts(prev => prev.map(p => 
              p.id.toString() === id.toString() ? { ...p, optimized: false } : p
            ));
          } else if (type === 'article') {
            // For articles, update the specific article within blogs
            setBlogs(prev => prev.map(blog => ({
              ...blog,
              articles: blog.articles?.map(article => 
                article.id.toString() === id.toString() ? { ...article, optimized: false } : article
              ) || []
            })));
          } else if (type === 'page') {
            setPages(prev => prev.map(p => 
              p.id.toString() === id.toString() ? { ...p, optimized: false } : p
            ));
          } else if (type === 'collection') {
            setCollections(prev => prev.map(c => 
              c.id.toString() === id.toString() ? { ...c, optimized: false } : c
            ));
          }
          
          // Refresh data in background with rate limiting protection
          setTimeout(async () => {
            try {
              console.log('Refreshing data after rollback with rate limit protection...');
              
              // Refresh in smaller batches with delays to avoid rate limits
              await fetchStatus(shop).catch(err => console.log('Status refresh failed:', err.message));
              
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
              
              await Promise.all([
                fetchProducts(shop).catch(err => console.log('Products refresh failed:', err.message)),
                fetchPages(shop).catch(err => console.log('Pages refresh failed:', err.message))
              ]);
              
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
              
              await Promise.all([
                fetchBlogs(shop).catch(err => console.log('Blogs refresh failed:', err.message)),
                fetchCollections(shop).catch(err => console.log('Collections refresh failed:', err.message))
              ]);
              
              await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
              
              await Promise.all([
                fetchHistory(shop).catch(err => console.log('History refresh failed:', err.message)),
                fetchUsage(shop).catch(err => console.log('Usage refresh failed:', err.message))
              ]);
              
              console.log('Background refresh completed with rate limiting');
            } catch (error) {
              console.log('Background refresh error (non-blocking):', error.message);
            }
          }, 100); // Small delay to ensure modal closes first
          
          console.log('[ROLLBACK] Rollback completed successfully, modal should close now');
        } catch (error) {
          console.error('Rollback error:', error);
          addNotification('Failed to rollback: ' + error.message, 'error');
          // Close modal immediately on error too
          setOptimizing(false);
        }
      }
    });
    setShowConfirmModal(true);
  };

  const saveDraft = async (type, id, content, settings) => {
    try {
      setOptimizing(true);
      const response = await authFetch(`${API_BASE}/api/optimize/draft?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resourceType: type, 
          resourceId: id, 
          content, 
          settings 
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      addNotification('Draft saved successfully', 'success');
      
      // Refresh data
      fetchStatus(shop);
      fetchProducts(shop);
      
      return data;
    } catch (error) {
      console.error('Save draft error:', error);
      addNotification('Failed to save draft. Please try again.', 'error');
      throw error;
    } finally {
      setOptimizing(false);
    }
  };

  const publishDraft = async (type, id) => {
    return new Promise((resolve, reject) => {
      showConfirmation(
        'Publish Draft',
        'This will make the draft content live on your store. Are you sure?',
        async () => {
          try {
            const result = await performPublishDraft(type, id);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  };

  const performPublishDraft = async (type, id) => {
    
    try {
      console.log('[PUBLISH] Starting publish for', type, id);
      setOptimizing(true);
      
      const requestBody = { 
        resourceType: type, 
        resourceId: id 
      };
      console.log('[PUBLISH] Request body:', requestBody);
      console.log('[PUBLISH] Shop:', shop);
      console.log('[PUBLISH] API_BASE:', API_BASE);
      
      const response = await authFetch(`${API_BASE}/api/optimize/publish?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('[PUBLISH] Response received:', response.status, response.statusText);
      console.log('[PUBLISH] Response OK:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PUBLISH] Error response body:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[PUBLISH] Success response:', data);
      addNotification('Draft published successfully', 'success');
      
      // Update the product/blog/page/collection status to reflect the publication
      if (type === 'product') {
        setProducts(prev => prev.map(p => 
          p.id.toString() === id.toString() ? { ...p, optimized: true } : p
        ));
      } else if (type === 'blog') {
        setBlogs(prev => prev.map(b => 
          b.id.toString() === id.toString() ? { ...b, optimized: true } : b
        ));
      } else if (type === 'page') {
        setPages(prev => prev.map(p => 
          p.id.toString() === id.toString() ? { ...p, optimized: true } : p
        ));
      } else if (type === 'collection') {
        setCollections(prev => prev.map(c => 
          c.id.toString() === id.toString() ? { ...c, optimized: true } : c
        ));
      }
      
      // Refresh data with rate limiting protection
      setTimeout(async () => {
        try {
          await fetchStatus(shop);
          await new Promise(resolve => setTimeout(resolve, 300));
          await Promise.all([fetchProducts(shop), fetchPages(shop)]);
          await new Promise(resolve => setTimeout(resolve, 300));
          await Promise.all([fetchBlogs(shop), fetchCollections(shop)]);
          await new Promise(resolve => setTimeout(resolve, 300));
          await fetchHistory(shop);
        } catch (error) {
          console.log('Publish refresh error (non-blocking):', error.message);
        }
      }, 100);
      
      return data;
    } catch (error) {
      console.error('[PUBLISH] Error caught:', error);
      console.error('[PUBLISH] Error type:', typeof error);
      console.error('[PUBLISH] Error message:', error.message);
      console.error('[PUBLISH] Error stack:', error.stack);
      addNotification(`Failed to publish draft: ${error.message}`, 'error');
      throw error;
    } finally {
      setOptimizing(false);
    }
  };

  const getDraftContent = async (type, id) => {
    try {
      const response = await authFetch(`${API_BASE}/api/draft/${type}/${id}?shop=${shop}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get draft content error:', error);
      addNotification('Failed to fetch draft content', 'error');
      return null;
    }
  };

  const rollbackAllOptimizations = async (type) => {
    let itemsToRollback = [];
    let rollbackType = type;
    
    if (type === 'product') {
      itemsToRollback = products.filter(p => p.optimized);
    } else if (type === 'blog') {
      // For blogs, we need to rollback individual articles
      rollbackType = 'article';
      itemsToRollback = blogs.flatMap(blog => 
        blog.articles?.filter(article => article.optimized) || []
      );
    }
    
    if (itemsToRollback.length === 0) {
      addNotification('No optimized items to rollback', 'info');
      return;
    }
    
    const itemLabel = type === 'product' ? 'products' : 'articles';
    const message = `Rollback ALL ${itemsToRollback.length} optimized ${itemLabel}?\n\nThis will:\n• Delete all draft and published optimizations\n• Restore original content for all items\n• Remove all AI-generated FAQs\n• Disable LLM schema output\n\nThis action cannot be undone.`;
    
    if (!confirm(message)) return;
    
    try {
      setOptimizing(true);
      const results = [];
      
      for (const item of itemsToRollback) {
        try {
          const response = await authFetch(`${API_BASE}/api/rollback/${rollbackType}/${item.id}?shop=${shop}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop })
          });
          
          if (response.ok) {
            results.push({ id: item.id, status: 'success' });
            
            // Update local state
            if (type === 'product') {
              setProducts(prev => prev.map(p => 
                p.id === item.id ? { ...p, optimized: false } : p
              ));
            } else {
              setBlogs(prev => prev.map(b => 
                b.id === item.id ? { ...b, optimized: false } : b
              ));
            }
          } else {
            results.push({ id: item.id, status: 'error' });
          }
        } catch (error) {
          results.push({ id: item.id, status: 'error' });
        }
      }
      
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      if (successCount > 0) {
        addNotification(`Successfully rolled back ${successCount} ${type}s`, 'success');
      }
      if (errorCount > 0) {
        addNotification(`Failed to rollback ${errorCount} ${type}s`, 'error');
      }
      
      // Refresh data
      fetchStatus(shop);
      fetchHistory(shop);
      fetchUsage(shop);
    } catch (error) {
      console.error('Rollback all error:', error);
      addNotification('Failed to rollback optimizations. Please try again.', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  const getContentTitle = (type, id, draftData) => {
    // Try to get title from draft content first
    const draftTitle = draftData?.draft?.content?.title || draftData?.draft?.content?.optimizedTitle;
    if (draftTitle) return draftTitle;
    
    // Try to get from live content
    const liveTitle = draftData?.live?.title;
    if (liveTitle) return liveTitle;
    
    // Try to get from original data arrays
    if (type === 'product') {
      const product = products.find(p => p.id.toString() === id.toString());
      if (product?.title) return product.title;
    } else if (type === 'article') {
      const article = articles.find(a => a.id.toString() === id.toString());
      if (article?.title) return article.title;
    } else if (type === 'page') {
      const page = pages.find(p => p.id.toString() === id.toString());
      if (page?.title) return page.title;
    } else if (type === 'collection') {
      const collection = collections.find(c => c.id.toString() === id.toString());
      if (collection?.title) return collection.title;
    }
    
    // Fallback to short ID or default
    const shortId = id.toString().slice(-8);
    return `Untitled ${type.charAt(0).toUpperCase() + type.slice(1)} (${shortId})`;
  };

  const handlePreviewDraft = async (type, id) => {
    const draftData = await getDraftContent(type, id);
    if (draftData) {
      setSelectedDraft({ type, id, data: draftData });
      setShowDraftModal(true);
    }
  };

  const toggleProductSelection = (productId) => {
    console.log('toggleProductSelection called with:', productId, typeof productId);
    console.log('Current selectedProducts:', selectedProducts);
    
    setSelectedProducts(prev => {
      const newSelection = prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      console.log('New selectedProducts:', newSelection);
      return newSelection;
    });
  };

  const toggleBlogSelection = (blogId) => {
    setSelectedBlogs(prev => 
      prev.includes(blogId) 
        ? prev.filter(id => id !== blogId)
        : [...prev, blogId]
    );
  };

  const toggleArticleSelection = (articleId) => {
    console.log('toggleArticleSelection called with:', articleId, typeof articleId);
    console.log('Current selectedArticles:', selectedArticles);
    
    setSelectedArticles(prev => {
      const newSelection = prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId];
      console.log('New selectedArticles:', newSelection);
      return newSelection;
    });
  };

  // Test function for end-to-end optimization
  const runEndToEndTest = async () => {
    console.log('[ASB-DEBUG] Starting end-to-end optimization test');
    const results = { steps: [], errors: [], startTime: Date.now() };
    
    try {
      // Step 1: Verify authenticated fetch
      results.steps.push('Step 1: Verify authenticated fetch');
      console.log('[ASB-DEBUG] Step 1: typeof window.authenticatedFetch =', typeof window.authenticatedFetch);
      console.log('[ASB-DEBUG] Step 1: typeof authFetch =', typeof authFetch);
      
      if (typeof window.authenticatedFetch !== 'function') {
        throw new Error('window.authenticatedFetch is not a function');
      }
      
      // Step 2: Test all API endpoints
      results.steps.push('Step 2: Test API endpoints');
      
      // Test /api/status
      console.log('[ASB-DEBUG] Step 2a: Testing /api/status');
      const statusRes = await authFetch(`${API_BASE}/api/status?shop=${shop}`);
      console.log('[ASB-DEBUG] Step 2a: Status response:', statusRes.status, statusRes.statusText);
      
      if (!statusRes.ok) throw new Error(`/api/status failed: ${statusRes.status}`);
      const statusData = await statusRes.json();
      console.log('[ASB-DEBUG] Step 2a: Status data:', statusData);
      
      // Test /api/products  
      console.log('[ASB-DEBUG] Step 2b: Testing /api/products');
      const productsRes = await authFetch(`${API_BASE}/api/products?shop=${shop}`);
      console.log('[ASB-DEBUG] Step 2b: Products response:', productsRes.status, productsRes.statusText);
      
      if (!productsRes.ok) throw new Error(`/api/products failed: ${productsRes.status}`);
      const productsData = await productsRes.json();
      console.log('[ASB-DEBUG] Step 2b: Products data:', productsData);
      
      // Get first real product ID
      const realProducts = productsData.products || [];
      if (realProducts.length === 0) {
        throw new Error('No products found in store');
      }
      
      const testProduct = realProducts[0];
      const productId = testProduct.id;
      console.log('[ASB-DEBUG] Step 2b: Selected test product ID:', productId, 'Title:', testProduct.title);
      
      // Step 3: Run real optimization
      results.steps.push('Step 3: Run real optimization');
      console.log('[ASB-DEBUG] Step 3: Running optimization on product ID:', productId);
      
      const optimizePayload = {
        productIds: [productId],
        settings: {
          targetLLM: 'general',
          keywords: ['premium', 'quality', 'organic'],
          tone: 'professional'
        }
      };
      
      console.log('[ASB-DEBUG] Step 3: Optimization payload:', optimizePayload);
      
      const optimizeRes = await authFetch(`${API_BASE}/api/optimize/products?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimizePayload)
      });
      
      console.log('[ASB-DEBUG] Step 3: Optimization response:', optimizeRes.status, optimizeRes.statusText);
      
      if (!optimizeRes.ok) throw new Error(`Optimization failed: ${optimizeRes.status}`);
      const optimizeData = await optimizeRes.json();
      console.log('[ASB-DEBUG] Step 3: Optimization result:', optimizeData);
      
      // Step 4: Test rollback
      results.steps.push('Step 4: Test rollback');
      console.log('[ASB-DEBUG] Step 4: Testing rollback for product ID:', productId);
      
      const rollbackRes = await authFetch(`${API_BASE}/api/rollback/product/${productId}?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'original' })
      });
      
      console.log('[ASB-DEBUG] Step 4: Rollback response:', rollbackRes.status, rollbackRes.statusText);
      
      if (!rollbackRes.ok) throw new Error(`Rollback failed: ${rollbackRes.status}`);
      const rollbackData = await rollbackRes.json();
      console.log('[ASB-DEBUG] Step 4: Rollback result:', rollbackData);
      
      // Success!
      results.success = true;
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      
      console.log('[ASB-DEBUG] END-TO-END TEST SUCCESS!');
      console.log('[ASB-DEBUG] Total duration:', results.duration + 'ms');
      console.log('[ASB-DEBUG] Steps completed:', results.steps);
      
      setTestResults(results);
      
    } catch (error) {
      results.errors.push(error.message);
      results.success = false;
      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      
      console.error('[ASB-DEBUG] END-TO-END TEST FAILED:', error);
      console.error('[ASB-DEBUG] Steps completed:', results.steps);
      console.error('[ASB-DEBUG] Errors:', results.errors);
      
      setTestResults(results);
    }
  };

  // Show error state if there's an error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-800/20 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-dark-card rounded-lg shadow border border-dark-border">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">Dashboard Error</h2>
          <p className="text-text-secondary mb-4">{error.message}</p>
          <details className="text-left text-sm text-gray-300 mb-4">
            <summary className="cursor-pointer">Technical Details</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {error.stack}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (loading || !isReady) {
    return (
      <div className="min-h-screen bg-gray-800/20 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-300">
            {!isReady ? 'Initializing authentication...' : 'Loading AI Search Booster...'}
          </p>
          <div className="mt-2 text-xs text-gray-400">
            Auth ready: {isReady ? '✓' : '⏳'} | 
            Fetch available: {authFetch ? '✓' : '⏳'}
          </div>
        </div>
      </div>
    );
  }

  const optimizationPercentage = status ? (status.optimizedProducts / status.totalProducts * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Quota Toast Notification */}
      <QuotaToast 
        isVisible={tierUsage && !tierUsage.hasQuota}
        usageCount={tierUsage?.usageThisMonth || 0}
        monthlyLimit={tierUsage?.monthlyLimit || 25}
        tier={testTier}
      />

      {/* ChatGPT-style Collapsible Sidebar Navigation */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-[#1e1e1e] flex-shrink-0 hidden lg:flex flex-col fixed left-0 top-0 h-screen z-50 transition-all duration-300 ease-in-out`}>
        {/* Collapse Toggle Button */}
        <div className="absolute -right-3 top-6 z-10">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-6 h-6 bg-[#1e1e1e] border border-dark-border rounded-full flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3 h-3 text-text-muted" />
            ) : (
              <ChevronLeft className="w-3 h-3 text-text-muted" />
            )}
          </button>
        </div>

        {/* Logo Section - moved UP 25px */}
        <div className={`${sidebarCollapsed ? 'p-4' : 'p-6'} mt-6`}>
          <div className={`flex ${sidebarCollapsed ? 'justify-center' : 'flex-col items-center text-center'} space-y-2`}>
            <img 
              src={`/logo.png?v=${Date.now()}`} 
              alt="AI Search Booster" 
              className={`${sidebarCollapsed ? 'w-8 h-8' : 'w-24 h-24'} object-contain transition-all duration-300`}
            />
            {!sidebarCollapsed && (
              <div className="text-text-muted text-sm text-center">
                <div>Optimize for ChatGPT,</div>
                <div>Gemini, Claude & More!</div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Optimization Section Header */}
          {!sidebarCollapsed && (
            <div className="px-3 pb-2">
              <h3 className="text-white text-sm font-semibold uppercase tracking-wide">Optimize</h3>
            </div>
          )}
          
          {/* Main Content Sections */}
          {[
            { id: 'products', label: 'Products', icon: Package, count: products?.length || 0 },
            { id: 'blogs', label: 'Blog Articles', icon: BookOpen, count: articles?.length || 0 },
            { id: 'pages', label: 'Pages', icon: FileText, count: pages?.length || 0 },
            { id: 'collections', label: 'Collections', icon: Globe, count: collections?.length || 0 },
            { id: 'boost-ai', label: 'Boost AI Discovery', icon: Target, count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'justify-between py-2 px-3'} rounded-xl text-left transition-all duration-200 ease-out ${
                activeTab === tab.id
                  ? 'bg-[#2a2a2a] text-white font-medium shadow-lg'
                  : 'text-text-secondary hover:bg-[#2a2a2a] hover:text-text-primary'
              }`}
              title={sidebarCollapsed ? tab.label : ''}
            >
              <div className={`flex items-center ${sidebarCollapsed ? '' : 'space-x-3'}`}>
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : ''}`} />
                {!sidebarCollapsed && <span className="text-sm">{tab.label}</span>}
              </div>
              {!sidebarCollapsed && tab.count !== null && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  activeTab === tab.id 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-dark-border text-text-muted'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
          
          {/* Spacer */}
          <div className="my-6"></div>
          
          {/* Support Section Header */}
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 pt-4">
              <h3 className="text-white text-sm font-semibold uppercase tracking-wide">Support</h3>
            </div>
          )}
          
          {/* Help & Support Sections */}
          {[
            { id: 'instructions', label: 'Instructions', icon: BookOpen },
            { id: 'support', label: 'FAQ', icon: MessageSquare },
            { id: 'terms', label: 'Terms & Disclaimer', icon: FileText },
          ].map((helpTab) => (
            <button
              key={helpTab.id}
              onClick={() => setActiveTab(helpTab.id)}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'space-x-3 py-2 px-3'} rounded-xl text-left transition-all duration-200 ease-out ${
                activeTab === helpTab.id
                  ? 'bg-[#2a2a2a] text-white font-medium shadow-lg'
                  : 'text-text-secondary hover:bg-[#2a2a2a] hover:text-text-primary'
              }`}
              title={sidebarCollapsed ? helpTab.label : ''}
            >
              <helpTab.icon className={`w-5 h-5 ${activeTab === helpTab.id ? 'text-white' : ''}`} />
              {!sidebarCollapsed && <span className="text-sm">{helpTab.label}</span>}
            </button>
          ))}
        </nav>

        {/* Settings Button - Fixed at Bottom */}
        <div className="p-4">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'space-x-3 py-2 px-3'} rounded-xl text-left transition-all duration-200 ease-out ${
              activeTab === 'settings'
                ? 'bg-[#2a2a2a] text-white font-medium shadow-lg'
                : 'text-text-secondary hover:bg-[#2a2a2a] hover:text-text-primary'
            }`}
            title={sidebarCollapsed ? 'Settings' : ''}
          >
            <Settings className={`w-5 h-5 ${activeTab === 'settings' ? 'text-white' : ''}`} />
            {!sidebarCollapsed && <span className="text-sm">Settings</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area - with left margin to account for fixed sidebar */}
      <main className={`flex-1 flex flex-col min-h-screen bg-dark-bg-secondary scrollbar-dark transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Mobile Header */}
        <header className="lg:hidden bg-dark-card border-b border-dark-border p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-dark-border text-text-secondary transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <img 
                src={`/logo.png?v=${Date.now()}`} 
                alt="AI Search Booster" 
                className="w-8 h-8 object-contain"
              />
              <h1 className="text-text-primary font-semibold">AI Search Booster</h1>
            </div>
            <button
              onClick={() => setActiveTab('settings')}
              className="p-2 rounded-lg hover:bg-dark-border text-text-secondary transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 backdrop-blur-sm bg-black/40 animate-fade-in" onClick={() => setMobileMenuOpen(false)}>
            <aside className="w-64 bg-[#1e1e1e] h-full animate-slide-in-left" onClick={e => e.stopPropagation()}>
              {/* Logo Section */}
              <div className="p-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  <img 
                    src={`/logo.png?v=${Date.now()}`} 
                    alt="AI Search Booster" 
                    className="w-24 h-24 object-contain"
                  />
                  <div className="text-text-muted text-sm text-center">
                <div>Optimize for ChatGPT,</div>
                <div>Gemini, Claude & More!</div>
              </div>
                </div>
              </div>

              {/* Mobile Navigation Menu */}
              <nav className="flex-1 p-4 space-y-2">
                {/* Optimization Section Header */}
                <div className="px-3 pb-2">
                  <h3 className="text-white text-sm font-semibold uppercase tracking-wide">Optimize</h3>
                </div>
                
                {/* Main Content Sections */}
                {[
                  { id: 'products', label: 'Products', icon: Package, count: products?.length || 0 },
                  { id: 'blogs', label: 'Blog Articles', icon: BookOpen, count: articles?.length || 0 },
                  { id: 'pages', label: 'Pages', icon: FileText, count: pages?.length || 0 },
                  { id: 'collections', label: 'Collections', icon: Globe, count: collections?.length || 0 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 ease-out ${
                      activeTab === tab.id
                        ? 'bg-[#363636] text-white font-medium'
                        : 'text-text-secondary hover:bg-[#2a2a2a] hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : ''}`} />
                      <span className="text-sm">{tab.label}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      activeTab === tab.id 
                        ? 'bg-[#3a3a3a] text-white' 
                        : 'bg-dark-border text-text-muted'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
                
                {/* Divider */}
                <div className="my-3"></div>
                
                {/* Support Section Header */}
                <div className="px-3 pb-2">
                  <h3 className="text-white text-sm font-semibold uppercase tracking-wide">Support</h3>
                </div>
                
                {/* Help & Support Sections */}
                {[
                  { id: 'instructions', label: 'Instructions', icon: BookOpen },
                  { id: 'support', label: 'FAQ', icon: MessageSquare },
                  { id: 'terms', label: 'Terms & Disclaimer', icon: FileText },
                ].map((helpTab) => (
                  <button
                    key={helpTab.id}
                    onClick={() => {
                      setActiveTab(helpTab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-xl text-left transition-all duration-200 ease-out ${
                      activeTab === helpTab.id
                        ? 'bg-[#363636] text-white font-medium'
                        : 'text-text-secondary hover:bg-[#2a2a2a] hover:text-text-primary'
                    }`}
                  >
                    <helpTab.icon className={`w-5 h-5 ${activeTab === helpTab.id ? 'text-white' : ''}`} />
                    <span className="text-sm">{helpTab.label}</span>
                  </button>
                ))}
              </nav>

              {/* Mobile Settings Button */}
              <div className="p-4">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 rounded-xl text-text-secondary hover:bg-dark-border hover:text-text-primary transition-all duration-200"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm">Settings</span>
                </button>
              </div>
            </aside>
          </div>
        )}


        {/* Content Area */}
        <div className="flex-1 px-6 pt-8 pb-6 overflow-y-auto">

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg shadow-lg border-l-4 animate-fade-in ${
                notification.type === 'success' ? 'bg-dark-card border-green-400' :
                notification.type === 'error' ? 'bg-dark-card border-red-400' :
                notification.type === 'warning' ? 'bg-dark-card border-yellow-400' :
                'bg-dark-card border-blue-400'
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                  {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                  {notification.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-400" />}
                  {notification.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${
                    notification.type === 'success' ? 'text-white' :
                    notification.type === 'error' ? 'text-white' :
                    notification.type === 'warning' ? 'text-white' :
                    'text-white'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className={`rounded-md inline-flex text-gray-400 hover:text-white focus:outline-none transition-colors`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Theme App Extension Activation */}
      <AppBridgeActivation 
        shopDomain={shop} 
        apiKey={process.env.SHOPIFY_API_KEY}
        onToast={addNotification}
      />

      {/* Citation Notifications */}
      {citations.length > 0 && (
        <div className="fixed top-20 right-4 z-40 max-w-sm">
          <div className="bg-blue-900/20 border border-blue-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  Recent Citations Found
                </h3>
                <div className="mt-2 space-y-1">
                  {citations.slice(0, 3).map((citation) => (
                    <div key={citation.id} className="text-xs text-blue-700">
                      <span className="font-medium">{citation.source}</span> mentioned{' '}
                      <span className="font-medium">{citation.product_title}</span>
                    </div>
                  ))}
                  {citations.length > 3 && (
                    <div className="text-xs text-blue-600">
                      +{citations.length - 3} more citations
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar for Optimization */}
      {optimizationProgress && (
        <div className="bg-dark-card border-b border-dark-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              <RefreshCw className="w-5 h-5 text-accent-primary animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">
                  Optimizing {optimizationProgress.type}... ({optimizationProgress.current}/{optimizationProgress.total})
                </p>
                <div className="mt-2 bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-green-400 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(optimizationProgress.current / optimizationProgress.total) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar for Preview Loading */}
      {previewLoading && (
        <div className="bg-dark-card border-b border-dark-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              <Eye className="w-5 h-5 text-accent-primary animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">
                  Preview Incoming!
                </p>
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div className="bg-black h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        {/* Section Headers */}
        
        {/* Tab-Specific Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {activeTab === 'products' && (
            <>
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-gray-500/30 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Total Products</h3>
                  <p className="text-4xl font-bold text-text-primary mb-6">{products?.length || 0}</p>
                  <Package className="w-8 h-8 text-text-muted mx-auto" />
                </div>
              </div>
              
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-accent-primary/50 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Optimized Products</h3>
                  <p className="text-4xl font-bold text-accent-primary mb-6">{products?.filter(p => p.optimized)?.length || 0}</p>
                  <CheckCircle className="w-8 h-8 text-accent-primary mx-auto" />
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'blogs' && (
            <>
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-gray-500/30 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Total Articles</h3>
                  <p className="text-4xl font-bold text-text-primary mb-6">{articles?.length || 0}</p>
                  <FileText className="w-8 h-8 text-text-muted mx-auto" />
                </div>
              </div>
              
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-accent-primary/50 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Optimized Articles</h3>
                  <p className="text-4xl font-bold text-accent-primary mb-6">{articles?.filter(a => a.optimized)?.length || 0}</p>
                  <CheckCircle className="w-8 h-8 text-accent-primary mx-auto" />
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'pages' && (
            <>
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-gray-500/30 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Total Pages</h3>
                  <p className="text-4xl font-bold text-text-primary mb-6">{pages?.length || 0}</p>
                  <Globe className="w-8 h-8 text-text-muted mx-auto" />
                </div>
              </div>
              
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-accent-primary/50 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Optimized Pages</h3>
                  <p className="text-4xl font-bold text-accent-primary mb-6">{pages?.filter(p => p.optimized)?.length || 0}</p>
                  <CheckCircle className="w-8 h-8 text-accent-primary mx-auto" />
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'collections' && (
            <>
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-gray-500/30 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Total Collections</h3>
                  <p className="text-4xl font-bold text-text-primary mb-6">{collections?.length || 0}</p>
                  <Package className="w-8 h-8 text-text-muted mx-auto" />
                </div>
              </div>
              
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-accent-primary/50 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Optimized Collections</h3>
                  <p className="text-4xl font-bold text-accent-primary mb-6">{collections?.filter(c => c.optimized)?.length || 0}</p>
                  <CheckCircle className="w-8 h-8 text-accent-primary mx-auto" />
                </div>
              </div>
            </>
          )}
          
          {/* Hide usage and enterprise status on support tabs */}
          {activeTab !== 'instructions' && activeTab !== 'support' && activeTab !== 'terms' && activeTab !== 'settings' && activeTab !== 'boost-ai' && (
            <>
              {/* Monthly Optimization Usage - Hidden on support tabs */}
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-gray-500/30 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">Monthly Optimization Usage</h3>
                  
                  {/* Large Usage Counter */}
                  <p className={`text-4xl font-bold mb-2 ${
                    tierUsage && !tierUsage.hasQuota ? 'text-red-400' : 'text-accent-secondary'
                  }`}>
                    {tierUsage?.usageThisMonth || 0} / {tierUsage?.monthlyLimit || 25}
                  </p>
                  
                  {/* Usage Description */}
                  <p className="text-xs text-text-muted mb-3">
                    Remaining {tierUsage?.isTestTier && (
                      <span className="text-yellow-400 font-medium">(Test Tier: {tierUsage.currentTier})</span>
                    )}
                  </p>
                  
                  {/* Tier Badge or Upgrade Button */}
                  {(tierUsage?.currentTier === 'Free' || !tierUsage?.currentTier) ? (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 ease-out flex items-center space-x-1 bg-transparent text-white border border-white/20 hover:border-blue-500 mx-auto"
                    >
                      <span>{tierUsage && !tierUsage.hasQuota ? 'Upgrade Plan Now' : 'Upgrade Plan'}</span>
                    </button>
                  ) : (
                    <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                      tierUsage?.currentTier === 'Enterprise' ? 'bg-purple-900/30 text-purple-300' :
                      tierUsage?.currentTier === 'Scale' ? 'bg-green-900/30 text-green-300' :
                      tierUsage?.currentTier === 'Pro' ? 'bg-blue-900/30 text-blue-300' :
                      tierUsage?.currentTier === 'Starter' ? 'bg-yellow-900/30 text-yellow-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {tierUsage?.currentTier}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Enterprise Status - Hidden on support tabs */}
              <div className="bg-dark-card rounded-xl border border-dark-border p-6 hover:ring-1 hover:ring-purple-400/50 transition-all duration-200 ease-out">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-text-muted mb-4">System Status</h3>
                  <p className="text-2xl font-bold text-accent-primary mb-4">
                    LLM Optimized
                  </p>
                  <div className="text-sm space-y-2">
                    <div className="text-center">
                      <span className="text-text-muted">JSON-LD: </span>
                      <span className="text-accent-primary font-medium">Active</span>
                    </div>
                    <div className="text-center">
                      <span className="text-text-muted">Auto-Rollback: </span>
                      <span className="text-accent-primary font-medium">On</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

          <div className="px-6 pt-0 pb-6">
            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Select Products</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        if (selectedProducts.length === products.length) {
                          setSelectedProducts([]);
                        } else {
                          setSelectedProducts(products.map(p => p.id.toString()));
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-out flex items-center space-x-1 bg-transparent text-white border border-white/20 hover:border-gray-400"
                      title={selectedProducts.length === products.length ? "Deselect all products" : "Select all products"}
                    >
                      <CheckCircle className="w-3 h-3" />
                      <span>{selectedProducts.length === products.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    
                    {/* Auto-Optimize Button */}
                    <AutoOptimizeToggle
                      enabled={autoOptimizeEnabled}
                      loading={autoOptimizeLoading}
                      tier={testTier}
                      onToggle={toggleAutoOptimize}
                      onUpgrade={() => setShowUpgradeModal(true)}
                    />
                    <button
                      onClick={optimizeProducts}
                      disabled={optimizing || selectedProducts.length === 0 || (tierUsage && !tierUsage.hasQuota)}
                      title={tierUsage && !tierUsage.hasQuota ? `Quota exceeded: ${tierUsage.usageThisMonth}/${tierUsage.monthlyLimit} optimizations used this month` : 'Optimize selected products'}
                      className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
                    >
                      {optimizing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Optimizing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Optimize Selected</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        const drafts = products.filter(p => p.hasDraft);
                        if (drafts.length === 0) {
                          addNotification('No drafts to publish', 'info');
                          return;
                        }
                        showConfirmation(
                          'Publish Drafts',
                          `Publish ${drafts.length} draft optimizations? This will make the draft content live on your store.`,
                          () => {
                            Promise.all(drafts.map(p => performPublishDraft('product', p.id)))
                              .then(async () => {
                                addNotification(`Successfully published ${drafts.length} drafts`, 'success');
                                // Final refresh to ensure UI is updated
                                await Promise.all([
                                  fetchProducts(shop),
                                  fetchStatus(shop)
                                ]);
                              })
                              .catch(err => addNotification('Some drafts failed to publish', 'error'));
                          }
                        );
                      }}
                      disabled={optimizing || !products.some(p => p.hasDraft)}
                      className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                      title="Publish all draft optimizations"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Publish Drafts</span>
                    </button>
                    <button
                      onClick={() => rollbackAllOptimizations('product')}
                      disabled={optimizing || !products.some(p => p.optimized)}
                      className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                      title="Rollback all product optimizations"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Rollback All</span>
                    </button>
                  </div>
                </div>
                
                {products.length === 0 ? (
                  <p className="text-gray-300 text-center py-8">No products found</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map((product) => (
                      <ContentCard
                        key={product.id}
                        item={product}
                        type="product"
                        isSelected={selectedProducts.includes(product.id.toString())}
                        onToggleSelect={(id) => toggleProductSelection(id.toString())}
                        onPreview={handlePreviewDraft}
                        onPublish={publishDraft}
                        onRollback={rollback}
                        title={product.title}
                        subtitle={product.vendor || product.product_type ? `${product.vendor || ''}${product.vendor && product.product_type ? ' • ' : ''}${product.product_type || ''}` : ''}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Blogs Tab - Individual Articles */}
            {activeTab === 'blogs' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Select Blog Articles</h3>
                  <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          if (selectedArticles.length === articles.length) {
                            setSelectedArticles([]);
                          } else {
                            setSelectedArticles(articles.map(a => a.id.toString()));
                          }
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-out flex items-center space-x-1 bg-transparent text-white border border-white/20 hover:border-gray-400"
                        title={selectedArticles.length === articles.length ? "Deselect all articles" : "Select all articles"}
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>{selectedArticles.length === articles.length ? 'Deselect All' : 'Select All'}</span>
                      </button>
                      
                      {/* Auto-Optimize Button */}
                      <AutoOptimizeToggle
                        enabled={autoOptimizeEnabled}
                        loading={autoOptimizeLoading}
                        tier={testTier}
                        onToggle={toggleAutoOptimize}
                        onUpgrade={() => setShowUpgradeModal(true)}
                      />
                      <button
                        onClick={() => optimizeArticles()}
                        disabled={optimizing || selectedArticles.length === 0 || (tierUsage && !tierUsage.hasQuota)}
                        title={tierUsage && !tierUsage.hasQuota ? `Quota exceeded: ${tierUsage.usageThisMonth}/${tierUsage.monthlyLimit} optimizations used this month` : 'Optimize selected articles'}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
                      >
                        {optimizing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Optimizing...</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-4 h-4" />
                            <span>Optimize Selected</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const drafts = articles.filter(a => a.hasDraft);
                          if (drafts.length === 0) {
                            addNotification('No drafts to publish', 'info');
                            return;
                          }
                          showConfirmation(
                            'Publish Drafts',
                            `Publish ${drafts.length} draft optimizations? This will make the draft content live on your store.`,
                            () => {
                              Promise.all(drafts.map(a => performPublishDraft('article', a.id)))
                                .then(async () => {
                                  addNotification(`Successfully published ${drafts.length} drafts`, 'success');
                                  // Final refresh to ensure UI is updated
                                  await Promise.all([
                                    fetchBlogs(shop),
                                    fetchStatus(shop)
                                  ]);
                                })
                                .catch(err => addNotification('Some drafts failed to publish', 'error'));
                            }
                          );
                        }}
                        disabled={optimizing || !articles.some(a => a.hasDraft)}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                        title="Publish all article drafts"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Publish Drafts</span>
                      </button>
                      <button
                        onClick={() => rollbackAllOptimizations('article')}
                        disabled={optimizing || !articles.some(a => a.optimized)}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                        title="Rollback all article optimizations"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Rollback All</span>
                      </button>
                    </div>
                </div>
                
                {articles.length === 0 ? (
                    <p className="text-gray-300 text-center py-8">No blog articles found</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {articles.map((article) => (
                        <ContentCard
                          key={article.id}
                          item={article}
                          type="article"
                          isSelected={selectedArticles.includes(article.id.toString())}
                          onToggleSelect={(id) => toggleArticleSelection(id.toString())}
                          onPreview={handlePreviewDraft}
                          onPublish={publishDraft}
                          onRollback={rollback}
                          title={article.title}
                        />
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Pages Tab */}
            {activeTab === 'pages' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Select Pages</h3>
                  <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          if (selectedPages.length === pages.length) {
                            setSelectedPages([]);
                          } else {
                            setSelectedPages(pages.map(p => p.id.toString()));
                          }
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-out flex items-center space-x-1 bg-transparent text-white border border-white/20 hover:border-gray-400"
                        title={selectedPages.length === pages.length ? "Deselect all pages" : "Select all pages"}
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>{selectedPages.length === pages.length ? 'Deselect All' : 'Select All'}</span>
                      </button>
                      
                      {/* Auto-Optimize Button */}
                      <AutoOptimizeToggle
                        enabled={autoOptimizeEnabled}
                        loading={autoOptimizeLoading}
                        tier={testTier}
                        onToggle={toggleAutoOptimize}
                        onUpgrade={() => setShowUpgradeModal(true)}
                      />
                      <button
                        onClick={optimizePages}
                        disabled={optimizing || selectedPages.length === 0 || (tierUsage && !tierUsage.hasQuota)}
                        title={tierUsage && !tierUsage.hasQuota ? `Quota exceeded: ${tierUsage.usageThisMonth}/${tierUsage.monthlyLimit} optimizations used this month` : 'Optimize selected pages'}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
                      >
                        {optimizing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Optimizing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Optimize Selected</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const drafts = pages.filter(p => p.hasDraft);
                          if (drafts.length === 0) {
                            addNotification('No drafts to publish', 'info');
                            return;
                          }
                          showConfirmation(
                            'Publish Drafts',
                            `Publish ${drafts.length} draft optimizations? This will make the draft content live on your store.`,
                            () => {
                              Promise.all(drafts.map(p => performPublishDraft('page', p.id)))
                                .then(async () => {
                                  addNotification(`Successfully published ${drafts.length} drafts`, 'success');
                                  await Promise.all([
                                    fetchPages(shop),
                                    fetchStatus(shop)
                                  ]);
                                })
                                .catch(err => addNotification('Some drafts failed to publish', 'error'));
                            }
                          );
                        }}
                        disabled={optimizing || !pages.some(p => p.hasDraft)}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                        title="Publish all draft optimizations"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Publish Drafts</span>
                      </button>
                      <button
                        onClick={() => rollbackAllOptimizations('page')}
                        disabled={optimizing || !pages.some(p => p.optimized)}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                        title="Rollback all page optimizations"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Rollback All</span>
                      </button>
                    </div>
                </div>
                
                {pages.length === 0 ? (
                    <p className="text-gray-300 text-center py-8">No pages found</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pages.map((page) => (
                        <ContentCard
                          key={page.id}
                          item={page}
                          type="page"
                          isSelected={selectedPages.includes(page.id.toString())}
                          onToggleSelect={(id) => {
                            const pageId = id.toString();
                            setSelectedPages(prev => 
                              prev.includes(pageId) 
                                ? prev.filter(id => id !== pageId)
                                : [...prev, pageId]
                            );
                          }}
                          onPreview={handlePreviewDraft}
                          onPublish={publishDraft}
                          onRollback={rollback}
                          title={page.title}
                        />
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Collections Tab */}
            {activeTab === 'collections' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">Select Collections</h3>
                  <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          if (selectedCollections.length === collections.length) {
                            setSelectedCollections([]);
                          } else {
                            setSelectedCollections(collections.map(c => c.id.toString()));
                          }
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-out flex items-center space-x-1 bg-transparent text-white border border-white/20 hover:border-gray-400"
                        title={selectedCollections.length === collections.length ? "Deselect all collections" : "Select all collections"}
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>{selectedCollections.length === collections.length ? 'Deselect All' : 'Select All'}</span>
                      </button>
                      
                      {/* Auto-Optimize Button */}
                      <AutoOptimizeToggle
                        enabled={autoOptimizeEnabled}
                        loading={autoOptimizeLoading}
                        tier={testTier}
                        onToggle={toggleAutoOptimize}
                        onUpgrade={() => setShowUpgradeModal(true)}
                      />
                      <button
                        onClick={optimizeCollections}
                        disabled={optimizing || selectedCollections.length === 0 || (tierUsage && !tierUsage.hasQuota)}
                        title={tierUsage && !tierUsage.hasQuota ? `Quota exceeded: ${tierUsage.usageThisMonth}/${tierUsage.monthlyLimit} optimizations used this month` : 'Optimize selected collections'}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-500 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-blue-700"
                      >
                        {optimizing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Optimizing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Optimize Selected</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const drafts = collections.filter(c => c.hasDraft);
                          if (drafts.length === 0) {
                            addNotification('No drafts to publish', 'info');
                            return;
                          }
                          showConfirmation(
                            'Publish Drafts',
                            `Publish ${drafts.length} draft optimizations? This will make the draft content live on your store.`,
                            () => {
                              Promise.all(drafts.map(c => performPublishDraft('collection', c.id)))
                                .then(async () => {
                                  addNotification(`Successfully published ${drafts.length} drafts`, 'success');
                                  await Promise.all([
                                    fetchCategories(shop),
                                    fetchStatus(shop)
                                  ]);
                                })
                                .catch(err => addNotification('Some drafts failed to publish', 'error'));
                            }
                          );
                        }}
                        disabled={optimizing || !collections.some(c => c.hasDraft)}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                        title="Publish all draft optimizations"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Publish Drafts</span>
                      </button>
                      <button
                        onClick={() => rollbackAllOptimizations('collection')}
                        disabled={optimizing || !collections.some(c => c.optimized)}
                        className="px-4 py-2 rounded-xl font-medium transition-all duration-200 ease-out flex items-center space-x-2 bg-transparent text-white border border-white/20 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/20"
                        title="Rollback all collection optimizations"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Rollback All</span>
                      </button>
                    </div>
                </div>
                
                {(() => {
                  console.log('RENDER DEBUG: collections.length =', collections.length);
                  console.log('RENDER DEBUG: collections =', collections);
                  return collections.length === 0;
                })() ? (
                    <p className="text-gray-300 text-center py-8">No collections found</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {collections.map((category) => (
                        <ContentCard
                          key={category.id}
                          item={category}
                          type="collection"
                          isSelected={selectedCollections.includes(category.id.toString())}
                          onToggleSelect={(id) => {
                            const categoryId = id.toString();
                            setSelectedCollections(prev => 
                              prev.includes(categoryId) 
                                ? prev.filter(id => id !== categoryId)
                                : [...prev, categoryId]
                            );
                          }}
                          onPreview={handlePreviewDraft}
                          onPublish={publishDraft}
                          onRollback={rollback}
                          title={category.title}
                        />
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* Boost AI Discovery Tab */}
            {activeTab === 'boost-ai' && (
              <div className="space-y-6">
                {/* Intro Section */}
                <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <Target className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-3">🧭 Boost AI Discovery</h3>
                      <p className="text-gray-300 mb-4">
                        Advanced strategies to maximize your store's visibility across AI platforms like ChatGPT, Claude, Gemini, and Perplexity. 
                        These expert-level techniques go beyond basic optimization.
                      </p>
                      <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4">
                        <p className="text-sm text-blue-200 flex items-center">
                          <Info className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span><strong>Pro Tip:</strong> Complete these strategies in order for maximum impact on AI search results.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content - Accordion/Card UI */}
                <div className="grid gap-4">
                  {/* 1. Submit to Bing Merchant Center */}
                  <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-blue-500/30 transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          boostAiCompletions['bing-merchant'] 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-400'
                        }`}>
                          {boostAiCompletions['bing-merchant'] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">1. Submit to Bing Merchant Center</h4>
                          <p className="text-sm text-gray-400">Essential for Copilot and Edge AI integration</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-9 space-y-4">
                      <p className="text-gray-300 text-sm">
                        Bing Merchant Center feeds directly into Microsoft's AI ecosystem, including Copilot. This ensures your products 
                        appear in AI-powered shopping recommendations and searches.
                      </p>
                      
                      <div className="flex flex-wrap gap-3">
                        <a
                          href="https://www.bingplaces.com/merchantcenter"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Bing Merchant Center
                        </a>
                        
                        <button
                          onClick={() => handleBoostAiToggle('bing-merchant')}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            boostAiCompletions['bing-merchant']
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {boostAiCompletions['bing-merchant'] ? 'Completed' : 'Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. Submit Your Site to Perplexity AI */}
                  <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-purple-500/30 transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          boostAiCompletions['perplexity-submit'] 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-400'
                        }`}>
                          {boostAiCompletions['perplexity-submit'] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">2. Submit Your Site to Perplexity AI</h4>
                          <p className="text-sm text-gray-400">Direct indexing for AI search results</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-9 space-y-4">
                      <p className="text-gray-300 text-sm">
                        Perplexity allows direct site submission for faster AI indexing. This dramatically improves your chances 
                        of appearing in Perplexity's search results and citations.
                      </p>
                      
                      <div className="flex flex-wrap gap-3">
                        <a
                          href="https://perplexity.ai/hub/submit"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Submit to Perplexity
                        </a>
                        
                        <button
                          onClick={() => handleBoostAiToggle('perplexity-submit')}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            boostAiCompletions['perplexity-submit']
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {boostAiCompletions['perplexity-submit'] ? 'Completed' : 'Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Fix JSON-LD Conflicts */}
                  <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-yellow-500/30 transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          boostAiCompletions['jsonld-conflicts'] 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-400'
                        }`}>
                          {boostAiCompletions['jsonld-conflicts'] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">3. Fix JSON-LD Conflicts</h4>
                          <p className="text-sm text-gray-400">Resolve schema markup issues</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-9 space-y-4">
                      <p className="text-gray-300 text-sm">
                        Multiple JSON-LD schemas can conflict and confuse AI platforms. Use Google's testing tool 
                        to identify and resolve conflicts for cleaner data parsing by AI systems.
                      </p>
                      
                      <div className="flex flex-wrap gap-3">
                        <a
                          href="https://developers.google.com/search/docs/appearance/structured-data"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Schema Testing Tool
                        </a>
                        
                        <button
                          onClick={() => handleBoostAiToggle('jsonld-conflicts')}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            boostAiCompletions['jsonld-conflicts']
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {boostAiCompletions['jsonld-conflicts'] ? 'Completed' : 'Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 4. Create Fresh Content Strategy */}
                  <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-indigo-500/30 transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          boostAiCompletions['fresh-content'] 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-400'
                        }`}>
                          {boostAiCompletions['fresh-content'] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">4. Create Fresh Content Strategy</h4>
                          <p className="text-sm text-gray-400">Regular updates for AI relevance</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-9 space-y-4">
                      <p className="text-gray-300 text-sm">
                        AI platforms favor recently updated content. Establish a content refresh schedule to maintain 
                        high visibility in AI search results and recommendations.
                      </p>
                      
                      <div className="bg-indigo-900/30 rounded-lg p-4 border border-indigo-500/30">
                        <p className="text-sm text-indigo-200 mb-2"><strong>Recommended Schedule:</strong></p>
                        <ul className="text-sm text-indigo-300 space-y-1 ml-4 list-disc">
                          <li>Weekly: Add 1-2 new blog posts about your products</li>
                          <li>Bi-weekly: Update product descriptions with seasonal content</li>
                          <li>Monthly: Refresh your About page and policies</li>
                          <li>Quarterly: Add new FAQ sections based on customer questions</li>
                        </ul>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleBoostAiToggle('fresh-content')}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            boostAiCompletions['fresh-content']
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {boostAiCompletions['fresh-content'] ? 'Completed' : 'Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 5. Build Comprehensive FAQ Page */}
                  <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-pink-500/30 transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          boostAiCompletions['faq-page'] 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-400'
                        }`}>
                          {boostAiCompletions['faq-page'] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">5. Build Comprehensive FAQ Page</h4>
                          <p className="text-sm text-gray-400">AI platforms love Q&A format</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-9 space-y-4">
                      <p className="text-gray-300 text-sm">
                        FAQ pages are AI gold mines. They directly answer user questions in the exact format AI 
                        platforms use. Create detailed FAQs covering every aspect of your business and products.
                      </p>
                      
                      <div className="bg-pink-900/30 rounded-lg p-4 border border-pink-500/30">
                        <p className="text-sm text-pink-200 mb-2"><strong>Essential FAQ Categories:</strong></p>
                        <ul className="text-sm text-pink-300 space-y-1 ml-4 list-disc">
                          <li>Product specifications and compatibility</li>
                          <li>Shipping, returns, and warranty policies</li>
                          <li>Usage instructions and troubleshooting</li>
                          <li>Comparison with competitors</li>
                          <li>Pricing and payment options</li>
                        </ul>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleBoostAiToggle('faq-page')}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            boostAiCompletions['faq-page']
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {boostAiCompletions['faq-page'] ? 'Completed' : 'Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 6. Optimize Descriptive Titles */}
                  <div className="bg-dark-card border border-dark-border rounded-xl p-6 hover:border-teal-500/30 transition-all duration-200">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          boostAiCompletions['descriptive-titles'] 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-400'
                        }`}>
                          {boostAiCompletions['descriptive-titles'] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">6. Optimize Descriptive Titles</h4>
                          <p className="text-sm text-gray-400">Clear, semantic naming for AI understanding</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-9 space-y-4">
                      <p className="text-gray-300 text-sm">
                        AI platforms rely heavily on clear, descriptive titles to understand content context. 
                        Avoid vague titles and focus on specific, benefit-focused descriptions.
                      </p>
                      
                      <div className="bg-teal-900/30 rounded-lg p-4 border border-teal-500/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-red-300 mb-2"><strong>❌ Avoid:</strong></p>
                            <ul className="text-sm text-red-400 space-y-1 ml-4 list-disc">
                              <li>"Super Cool Product"</li>
                              <li>"Best Item Ever"</li>
                              <li>"Check This Out"</li>
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm text-green-300 mb-2"><strong>✅ Use Instead:</strong></p>
                            <ul className="text-sm text-green-400 space-y-1 ml-4 list-disc">
                              <li>"Wireless Bluetooth Headphones with 30H Battery"</li>
                              <li>"Organic Cotton T-Shirt for Sensitive Skin"</li>
                              <li>"Stainless Steel Kitchen Knife Set - 7 Pieces"</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleBoostAiToggle('descriptive-titles')}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            boostAiCompletions['descriptive-titles']
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {boostAiCompletions['descriptive-titles'] ? 'Completed' : 'Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 7. Advanced Pro Tips */}
                  <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          boostAiCompletions['pro-tips'] 
                            ? 'bg-green-500 border-green-500' 
                            : 'border-gray-400'
                        }`}>
                          {boostAiCompletions['pro-tips'] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-white">7. 🚀 Advanced Pro Tips</h4>
                          <p className="text-sm text-gray-400">Expert-level AI visibility strategies</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-9 space-y-4">
                      <div className="grid gap-4">
                        <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-500/30">
                          <h5 className="font-medium text-purple-200 mb-2">🎯 Semantic Clustering</h5>
                          <p className="text-sm text-purple-300">
                            Group related products with shared vocabulary. AI platforms recognize semantic relationships 
                            and will suggest your entire product line when one item is mentioned.
                          </p>
                        </div>
                        
                        <div className="bg-pink-900/30 rounded-lg p-4 border border-pink-500/30">
                          <h5 className="font-medium text-pink-200 mb-2">🔗 Cross-Platform Consistency</h5>
                          <p className="text-sm text-pink-300">
                            Use identical product names, descriptions, and key phrases across all platforms 
                            (Shopify, social media, business listings) to reinforce AI recognition patterns.
                          </p>
                        </div>
                        
                        <div className="bg-indigo-900/30 rounded-lg p-4 border border-indigo-500/30">
                          <h5 className="font-medium text-indigo-200 mb-2">📊 Monitor AI Mentions</h5>
                          <p className="text-sm text-indigo-300">
                            Set up Google Alerts for your brand name + "AI recommends" or "according to AI" 
                            to track when AI platforms mention your products organically.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleBoostAiToggle('pro-tips')}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            boostAiCompletions['pro-tips']
                              ? 'bg-gray-600 hover:bg-gray-700 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {boostAiCompletions['pro-tips'] ? 'Completed' : 'Mark as Done'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Summary */}
                <div className="bg-dark-card border border-dark-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-blue-400" />
                    Progress Summary
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400 mb-1">
                        {Object.values(boostAiCompletions).filter(Boolean).length}
                      </div>
                      <div className="text-sm text-gray-400">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-400 mb-1">
                        {7 - Object.values(boostAiCompletions).filter(Boolean).length}
                      </div>
                      <div className="text-sm text-gray-400">Remaining</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400 mb-1">
                        {Math.round((Object.values(boostAiCompletions).filter(Boolean).length / 7) * 100)}%
                      </div>
                      <div className="text-sm text-gray-400">Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400 mb-1">7</div>
                      <div className="text-sm text-gray-400">Total Strategies</div>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(Object.values(boostAiCompletions).filter(Boolean).length / 7) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {preview && (
          <div className="bg-dark-card rounded-xl border border-dark-border p-6 mb-8 hover:ring-1 hover:ring-gray-500/30 transition-all duration-200 ease-out">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Optimization Preview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-text-secondary mb-2">Original Content</h3>
                <div className="bg-dark-bg p-4 rounded border border-dark-border">
                  <p className="font-semibold text-text-primary">{preview.original.title || preview.original.name}</p>
                  <p className="text-sm text-text-muted mt-2">{preview.original.description}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-text-secondary mb-2">AI-Optimized Content</h3>
                <div className="bg-accent-secondary/10 p-4 rounded border border-accent-secondary/30">
                  <p className="font-semibold text-accent-secondary mb-2">Summary:</p>
                  <p className="text-sm text-text-secondary mb-3">{preview.optimized.summary}</p>
                  
                  <p className="font-semibold text-accent-secondary mb-2">FAQs:</p>
                  {preview.optimized.faqs.map((faq, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-sm font-medium text-accent-secondary">Q: {faq.question}</p>
                      <p className="text-sm text-text-secondary">A: {faq.answer}</p>
                    </div>
                  ))}
                  
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-accent-secondary hover:text-accent-primary transition-colors">View Technical Implementation</summary>
                    <pre className="mt-2 text-xs bg-dark-bg p-2 rounded overflow-x-auto text-text-muted border border-dark-border">{preview.preview.jsonLd}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="bg-dark-card rounded-2xl shadow-md border border-dark-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Optimization History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Item ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-dark-card divide-y divide-dark-border">
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary capitalize">{item.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">{item.itemId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          v{item.version || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => rollback(item.type, item.itemId)}
                          className="text-red-600 hover:text-red-800 flex items-center space-x-1"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Rollback</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Instructions Tab */}
        {activeTab === 'instructions' && (
          <div className="prose prose-blue max-w-none -mt-8">
            <div className="bg-dark-bg rounded-lg p-6 border border-dark-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                🧭 How to Use AI Search Booster
              </h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-text-primary mb-2 flex items-center">
                    ✅ Step 1: Connect Your Shopify Store
                  </h4>
                  <p className="text-text-secondary text-sm">
                    Once installed, AI Search Booster automatically connects through OAuth. No setup required.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2 flex items-center">
                    ✅ Step 2: Select What You Want to Optimize
                  </h4>
                  <p className="text-text-secondary text-sm mb-2">Use the sidebar to navigate between:</p>
                  <ul className="text-sm text-text-secondary ml-4 list-disc">
                    <li>Products</li>
                    <li>Blog Posts</li>
                    <li>Pages</li>
                    <li>Collections</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2 flex items-center">
                    ✅ Step 3: Click "Optimize"
                  </h4>
                  <ul className="text-sm text-white ml-4 list-disc space-y-1">
                    <li>🟦 Click <strong>"Optimize All"</strong> to process everything</li>
                    <li>✅ Or select specific items and click <strong>"Optimize Selected"</strong></li>
                  </ul>
                  <p className="text-white text-sm mt-2">A draft is created for each item.</p>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2 flex items-center">
                    ✅ Step 4: Preview & Approve
                  </h4>
                  <p className="text-white text-sm mb-2">Each draft includes:</p>
                  <ul className="text-sm text-white ml-4 list-disc space-y-1">
                    <li>LLM-optimized summary and description</li>
                    <li>Embedded JSON-LD</li>
                    <li>&lt;div data-llm&gt; blocks</li>
                    <li>FAQ schema</li>
                  </ul>
                  <p className="text-white text-sm mt-2">You can:</p>
                  <ul className="text-sm text-white ml-4 list-disc space-y-1">
                    <li>✅ <strong>Publish</strong></li>
                    <li>🔄 <strong>Rollback</strong></li>
                    <li>♻️ <strong>Re-optimize</strong></li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-text-primary mb-2 flex items-center">
                    ✅ Step 5: Track Progress
                  </h4>
                  <p className="text-white text-sm mb-2">Use the dashboard stats:</p>
                  <ul className="text-sm text-white ml-4 list-disc space-y-1">
                    <li>Optimized items</li>
                    <li>Usage count</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === 'support' && (
          <div className="prose prose-blue max-w-none -mt-8">
            <div className="bg-dark-bg rounded-lg p-6 border border-dark-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                🧰 FAQ
              </h3>
            
              <div className="space-y-3">
                {[
                {
                  question: "What does AI Search Booster do?",
                  answer: "It enhances your Shopify content to be discoverable by ChatGPT, Claude, Gemini, and Perplexity — using JSON-LD, semantic summaries, FAQs, and invisible AI-readable blocks."
                },
                {
                  question: "Will this change how my store looks?",
                  answer: "No. All content is invisible to human users and does not affect your Shopify theme."
                },
                {
                  question: "Can I undo changes?",
                  answer: "Yes — all content is nondestructive. You can: Preview before publishing, Rollback at any time, View original content anytime."
                },
                {
                  question: "How is this different from SEO?",
                  answer: "This is not Google SEO. This is for discoverability in LLM answers, not search engines. It prioritizes semantic clarity, FAQs, JSON-LD, and LLM-friendly structure."
                },
                {
                  question: "How often should I re-optimize?",
                  answer: "Re-optimize whenever you: Change your product/page/blog content, Add new content, Want to adapt to better LLM parsing formats."
                },
                {
                  question: "How do I get help?",
                  answer: "Email: AskMaxEvo@gmail.com"
                }
              ].map((faq, index) => (
                <div key={index} className="border border-dark-border rounded-lg bg-dark-card">
                  <button
                    className="w-full px-4 py-3 text-left flex justify-between items-center hover:bg-[#363636] focus:outline-none focus:bg-[#363636]"
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  >
                    <span className="font-medium text-text-primary">❓ {faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-text-muted transform transition-transform ${
                        expandedFaq === index ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedFaq === index && (
                    <div className="px-4 pb-3">
                      <p className="text-text-secondary text-sm">{faq.answer}</p>
                    </div>
                  )}
                </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Terms & Disclaimer Tab */}
        {activeTab === 'terms' && (
          <div className="prose prose-blue max-w-none -mt-8">
            <div className="bg-dark-bg rounded-lg p-6 border border-dark-border">
              <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                📜 Legal Disclaimer
              </h3>
            
              <div className="prose prose-sm text-white space-y-4">
              <p>
                AI Search Booster provides content optimization suggestions using advanced automation. While we aim to improve your store's visibility across modern search platforms, results may vary depending on your existing content, store setup, and third-party platform behavior.
              </p>
              
              <p>
                <strong>All optimization suggestions should be reviewed before publishing.</strong> You are solely responsible for verifying the accuracy, appropriateness, and compliance of any content generated using this app.
              </p>
              
              <p>By using this app, you acknowledge and accept that:</p>
              
              <ul className="list-disc ml-6 space-y-2">
                <li>You are responsible for any content published via this tool.</li>
                <li>We are not liable for how optimization outputs are used or interpreted.</li>
                <li>No guarantee is made that use of this app will result in increased traffic, visibility, or sales.</li>
                <li>This tool is provided "as-is" without warranties of any kind. Use at your own discretion.</li>
              </ul>
              
              <p className="text-xs text-white mt-6 p-3 bg-dark-bg-secondary rounded border border-dark-border">
                Consent to these terms is recorded with a timestamp and securely stored. This record may be referenced in the event of legal inquiries or disputes regarding usage.
              </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="prose prose-blue max-w-none -mt-8">
            <div className="bg-[#1e1e1e] rounded-lg p-6 border border-dark-border">
              <h3 className="text-lg font-semibold text-white mb-4">Optimization Settings</h3>
              
              {settings && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Target AI Platform
                    </label>
                    <select
                      value={settings.targetLLM || 'general'}
                      onChange={(e) => setSettings({...settings, targetLLM: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="general">All Platforms</option>
                      <option value="chatgpt">ChatGPT</option>
                      <option value="claude">Claude</option>
                      <option value="perplexity">Perplexity</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Keywords (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={settings.keywords || ''}
                      onChange={(e) => setSettings({...settings, keywords: e.target.value})}
                      placeholder="organic, sustainable, premium"
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tone
                    </label>
                    <select
                      value={settings.tone || 'professional'}
                      onChange={(e) => setSettings({...settings, tone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="technical">Technical</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                </div>
              )}
              
              {/* Auto-Optimization Section */}
              <div className="mt-6 pt-6 border-t border-gray-600">
                <h4 className="text-md font-semibold text-white mb-4 flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span>Background Auto-Optimization</span>
                  <span className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-2 py-1 rounded-full font-bold">
                    PAID ONLY
                  </span>
                </h4>
                
                <div className="space-y-4">
                  <div className="bg-[#2a2a2a] rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="auto-optimize-toggle"
                            checked={autoOptimizeEnabled}
                            onChange={(e) => toggleAutoOptimize(e.target.checked)}
                            disabled={autoOptimizeLoading || testTier === 'Free'}
                            className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                          />
                          <label 
                            htmlFor="auto-optimize-toggle" 
                            className="text-sm font-medium text-white cursor-pointer"
                          >
                            Enable Auto-Optimization
                          </label>
                        </div>
                        {autoOptimizeLoading && (
                          <Loader className="w-4 h-4 text-blue-500 animate-spin" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          autoOptimizeEnabled ? 'bg-green-500' : 'bg-gray-500'
                        }`}></div>
                        <span className="text-xs text-gray-400">
                          {autoOptimizeEnabled ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-3">
                      Automatically optimize new products, blogs, collections, and pages when published in Shopify. 
                      Content is optimized in the background and injected invisibly via the Theme App Extension.
                    </p>
                    
                    {testTier === 'Free' && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm text-yellow-400 font-medium">
                            Upgrade Required
                          </span>
                        </div>
                        <p className="text-xs text-yellow-300 mt-1">
                          Auto-optimization is available for Starter, Pro, and Enterprise plans. 
                          Upgrade to enable automatic background optimization of your content.
                        </p>
                      </div>
                    )}
                    
                    {autoOptimizeEnabled && autoOptimizeStatus && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-400">Queue Status:</span>
                          <span className="text-white">
                            {autoOptimizeStatus.queueLength} items pending
                            {autoOptimizeStatus.isProcessing && ' (processing...)'}
                          </span>
                        </div>
                        {autoOptimizeStatus.nextItems && autoOptimizeStatus.nextItems.length > 0 && (
                          <div className="mt-2 text-xs text-gray-400">
                            Next: {autoOptimizeStatus.nextItems.map(item => 
                              `${item.resourceType} ${item.resourceId}`
                            ).join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-400 mt-3 space-y-1">
                      <div>• Content is never overwritten - optimization stored in metafields</div>
                      <div>• Prevents duplicate optimizations within 24 hours</div>
                      <div>• Uses efficient GPT-4o-mini model for background processing</div>
                      <div>• Automatic retry with exponential backoff on failures</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Secure Admin Access */}
              <div className="mt-6 pt-6 border-t border-gray-600">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-semibold text-white">Production Settings</h4>
                  <button
                    onClick={() => setShowSecureAdmin(true)}
                    className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                    title="Secure Admin Access"
                  >
                    admin
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  All settings optimized for production use. Secure admin controls available with authentication.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* Draft Preview Modal - Production-grade UI */}
      {showDraftModal && selectedDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl mx-auto border border-gray-700">
            <div className="p-6">
              {/* Header with Human-Readable Title */}
              <div className="text-center border-b border-dark-border pb-4 mb-6">
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  {selectedDraft.type.charAt(0).toUpperCase() + selectedDraft.type.slice(1)}: Draft Preview – {getContentTitle(selectedDraft.type, selectedDraft.id, selectedDraft.data)}
                </h2>
                <button
                  onClick={() => setShowDraftModal(false)}
                  className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Two-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                {/* Left Column: Optimized Content */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-blue-500" />
                    Optimized Content
                  </h3>
                  {selectedDraft.data.hasDraft ? (
                    <div className="space-y-4">
                      {/* Quality Assessment Card */}
                      {(selectedDraft.data.draft.content?.visibilityScore !== undefined || 
                        selectedDraft.data.draft.content?.rolledBack || 
                        (showAdvancedDebugUI && selectedDraft.data.draft.content?.riskScore !== undefined)) && (
                        <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-gray-700">
                          <h4 className="text-md font-medium text-white mb-4 flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2 text-gray-300" />
                            Quality Assessment
                          </h4>
                          <div className={`grid gap-6 ${
                            // Calculate grid columns based on what's visible
                            (() => {
                              const hasRiskScore = showAdvancedDebugUI && selectedDraft.data.draft.content?.riskScore !== undefined;
                              const hasVisibilityScore = selectedDraft.data.draft.content?.visibilityScore !== undefined;
                              const hasRolledBack = selectedDraft.data.draft.content?.rolledBack;
                              const visibleItems = [hasRiskScore, hasVisibilityScore, hasRolledBack].filter(Boolean).length;
                              
                              if (visibleItems === 1) return 'grid-cols-1 place-items-center';
                              if (visibleItems === 2) return 'grid-cols-1 sm:grid-cols-2';
                              return 'grid-cols-1 sm:grid-cols-3';
                            })()
                          }`}>
                            {showAdvancedDebugUI && selectedDraft.data.draft.content?.riskScore !== undefined && (
                              <div className="text-center">
                                <span className="text-gray-300 text-xs font-medium block mb-2">Risk Score</span>
                                <div className={`text-2xl font-bold mb-1 ${
                                  selectedDraft.data.draft.content.riskScore > 0.7 ? 'text-red-600' :
                                  selectedDraft.data.draft.content.riskScore > 0.4 ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                  {(selectedDraft.data.draft.content.riskScore * 100).toFixed(0)}%
                                </div>
                                <span className={`text-xs inline-flex items-center ${
                                  selectedDraft.data.draft.content.riskScore > 0.7 ? 'text-red-500' :
                                  selectedDraft.data.draft.content.riskScore > 0.4 ? 'text-yellow-500' : 'text-green-500'
                                }`}>
                                  {selectedDraft.data.draft.content.riskScore > 0.7 ? '❌ High Risk' :
                                   selectedDraft.data.draft.content.riskScore > 0.4 ? '⚠️ Medium Risk' : '✅ Low Risk'}
                                </span>
                              </div>
                            )}
                            {selectedDraft.data.draft.content?.visibilityScore !== undefined && (
                              <div className="text-center max-w-xs mx-auto">
                                <span className="text-gray-300 text-sm font-medium block mb-3">AI Visibility Score</span>
                                <div className={`text-5xl font-bold mb-3 ${
                                  selectedDraft.data.draft.content.visibilityScore >= 80 ? 'text-green-600' :
                                  selectedDraft.data.draft.content.visibilityScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {selectedDraft.data.draft.content.visibilityScore}
                                </div>
                                <span className={`text-sm inline-flex items-center justify-center font-medium px-3 py-1 rounded-full ${
                                  selectedDraft.data.draft.content.visibilityScore >= 80 ? 'text-green-400 bg-green-900/30' :
                                  selectedDraft.data.draft.content.visibilityScore >= 60 ? 'text-yellow-400 bg-yellow-900/30' : 'text-red-400 bg-red-900/30'
                                }`}>
                                  {selectedDraft.data.draft.content.visibilityScore >= 80 ? '✅ Excellent' :
                                   selectedDraft.data.draft.content.visibilityScore >= 60 ? '⚠️ Good' : '❌ Needs Work'}
                                </span>
                              </div>
                            )}
                            {selectedDraft.data.draft.content?.rolledBack && (
                              <div className="text-center">
                                <span className="text-gray-300 text-xs font-medium block mb-2">Safety Status</span>
                                <div className="text-2xl font-bold text-orange-600 mb-1 flex items-center justify-center">
                                  <RotateCcw className="w-5 h-5 mr-1" />
                                  Auto
                                </div>
                                <span className="text-xs text-orange-500">
                                  ⚠️ Rolled Back
                                </span>
                              </div>
                            )}
                          </div>
                          {selectedDraft.data.draft.content?.promptVersion && (
                            <div className="mt-4 pt-4 border-t border-dark-border text-center">
                              <div className="text-xs text-gray-400">
                                Generated by GPT‑4 • {selectedDraft.data.draft.content.promptVersion}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Optimized Content Section */}
                      <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-gray-700">
                        <h4 className="text-md font-medium text-white mb-4 flex items-center">
                          <FileText className="w-5 h-5 mr-2 text-gray-300" />
                          Optimized Content
                        </h4>
                        <div className="space-y-4">
                          {selectedDraft.data.draft.content?.title && (
                            <div>
                              <h5 className="text-md font-medium text-gray-300 mb-1">Title</h5>
                              <div className="text-base text-gray-300 font-medium">{selectedDraft.data.draft.content.title}</div>
                            </div>
                          )}
                          {selectedDraft.data.draft.content?.optimizedDescription && (
                            <div>
                              <h5 className="text-md font-medium text-gray-300 mb-1">Description</h5>
                              <div className="text-base text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{selectedDraft.data.draft.content.optimizedDescription}</div>
                            </div>
                          )}
                          {selectedDraft.data.draft.content?.llmDescription && (
                            <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-200">
                              <h5 className="text-md font-medium text-gray-300 mb-1">LLM Description</h5>
                              <div className="text-base text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{selectedDraft.data.draft.content.llmDescription}</div>
                            </div>
                          )}
                          {selectedDraft.data.draft.content?.summary && (
                            <div>
                              <h5 className="text-md font-medium text-gray-300 mb-1">Summary</h5>
                              <div className="text-base text-gray-300">{selectedDraft.data.draft.content.summary}</div>
                            </div>
                          )}
                          {selectedDraft.data.draft.content?.description && !selectedDraft.data.draft.content?.title && (
                            <div>
                              <h5 className="text-md font-medium text-gray-300 mb-1">Content</h5>
                              <div className="text-base text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{selectedDraft.data.draft.content.description}</div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* FAQ Section */}
                      {(selectedDraft.data.draft.content?.faqs || selectedDraft.data.draft.faq) && (
                        <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-gray-700">
                          <h4 className="text-md font-medium text-white mb-4 flex items-center">
                            <HelpCircle className="w-5 h-5 mr-2 text-gray-300" />
                            Frequently Asked Questions
                          </h4>
                          <div className="space-y-3">
                            {(selectedDraft.data.draft.content?.faqs || selectedDraft.data.draft.faq?.questions || selectedDraft.data.draft.faq || []).map((faq, index) => (
                              <div key={index} className="bg-blue-900/20 rounded-lg p-4 border border-blue-100">
                                <div className="text-blue-600 font-medium mb-2 break-words">Q: {faq.q || faq.question}</div>
                                <div className="text-gray-300 leading-relaxed break-words">A: {faq.a || faq.answer}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-300">
                        Draft saved: {new Date(selectedDraft.data.draft.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-800/20 border border-dark-border rounded-lg p-4">
                      <p className="text-text-secondary">No draft content available</p>
                    </div>
                  )}
                </div>
                
                {/* Right Column: Live Content */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center">
                    <Globe className="w-5 h-5 mr-2 text-green-500" />
                    Live Content
                  </h3>
                  {selectedDraft.data.hasLive ? (
                    <div className="space-y-6">
                      <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-gray-700">
                        <h4 className="text-md font-medium text-white mb-4 flex items-center">
                          <Monitor className="w-5 h-5 mr-2 text-gray-300" />
                          Published Content
                        </h4>
                        <div className="text-base text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                          {selectedDraft.data.live.content}
                        </div>
                      </div>
                      
                      {selectedDraft.data.live.faq && (
                        <div className="bg-[#2a2a2a] rounded-lg shadow p-6 border border-gray-700">
                          <h4 className="text-md font-medium text-white mb-4 flex items-center">
                            <HelpCircle className="w-5 h-5 mr-2 text-gray-300" />
                            Published FAQ
                          </h4>
                          <div className="space-y-3">
                            {selectedDraft.data.live.faq?.map((faq, index) => (
                              <div key={index} className="bg-green-900/20 rounded-lg p-4 border border-green-100">
                                <div className="text-green-600 font-medium mb-2 break-words">Q: {faq.question}</div>
                                <div className="text-gray-300 leading-relaxed break-words">A: {faq.answer}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-300 text-center">
                        Published: {new Date(selectedDraft.data.live.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-800/20 border border-dark-border rounded-lg p-4">
                      <p className="text-text-secondary">No live content available</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowDraftModal(false)}
                  className="px-4 py-2 border border-dark-border rounded-md text-sm font-medium text-text-secondary bg-dark-bg-secondary hover:bg-[#363636]"
                >
                  Close
                </button>
                {selectedDraft.data.hasDraft && (
                  <button
                    onClick={() => {
                      publishDraft(selectedDraft.type, selectedDraft.id);
                      setShowDraftModal(false);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-out bg-transparent text-white border border-white/20 hover:border-green-500"
                  >
                    Publish Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Confirmation Modal */}
      {showConfirmModal && confirmConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">
                {confirmConfig.title}
              </h3>
              <p className="text-text-secondary mb-6">
                {confirmConfig.message}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleConfirmClose}
                  className="px-4 py-2 border border-dark-border rounded-md text-sm font-medium text-text-secondary bg-dark-bg-secondary hover:bg-[#363636]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ease-out bg-transparent text-white border border-white/20 hover:border-blue-600"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-lg w-full mx-4 border border-gray-700">
            <div className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-text-primary mb-4">
                  🚀 Welcome to AI Search Booster!
                </h2>
                <div className="space-y-4 text-text-secondary text-left">
                  <p>
                    This app enhances your store's visibility in modern search environments using advanced automation.
                  </p>
                  <p>
                    As with any optimization tool, please review changes before publishing.
                  </p>
                  <p>
                    By continuing, you agree to our{' '}
                    <button 
                      onClick={() => setShowTermsPopup(true)} 
                      className="text-accent-primary hover:text-accent-primary-hover underline"
                    >
                      Terms of Use and Legal Disclaimer
                    </button>.
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={consentCheckbox}
                    onChange={(e) => setConsentCheckbox(e.target.checked)}
                    className="mt-1 h-4 w-4 text-accent-primary focus:ring-accent-primary border-dark-border rounded bg-dark-bg-secondary"
                  />
                  <span className="text-sm text-text-secondary">
                    I understand this tool generates optimization suggestions that may require review before publishing.
                  </span>
                </label>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={handleConsentAccept}
                  disabled={!consentCheckbox}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    consentCheckbox 
                      ? 'bg-accent-primary text-white hover:bg-accent-primary-hover' 
                      : 'bg-dark-border text-text-disabled cursor-not-allowed'
                  }`}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms Popup Modal */}
      {showTermsPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden border border-gray-700">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-text-primary">
                  📜 Terms of Use & Legal Disclaimer
                </h2>
                <button
                  onClick={() => setShowTermsPopup(false)}
                  className="text-text-muted hover:text-text-primary text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="overflow-y-auto max-h-[60vh] prose prose-sm text-gray-300 space-y-4">
                <p>
                  AI Search Booster provides content optimization suggestions using advanced automation. While we aim to improve your store's visibility across modern search platforms, results may vary depending on your existing content, store setup, and third-party platform behavior.
                </p>
                
                <p>
                  <strong>All optimization suggestions should be reviewed before publishing.</strong> You are solely responsible for verifying the accuracy, appropriateness, and compliance of any content generated using this app.
                </p>
                
                <p>By using this app, you acknowledge and accept that:</p>
                
                <ul className="list-disc ml-6 space-y-2">
                  <li>You are responsible for any content published via this tool.</li>
                  <li>We are not liable for how optimization outputs are used or interpreted.</li>
                  <li>No guarantee is made that use of this app will result in increased traffic, visibility, or sales.</li>
                  <li>This tool is provided "as-is" without warranties of any kind. Use at your own discretion.</li>
                </ul>
                
                <p className="text-xs text-white mt-6 p-3 bg-dark-bg-secondary rounded border border-dark-border">
                  Consent to these terms is recorded with a timestamp and securely stored. This record may be referenced in the event of legal inquiries or disputes regarding usage.
                </p>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowTermsPopup(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legal Records Popup Modal */}
      {showLegalRecords && legalRecordsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden border border-gray-700">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-text-primary">
                  📋 Legal Consent Records Verification
                </h2>
                <button
                  onClick={() => setShowLegalRecords(false)}
                  className="text-text-muted hover:text-text-primary text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              <div className="overflow-y-auto max-h-[60vh] space-y-6">
                {/* Shop Info */}
                <div className="bg-blue-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-200 mb-2">Store Information</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Shop Domain:</strong> {legalRecordsData.shop}</p>
                    <p><strong>Records Retrieved:</strong> {new Date(legalRecordsData.retrievedAt).toLocaleString()}</p>
                  </div>
                </div>

                {/* Consent Status */}
                <div className="bg-green-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-200 mb-2">Consent Verification</h3>
                  {legalRecordsData.shopifyMetafields.length > 0 ? (
                    <div className="space-y-3">
                      {legalRecordsData.shopifyMetafields.map((field, index) => (
                        <div key={index} className="bg-dark-bg-secondary p-3 rounded border border-dark-border">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p><strong>Field:</strong> {field.key}</p>
                            <p><strong>Value:</strong> {field.value}</p>
                            <p><strong>Shopify ID:</strong> {field.id}</p>
                            <p><strong>Type:</strong> {field.type}</p>
                            <p><strong>Created:</strong> {new Date(field.created_at).toLocaleString()}</p>
                            <p><strong>Updated:</strong> {new Date(field.updated_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-red-600">❌ No consent records found</p>
                  )}
                </div>

                {/* Server Logs */}
                <div className="bg-yellow-900/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-yellow-200 mb-2">Server Audit Trail</h3>
                  <div className="text-sm space-y-2">
                    <p><strong>Log Reference:</strong></p>
                    <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                      {legalRecordsData.serverLogs}
                    </div>
                    <p className="text-gray-300">
                      Server logs contain IP address, user agent, and exact timestamps for legal protection.
                    </p>
                  </div>
                </div>

                {/* Legal Notes */}
                <div className="bg-gray-800/20 p-4 rounded-lg">
                  <h3 className="font-semibold text-text-primary mb-2">Legal Information</h3>
                  <div className="text-sm space-y-2">
                    <p>{legalRecordsData.legalNote}</p>
                    <div className="mt-3 p-3 bg-dark-bg-secondary border-l-4 border-blue-500">
                      <p className="font-medium">For Legal Inquiries:</p>
                      <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                        <li>Shopify metafields provide permanent storage with platform timestamps</li>
                        <li>Server logs include IP addresses and user agents for identity verification</li>
                        <li>All consent actions are logged with microsecond precision</li>
                        <li>Records can be cross-referenced between Shopify and server systems</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(legalRecordsData, null, 2));
                    addNotification('Legal records copied to clipboard', 'success');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Copy JSON Data
                </button>
                <button
                  onClick={() => setShowLegalRecords(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isVisible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={testTier}
        authFetch={authFetch}
        updateTier={setTestTier}
      />

      {/* Secure Admin Debug Modal */}
      <SecureAdminDebug
        isOpen={showSecureAdmin}
        onClose={() => setShowSecureAdmin(false)}
        authFetch={authFetch}
        shop={shop}
      />

      {/* Chat Assistant */}
      <ChatAssistant />

        </div>
      </main>
    </div>
  );
};

export default Dashboard;
