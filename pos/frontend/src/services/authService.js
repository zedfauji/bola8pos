import axios from 'axios';

// Use a consistent API URL for all requests
const apiRoot = 'http://localhost:3001';
console.log('Using API root:', apiRoot);

const api = axios.create({
  baseURL: `${apiRoot}/api/access/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token to requests
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

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  /** @param {unknown} error */
  async (error) => {
    const err = /** @type {any} */ (error);
    const originalRequest = err.config;

    // Do not attempt to refresh for the refresh endpoint itself or if no response
    const reqUrl = originalRequest?.url || '';
    const isRefreshCall = reqUrl.includes('/refresh-token');
    const isLoginCall = reqUrl.includes('/login');
    if (!err.response || isRefreshCall || isLoginCall) {
      return Promise.reject(err);
    }

    // If error is 401 and we haven't tried to refresh yet
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Refresh using HTTP-only cookie; no body needed
        const response = await refreshTokenApi();
        const { accessToken } = response;
        
        // Update the stored token
        localStorage.setItem('accessToken', accessToken);
        
        // Update the authorization header
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers["Authorization"] = `Bearer ${accessToken}`;
        
        // Retry the original request
        return api(originalRequest);
      } catch (error) {
        console.error('Token refresh failed:', error);
        // Clear auth data and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(err);
  }
);

// API functions
/** @param {{email: string, password: string}} credentials */
export const login = async (credentials) => {
  try {
    const response = await api.post('/login', credentials);
    const data = response.data || {};
    // Normalize to { user, accessToken, expiresIn }
    return {
      user: data.user,
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    const err = /** @type {any} */ (error);
    throw new Error(err?.response?.data?.message || 'Login failed');
  }
};

export const refreshTokenApi = async () => {
  try {
    // Backend reads refresh token from cookie; send empty body
    const response = await api.post('/refresh-token');
    const data = response.data || {};
    // Normalize to { accessToken, user, expiresIn }
    return {
      accessToken: data.accessToken,
      user: data.user,
      expiresIn: data.expiresIn,
    };
  } catch (error) {
    const err = /** @type {any} */ (error);
    throw new Error(err?.response?.data?.message || 'Failed to refresh token');
  }
};

export const logout = async () => {
  try {
    await api.post('/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear local storage regardless of API call success
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/me');
    return response.data;
  } catch (error) {
    const err = /** @type {any} */ (error);
    throw new Error(err?.response?.data?.message || 'Failed to fetch user');
  }
};

export default {
  login,
  refreshToken: refreshTokenApi,
  logout,
  getCurrentUser,
};
