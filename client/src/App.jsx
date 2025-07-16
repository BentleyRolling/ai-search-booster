import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useAppBridge } from '@shopify/app-bridge-react';
import { Redirect } from '@shopify/app-bridge/actions';
import { AppProvider } from '@shopify/polaris';
import { authenticatedFetch } from '@shopify/app-bridge-utils';
import Dashboard from './pages/Dashboard';
import '@shopify/polaris/build/esm/styles.css';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h1>Something went wrong.</h1>
          <p>Please refresh the page or contact support.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component
const Loading = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <div>Loading...</div>
  </div>
);

// Authenticated Component Wrapper
function AuthenticatedApp() {
  const app = useAppBridge();
  const urlParams = new URLSearchParams(location.search);
  const host = urlParams.get('host');
  const shop = urlParams.get('shop');
  const error = urlParams.get('error');
  const code = urlParams.get('code');
  
  // Log all URL parameters for debugging
  React.useEffect(() => {
    console.log('=== FRONTEND DEBUG INFO ===');
    console.log('Current URL:', window.location.href);
    console.log('URL Search:', window.location.search);
    console.log('All URL params:', Object.fromEntries(urlParams.entries()));
    console.log('Parsed params:', { host, shop, error, code });
    console.log('=== END DEBUG INFO ===');
  }, []);

  // Create authenticated fetch and make it globally available
  React.useEffect(() => {
    if (app) {
      window.authenticatedFetch = authenticatedFetch(app);
    }
  }, [app]);

  // Show error if present
  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Authentication Error</h1>
        <p>Error: {error}</p>
        <p>Please try installing the app again.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // If we have shop but no host, create a host parameter
  if (shop && !host) {
    console.log('Creating host parameter from shop:', shop);
    const generatedHost = btoa(`${shop}/admin`); // Use browser's btoa instead of Buffer
    const newUrl = `${window.location.pathname}?shop=${shop}&host=${generatedHost}`;
    console.log('Redirecting to:', newUrl);
    window.location.replace(newUrl);
    return <Loading />;
  }

  // If we have neither shop nor host, show a fallback
  if (!host && !shop) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>AI Search Booster</h1>
        <p>Loading app...</p>
        <p>If this page doesn't load, please install the app from your Shopify admin.</p>
        <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
          URL: {window.location.href}<br/>
          Params: {window.location.search || 'none'}
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const host = new URLSearchParams(location.search).get('host');
  const apiKey = import.meta.env.VITE_SHOPIFY_API_KEY;

  if (!apiKey) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Configuration Error</h1>
        <p>VITE_SHOPIFY_API_KEY is not set.</p>
      </div>
    );
  }

  const config = {
    apiKey,
    host: host || '',
    forceRedirect: true
  };

  return (
    <ErrorBoundary>
      <Provider config={config}>
        <AppProvider>
          <Suspense fallback={<Loading />}>
            <Router>
              <AuthenticatedApp />
            </Router>
          </Suspense>
        </AppProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;