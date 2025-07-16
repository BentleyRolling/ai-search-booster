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
  
  React.useEffect(() => {
    console.log('AuthenticatedApp loaded with params:', { host, shop, error });
    
    if (!host) {
      console.log('No host parameter, redirecting to apps');
      const redirect = Redirect.create(app);
      redirect.dispatch(Redirect.Action.ADMIN_PATH, '/apps');
    }
  }, [app, host]);

  // Create authenticated fetch and make it globally available
  React.useEffect(() => {
    window.authenticatedFetch = authenticatedFetch(app);
  }, [app]);

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Authentication Error</h1>
        <p>Error: {error}</p>
        <p>Please try installing the app again.</p>
      </div>
    );
  }

  if (!host) {
    return <Loading />;
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