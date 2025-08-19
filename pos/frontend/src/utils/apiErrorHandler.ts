/**
 * API Error Handler Utility
 * Provides utilities to handle API errors gracefully and prevent console flooding
 */

// Store error occurrences to prevent repeated logging
const errorOccurrences = new Map<string, number>();

/**
 * Handles API errors with rate limiting to prevent console flooding
 * @param {Error|unknown} error - The error object
 * @param {string} endpoint - The API endpoint that failed
 * @param {Object} options - Additional options
 * @returns {Error|unknown} The original error for further handling
 */
export const handleApiError = (
  error: unknown, 
  endpoint: string, 
  options: {
    silent?: boolean;
    logInterval?: number;
    onError?: (error: unknown, endpoint: string) => void;
  } = {}
): unknown => {
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
 * Creates a safe API call wrapper that handles errors gracefully
 * @param apiCall - The API call function to wrap
 * @param endpoint - The API endpoint description
 * @param options - Error handling options
 * @param fallbackValue - Value to return on error
 * @returns Wrapped function that handles errors
 */
export const createSafeApiCall = <T, Args extends any[]>(
  apiCall: (...args: Args) => Promise<T>,
  endpoint: string,
  options: {
    silent?: boolean;
    logInterval?: number;
    onError?: (error: unknown, endpoint: string) => void;
  } = {},
  fallbackValue: T = { data: [] } as unknown as T
): ((...args: Args) => Promise<T>) => {
  return async (...args: Args): Promise<T> => {
    try {
      return await apiCall(...args);
    } catch (error) {
      handleApiError(error, endpoint, options);
      return fallbackValue;
    }
  };
};

/**
 * Checks if an API endpoint is available
 * @param apiCall - API function to test
 * @param testParams - Parameters to pass to the API call
 * @returns Whether the endpoint is available
 */
export const isApiEndpointAvailable = async <T, P>(
  apiCall: (params?: P) => Promise<T>,
  testParams?: P
): Promise<boolean> => {
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
