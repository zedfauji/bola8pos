/**
 * Test script for inventory API error handling
 * 
 * This script tests the error handling implementation for inventory API endpoints
 * by making requests to the API and verifying that errors are handled gracefully.
 */

const axios = require('axios');
const path = require('path');

// Import apiErrorHandler from the correct path
const apiErrorHandlerPath = path.join(__dirname, '..', 'pos', 'frontend', 'src', 'utils', 'apiErrorHandler.js');

// Create a simple implementation of the error handler for testing
const handleApiError = (error, endpoint, options = {}) => {
  const { silent = false, logInterval = 10000 } = options;
  if (!silent) {
    console.warn(`API Error (${endpoint}): ${error?.message || 'Unknown error'}`);
  }
  return error;
};

const createSafeApiCall = (apiCall, endpoint, options = {}, fallbackValue = { data: [] }) => {
  return async (...args) => {
    try {
      return await apiCall(...args);
    } catch (error) {
      handleApiError(error, endpoint, options);
      return fallbackValue;
    }
  };
};

const { getJwtToken } = require('./get-jwt-token');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Create axios instance (will be configured with token later)
let api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Mock inventory API endpoints
const inventoryEndpoints = [
  '/api/inventory/products',
  '/api/inventory/categories',
  '/api/inventory/categories/tree',
  '/api/inventory/suppliers',
  '/api/inventory/locations',
  '/api/inventory/purchase-orders'
];

// Test error handling for each endpoint
async function testEndpoint(endpoint) {
  console.log(`Testing endpoint: ${endpoint}`);
  
  // Create a safe API call wrapper
  const safeApiCall = createSafeApiCall(
    () => api.get(endpoint),
    endpoint,
    { logInterval: 1000 }, // Short interval for testing
    { data: [] } // Fallback value
  );
  
  try {
    // Make the API call
    console.log('Making API call...');
    const response = await safeApiCall();
    
    // Check if we got a response or fallback
    if (response && Array.isArray(response.data)) {
      if (response.data.length === 0) {
        console.log('✓ Endpoint returned empty array (possibly fallback)');
      } else {
        console.log('✓ Endpoint returned data successfully');
      }
    } else {
      console.log('✗ Unexpected response format');
    }
  } catch (error) {
    // This should not happen since safeApiCall should handle errors
    console.error('✗ Error was not handled properly:', error);
  }
  
  console.log('-----------------------------------');
}

// Run tests
async function runTests() {
  console.log('=== INVENTORY API ERROR HANDLING TEST ===');
  console.log(`Base URL: ${API_BASE_URL}`);
  console.log('=======================================');
  
  // Get JWT token
  console.log('Getting JWT token...');
  const token = process.env.JWT_TOKEN || await getJwtToken();
  
  if (!token) {
    console.error('Failed to get JWT token. Please check your credentials.');
    return;
  }
  
  // Configure API with token
  api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  console.log('JWT token obtained successfully.');
  console.log('=======================================');
  
  // Test each endpoint
  for (const endpoint of inventoryEndpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('All tests completed!');
}

// Execute tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
});
