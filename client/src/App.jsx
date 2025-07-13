import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Provider } from '@shopify/app-bridge-react'
import { AppProvider } from '@shopify/polaris'
import Dashboard from './pages/Dashboard'

const config = {
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY,
  host: new URLSearchParams(location.search).get('host') || 
        new URLSearchParams(window.parent?.location?.search || '').get('host') ||
        window.btoa(window.location.origin).replace(/=/g, ''),
}

function App() {
  return (
    <Provider config={config}>
      <AppProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </Router>
      </AppProvider>
    </Provider>
  )
}

export default App
