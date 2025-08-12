import axios from 'axios';

// Resolve API base URL: prefer Vite env, then window override, then localhost:3001
let API_BASE_URL = 'http://localhost:3001';
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    API_BASE_URL = import.meta.env.VITE_API_URL;
  }
} catch {}
if (typeof window !== 'undefined' && window.__API_BASE_URL__) {
  API_BASE_URL = window.__API_BASE_URL__;
}
// Ensure trailing /api for axios base if not provided
if (!/\/api\/?$/.test(API_BASE_URL)) {
  API_BASE_URL = API_BASE_URL.replace(/\/$/, '') + '/api';
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Products API
export const productsApi = {
  getAll: (params = {}) => api.get('/inventory/products', { params }),
  getById: (id) => api.get(`/inventory/products/${id}`),
  create: (data) => api.post('/inventory/products', data),
  update: (id, data) => api.put(`/inventory/products/${id}`, data),
  delete: (id) => api.delete(`/inventory/products/${id}`),
  getInventory: (productId) => api.get(`/inventory/products/${productId}/inventory`),
  
  // Variants
  addVariant: (productId, data) => api.post(`/inventory/products/${productId}/variants`, data),
  updateVariant: (variantId, data) => api.put(`/inventory/variants/${variantId}`, data),
  deleteVariant: (variantId) => api.delete(`/inventory/variants/${variantId}`),
};

// Inventory API
export const inventoryApi = {
  getByLocation: (locationId, params = {}) => 
    api.get(`/inventory/inventory/location/${locationId}`, { params }),
  getByProduct: (productId, params = {}) => 
    api.get(`/inventory/inventory/product/${productId}`, { params }),
  adjust: (data) => api.post('/inventory/inventory/adjust', data),
  transfer: (data) => api.post('/inventory/inventory/transfer', data),
  getHistory: (productId, params = {}) => 
    api.get(`/inventory/inventory/history/product/${productId}`, { params }),
  getLowStock: (threshold = 10) => 
    api.get('/inventory/inventory/low-stock', { params: { threshold } }),
  getSnapshot: (params = {}) => 
    api.get('/inventory/inventory/snapshot', { params }),
};

// Categories API
export const categoriesApi = {
  getAll: () => api.get('/inventory/categories'),
  getTree: () => api.get('/inventory/categories/tree'),
  getById: (id) => api.get(`/inventory/categories/${id}`),
  create: (data) => api.post('/inventory/categories', data),
  update: (id, data) => api.put(`/inventory/categories/${id}`, data),
  delete: (id) => api.delete(`/inventory/categories/${id}`),
  getProducts: (categoryId, params = {}) => 
    api.get(`/inventory/categories/${categoryId}/products`, { params }),
};

// Locations API
export const locationsApi = {
  getAll: (params = {}) => api.get('/inventory/locations', { params }),
  getById: (id) => api.get(`/inventory/locations/${id}`),
  create: (data) => api.post('/inventory/locations', data),
  update: (id, data) => api.put(`/inventory/locations/${id}`, data),
  delete: (id) => api.delete(`/inventory/locations/${id}`),
  getInventory: (locationId, params = {}) => 
    api.get(`/inventory/locations/${locationId}/inventory`, { params }),
  getTypes: () => api.get('/inventory/locations/types'),
};

// Suppliers API
export const suppliersApi = {
  getAll: (params = {}) => api.get('/inventory/suppliers', { params }),
  getById: (id) => api.get(`/inventory/suppliers/${id}`),
  create: (data) => api.post('/inventory/suppliers', data),
  update: (id, data) => api.put(`/inventory/suppliers/${id}`, data),
  delete: (id) => api.delete(`/inventory/suppliers/${id}`),
  getPurchaseOrders: (supplierId, params = {}) => 
    api.get(`/inventory/suppliers/${supplierId}/purchase-orders`, { params }),
  getStats: (supplierId) => 
    api.get(`/inventory/suppliers/${supplierId}/stats`),
  search: (query) => 
    api.get(`/inventory/suppliers/search/${encodeURIComponent(query)}`),
};

// Purchase Orders API
export const purchaseOrdersApi = {
  getAll: (params = {}) => api.get('/inventory/purchase-orders', { params }),
  getById: (id) => api.get(`/inventory/purchase-orders/${id}`),
  create: (data) => api.post('/inventory/purchase-orders', data),
  updateStatus: (id, status) => 
    api.put(`/inventory/purchase-orders/${id}/status`, { status }),
  receiveItems: (id, data) => 
    api.post(`/inventory/purchase-orders/${id}/receive`, data),
  getHistory: (id) => 
    api.get(`/inventory/purchase-orders/${id}/history`),
  getBySupplier: (supplierId, params = {}) => 
    api.get(`/inventory/purchase-orders/supplier/${supplierId}`, { params }),
};

export default {
  products: productsApi,
  inventory: inventoryApi,
  categories: categoriesApi,
  locations: locationsApi,
  suppliers: suppliersApi,
  purchaseOrders: purchaseOrdersApi,
};
