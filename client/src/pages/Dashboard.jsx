import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Eye, RotateCcw, Settings, Search, Sparkles, BookOpen, Package } from 'lucide-react';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from '@shopify/app-bridge-utils';
import { Redirect } from '@shopify/app-bridge/actions';

const Dashboard = () => {
  const app = useAppBridge();
  const redirect = Redirect.create(app);
  const authFetch = authenticatedFetch(app);
  
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

  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://ai-search-booster-backend.onrender.com';

  useEffect(() => {
    // Get shop from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const shopParam = urlParams.get('shop');
    console.log('Dashboard: Shop parameter:', shopParam);
    
    if (shopParam) {
      setShop(shopParam);
      
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
      });
    } else {
      console.log('Dashboard: No shop parameter found');
      setLoading(false);
    }
  }, []);

  const fetchStatus = async (shopName) => {
    try {
      console.log('Dashboard: Fetching status for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/status?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dashboard: Status data received:', data);
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
      console.log('Dashboard: Fetching products for shop:', shopName);
      const response = await authFetch(`${API_BASE}/api/products?shop=${shopName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Dashboard: Products data received:', data);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]); // Set empty array as fallback
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
      setBlogs([]); // Set empty array as fallback
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

  const optimizeProducts = async () => {
    if (selectedProducts.length === 0) {
      alert('Please select products to optimize');
      return;
    }
    
    setOptimizing(true);
    try {
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
      const data = await response.json();
      alert(`Successfully optimized ${data.results.filter(r => r.status === 'success').length} products!`);
      fetchStatus(shop);
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedProducts([]);
    } catch (error) {
      alert('Failed to optimize products');
    } finally {
      setOptimizing(false);
    }
  };

  const optimizeBlogs = async () => {
    if (selectedBlogs.length === 0) {
      alert('Please select blogs to optimize');
      return;
    }
    
    setOptimizing(true);
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
      alert('Blogs optimized successfully!');
      fetchHistory(shop);
      fetchUsage(shop);
      setSelectedBlogs([]);
    } catch (error) {
      alert('Failed to optimize blogs');
    } finally {
      setOptimizing(false);
    }
  };

  const previewOptimization = async () => {
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
    } catch (error) {
      alert('Failed to generate preview');
    }
  };

  const rollback = async (type, id, version = null) => {
    const message = version 
      ? `Roll back to version ${version}?` 
      : 'Remove all optimizations and restore original content?';
    
    if (!confirm(message)) return;
    
    try {
      const response = await authFetch(`${API_BASE}/api/rollback/${type}/${id}?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop, version })
      });
      const data = await response.json();
      alert(data.message);
      fetchStatus(shop);
      fetchHistory(shop);
      fetchUsage(shop);
    } catch (error) {
      alert('Failed to rollback');
    }
  };

  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleBlogSelection = (blogId) => {
    setSelectedBlogs(prev => 
      prev.includes(blogId) 
        ? prev.filter(id => id !== blogId)
        : [...prev, blogId]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading AI Search Booster...</p>
        </div>
      </div>
    );
  }

  const optimizationPercentage = status ? (status.optimizedProducts / status.totalProducts * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Search className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Search Booster</h1>
                <p className="text-sm text-gray-500">Optimize your store for AI visibility</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

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
                  style={{ width: `${usage ? (usage.usage.optimizations / usage.billing.optimizationsLimit * 100) : 0}%` }}
                />
              </div>
            </div>
            <p className="text-lg font-bold text-blue-600">
              {usage?.usage.optimizations || 0} / {usage?.billing.optimizationsLimit || 50}
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
                      onClick={previewOptimization}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview</span>
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
                  <button
                    onClick={optimizeBlogs}
                    disabled={optimizing || selectedBlogs.length === 0}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
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
                            ? 'border-purple-500 bg-purple-50'
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
    </div>
  );
};

export default Dashboard;
