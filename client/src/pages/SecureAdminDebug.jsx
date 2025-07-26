import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  AlertCircle, 
  Loader, 
  Shield,
  Code,
  Database,
  Settings,
  LogOut
} from 'lucide-react';

const SecureAdminDebug = ({ 
  isOpen,
  onClose,
  authFetch, 
  shop
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [adminToken, setAdminToken] = useState(null);
  const [schemaEnabled, setSchemaEnabled] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [testTier, setTestTier] = useState('Free');
  const [testTierLoading, setTestTierLoading] = useState(false);
  const [adminStatus, setAdminStatus] = useState(null);

  // Check for existing admin token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken) {
      validateAdminToken(storedToken);
    }
  }, []);

  const validateAdminToken = async (token) => {
    try {
      const response = await fetch('/api/admin/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const status = await response.json();
        setAdminToken(token);
        setIsAuthenticated(true);
        setShowPasswordInput(false);
        setAdminStatus(status);
        loadSchemaStatus(token);
      } else {
        localStorage.removeItem('adminToken');
      }
    } catch (error) {
      console.error('Token validation error:', error);
      localStorage.removeItem('adminToken');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok) {
        setAdminToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setIsAuthenticated(true);
        setShowPasswordInput(false);
        setPassword('');
        loadSchemaStatus(data.token);
      } else {
        alert(data.error || 'Authentication failed');
        setPassword('');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      alert('Authentication failed. Please try again.');
      setPassword('');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('adminToken');
      setAdminToken(null);
      setIsAuthenticated(false);
      setShowPasswordInput(true);
      setAdminStatus(null);
    }
  };

  const loadSchemaStatus = async (token) => {
    if (!shop) return;
    
    try {
      setSchemaLoading(true);
      const response = await fetch(`/api/admin/schema/${shop}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSchemaEnabled(data.schemaEnabled || false);
      }
    } catch (error) {
      console.error('Error loading schema status:', error);
    } finally {
      setSchemaLoading(false);
    }
  };

  const toggleSchema = async (enabled) => {
    if (!shop || !adminToken) return;
    
    try {
      setSchemaLoading(true);
      const response = await fetch(`/api/admin/schema/${shop}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });
      
      if (response.ok) {
        setSchemaEnabled(enabled);
      } else {
        console.error('Failed to update schema setting');
      }
    } catch (error) {
      console.error('Error updating schema setting:', error);
    } finally {
      setSchemaLoading(false);
    }
  };

  const changeTestTier = async (tier) => {
    if (!shop || !adminToken) return;
    
    try {
      setTestTierLoading(true);
      const response = await fetch(`/api/admin/test-tier/${shop}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tier })
      });
      
      if (response.ok) {
        setTestTier(tier);
      } else {
        console.error('Failed to update test tier');
      }
    } catch (error) {
      console.error('Error updating test tier:', error);
    } finally {
      setTestTierLoading(false);
    }
  };

  if (!isOpen) return null;

  if (showPasswordInput) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#2d2d2d] rounded-lg p-8 max-w-md w-full border border-gray-600">
          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Secure Admin Access</h1>
            <p className="text-gray-400">Enter admin credentials to access secure debug controls</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Admin Password"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:outline-none"
              autoFocus
              disabled={authLoading}
            />
            <button
              type="submit"
              disabled={authLoading || !password}
              className="w-full px-4 py-3 bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {authLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Authenticate</span>
              )}
            </button>
          </form>
          
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center justify-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto text-white border border-gray-600">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold flex items-center space-x-3">
                  <Code className="w-8 h-8 text-red-500" />
                  <span>Secure Admin Console</span>
                </h1>
                <p className="text-gray-400 mt-1">Authenticated access to system controls</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                Shop: <span className="text-white font-mono">{shop}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm transition-colors flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {/* Schema Settings */}
            <div className="bg-[#2d2d2d] rounded-lg p-6 border border-gray-600">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
                <Database className="w-5 h-5 text-blue-500" />
                <span>JSON-LD Schema Settings</span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="schema-toggle"
                        checked={schemaEnabled}
                        onChange={(e) => toggleSchema(e.target.checked)}
                        disabled={schemaLoading}
                        className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label htmlFor="schema-toggle" className="text-sm font-medium text-white cursor-pointer">
                        Enable JSON-LD Schema Injection
                      </label>
                      {schemaLoading && <Loader className="w-4 h-4 text-blue-500 animate-spin" />}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      Injects invisible FAQPage and timestamp schema for LLM discoverability
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${schemaEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    <span className="text-xs text-gray-400">
                      {schemaEnabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-300">
                  <div className="font-semibold mb-1">🎯 Schema Features:</div>
                  <div>• FAQPage schema for all optimized content</div>
                  <div>• Timestamp schema with optimization dates</div>
                  <div>• Invisible to users, visible to AI crawlers</div>
                  <div>• Boosts ChatGPT, Perplexity, Bing indexing</div>
                </div>
              </div>
            </div>

            {/* Test Tier Override */}
            <div className="bg-[#2d2d2d] rounded-lg p-6 border border-gray-600">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center space-x-2">
                <Settings className="w-5 h-5 text-yellow-500" />
                <span>Test Tier Override</span>
                <span className="text-xs bg-yellow-500 text-black px-2 py-1 rounded-full font-bold">
                  TESTING ONLY
                </span>
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-300">Current Test Tier:</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      testTier === 'Free' ? 'bg-gray-600 text-gray-200' :
                      testTier === 'Starter' ? 'bg-blue-600 text-white' :
                      testTier === 'Pro' ? 'bg-green-600 text-white' :
                      'bg-purple-600 text-white'
                    }`}>
                      {testTier}
                    </span>
                  </div>
                  {testTierLoading && <Loader className="w-4 h-4 text-yellow-500 animate-spin" />}
                </div>
                
                <div className="flex items-center space-x-2">
                  {['Free', 'Starter', 'Pro', 'Enterprise'].map((tier) => (
                    <button
                      key={tier}
                      onClick={() => changeTestTier(tier)}
                      disabled={testTierLoading || testTier === tier}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        testTier === tier
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
                
                <div className="text-xs text-yellow-300 space-y-1">
                  <div>• Switch between Free/Starter/Pro/Enterprise to test functionality</div>
                  <div>• Changes are logged and audited for security</div>
                  <div>• All actions are tracked with timestamps and user info</div>
                </div>
              </div>
            </div>

            {/* Admin Status */}
            {adminStatus && (
              <div className="bg-[#2d2d2d] rounded-lg p-6 border border-gray-600">
                <h3 className="text-xl font-semibold text-white mb-4">Admin Session Status</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">User ID:</span>
                    <span className="text-white ml-2">{adminStatus.userId}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Session Created:</span>
                    <span className="text-white ml-2">{new Date(adminStatus.sessionCreated).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Last Access:</span>
                    <span className="text-white ml-2">{new Date(adminStatus.lastAccess).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Authenticated:</span>
                    <span className="text-green-400 ml-2">✓ Active</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureAdminDebug;