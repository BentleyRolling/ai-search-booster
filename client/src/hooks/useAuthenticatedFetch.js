import { useAppBridge } from '@shopify/app-bridge-react';
import { getSessionToken } from '@shopify/app-bridge-utils';
import { useMemo } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ai-search-booster-backend.onrender.com';

export function useAuthenticatedFetch() {
  const app = useAppBridge();
  
  return useMemo(() => {
    return async (uri, options = {}) => {
      const token = await getSessionToken(app);
      const shop = new URLSearchParams(window.location.search).get('shop');
      
      const url = uri.startsWith('/') ? `${BACKEND_URL}${uri}` : uri;
      
      const fetchOptions = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Shopify-Shop-Domain': shop,
          ...options.headers,
        },
      };
      
      return fetch(url, fetchOptions);
    };
  }, [app]);
}