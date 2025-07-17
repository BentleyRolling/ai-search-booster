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
      
      // Wrap the fetch to add logging
      const wrappedFetch = async (url, options = {}) => {
        console.log('[ASB-DEBUG] AuthProvider: wrappedFetch called with URL:', url);
        console.log('[ASB-DEBUG] AuthProvider: wrappedFetch options:', options);
        
        try {
          const result = await fetch(url, options);
          console.log('[ASB-DEBUG] AuthProvider: wrappedFetch result:', result);
          return result;
        } catch (error) {
          console.error('[ASB-DEBUG] AuthProvider: wrappedFetch error:', error);
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