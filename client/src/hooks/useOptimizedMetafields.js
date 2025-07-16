import { useState, useEffect } from 'react';
import { useAuthenticatedFetch } from './useAuthenticatedFetch';

export function useOptimizedMetafields(resourceType, resourceId) {
  const [metafields, setMetafields] = useState({
    original_backup: null,
    optimized_v1: null,
    optimized_v2: null,
    current_version: 'original',
    versions: [],
    loading: true,
    error: null
  });
  
  const fetch = useAuthenticatedFetch();

  useEffect(() => {
    if (!resourceId) return;

    const fetchMetafields = async () => {
      try {
        const response = await fetch(`/api/metafields/${resourceType}/${resourceId}`);
        const data = await response.json();
        
        const versions = [];
        Object.keys(data).forEach(key => {
          if (key.startsWith('optimized_v')) {
            versions.push({
              version: key,
              content: data[key],
              timestamp: data[`${key}_timestamp`] || null
            });
          }
        });

        setMetafields({
          ...data,
          versions,
          loading: false,
          error: null
        });
      } catch (error) {
        setMetafields(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    };

    fetchMetafields();
  }, [resourceType, resourceId, fetch]);

  const getActiveContent = () => {
    const version = metafields.current_version;
    if (version === 'original') return metafields.original_backup;
    return metafields[version] || metafields.original_backup;
  };

  return {
    ...metafields,
    getActiveContent
  };
}