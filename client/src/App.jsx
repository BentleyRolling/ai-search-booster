import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Provider } from '@shopify/app-bridge-react'
import { AppProvider } from '@shopify/polaris'
import Dashboard from './pages/Dashboard'

const config = {
  apiKey: import.meta.env.VITE_SHOPIFY_API_KEY || '4509cf5ef854ceac54c93cceda14987d',
  host: new URLSearchParams(location.search).get('host') || window.location.origin,
}

function App() {
  const isLocalDev = window.location.hostname === 'localhost'
  
  if (isLocalDev) {
    return (
      <AppProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </Router>
      </AppProvider>
    )
  }

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
