import { useEffect, useState } from 'react';
import { AppProvider } from '@shopify/app-bridge';
import { useAppBridge } from '@shopify/app-bridge-react';

/**
 * AppBridge Activation Component
 * Auto-triggers theme app extension activation on app install/open
 */
export function AppBridgeActivation({ shopDomain, apiKey }) {
  const [activationStatus, setActivationStatus] = useState('pending');
  const app = useAppBridge();

  useEffect(() => {
    const activateThemeExtension = async () => {
      try {
        // Check if this is first time activation
        const isFirstActivation = localStorage.getItem('asb_extension_activated') !== 'true';
        
        if (isFirstActivation || activationStatus === 'pending') {
          console.log('[AI Search Booster] Activating theme app extension...');
          
          // Trigger Shopify App Bridge modal to enable extension
          const modal = {
            title: 'Enable AI Search Booster',
            message: 'Click "Enable" to activate AI content optimization on your storefront. This will inject SEO-optimized content invisible to customers but visible to AI search engines like ChatGPT, Claude, and Perplexity.',
            primaryAction: {
              content: 'Enable Extension',
              onAction: () => {
                // Enable app embed block
                app.dispatch({
                  type: 'APP::APP_EMBED_BLOCK::ENABLE',
                  payload: {
                    type: 'ai-search-booster-inject'
                  }
                });
                
                // Mark as activated
                localStorage.setItem('asb_extension_activated', 'true');
                setActivationStatus('activated');
                console.log('[AI Search Booster] Theme extension activated successfully');
              }
            },
            secondaryActions: [{
              content: 'Skip for now',
              onAction: () => {
                setActivationStatus('skipped');
                console.log('[AI Search Booster] Theme extension activation skipped');
              }
            }]
          };
          
          // Show modal after brief delay to ensure app bridge is ready
          setTimeout(() => {
            app.dispatch({
              type: 'APP::MODAL::OPEN',
              payload: modal
            });
          }, 1000);
          
        } else {
          setActivationStatus('already_activated');
        }
        
      } catch (error) {
        console.error('[AI Search Booster] Theme extension activation failed:', error);
        setActivationStatus('error');
      }
    };

    if (app && shopDomain) {
      activateThemeExtension();
    }
  }, [app, shopDomain, activationStatus]);

  // Manual activation trigger for settings panel
  const triggerManualActivation = () => {
    try {
      app.dispatch({
        type: 'APP::APP_EMBED_BLOCK::ENABLE',
        payload: {
          type: 'ai-search-booster-inject'
        }
      });
      
      localStorage.setItem('asb_extension_activated', 'true');
      setActivationStatus('activated');
      
      // Show success toast
      app.dispatch({
        type: 'APP::TOAST::SHOW',
        payload: {
          message: 'AI Search Booster extension activated successfully!',
          duration: 3000,
          isError: false
        }
      });
      
    } catch (error) {
      console.error('[AI Search Booster] Manual activation failed:', error);
      
      // Show error toast
      app.dispatch({
        type: 'APP::TOAST::SHOW',
        payload: {
          message: 'Failed to activate extension. Please try again.',
          duration: 3000,
          isError: true
        }
      });
    }
  };

  return (
    <div className="extension-activation-status">
      {activationStatus === 'pending' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-3"></div>
            <p className="text-blue-700 text-sm">Activating theme extension...</p>
          </div>
        </div>
      )}
      
      {activationStatus === 'activated' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <svg className="w-4 h-4 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <p className="text-green-700 text-sm">Theme extension activated! AI content optimization is now live.</p>
          </div>
        </div>
      )}
      
      {activationStatus === 'skipped' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-yellow-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-yellow-700 text-sm">Theme extension not activated. Click to enable manually.</p>
            </div>
            <button
              onClick={triggerManualActivation}
              className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-3 py-1 rounded transition-colors"
            >
              Activate Now
            </button>
          </div>
        </div>
      )}
      
      {activationStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 text-sm">Extension activation failed. Please try again.</p>
            </div>
            <button
              onClick={triggerManualActivation}
              className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppBridgeActivation;