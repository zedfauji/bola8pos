import axios from 'axios';
import { createSafeApiCall } from '../utils/apiErrorHandler';

/** @typedef {Window & { __API_BASE_URL__?: string }} WindowWithApiBase */

// Resolve API base URL: prefer Vite env, then window override, then localhost:3001
let API_BASE_URL = 'http://localhost:3001';
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    API_BASE_URL = import.meta.env.VITE_API_URL;
  }
} catch {}
if (typeof window !== 'undefined') {
  const w = /** @type {WindowWithApiBase} */ (window);
  if (w.__API_BASE_URL__) {
    API_BASE_URL = w.__API_BASE_URL__;
  }
}
// Normalize: strip trailing '/api' if present; endpoints already include '/api'
API_BASE_URL = String(API_BASE_URL || '').replace(/\/?api\/?$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  /** @param {import('axios').InternalAxiosRequestConfig} config */
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      if (config.headers) {
        config.headers["Authorization"] = `Bearer ${token}`;
      } else {
        config.headers = /** @type {import('axios').AxiosRequestHeaders} */ ({
          Authorization: `Bearer ${token}`,
        });
      }
    }
    return config;
  },
  /** @param {unknown} error */
  (error) => {
    return Promise.reject(error);
  }
);

// Error handling options - only log once per minute
const errorOptions = {
  silent: false,
  logInterval: 60000
};

// Products API
export const productsApi = {
  /** @param {Record<string, any>} [params] */
  getAll: createSafeApiCall(
    (params = {}) => api.get('/api/inventory/products', { params }),
    'products.getAll',
    errorOptions
  ),
  /** @param {string|number} id */
  getById: (id) => api.get(`/api/inventory/products/${id}`),
  /** @param {any} data */
  create: (data) => api.post('/api/inventory/products', data),
  /** @param {string|number} id @param {any} data */
  update: (id, data) => api.put(`/api/inventory/products/${id}`, data),
  /** @param {string|number} id */
  delete: (id) => api.delete(`/api/inventory/products/${id}`),
  /** @param {string|number} productId */
  getInventory: (productId) => api.get(`/api/inventory/products/${productId}/inventory`),
  
  // Variants
  /** @param {string|number} productId @param {any} data */
  addVariant: (productId, data) => api.post(`/api/inventory/products/${productId}/variants`, data),
  /** @param {string|number} variantId @param {any} data */
  updateVariant: (variantId, data) => api.put(`/api/inventory/variants/${variantId}`, data),
  /** @param {string|number} variantId */
  deleteVariant: (variantId) => api.delete(`/api/inventory/variants/${variantId}`),
};

// Inventory API
export const inventoryApi = {
  /** @param {string|number} locationId @param {Record<string, any>} [params] */
  getByLocation: (locationId, params = {}) => 
    api.get(`/api/inventory/location/${locationId}`, { params }),
  /** @param {string|number} productId @param {Record<string, any>} [params] */
  getByProduct: (productId, params = {}) => 
    api.get(`/api/inventory/product/${productId}`, { params }),
  /** @param {any} data */
  adjust: (data) => api.post('/api/inventory/adjust', data),
  /** @param {any} data */
  transfer: (data) => api.post('/api/inventory/transfer', data),
  /** @param {string|number} productId @param {Record<string, any>} [params] */
  getHistory: (productId, params = {}) => 
    api.get(`/api/inventory/history/product/${productId}`, { params }),
  /** @param {number} [threshold] */
  getLowStock: (threshold = 10) => 
    api.get('/api/inventory/low-stock', { params: { threshold } }),
  /** @param {Record<string, any>} [params] */
  getSnapshot: (params = {}) => 
    api.get('/api/inventory/snapshot', { params }),
  
  // Stock Count API
  /** @param {Record<string, any>} [params] Get all stock counts */
  getStockCounts: (params = {}) => 
    api.get('/api/inventory/stock-counts', { params }),
  /** @param {string|number} id Get stock count by ID */
  getStockCountById: (id) => 
    api.get(`/api/inventory/stock-counts/${id}`),
  /** @param {any} data Create a new stock count */
  createStockCount: (data) => 
    api.post('/api/inventory/stock-counts', data),
  /** @param {string|number} id @param {any} data Update a stock count */
  updateStockCount: (id, data) => 
    api.put(`/api/inventory/stock-counts/${id}`, data),
  /** @param {string|number} id @param {any} data Save stock count items */
  saveStockCountItems: (id, data) => 
    api.post(`/api/inventory/stock-counts/${id}/items`, data),
  /** @param {string|number} id Complete a stock count */
  completeStockCount: (id) => 
    api.put(`/api/inventory/stock-counts/${id}/complete`),
  /** @param {string|number} id Cancel a stock count */
  cancelStockCount: (id) => 
    api.put(`/api/inventory/stock-counts/${id}/cancel`),
  /** @param {Record<string, any>} [params] Get stock count history */
  getStockCountHistory: (params = {}) => 
    api.get('/api/inventory/stock-counts/history', { params }),
};

