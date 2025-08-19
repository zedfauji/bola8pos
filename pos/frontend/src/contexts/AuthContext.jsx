import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi, refreshTokenApi } from '../services/authService';

/**
 * @typedef {Object} AuthContextValue
 * @property {AuthUser|null} user
 * @property {boolean} loading
 * @property {string|null} error
 * @property {(email: string, password: string) => Promise<AuthUser>} login
 * @property {() => void} logout
 * @property {() => Promise<string>} refreshToken
 * @property {() => boolean} isAuthenticated
 * @property {(permission: string) => boolean} hasPermission
 */

/**
 * @typedef {Object} AuthUser
 * @property {string} [id]
 * @property {string} [email]
 * @property {string} [role]
 * @property {Record<string, string[]>} [permissions]
 */

// Create a typed context initialized to null
const AuthContext = /** @type {import('react').Context<AuthContextValue|null>} */(
  createContext(/** @type {AuthContextValue|null} */ (null))
);

/** @param {{children: React.ReactNode}} props */
export const AuthProvider = ({ children }) => {
  /** @type {[AuthUser|null, React.Dispatch<React.SetStateAction<AuthUser|null>>]} */
  const [user, setUser] = useState(/** @type {AuthUser|null} */(null));
  const [loading, setLoading] = useState(true);
  /** @type {[string|null, React.Dispatch<React.SetStateAction<string|null>>]} */
  const [error, setError] = useState(/** @type {string|null} */(null));
  const navigate = useNavigate();

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userData = localStorage.getItem('user');
        
        if (token && userData) {
          setUser(JSON.parse(userData));
          // Set up token refresh
          setupTokenRefresh();
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Setup token refresh interval
  const setupTokenRefresh = useCallback(() => {
    const refreshInterval = setInterval(() => {
      refreshToken().catch(() => {
        console.log('Token refresh failed, logging out...');
        logout();
      });
    }, 14 * 60 * 1000); // Refresh token every 14 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  /** @param {string} email @param {string} password */
  const login = async (email, password) => {
    try {
      setError(null);
      const response = await loginApi({ email, password });
      
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      setUser(response.user);
      setupTokenRefresh();
      
      return response.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  };

  const refreshToken = async () => {
    try {
      // Use cookie-based refresh; no localStorage dependency
      const response = await refreshTokenApi();
      localStorage.setItem('accessToken', response.accessToken);
      if (response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
      }
      return response.accessToken;
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const isAuthenticated = () => {
    return !!user;
  };

  /** @param {string} permission */
  const hasPermission = (permission) => {
    if (!user) return false;
    // Admin-like roles have full access
    if (typeof user.role === 'string' && /admin/i.test(user.role)) return true;

    if (!user.permissions) return false;
    // Check if user has the specific permission
    // Format: 'resource:action' (e.g., 'users:create', 'orders:read')
    const [resource, action] = permission.split(':');

    // Normalize common synonyms (view -> read)
    const actionNorm = action === 'view' ? 'read' : action;

    return (
      user.permissions[resource] &&
      Array.isArray(user.permissions[resource]) &&
      user.permissions[resource].includes(actionNorm)
    );
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    refreshToken,
    isAuthenticated,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

/** @returns {AuthContextValue} */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
