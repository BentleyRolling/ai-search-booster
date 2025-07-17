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
          // Production: Force direct backend until proxy is registered
          if (url.startsWith('/api') || (url.startsWith('api') && !url.includes('://'))) {
            const BACKEND_URL = 'https://ai-search-booster-backend.onrender.com';
            const apiPath = url.startsWith('/') ? url : '/' + url;
            finalUrl = `${BACKEND_URL}${apiPath}`;
            console.log('[ASB-DEBUG] AuthProvider: Prod - using direct backend (proxy not registered):', finalUrl);
            console.log('[ASB-DEBUG] AuthProvider: ⚠️ App proxy will be enabled once registered via Shopify CLI');
          }
        }
        
        console.log('[ASB-DEBUG] AuthProvider: Final URL for request:', finalUrl);
        
        try {
          // For direct backend calls, use simple CORS mode (TEMPORARY until proxy registered)
          const fetchOptions = finalUrl.startsWith('https://') ? {
            method: 'GET',
            mode: 'cors',
            credentials: 'omit',
            headers: {
              'Accept': 'application/json',
              'X-Shopify-Shop-Domain': shop || 'aisearch-dev.myshopify.com'
            }
          } : options;
            
          console.log('[ASB-DEBUG] AuthProvider: Making SIMPLE fetch with options:', fetchOptions);
          
          // Add timeout for hanging requests
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout after 8 seconds')), 8000);
          });
          
          const result = await Promise.race([fetch(finalUrl, fetchOptions), timeoutPromise]);
          console.log('[ASB-DEBUG] AuthProvider: ✅ Got response!');
          console.log('[ASB-DEBUG] AuthProvider: Response URL:', result.url);
          console.log('[ASB-DEBUG] AuthProvider: Response status:', result.status);
          console.log('[ASB-DEBUG] AuthProvider: Response ok:', result.ok);
          console.log('[ASB-DEBUG] AuthProvider: Response headers:', Object.fromEntries(result.headers.entries()));
          
          return result;
        } catch (error) {
          console.error('[ASB-DEBUG] AuthProvider: ❌ Request failed:', error.message);
          console.error('[ASB-DEBUG] AuthProvider: Error type:', error.name);
          console.error('[ASB-DEBUG] AuthProvider: Full error:', error);
          
          // Try with a simpler fetch as last resort
          if (finalUrl.startsWith('https://') && error.message.includes('timeout')) {
            console.log('[ASB-DEBUG] AuthProvider: Trying simplified fetch...');
            try {
              const simpleResult = await fetch(finalUrl, { 
                method: 'GET',
                mode: 'cors',
                headers: { 'Accept': 'application/json' }
              });
              console.log('[ASB-DEBUG] AuthProvider: ✅ Simple fetch worked!', simpleResult.status);
              return simpleResult;
            } catch (simpleError) {
              console.error('[ASB-DEBUG] AuthProvider: ❌ Simple fetch also failed:', simpleError);
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