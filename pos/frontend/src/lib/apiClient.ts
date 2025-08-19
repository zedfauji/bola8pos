import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { handleApiError } from '../utils/apiErrorHandler';

// Get base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Circuit breaker state
interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailure: number | null;
}

// Track circuit breaker state per endpoint
const circuitBreakers: Record<string, CircuitBreakerState> = {};

// Toast deduplication
const toastMessages = new Map<string, number>();
const TOAST_DEDUPE_INTERVAL = 10000; // 10 seconds

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    // Add Authorization header if token exists
    const token = localStorage.getItem('accessToken');
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    // Check circuit breaker before making request
    const endpoint = config.url || 'unknown';
    const circuitBreaker = circuitBreakers[endpoint];
    
    if (circuitBreaker && circuitBreaker.isOpen) {
      const now = Date.now();
      const retryAfter = (circuitBreaker.lastFailure || 0) + 30000; // 30s cooldown
      
      if (now < retryAfter) {
        // Circuit is open, reject the request
        const error = new Error(`Service unavailable: ${endpoint}. Circuit breaker open.`);
        return Promise.reject(error);
      } else {
        // Reset circuit after cooldown period
        circuitBreaker.isOpen = false;
        circuitBreaker.failureCount = 0;
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors and circuit breaking
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const endpoint = originalRequest.url || 'unknown';
    const status = error.response?.status;
    
    // Handle 401 Unauthorized error (token expired)
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          // Call refresh token API directly to avoid circular dependency
          const response = await axios.post(`${API_BASE_URL}/access/auth/refresh`, { refreshToken });
          
          if (response.data && response.data.accessToken) {
            localStorage.setItem('accessToken', response.data.accessToken);
            
            // Update the authorization header
            if (originalRequest.headers) {
              if (typeof originalRequest.headers.set === 'function') {
                originalRequest.headers.set('Authorization', `Bearer ${response.data.accessToken}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
              }
            }
            
            // Retry the original request
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // If refresh fails, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    
    // Handle server errors (5xx) with exponential backoff retry
    if (status && status >= 500 && status < 600 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Implement exponential backoff
      const retryCount = originalRequest._retryCount || 0;
      if (retryCount < 3) { // Max 3 retries
        originalRequest._retryCount = retryCount + 1;
        
        // Calculate delay with exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, retryCount) * 1000;
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return apiClient(originalRequest);
      }
    }
    
    // Circuit breaker logic
    if (status && status >= 500) {
      // Get or initialize circuit breaker for this endpoint
      if (!circuitBreakers[endpoint]) {
        circuitBreakers[endpoint] = {
          isOpen: false,
          failureCount: 0,
          lastFailure: null
        };
      }
      
      const circuitBreaker = circuitBreakers[endpoint];
      circuitBreaker.failureCount += 1;
      circuitBreaker.lastFailure = Date.now();
      
      // Open circuit after 3 consecutive failures
      if (circuitBreaker.failureCount >= 3) {
        circuitBreaker.isOpen = true;
        console.warn(`Circuit breaker opened for endpoint: ${endpoint}`);
        
        // Here you could dispatch an action to show a UI banner
        // or use a toast notification system
      }
    } else {
      // Reset failure count on non-server errors
      if (circuitBreakers[endpoint]) {
        circuitBreakers[endpoint].failureCount = 0;
      }
    }
    
    // Handle API error with rate limiting to prevent console flooding
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    const errorKey = `${endpoint}:${errorMessage}`;
    const now = Date.now();
    const lastToast = toastMessages.get(errorKey) || 0;
    
    // Only show toast if we haven't shown this error recently
    if (now - lastToast > TOAST_DEDUPE_INTERVAL) {
      toastMessages.set(errorKey, now);
      
      // Log with reduced verbosity using our error handler
      handleApiError(error, endpoint, {
        logInterval: TOAST_DEDUPE_INTERVAL,
        onError: (err) => {
          // Here you could dispatch an action to show a toast
          // or use a toast notification system
          console.warn(`API Error (${endpoint}): ${errorMessage}`);
        }
      });
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
