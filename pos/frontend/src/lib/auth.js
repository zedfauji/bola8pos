// Auth token key for localStorage
const TOKEN_KEY = 'auth_token';

/**
 * Get the authentication token from localStorage
 * @returns {string|null} The auth token or null if not found
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Set the authentication token in localStorage
 * @param {string} token - The JWT token to store
 */
export const setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

/**
 * Remove the authentication token from localStorage
 */
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if token exists and is not expired
 */
export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;
  
  // Check if token is expired (JWT format: header.payload.signature)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch (e) {
    return false;
  }
};

export default {
  getToken,
  setToken,
  removeToken,
  isAuthenticated
};
