import axios from 'axios';

// Resolve API root and ensure it ends with /api
// Use a consistent API URL for all requests
const API_BASE_URL = 'http://localhost:3001';

// Normalize: strip trailing '/api' if present, since endpoints already include '/api'
// This is just a safety check, as our URL is already normalized
const API_ROOT = API_BASE_URL.replace(/\/$/, '');
const baseURL = /\/api\/?$/.test(API_ROOT) ? API_ROOT : `${API_ROOT}/api`;

console.log('API baseURL:', baseURL);

// Create axios instance with base URL and headers
const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Required for refresh-token cookie
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  /** @param {import('axios').InternalAxiosRequestConfig} config */
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      // Axios v1 may use AxiosHeaders; support both
      if (!config.headers) {
        // Use a permissive cast to satisfy TypeScript checkJS typing
        config.headers = /** @type {any} */ ({});
      }
      /** @type {any} */
      const headers = config.headers;
      if (typeof headers.set === 'function') {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('accessToken');
        } catch {}
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
