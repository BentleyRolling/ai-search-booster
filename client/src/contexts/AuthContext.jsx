import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from '@shopify/app-bridge-utils';

const AuthContext = createContext();

export const useAuthenticatedFetch = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthenticatedFetch must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const app = useAppBridge();
  const [authFetch, setAuthFetch] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (app) {
      console.log('[ASB-DEBUG] AuthProvider: Creating authenticated fetch with app bridge');
      console.log('[ASB-DEBUG] AuthProvider: App bridge object:', app);
      
      const fetch = authenticatedFetch(app);
      
      // Wrap the fetch to add logging and handle URL routing
      const wrappedFetch = async (url, options = {}) => {
        console.log('[ASB-DEBUG] AuthProvider: wrappedFetch called with URL:', url);
        console.log('[ASB-DEBUG] AuthProvider: Current location:', window.location.href);
        console.log('[ASB-DEBUG] AuthProvider: wrappedFetch options:', options);
        
        // Extract shop parameter for app proxy routing
        const urlParams = new URLSearchParams(window.location.search);
        const shop = urlParams.get('shop');
        const envMode = import.meta.env.MODE;
        
        console.log('[ASB-DEBUG] AuthProvider: Shop parameter:', shop);
        console.log('[ASB-DEBUG] AuthProvider: Environment mode:', envMode);
        
        const isDevelopment = envMode === 'development' || 
                             window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1';
        
        let finalUrl = url;
        
        if (isDevelopment) {
          // Development: use absolute backend URL
          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ai-search-booster-backend.onrender.com';
          if (url.startsWith('/api') || (url.startsWith('api') && !url.includes('://'))) {
            finalUrl = `${BACKEND_URL}${url.startsWith('/') ? url : '/' + url}`;
            console.log('[ASB-DEBUG] AuthProvider: Dev - absolute backend URL:', finalUrl);
          }
        } else {
          // Production: Try app proxy first, fallback to direct backend
          if (url.startsWith('/api') || (url.startsWith('api') && !url.includes('://'))) {
            const apiPath = url.startsWith('/') ? url : '/' + url;
            finalUrl = `/apps/ai-search-booster${apiPath}`;
            console.log('[ASB-DEBUG] AuthProvider: Prod - trying app proxy path:', finalUrl);
            console.log('[ASB-DEBUG] AuthProvider: Will fallback to direct backend if proxy fails');
          }
        }
        
        console.log('[ASB-DEBUG] AuthProvider: Final URL for request:', finalUrl);
        
        try {
          const result = await fetch(finalUrl, options);
          console.log('[ASB-DEBUG] AuthProvider: wrappedFetch result:', result);
          console.log('[ASB-DEBUG] AuthProvider: Response URL:', result.url);
          console.log('[ASB-DEBUG] AuthProvider: Response status:', result.status);
          console.log('[ASB-DEBUG] AuthProvider: Response headers:', Object.fromEntries(result.headers.entries()));
          
          // If proxy request failed with redirect, try direct backend as fallback
          if (!isDevelopment && result.status === 302 && finalUrl.startsWith('/apps/ai-search-booster')) {
            console.log('[ASB-DEBUG] AuthProvider: App proxy returned 302, trying direct backend fallback...');
            const BACKEND_URL = 'https://ai-search-booster-backend.onrender.com';
            const directUrl = `${BACKEND_URL}${url.startsWith('/') ? url : '/' + url}`;
            console.log('[ASB-DEBUG] AuthProvider: Fallback URL:', directUrl);
            
            const fallbackResult = await fetch(directUrl, {
              ...options,
              mode: 'cors',
              credentials: 'omit' // Don't send cookies for CORS requests
            });
            
            console.log('[ASB-DEBUG] AuthProvider: Fallback result:', fallbackResult.status);
            if (fallbackResult.ok) {
              console.log('[ASB-DEBUG] AuthProvider: ✅ Fallback to direct backend succeeded!');
              console.log('[ASB-DEBUG] AuthProvider: ⚠️ Note: App proxy not configured, using direct CORS calls');
              return fallbackResult;
            }
          }
          
          return result;
        } catch (error) {
          console.error('[ASB-DEBUG] AuthProvider: wrappedFetch error:', error);
          
          // If proxy failed and we're in production, try direct backend
          if (!isDevelopment && finalUrl.startsWith('/apps/ai-search-booster')) {
            console.log('[ASB-DEBUG] AuthProvider: Proxy request failed, trying direct backend...');
            try {
              const BACKEND_URL = 'https://ai-search-booster-backend.onrender.com';
              const directUrl = `${BACKEND_URL}${url.startsWith('/') ? url : '/' + url}`;
              
              const fallbackResult = await fetch(directUrl, {
                ...options,
                mode: 'cors',
                credentials: 'omit'
              });
              
              if (fallbackResult.ok) {
                console.log('[ASB-DEBUG] AuthProvider: ✅ Emergency fallback succeeded!');
                return fallbackResult;
              }
            } catch (fallbackError) {
              console.error('[ASB-DEBUG] AuthProvider: Fallback also failed:', fallbackError);
            }
          }
          
          throw error;
        }
      };
      
      setAuthFetch(() => wrappedFetch);
      
      // Also set global for backward compatibility
      window.authenticatedFetch = wrappedFetch;
      
      setIsReady(true);
      console.log('[ASB-DEBUG] AuthProvider: Authenticated fetch is ready');
      console.log('[ASB-DEBUG] AuthProvider: window.authenticatedFetch type:', typeof window.authenticatedFetch);
      console.log('[ASB-DEBUG] AuthProvider: Testing fetch function:', typeof wrappedFetch);
    }
  }, [app]);

  const contextValue = {
    authFetch,
    isReady,
    app
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};