// Categories API
export const categoriesApi = {
  getAll: createSafeApiCall(
    () => api.get('/api/inventory/categories'),
    'categories.getAll',
    errorOptions
  ),
  getTree: createSafeApiCall(
    () => api.get('/api/inventory/categories/tree'),
    'categories.getTree',
    errorOptions
  ),
  /** @param {string|number} id */
  getById: (id) => api.get(`/api/inventory/categories/${id}`),
  /** @param {any} data */
  create: (data) => api.post('/api/inventory/categories', data),
  /** @param {string|number} id @param {any} data */
  update: (id, data) => api.put(`/api/inventory/categories/${id}`, data),
  /** @param {string|number} id */
  delete: (id) => api.delete(`/api/inventory/categories/${id}`),
  /** @param {string|number} categoryId @param {Record<string, any>} [params] */
  getProducts: (categoryId, params = {}) => 
    api.get(`/api/inventory/categories/${categoryId}/products`, { params }),
};

// Locations API
export const locationsApi = {
  /** @param {Record<string, any>} [params] */
  getAll: createSafeApiCall(
    (params = {}) => api.get('/api/inventory/locations', { params }),
    'locations.getAll',
    errorOptions
  ),
  /** @param {string|number} id */
  getById: (id) => api.get(`/api/inventory/locations/${id}`),
  /** @param {any} data */
  create: (data) => api.post('/api/inventory/locations', data),
  /** @param {string|number} id @param {any} data */
  update: (id, data) => api.put(`/api/inventory/locations/${id}`, data),
  /** @param {string|number} id */
  delete: (id) => api.delete(`/api/inventory/locations/${id}`),
  /** @param {string|number} locationId @param {Record<string, any>} [params] */
  getInventory: (locationId, params = {}) => 
    api.get(`/api/inventory/locations/${locationId}/inventory`, { params }),
  getTypes: () => api.get('/api/inventory/locations/types'),
};

// Suppliers API
export const suppliersApi = {
  /** @param {Record<string, any>} [params] */
  getAll: createSafeApiCall(
    (params = {}) => api.get('/api/inventory/suppliers', { params }),
    'suppliers.getAll',
    errorOptions
  ),
  /** @param {string|number} id */
  getById: (id) => api.get(`/api/inventory/suppliers/${id}`),
  /** @param {any} data */
  create: (data) => api.post('/api/inventory/suppliers', data),
  /** @param {string|number} id @param {any} data */
  update: (id, data) => api.put(`/api/inventory/suppliers/${id}`, data),
  /** @param {string|number} id */
  delete: (id) => api.delete(`/api/inventory/suppliers/${id}`),
  /** @param {string|number} supplierId @param {Record<string, any>} [params] */
  getPurchaseOrders: (supplierId, params = {}) => 
    api.get(`/api/inventory/suppliers/${supplierId}/purchase-orders`, { params }),
  /** @param {string|number} supplierId */
  getStats: (supplierId) => 
    api.get(`/api/inventory/suppliers/${supplierId}/stats`),
  /** @param {string} query */
  search: (query) => 
    api.get(`/api/inventory/suppliers/search/${encodeURIComponent(query)}`),
};

// Purchase Orders API
export const purchaseOrdersApi = {
  /** @param {Record<string, any>} [params] */
  getAll: createSafeApiCall(
    (params = {}) => api.get('/api/inventory/purchase-orders', { params }),
    'purchaseOrders.getAll',
    errorOptions
  ),
  /** @param {string|number} id */
  getById: (id) => api.get(`/api/inventory/purchase-orders/${id}`),
  /** @param {any} data */
  create: (data) => api.post('/api/inventory/purchase-orders', data),
  /** @param {string|number} id @param {string} status */
  updateStatus: (id, status) => 
    api.put(`/api/inventory/purchase-orders/${id}/status`, { status }),
  /** @param {string|number} id @param {any} data */
  receiveItems: (id, data) => 
    api.post(`/api/inventory/purchase-orders/${id}/receive`, data),
  /** @param {string|number} id */
  getHistory: (id) => 
    api.get(`/api/inventory/purchase-orders/${id}/history`),
  /** @param {string|number} supplierId @param {Record<string, any>} [params] */
  getBySupplier: (supplierId, params = {}) => 
    api.get(`/api/inventory/purchase-orders/supplier/${supplierId}`, { params }),
};

// Backup API
export const backupApi = {
  /** @param {Record<string, any>} [params] */
  listBackups: createSafeApiCall(
    (params = {}) => api.get('/api/inventory/backup', { params }),
    'backup.listBackups',
    errorOptions
  ),
  /** @param {string} filename */
  getBackupDetails: (filename) => api.get(`/api/inventory/backup/${encodeURIComponent(filename)}`),
  /** @param {any} data Create a new backup */
  createBackup: (data) => api.post('/api/inventory/backup', data),
  /** @param {string} filename @param {any} data Restore from a backup */
  restoreBackup: (filename, data) => api.post(`/api/inventory/backup/${encodeURIComponent(filename)}/restore`, data),
  /** @param {string} filename Delete a backup */
  deleteBackup: (filename) => api.delete(`/api/inventory/backup/${encodeURIComponent(filename)}`),
};

export default {
  products: productsApi,
  inventory: inventoryApi,
  categories: categoriesApi,
  locations: locationsApi,
  suppliers: suppliersApi,
  purchaseOrders: purchaseOrdersApi,
  backup: backupApi,
};
