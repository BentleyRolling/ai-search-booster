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
        
        // BYPASS APP PROXY: Use direct backend URL due to password-protected store
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ai-search-booster-backend.onrender.com';
        if (url.startsWith('/api') || (url.startsWith('api') && !url.includes('://'))) {
          const apiPath = url.startsWith('/') ? url : '/' + url;
          finalUrl = `${BACKEND_URL}${apiPath}`;
          console.log('[ASB-DEBUG] AuthProvider: Using direct backend URL:', finalUrl);
          console.log('[ASB-DEBUG] AuthProvider: Bypassing app proxy due to password-protected store');
        }
        
        console.log('[ASB-DEBUG] AuthProvider: Final URL for request:', finalUrl);
        
        try {
          // Use direct fetch for external backend URL, authenticated fetch for relative paths
          const isExternalUrl = finalUrl.includes('://');
          
          let fetchOptions = options;
          let fetchFunction = fetch; // Default to authenticated fetch
          
          if (isExternalUrl) {
            // For external URLs, ensure shop parameter is included for backend authentication
            const url = new URL(finalUrl);
            if (shop && !url.searchParams.has('shop')) {
              url.searchParams.set('shop', shop);
              finalUrl = url.toString();
            }
            
            fetchOptions = { 
              ...options, 
              mode: 'cors', 
              credentials: 'omit',
              headers: {
                ...options.headers,
                // Don't include additional auth headers for external - backend uses shop param
              }
            };
            fetchFunction = window.fetch;
          }
            
          console.log('[ASB-DEBUG] AuthProvider: Making fetch with options:', fetchOptions);
          console.log('[ASB-DEBUG] AuthProvider: Final URL with shop param:', finalUrl);
          
          // Add timeout for hanging requests - increased for GPT-4 optimization calls
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout after 45 seconds')), 45000);
          });
          
          const result = await Promise.race([fetchFunction(finalUrl, fetchOptions), timeoutPromise]);
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