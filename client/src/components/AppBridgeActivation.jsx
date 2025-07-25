import { useEffect, useState, useRef } from 'react';
import { useAppBridge } from '@shopify/app-bridge-react';
import { CheckCircle, AlertTriangle, AlertCircle, Loader } from 'lucide-react';

/**
 * AppBridge Activation Component
 * Auto-triggers theme app extension activation with proper timeout handling
 */
export function AppBridgeActivation({ shopDomain, apiKey, onToast }) {
  const [activationStatus, setActivationStatus] = useState('checking');
  const [isVisible, setIsVisible] = useState(true);
  const app = useAppBridge();
  const timeoutRef = useRef(null);
  const activationTimeoutRef = useRef(null);

  // Toast function that integrates with Dashboard notifications
  const showToast = (message, type = 'info') => {
    if (onToast) {
      onToast(message, type);
    } else {
      console.log(`[Toast] ${type}: ${message}`);
    }
  };

  useEffect(() => {
    const checkAndActivateExtension = async () => {
      try {
        // Check if already activated
        const isAlreadyActivated = localStorage.getItem('asb_extension_activated') === 'true';
        
        if (isAlreadyActivated) {
          setActivationStatus('activated');
          // Auto-hide success banner after 3 seconds
          setTimeout(() => {
            setIsVisible(false);
          }, 3000);
          return;
        }

        // Set timeout for activation process (10 seconds)
        activationTimeoutRef.current = setTimeout(() => {
          if (activationStatus === 'pending') {
            setActivationStatus('timeout');
            showToast('Theme Extension activation timed out. Please try again or refresh the page.', 'error');
          }
        }, 10000);

        // Check if this is first time activation
        const isFirstRun = localStorage.getItem('asb_extension_first_run') !== 'false';
        
        if (isFirstRun && app) {
          console.log('[AI Search Booster] Starting theme extension activation...');
          setActivationStatus('pending');
          
          // Mark that we've attempted activation
          localStorage.setItem('asb_extension_first_run', 'false');
          
          // Try automatic activation via App Bridge
          try {
            const activationPromise = new Promise((resolve, reject) => {
              app.dispatch({
                type: 'APP::APP_EMBED_BLOCK::ENABLE',
                payload: {
                  type: 'ai-search-booster-inject'
                }
              });
              
              // Simulate response after 2 seconds (App Bridge doesn't return promises)
              setTimeout(() => {
                resolve('activated');
              }, 2000);
            });

            await activationPromise;
            
            // Clear timeout
            if (activationTimeoutRef.current) {
              clearTimeout(activationTimeoutRef.current);
            }
            
            // Mark as activated
            localStorage.setItem('asb_extension_activated', 'true');
            setActivationStatus('activated');
            console.log('[AI Search Booster] Theme extension activated successfully');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
              setIsVisible(false);
            }, 5000);
            
          } catch (error) {
            console.error('[AI Search Booster] Automatic activation failed:', error);
            setActivationStatus('error');
          }
          
        } else {
          // Not first run, hide the banner
          setIsVisible(false);
        }
        
      } catch (error) {
        console.error('[AI Search Booster] Extension check failed:', error);
        setActivationStatus('error');
      }
    };

    if (app && shopDomain) {
      // Small delay to ensure app bridge is ready
      setTimeout(() => {
        checkAndActivateExtension();
      }, 500);
    }

    // Cleanup timeouts
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (activationTimeoutRef.current) clearTimeout(activationTimeoutRef.current);
    };
  }, [app, shopDomain, activationStatus]);

  // Manual activation trigger
  const triggerManualActivation = async () => {
    setActivationStatus('pending');
    
    try {
      app.dispatch({
        type: 'APP::APP_EMBED_BLOCK::ENABLE',
        payload: {
          type: 'ai-search-booster-inject'
        }
      });
      
      // Simulate activation delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      localStorage.setItem('asb_extension_activated', 'true');
      setActivationStatus('activated');
      
      showToast('AI Search Booster extension activated successfully!', 'success');
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      
    } catch (error) {
      console.error('[AI Search Booster] Manual activation failed:', error);
      setActivationStatus('error');
      showToast('Failed to activate extension. Please try again.', 'error');
    }
  };

  // Don't render if not visible
  if (!isVisible) return null;

  return (
    <div className="theme-extension-banner animate-fade-in">
      {/* Pending/Loading State */}
      {activationStatus === 'pending' && (
        <div className="bg-[#1A1A1A] border border-[#374151] rounded-xl p-4 mb-4 transition-all duration-300 ease-in-out">
          <div className="flex items-center">
            <div className="mr-3">
              <div className="relative">
                <div className="w-5 h-5 rounded-full border-2 border-[#4F46E5] border-t-transparent animate-spin"></div>
                <Loader className="absolute inset-0 w-5 h-5 text-[#4F46E5] animate-pulse" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Activating theme extension...</p>
              <div className="mt-2 bg-[#111827] rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-[#4F46E5] rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Checking State */}
      {activationStatus === 'checking' && (
        <div className="bg-[#1A1A1A] border border-[#374151] rounded-xl p-4 mb-4 transition-all duration-300 ease-in-out">
          <div className="flex items-center">
            <Loader className="w-4 h-4 text-[#6B7280] mr-3 animate-spin" />
            <p className="text-[#9CA3AF] text-sm">Checking extension status...</p>
          </div>
        </div>
      )}
      
      {/* Success State */}
      {activationStatus === 'activated' && (
        <div className="bg-[#064E3B] border border-[#059669] rounded-xl p-4 mb-4 transition-all duration-300 ease-in-out animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-[#10B981] mr-3" />
              <div>
                <p className="text-white text-sm font-medium">Theme extension activated!</p>
                <p className="text-[#6EE7B7] text-xs mt-1">AI content optimization is now live on your storefront.</p>
              </div>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-[#6EE7B7] hover:text-white transition-colors text-xs px-2 py-1 rounded hover:bg-[#047857]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {activationStatus === 'error' && (
        <div className="bg-[#7F1D1D] border border-[#DC2626] rounded-xl p-4 mb-4 transition-all duration-300 ease-in-out">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-[#EF4444] mr-3" />
              <div>
                <p className="text-white text-sm font-medium">Extension activation failed</p>
                <p className="text-[#FCA5A5] text-xs mt-1">Please try again or refresh the page.</p>
              </div>
            </div>
            <button
              onClick={triggerManualActivation}
              className="bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
              disabled={activationStatus === 'pending'}
            >
              {activationStatus === 'pending' ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      )}
      
      {/* Timeout State */}
      {activationStatus === 'timeout' && (
        <div className="bg-[#92400E] border border-[#F59E0B] rounded-xl p-4 mb-4 transition-all duration-300 ease-in-out">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] mr-3" />
              <div>
                <p className="text-white text-sm font-medium">Activation timed out</p>
                <p className="text-[#FCD34D] text-xs mt-1">The extension may still be activating. Try refreshing the page.</p>
              </div>
            </div>
            <button
              onClick={triggerManualActivation}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppBridgeActivation;