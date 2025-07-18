import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Eye, RotateCcw, Settings, Search, Sparkles, BookOpen, Package, X, Info, Monitor, Bell, TrendingUp } from 'lucide-react';
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
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedBlogs, setSelectedBlogs] = useState([]);
  const [usage, setUsage] = useState(null);
  const [settings, setSettings] = useState({
    targetLLM: 'general',
    keywords: '',
    tone: 'professional'
  });
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [testResults, setTestResults] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [optimizationProgress, setOptimizationProgress] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [draftContent, setDraftContent] = useState(new Map());
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null);
  
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
        
        // Wait for authFetch to be ready before making API calls
        if (isReady && authFetch) {
          console.log('[ASB-DEBUG] Dashboard: Starting API calls with authenticated fetch');
          
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
            fetchUsage(shopParam)
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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('[ASB-DEBUG] Dashboard: Products data received:', data);
      setProducts(data.products || []);
    } catch (error) {
      console.error('[ASB-DEBUG] Dashboard: fetchProducts error:', error);
      console.error('[ASB-DEBUG] Dashboard: Error stack:', error.stack);
      
      // TEMPORARY: Use mock data when app proxy is not working
      console.log('[ASB-DEBUG] Dashboard: App proxy not working, using mock data...');
      const mockProducts = [
        {
          id: 1,
          title: "Sample Product 1",
          handle: "sample-product-1",
          status: "active",
          vendor: "Demo Store",
          product_type: "Sample",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false
        },
        {
          id: 2,
          title: "Sample Product 2", 
          handle: "sample-product-2",
          status: "active",
          vendor: "Demo Store",
          product_type: "Sample",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false
        }
      ];
      
      console.log('[ASB-DEBUG] Dashboard: Setting mock products:', mockProducts);
      setProducts(mockProducts);
    }
  };

  const fetchBlogs = async (shopName) => {
    try {
      console.log('Dashboard: Fetching blogs for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/blogs?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dashboard: Blogs data received:', data);
      setBlogs(data.blogs || []);
    } catch (error) {
      console.error('Failed to fetch blogs:', error);
      
      // TEMPORARY: Use mock data when app proxy is not working
      console.log('[ASB-DEBUG] Dashboard: App proxy not working, using mock blogs...');
      const mockBlogs = [
        {
          id: 1,
          title: "Sample Blog Post 1",
          handle: "sample-blog-1",
          status: "published",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false
        },
        {
          id: 2,
          title: "Sample Blog Post 2",
          handle: "sample-blog-2", 
          status: "published",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          optimized: false
        }
      ];
      
      console.log('[ASB-DEBUG] Dashboard: Setting mock blogs:', mockBlogs);
      setBlogs(mockBlogs);
    }
  };

  const fetchUsage = async (shopName) => {
    try {
      console.log('Dashboard: Fetching usage for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/usage?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dashboard: Usage data received:', data);
      setUsage(data);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
      setUsage({
        shop: shopName,
        optimizations: { products: 0, blogs: 0, total: 0 },
        aiCalls: { today: 0, thisMonth: 0, total: 0 },
        limits: { monthlyOptimizations: 1000, dailyAICalls: 100 }
      });
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
      console.log('Making optimize request to:', `${API_BASE}/api/optimize/products?shop=${shop}`);
      const response = await authFetch(`${API_BASE}/api/optimize/products?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          productIds: selectedProducts,
          settings: {
            targetLLM: settings.targetLLM,
            keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
            tone: settings.tone
          }
        })
      });
      console.log('Optimize response received:', response);
      const data = await response.json();
      console.log('Optimize response data:', data);
      console.log('Results array:', data.results);
      if (data.results) {
        console.log('Individual results:');
        data.results.forEach((result, index) => {
          console.log(`Result ${index}:`, result);
          console.log(`Status: "${result.status}", Type: ${typeof result.status}`);
        });
      }
      const successCount = data.results ? data.results.filter(r => r.status === 'success').length : 0;
      console.log('Success count:', successCount);
      addNotification(`Successfully optimized ${successCount} products!`, 'success');
      fetchStatus(shop);
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedProducts([]);
    } catch (error) {
      console.error('Optimization error:', error);
      addNotification('Failed to optimize products. Please try again.', 'error');
    } finally {
      setOptimizing(false);
      setOptimizationProgress(null);
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
      const response = await authFetch(`${API_BASE}/api/optimize/blogs?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop,
          blogIds: selectedBlogs,
          settings: {
            targetLLM: settings.targetLLM,
            keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k),
            tone: settings.tone
          }
        })
      });
      const data = await response.json();
      addNotification('Blogs optimized successfully!', 'success');
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedBlogs([]);
    } catch (error) {
      addNotification('Failed to optimize blogs. Please try again.', 'error');
    } finally {
      setOptimizing(false);
      setOptimizationProgress(null);
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
      const data = await response.json();
      setPreview(data);
      addNotification('Product preview generated successfully!', 'success');
    } catch (error) {
      addNotification('Failed to generate preview. Please try again.', 'error');
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
      const data = await response.json();
      setPreview(data);
      addNotification('Blog preview generated successfully!', 'success');
    } catch (error) {
      addNotification('Failed to generate blog preview. Please try again.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const rollback = async (type, id, version = null) => {
    const message = version 
      ? `Roll back to version ${version}?` 
      : 'Remove all optimizations and restore original content?\n\nThis will:\n• Delete all draft and published optimizations\n• Restore the original content\n• Remove all AI-generated FAQs\n• Disable LLM schema output\n\nThis action cannot be undone.';
    
    if (!confirm(message)) return;
    
    try {
      setOptimizing(true);
      const response = await authFetch(`${API_BASE}/api/rollback/${type}/${id}?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, version })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      addNotification(data.message, 'success');
      
      // Update the product/blog status to reflect the rollback
      if (type === 'product') {
        setProducts(prev => prev.map(p => 
          p.id.toString() === id.toString() ? { ...p, optimized: false } : p
        ));
      } else if (type === 'blog') {
        setBlogs(prev => prev.map(b => 
          b.id.toString() === id.toString() ? { ...b, optimized: false } : b
        ));
      }
      
      // Refresh data
      fetchStatus(shop);
      fetchHistory(shop);
      fetchUsage(shop);
    } catch (error) {
      console.error('Rollback error:', error);
      addNotification('Failed to rollback. Please try again.', 'error');
    } finally {
      setOptimizing(false);
    }
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
    if (!confirm('Publish draft optimization?\n\nThis will make the draft content live on your store.')) return;
    
    try {
      setOptimizing(true);
      const response = await authFetch(`${API_BASE}/api/optimize/publish?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resourceType: type, 
          resourceId: id 
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      addNotification('Draft published successfully', 'success');
      
      // Update the product/blog status to reflect the publication
      if (type === 'product') {
        setProducts(prev => prev.map(p => 
          p.id.toString() === id.toString() ? { ...p, optimized: true } : p
        ));
      } else if (type === 'blog') {
        setBlogs(prev => prev.map(b => 
          b.id.toString() === id.toString() ? { ...b, optimized: true } : b
        ));
      }
      
      // Refresh data
      fetchStatus(shop);
      fetchHistory(shop);
      
      return data;
    } catch (error) {
      console.error('Publish draft error:', error);
      addNotification('Failed to publish draft. Please try again.', 'error');
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
    const itemsToRollback = type === 'product' 
      ? products.filter(p => p.optimized)
      : blogs.filter(b => b.optimized);
    
    if (itemsToRollback.length === 0) {
      addNotification('No optimized items to rollback', 'info');
      return;
    }
    
    const message = `Rollback ALL ${itemsToRollback.length} optimized ${type}s?\n\nThis will:\n• Delete all draft and published optimizations\n• Restore original content for all items\n• Remove all AI-generated FAQs\n• Disable LLM schema output\n\nThis action cannot be undone.`;
    
    if (!confirm(message)) return;
    
    try {
      setOptimizing(true);
      const results = [];
      
      for (const item of itemsToRollback) {
        try {
          const response = await authFetch(`${API_BASE}/api/rollback/${type}/${item.id}?shop=${shop}`, {
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard Error</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <details className="text-left text-sm text-gray-500 mb-4">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="shadow-sm border-b relative">
        {/* Black section for logo and icons */}
        <div className="bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-center relative">
              <img 
                src="/logo-dark.png" 
                alt="AI Search Booster Logo" 
                className="w-32 h-32 object-contain"
                onError={(e) => {
                  console.error('Logo failed to load:', e);
                  e.target.style.display = 'none';
                  // Show fallback text
                  e.target.parentElement.innerHTML = '<div class="text-white text-xl font-bold">AI Search Booster</div>';
                }}
                onLoad={() => console.log('Logo loaded successfully')}
              />
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                <div className="flex items-center space-x-2">
                  {/* Citation Badge */}
                  {stats && stats.total > 0 && (
                    <div className="flex items-center space-x-2 bg-green-600 text-white px-3 py-1 rounded-full">
                      <img src="/icons/citation-badge.svg" alt="Citations" className="w-4 h-4" />
                      <span className="text-sm font-medium">{stats.total} citations</span>
                    </div>
                  )}
                  
                  {/* Monitoring Status */}
                  <div className="flex items-center space-x-2">
                    <Monitor className={`w-5 h-5 ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-sm ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
                      {isMonitoring ? 'Monitoring' : 'Not Monitoring'}
                    </span>
                  </div>
                  
                  {/* Hidden test button - only visible in dev */}
                  {window.location.hostname === 'localhost' || window.location.search.includes('debug=true') ? (
                    <button
                      onClick={runEndToEndTest}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                      title="Run end-to-end test"
                    >
                      Test E2E
                    </button>
                  ) : null}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Settings className="w-6 h-6 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* White section for headline */}
        <div className="bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-800 mb-1">
                Make your Shopify store AI‑discoverable - ChatGPT, Gemini, Claude & more.
              </h1>
              <p className="text-sm text-gray-600">
                Automatic JSON‑LD, FAQ, RSS & embeddings. Boost your chances of showing up in AI answers!
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg shadow-lg border-l-4 ${
                notification.type === 'success' ? 'bg-green-50 border-green-400' :
                notification.type === 'error' ? 'bg-red-50 border-red-400' :
                notification.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                'bg-blue-50 border-blue-400'
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
                    notification.type === 'success' ? 'text-green-800' :
                    notification.type === 'error' ? 'text-red-800' :
                    notification.type === 'warning' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => removeNotification(notification.id)}
                    className={`rounded-md inline-flex text-gray-400 hover:text-gray-600 focus:outline-none ${
                      notification.type === 'success' ? 'hover:text-green-600' :
                      notification.type === 'error' ? 'hover:text-red-600' :
                      notification.type === 'warning' ? 'hover:text-yellow-600' :
                      'hover:text-blue-600'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Citation Notifications */}
      {citations.length > 0 && (
        <div className="fixed top-20 right-4 z-40 max-w-sm">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg">
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
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  Optimizing {optimizationProgress.type}... ({optimizationProgress.current}/{optimizationProgress.total})
                </p>
                <div className="mt-2 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              <Eye className="w-5 h-5 text-black animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
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

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h2 className="text-lg font-semibold mb-4">Optimization Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target AI Platform
                </label>
                <select
                  value={settings.targetLLM}
                  onChange={(e) => setSettings({...settings, targetLLM: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">All Platforms</option>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="claude">Claude</option>
                  <option value="perplexity">Perplexity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={settings.keywords}
                  onChange={(e) => setSettings({...settings, keywords: e.target.value})}
                  placeholder="organic, sustainable, premium"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tone
                </label>
                <select
                  value={settings.tone}
                  onChange={(e) => setSettings({...settings, tone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="technical">Technical</option>
                  <option value="friendly">Friendly</option>
                </select>
              </div>
            </div>
            
            {/* Citation Monitoring Controls */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-md font-semibold mb-4">Citation Monitoring</h3>
              
              {/* Debug Info - Always show for troubleshooting */}
              <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                <strong>Debug:</strong> shop={shop ? 'loaded' : 'missing'}, authFetch={authFetch ? 'ready' : 'missing'}, citationLoading={citationLoading.toString()}, isMonitoring={isMonitoring.toString()}, citationError={citationError || 'none'}
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Monitor className={`w-5 h-5 ${isMonitoring ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className={`text-sm ${isMonitoring ? 'text-green-600' : 'text-gray-400'}`}>
                    Status: {isMonitoring ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {!isMonitoring ? (
                  <button
                    onClick={async () => {
                      console.log('Start monitoring clicked');
                      const success = await startMonitoring({ 
                        interval: 'daily', 
                        keywords: settings.keywords.split(',').map(k => k.trim()).filter(k => k) 
                      });
                      if (success) {
                        addNotification('Citation monitoring started successfully', 'success');
                      } else {
                        addNotification('Failed to start citation monitoring', 'error');
                      }
                    }}
                    disabled={citationLoading || !shop || !authFetch}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title={citationLoading ? 'Loading...' : !shop ? 'Shop not loaded' : !authFetch ? 'Auth not ready' : 'Start citation monitoring'}
                  >
                    {citationLoading ? 'Loading...' : 'Start Monitoring'}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      const success = await stopMonitoring();
                      if (success) {
                        addNotification('Citation monitoring stopped', 'info');
                      } else {
                        addNotification('Failed to stop citation monitoring', 'error');
                      }
                    }}
                    disabled={citationLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {citationLoading ? 'Stopping...' : 'Stop Monitoring'}
                  </button>
                )}
                
                {stats && stats.total > 0 && (
                  <div className="text-sm text-gray-600">
                    Total citations: {stats.total}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
              <Package className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{status?.totalProducts || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Optimized</h3>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-600">{status?.optimizedProducts || 0}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">Usage This Month</h3>
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${usage ? ((usage.optimizations?.total || 0) / (usage.limits?.monthlyOptimizations || 1000) * 100) : 0}%` }}
                />
              </div>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {usage?.optimizations?.total || 0} / {usage?.limits?.monthlyOptimizations || 1000}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-500">AI Provider</h3>
              <AlertCircle className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-lg font-semibold text-gray-900">{status?.aiProvider || 'Not configured'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="border-b">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('products')}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'products' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Package className="w-4 h-4" />
                  <span>Products</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                    {selectedProducts.length} selected
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('blogs')}
                className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'blogs' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Blogs</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                    {selectedBlogs.length} selected
                  </span>
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Select Products to Optimize</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={testProxyRouting}
                      className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-1 text-sm"
                      title="Test app proxy routing - check console logs"
                    >
                      <Search className="w-3 h-3" />
                      <span>Test API</span>
                    </button>
                    <button
                      onClick={previewOptimization}
                      disabled={previewLoading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {previewLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={optimizeProducts}
                      disabled={optimizing || selectedProducts.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
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
                      onClick={() => rollbackAllOptimizations('product')}
                      disabled={optimizing || !products.some(p => p.optimized)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      title="Rollback all product optimizations"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Rollback All</span>
                    </button>
                  </div>
                </div>
                
                {products.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No products found</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => toggleProductSelection(product.id.toString())}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedProducts.includes(product.id.toString())
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id.toString())}
                            onChange={() => {}}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{product.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">{product.vendor}</p>
                            {product.product_type && (
                              <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                {product.product_type}
                              </span>
                            )}
                            <div className="mt-2 flex items-center space-x-2 flex-wrap">
                              {product.optimized && (
                                <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">
                                  ✓ Optimized
                                </span>
                              )}
                              
                              {/* Draft Actions */}
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePreviewDraft('product', product.id);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs flex items-center space-x-1"
                                  title="Preview draft content"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview</span>
                                </button>
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    publishDraft('product', product.id);
                                  }}
                                  className="text-green-600 hover:text-green-800 text-xs flex items-center space-x-1"
                                  title="Publish draft optimization"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Publish</span>
                                </button>
                                
                                {product.optimized && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      rollback('product', product.id);
                                    }}
                                    className="text-red-600 hover:text-red-800 text-xs flex items-center space-x-1"
                                    title="Rollback to original content"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Rollback</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Blogs Tab */}
            {activeTab === 'blogs' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Select Blogs to Optimize</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => previewBlogOptimization(blogs[0])}
                      disabled={previewLoading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {previewLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={optimizeBlogs}
                      disabled={optimizing || selectedBlogs.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {optimizing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
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
                      onClick={() => rollbackAllOptimizations('blog')}
                      disabled={optimizing || !blogs.some(b => b.optimized)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      title="Rollback all blog optimizations"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Rollback All</span>
                    </button>
                  </div>
                </div>
                
                {blogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No blogs found</p>
                ) : (
                  <div className="space-y-3">
                    {blogs.map((blog) => (
                      <div
                        key={blog.id}
                        onClick={() => toggleBlogSelection(blog.id.toString())}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedBlogs.includes(blog.id.toString())
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedBlogs.includes(blog.id.toString())}
                            onChange={() => {}}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{blog.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Created: {new Date(blog.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        {preview && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Optimization Preview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Original Content</h3>
                <div className="bg-gray-50 p-4 rounded border">
                  <p className="font-semibold">{preview.original.title || preview.original.name}</p>
                  <p className="text-sm text-gray-600 mt-2">{preview.original.description}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 mb-2">AI-Optimized Content</h3>
                <div className="bg-blue-50 p-4 rounded border border-blue-200">
                  <p className="font-semibold text-blue-900 mb-2">Summary:</p>
                  <p className="text-sm text-blue-800 mb-3">{preview.optimized.summary}</p>
                  
                  <p className="font-semibold text-blue-900 mb-2">FAQs:</p>
                  {preview.optimized.faqs.map((faq, i) => (
                    <div key={i} className="mb-2">
                      <p className="text-sm font-medium text-blue-700">Q: {faq.question}</p>
                      <p className="text-sm text-blue-600">A: {faq.answer}</p>
                    </div>
                  ))}
                  
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-blue-700">View Technical Implementation</summary>
                    <pre className="mt-2 text-xs bg-white p-2 rounded overflow-x-auto">{preview.preview.jsonLd}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Optimization History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{item.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.itemId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          v{item.version || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
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
      </div>

      {/* Draft Preview Modal */}
      {showDraftModal && selectedDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Draft Preview - {selectedDraft.type} {selectedDraft.id}
                </h2>
                <button
                  onClick={() => setShowDraftModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Draft Content */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Draft Content</h3>
                  {selectedDraft.data.hasDraft ? (
                    <div className="space-y-4">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-800 mb-2">Content</h4>
                        <div className="text-sm text-yellow-700 whitespace-pre-wrap">
                          {selectedDraft.data.draft.content}
                        </div>
                      </div>
                      
                      {selectedDraft.data.draft.faq && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="font-medium text-blue-800 mb-2">FAQ</h4>
                          <div className="space-y-2">
                            {selectedDraft.data.draft.faq.questions?.map((faq, index) => (
                              <div key={index} className="text-sm">
                                <div className="font-medium text-blue-700">Q: {faq.question}</div>
                                <div className="text-blue-600">A: {faq.answer}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        Draft saved: {new Date(selectedDraft.data.draft.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-600">No draft content available</p>
                    </div>
                  )}
                </div>
                
                {/* Live Content */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Live Content</h3>
                  {selectedDraft.data.hasLive ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-800 mb-2">Content</h4>
                        <div className="text-sm text-green-700 whitespace-pre-wrap">
                          {selectedDraft.data.live.content}
                        </div>
                      </div>
                      
                      {selectedDraft.data.live.faq && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="font-medium text-green-800 mb-2">FAQ</h4>
                          <div className="space-y-2">
                            {selectedDraft.data.live.faq.questions?.map((faq, index) => (
                              <div key={index} className="text-sm">
                                <div className="font-medium text-green-700">Q: {faq.question}</div>
                                <div className="text-green-600">A: {faq.answer}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        Published: {new Date(selectedDraft.data.live.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-600">No live content available</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowDraftModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Close
                </button>
                {selectedDraft.data.hasDraft && (
                  <button
                    onClick={() => {
                      publishDraft(selectedDraft.type, selectedDraft.id);
                      setShowDraftModal(false);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    Publish Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
