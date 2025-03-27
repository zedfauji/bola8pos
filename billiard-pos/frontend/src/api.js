import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 5000,
});

// Add response interceptor
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.config.url, error.response?.status);
    return Promise.reject(error);
  }
);

export default api;
