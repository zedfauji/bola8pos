/**
 * API Error Handler Utility
 * Provides utilities to handle API errors gracefully and prevent console flooding
 */

// Store error occurrences to prevent repeated logging
const errorOccurrences = new Map();

// Track request counts to implement throttling
const requestCounts = new Map();
const MAX_REQUESTS_PER_ENDPOINT = 5; // Max requests per time window
const REQUEST_TIME_WINDOW = 5000; // Time window in ms (5 seconds)

/**
 * Check if we should throttle requests to an endpoint
 * @param {string} endpoint - The API endpoint
 * @returns {boolean} - Whether to throttle the request
 */
const shouldThrottleRequest = (endpoint) => {
  const now = Date.now();
  const key = endpoint.split('?')[0]; // Ignore query params for throttling
  
  // Initialize or clean up old entries
  if (!requestCounts.has(key)) {
    requestCounts.set(key, []);
  } else {
    // Remove timestamps older than the time window
    const timestamps = requestCounts.get(key);
    const recentTimestamps = timestamps.filter(time => (now - time) < REQUEST_TIME_WINDOW);
    requestCounts.set(key, recentTimestamps);
  }
  
  // Check if we've exceeded the rate limit
  const recentRequests = requestCounts.get(key);
  if (recentRequests.length >= MAX_REQUESTS_PER_ENDPOINT) {
    return true;
  }
  
  // Record this request
  recentRequests.push(now);
  requestCounts.set(key, recentRequests);
  return false;
};

/**
 * Handles API errors with rate limiting to prevent console flooding
 * @param {Error|unknown} error - The error object
 * @param {string} endpoint - The API endpoint that failed
 * @param {Object} options - Additional options
 * @param {boolean} [options.silent=false] - Whether to suppress console output
 * @param {number} [options.logInterval=10000] - Minimum time in ms between repeated error logs
 * @param {Function} [options.onError] - Optional callback for error handling
 * @returns {Error|unknown} The original error for further handling
 */
export const handleApiError = (error, endpoint, options = {}) => {
  const { 
    silent = false, 
    logInterval = 10000,
    onError = null
  } = options;
  
  // Create a unique key for this error + endpoint combination
  const errorKey = `${endpoint}:${error && typeof error === 'object' && 'message' in error ? error.message : 'unknown'}`;
  const now = Date.now();
  const lastOccurrence = errorOccurrences.get(errorKey) || 0;
  
  // Only log if we haven't seen this error recently
  if (!silent && (now - lastOccurrence > logInterval)) {
    // Update the last occurrence time
    errorOccurrences.set(errorKey, now);
    
    // Log the error with reduced verbosity
    console.warn(`API Error (${endpoint}): ${error && typeof error === 'object' && 'message' in error ? error.message : 'Unknown error'}`);
  }
  
  // Call the optional error handler if provided
  if (typeof onError === 'function') {
    onError(error, endpoint);
  }
  
  return error;
};

/**
 * Detects if an error is related to resource exhaustion
 * @param {Error|unknown} error - The error object
 * @returns {boolean} - Whether this is a resource error
 */
const isResourceError = (error) => {
  if (!error) return false;
  
  // Check for specific error messages or codes
  const errorStr = String(error);
  const message = error && typeof error === 'object' && 'message' in error ? 
    String(error.message).toLowerCase() : errorStr.toLowerCase();
  
  return (
    message.includes('err_insufficient_resources') ||
    message.includes('network error') ||
    message.includes('socket hang up') ||
    message.includes('timeout') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    (error && typeof error === 'object' && 'status' in error && 
      (error.status === 429 || error.status === 503))
  );
};

/**
 * Creates a safe API call wrapper that handles errors gracefully
 * @param {Function} apiCall - The API call function to wrap
 * @param {string} endpoint - The API endpoint description
 * @param {Object} options - Error handling options
 * @param {any} fallbackValue - Value to return on error
 * @returns {Function} Wrapped function that handles errors
 */
export const createSafeApiCall = (apiCall, endpoint, options = {}, fallbackValue = { data: [] }) => {
  /**
   * @param {...any} args - Arguments to pass to the API call
   * @returns {Promise<any>} - Promise resolving to API response or fallback value
   */
  return async (...args) => {
    // Check if we should throttle this request
    if (shouldThrottleRequest(endpoint)) {
      console.warn(`Request to ${endpoint} throttled to prevent resource exhaustion`);
      return fallbackValue;
    }
    
    try {
      return await apiCall(...args);
    } catch (error) {
      // If this is a resource error, increase the throttling for this endpoint
      if (isResourceError(error)) {
        // Double the effective throttle time for resource errors
        const now = Date.now();
        const key = endpoint.split('?')[0];
        const timestamps = requestCounts.get(key) || [];
        // Add extra "fake" timestamps to increase throttling
        for (let i = 0; i < 3; i++) {
          timestamps.push(now);
        }
        requestCounts.set(key, timestamps);
      }
      
      handleApiError(error, endpoint, options);
      return fallbackValue;
    }
  };
};

/**
 * Checks if an API endpoint is available
 * @param {Function} apiCall - API function to test
 * @param {Object} testParams - Parameters to pass to the API call
 * @returns {Promise<boolean>} Whether the endpoint is available
 */
export const isApiEndpointAvailable = async (apiCall, testParams = {}) => {
  try {
    await apiCall(testParams);
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  handleApiError,
  createSafeApiCall,
  isApiEndpointAvailable
};
