import React, { useState, useEffect } from 'react'
import {
  Page,
  Layout,
  Card,
  Button,
  DataTable,
  ProgressBar,
  Badge,
  Text,
  ButtonGroup,
  Banner,
  Spinner,
  Modal,
  Tooltip,
  Icon,
  Select,
  Frame,
  Toast
} from '@shopify/polaris'
import { InfoIcon, CheckCircleIcon } from '@shopify/polaris-icons'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || ''

function Dashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [optimizing, setOptimizing] = useState(false)
  const [usage, setUsage] = useState({ used: 248, limit: 500, plan: 'Pro' })
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [previewModal, setPreviewModal] = useState(false)
  const [optimizedContent, setOptimizedContent] = useState(null)
  const [optimizationProgress, setOptimizationProgress] = useState(0)
  const [optimizedProducts, setOptimizedProducts] = useState(new Set())
  const [selectedPlan, setSelectedPlan] = useState('Pro')
  const [toastActive, setToastActive] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  
  const plans = [
    { label: 'Free - 5 products ($0)', value: 'Free', limit: 5, price: '$0' },
    { label: 'Basic - 100 products ($9.99)', value: 'Basic', limit: 100, price: '$9.99' },
    { label: 'Pro - 500 products ($14.99)', value: 'Pro', limit: 500, price: '$14.99' },
    { label: 'Custom - >500 products (Contact Us)', value: 'Custom', limit: 999, price: 'Contact Us' }
  ]

  useEffect(() => {
    fetchProducts()
    fetchUsage()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/products`)
      setProducts(response.data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsage = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/usage`)
      setUsage(response.data)
    } catch (error) {
      console.error('Error fetching usage:', error)
    }
  }

  const optimizeProduct = async (productId) => {
    setOptimizing(true)
    try {
      const response = await axios.post(`${API_BASE_URL}/api/products/${productId}/optimize`)
      setOptimizedContent(response.data.optimizedContent)
      setOptimizedProducts(prev => new Set([...prev, productId]))
      setToastMessage('Product optimized successfully!')
      setToastActive(true)
      await fetchProducts()
    } catch (error) {
      console.error('Error optimizing product:', error)
      setToastMessage('Failed to optimize product. Please try again.')
      setToastActive(true)
    } finally {
      setOptimizing(false)
    }
  }

  const previewProduct = (product) => {
    setSelectedProduct(product)
    setPreviewModal(true)
  }

  const applyAIVersion = async (productId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/products/${productId}/apply`)
      setToastMessage('AI version applied successfully!')
      setToastActive(true)
      setPreviewModal(false)
      await fetchProducts()
    } catch (error) {
      console.error('Error applying AI version:', error)
      setToastMessage('Failed to apply AI version.')
      setToastActive(true)
    }
  }

  const restoreOriginal = async (productId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/products/${productId}/restore`)
      setOptimizedProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
      setToastMessage('Original version restored!')
      setToastActive(true)
      setPreviewModal(false)
      await fetchProducts()
    } catch (error) {
      console.error('Error restoring original:', error)
      setToastMessage('Failed to restore original version.')
      setToastActive(true)
    }
  }

  const optimizeAllProducts = async () => {
    setOptimizing(true)
    setOptimizationProgress(0)
    
    try {
      const batchSize = 100 // Max batch size as per requirements
      const productsToOptimize = products.slice(0, Math.min(batchSize, usage.limit - usage.used))
      
      for (let i = 0; i < productsToOptimize.length; i++) {
        await optimizeProduct(productsToOptimize[i].id)
        setOptimizationProgress(((i + 1) / productsToOptimize.length) * 100)
        
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      setToastMessage(`✅ Optimized ${productsToOptimize.length} products successfully!`)
      setToastActive(true)
    } catch (error) {
      console.error('Error in bulk optimization:', error)
      setToastMessage('Bulk optimization failed. Please try again.')
      setToastActive(true)
    } finally {
      setOptimizing(false)
      setOptimizationProgress(0)
    }
  }

  const productRows = products.map((product) => [
    product.title,
    optimizedProducts.has(product.id) ? 
      <Badge status="success" icon={CheckCircleIcon}>Optimized</Badge> : 
      <Badge status="info">Ready</Badge>,
    <ButtonGroup>
      <Button 
        size="slim" 
        onClick={() => optimizeProduct(product.id)}
        loading={optimizing}
        disabled={optimizing || usage.used >= usage.limit}
      >
        Optimize
      </Button>
      <Button 
        size="slim" 
        variant="plain"
        onClick={() => previewProduct(product)}
      >
        Preview
      </Button>
      {optimizedProducts.has(product.id) && (
        <Button 
          size="slim" 
          variant="plain"
          onClick={() => restoreOriginal(product.id)}
        >
          Restore
        </Button>
      )}
    </ButtonGroup>
  ])

  if (loading) {
    return (
      <Page title="AI Search Booster">
        <Layout>
          <Layout.Section>
            <Card>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Spinner size="large" />
                <Text variant="bodyMd">Loading products...</Text>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    )
  }

  return (
    <Page 
      title="AI Search Booster"
      subtitle="Optimize your products for AI-generated answers"
      primaryAction={{
        content: 'Optimize All Products',
        onAction: optimizeAllProducts,
        loading: optimizing
      }}
    >
      <Layout>
        <Layout.Section>
          <Banner status="info">
            <Text variant="bodyMd">
              This app improves visibility in AI-generated answers — not Google SEO.
            </Text>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card title="Usage & Plan">
            <div style={{ marginBottom: '1rem' }}>
              <Text variant="bodyMd">
                {usage.used} / {usage.limit} products optimized this month
              </Text>
            </div>
            <ProgressBar 
              progress={(usage.used / usage.limit) * 100} 
              size="medium"
            />
            {optimizing && optimizationProgress > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <Text variant="bodyMd">Optimization Progress:</Text>
                <ProgressBar 
                  progress={optimizationProgress} 
                  size="small"
                />
              </div>
            )}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Badge status="success">{usage.plan} Plan</Badge>
              <Select
                label="Change Plan"
                options={plans}
                value={selectedPlan}
                onChange={setSelectedPlan}
              />
              <Button size="slim" variant="primary">Upgrade Plan</Button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Tooltip content="This app improves visibility in AI-generated answers — not Google SEO.">
                <Text variant="bodyMd" color="subdued">
                  <Icon source={InfoIcon} /> AI Search Optimization
                </Text>
              </Tooltip>
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Products">
            {products.length > 0 ? (
              <DataTable
                columnContentTypes={['text', 'text', 'text']}
                headings={['Product', 'Status', 'Actions']}
                rows={productRows}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Text variant="bodyMd">No products found. Make sure your store has products to optimize.</Text>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      {/* Preview Modal */}
      <Modal
        open={previewModal}
        onClose={() => setPreviewModal(false)}
        title="Product Preview"
        primaryAction={{
          content: 'Apply AI Version',
          onAction: () => selectedProduct && applyAIVersion(selectedProduct.id),
        }}
        secondaryActions={[
          {
            content: 'Restore Original',
            onAction: () => selectedProduct && restoreOriginal(selectedProduct.id),
          },
          {
            content: 'Cancel',
            onAction: () => setPreviewModal(false),
          },
        ]}
      >
        <Modal.Section>
          {selectedProduct && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Card title="Original Version">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Text variant="headingMd">{selectedProduct.title}</Text>
                  <Text variant="bodyMd">{selectedProduct.body_html || selectedProduct.description}</Text>
                </div>
              </Card>
              
              <Card title="AI Optimized Version">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Text variant="headingMd">{optimizedContent?.title || selectedProduct.title + ' (AI Optimized)'}</Text>
                  <Text variant="bodyMd">{optimizedContent?.description || 'AI optimization will appear here after processing...'}</Text>
                </div>
              </Card>
            </div>
          )}
        </Modal.Section>
      </Modal>

      {/* Toast Notifications */}
      {toastActive && (
        <Frame>
          <Toast
            content={toastMessage}
            onDismiss={() => setToastActive(false)}
          />
        </Frame>
      )}
    </Page>
  )
}

export default Dashboard
