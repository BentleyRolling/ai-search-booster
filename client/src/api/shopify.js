import { useAuthenticatedFetch } from '../hooks/useAuthenticatedFetch';

class ShopifyAPI {
  constructor(authenticatedFetch) {
    this.fetch = authenticatedFetch;
  }

  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await this.fetch(`/api/products?${query}`);
    return response.json();
  }

  async getBlogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await this.fetch(`/api/blogs?${query}`);
    return response.json();
  }

  async optimizeProducts(productIds, settings = {}) {
    const response = await this.fetch('/api/optimize/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds, settings })
    });
    return response.json();
  }

  async optimizeBlogs(blogIds, settings = {}) {
    const response = await this.fetch('/api/optimize/blogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blogIds, settings })
    });
    return response.json();
  }

  async previewOptimization(type, id, settings = {}) {
    const response = await this.fetch('/api/optimize/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, settings })
    });
    return response.json();
  }

  async rollback(type, id, version = 'original') {
    const response = await this.fetch(`/api/rollback/${type}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version })
    });
    return response.json();
  }

  async getHistory(shop) {
    const response = await this.fetch(`/api/history/${shop}`);
    return response.json();
  }

  async getUsage() {
    const response = await this.fetch('/api/usage');
    return response.json();
  }

  async getStatus() {
    const response = await this.fetch('/api/status');
    return response.json();
  }
}

export function useShopifyAPI() {
  const authenticatedFetch = useAuthenticatedFetch();
  return new ShopifyAPI(authenticatedFetch);
}