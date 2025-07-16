import { useAppBridge } from '@shopify/app-bridge-react';
import { authenticatedFetch } from '@shopify/app-bridge-utils';
import { useMemo } from 'react';

export function useAuthenticatedFetch() {
  const app = useAppBridge();
  return useMemo(() => {
    return authenticatedFetch(app);
  }, [app]);
}