import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  AlertCircle, 
  Loader, 
  RotateCcw, 
  FileText, 
  Monitor, 
  Play, 
  Square, 
  Shield,
  Code,
  Database
} from 'lucide-react';

const AdminDebug = ({ 
  isOpen,
  onClose,
  authFetch, 
  shop, 
  testTier, 
  setTestTier, 
  testTierLoading, 
  tierUsage, 
  resetConsent, 
  viewConsentRecords,
  isMonitoring,
  startMonitoring,
  stopMonitoring,
  citationLoading,
  citationError,
  settings,
  changeTestTier
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(true);
  const [schemaEnabled, setSchemaEnabled] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Check for existing auth on mount
  useEffect(() => {
    const adminAuth = localStorage.getItem('adminAuth');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
      setShowPasswordInput(false);
      loadSchemaStatus();
    }
  }, []);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (password === 'maxevo_secret_2025') {
      localStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
      setShowPasswordInput(false);
      loadSchemaStatus();
    } else {
      alert('Invalid passphrase');
      setPassword('');
    }
  };

  const loadSchemaStatus = async () => {
    if (!authFetch || !shop) return;
    
    try {
      setSchemaLoading(true);
      const response = await authFetch(`/api/settings/schema?shop=${shop}`);
      const data = await response.json();
      setSchemaEnabled(data.schemaEnabled || false);
    } catch (error) {
      console.error('Error loading schema status:', error);
    } finally {
      setSchemaLoading(false);
    }
  };

  const toggleSchema = async (enabled) => {
    if (!authFetch || !shop) return;
    
    try {
      setSchemaLoading(true);
      const response = await authFetch(`/api/settings/schema?shop=${shop}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Use the changeTestTier function passed from parent

  if (!isOpen) return null;

  if (showPasswordInput) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#2d2d2d] rounded-lg p-8 max-w-md w-full border border-gray-600">
          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access Required</h1>
            <p className="text-gray-400">Enter admin passphrase to access debug controls</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Admin Passphrase"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
            >
              Authenticate
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
      <div className="bg-[#1a1a1a] rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto text-white border border-gray-600">
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
                  <span>Admin Debug Console</span>
                </h1>
                <p className="text-gray-400 mt-1">Development & testing controls</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-400">
                Shop: <span className="text-white font-mono">{shop}</span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('adminAuth');
                  setIsAuthenticated(false);
                  setShowPasswordInput(true);
                }}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm transition-colors"
              >
                Logout
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
              <AlertCircle className="w-5 h-5 text-yellow-500" />
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
                <div className="text-xs text-gray-400">
                  ({tierUsage?.currentTier === testTier ? 'synced' : 'updating...'})
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
                <div>• Switch between Free/Starter/Pro/Enterprise to test auto-optimization behavior</div>
                <div>• Auto-optimization toggle will update based on selected tier</div>
                <div>• This is for testing only - remove before production</div>
              </div>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs text-red-300">
                <div className="font-semibold mb-1">🛡️ SAFETY LIMITS ACTIVE:</div>
                <div>• Max 10 optimizations per hour</div>
                <div>• Max 50 optimizations per day</div>
                <div>• 2-hour test session timeout</div>
                <div>• Auto-disabled in production</div>
              </div>
            </div>
          </div>

          {/* Development Controls */}
          <div className="bg-[#2d2d2d] rounded-lg p-6 border border-gray-600">
            <h3 className="text-xl font-semibold text-white mb-4">Development Controls</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    try {
                      resetConsent();
                    } catch (error) {
                      console.error('Reset consent error:', error);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset Consent Modal</span>
                </button>
                <p className="text-sm text-gray-300">
                  Reset consent to test the first-time launch modal again
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    try {
                      viewConsentRecords();
                    } catch (error) {
                      console.error('View consent records error:', error);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Legal Records</span>
                </button>
                <p className="text-sm text-gray-300">
                  Display consent records for legal verification (check browser console)
                </p>
              </div>
            </div>
          </div>

          {/* Citation Monitoring Controls */}
          {typeof isMonitoring !== 'undefined' && (
            <div className="bg-[#2d2d2d] rounded-lg p-6 border border-gray-600">
              <h3 className="text-xl font-semibold text-white mb-4">Citation Monitoring</h3>
              
              {/* Debug Info */}
              <div className="mb-4 p-3 bg-gray-800 rounded text-xs text-gray-300">
                <strong>Debug:</strong> shop={shop ? 'loaded' : 'missing'}, authFetch={authFetch ? 'ready' : 'missing'}, citationLoading={citationLoading ? citationLoading.toString() : 'false'}, isMonitoring={isMonitoring ? isMonitoring.toString() : 'false'}, citationError={citationError || 'none'}
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Monitor className={`w-5 h-5 ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`} />
                  <span className={`text-sm ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
                    Status: {isMonitoring ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {!isMonitoring && startMonitoring ? (
                  <button
                    onClick={async () => {
                      try {
                        console.log('Start monitoring clicked');
                        const success = await startMonitoring({ 
                          interval: 'daily', 
                          keywords: settings?.keywords ? settings.keywords.split(',').map(k => k.trim()).filter(k => k) : []
                        });
                        if (success) {
                          console.log('Start monitoring success');
                        } else {
                          console.log('Start monitoring failed');
                        }
                      } catch (error) {
                        console.error('Start monitoring error:', error);
                      }
                    }}
                    disabled={citationLoading || !shop || !authFetch}
                    className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    {citationLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span>{citationLoading ? 'Starting...' : 'Start Monitoring'}</span>
                  </button>
                ) : isMonitoring && stopMonitoring ? (
                  <button
                    onClick={async () => {
                      try {
                        console.log('Stop monitoring clicked');
                        const success = await stopMonitoring();
                        if (success) {
                          console.log('Stop monitoring success');
                        } else {
                          console.log('Stop monitoring failed');
                        }
                      } catch (error) {
                        console.error('Stop monitoring error:', error);
                      }
                    }}
                    disabled={citationLoading}
                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    {citationLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span>{citationLoading ? 'Stopping...' : 'Stop Monitoring'}</span>
                  </button>
                ) : null}
                
                {citationError && (
                  <div className="text-red-400 text-sm flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{citationError}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDebug;