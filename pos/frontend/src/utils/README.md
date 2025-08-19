# API Error Handling Utilities

This directory contains utilities for handling API errors gracefully in the frontend application.

## Overview

The `apiErrorHandler.ts` module provides utilities to:

1. Handle API errors with rate limiting to prevent console flooding
2. Create safe API calls that catch errors and return fallback values
3. Check if API endpoints are available before attempting to use them

## Usage

### Basic Error Handling

```javascript
import { handleApiError } from '../utils/apiErrorHandler';

try {
  await someApiCall();
} catch (error) {
  handleApiError(error, 'endpoint-name');
}
```

### Creating Safe API Calls

```javascript
import { createSafeApiCall } from '../utils/apiErrorHandler';

const safeApiCall = createSafeApiCall(
  (params) => api.get('/api/endpoint', { params }),
  'endpoint-name',
  { silent: false, logInterval: 10000 },
  { data: [] } // fallback value
);

// Use the safe API call
const response = await safeApiCall({ page: 1, limit: 10 });
```

### Checking API Availability

```javascript
import { isApiEndpointAvailable } from '../utils/apiErrorHandler';

const isAvailable = await isApiEndpointAvailable(
  (params) => api.get('/api/endpoint', { params })
);

if (isAvailable) {
  // Proceed with API calls
} else {
  // Handle unavailable API gracefully
}
```

## API Reference

### `handleApiError(error, endpoint, options)`

Handles API errors with rate limiting to prevent console flooding.

**Parameters:**
- `error: unknown` - The error object
- `endpoint: string` - The API endpoint that failed
- `options: object` - Additional options
  - `silent: boolean` - Whether to suppress logging (default: false)
  - `logInterval: number` - Minimum time in ms between logs of the same error (default: 10000)
  - `onError: function` - Optional callback for custom error handling

**Returns:** The original error for further handling

### `createSafeApiCall(apiCall, endpoint, options, fallbackValue)`

Creates a safe API call wrapper that handles errors gracefully.

**Parameters:**
- `apiCall: function` - The API call function to wrap
- `endpoint: string` - The API endpoint description
- `options: object` - Error handling options (same as handleApiError)
- `fallbackValue: any` - Value to return on error (default: `{ data: [] }`)

**Returns:** A wrapped function that handles errors

### `isApiEndpointAvailable(apiCall, testParams)`

Checks if an API endpoint is available.

**Parameters:**
- `apiCall: function` - API function to test
- `testParams: any` - Parameters to pass to the API call

**Returns:** `Promise<boolean>` - Whether the endpoint is available

## Implementation in Hooks

The error handling utilities are used in React hooks to:

1. Check API availability before making calls
2. Skip API calls if endpoints are unavailable
3. Return fallback values on errors
4. Prevent console flooding from repeated error logs

Example from `useInventory.ts`:

```javascript
// Check if API endpoint is available
useEffect(() => {
  const checkApiAvailability = async () => {
    const isAvailable = await isApiEndpointAvailable(inventoryService.productsApi.getAll);
    setApiAvailable(isAvailable);
    if (!isAvailable) setLoading(false);
  };
  checkApiAvailability();
}, []);

// Only make API calls if the endpoint is available
const fetchProducts = useCallback(async (params = {}) => {
  if (!apiAvailable) return;
  
  setLoading(true);
  try {
    const response = await inventoryService.productsApi.getAll(params);
    setProducts(response.data || []);
    setError(null);
  } catch (err) {
    setError(err as Error);
  } finally {
    setLoading(false);
  }
}, [apiAvailable]);
```
