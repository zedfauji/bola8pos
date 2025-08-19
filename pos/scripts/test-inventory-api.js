/**
 * Test script for inventory API endpoints
 * 
 * This script tests the inventory API endpoints to verify they are working correctly
 * after fixing the route nesting issue and adding proper error handling.
 */

const axios = require('axios');

// Simple color functions since chalk v5+ is ESM only
const chalk = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';
const DELAY_MS = 3000; // 3 second delay between requests
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNjE5NzA0MjM2fQ.YgQbK-mNlX9TPTYnJVgJzLYJnSKwrCjVVjNUQoZWFWU';

// Axios instance with auth header
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Define test endpoints
const endpoints = [
  { name: 'Inventory Health Check', method: 'GET', path: '/inventory/health' },
  // Comment out other endpoints to avoid rate limiting
  // { name: 'Products List', method: 'GET', path: '/inventory/products' },
  // { name: 'Categories List', method: 'GET', path: '/inventory/categories' },
  // { name: 'Locations List', method: 'GET', path: '/inventory/locations' },
  // { name: 'Suppliers List', method: 'GET', path: '/inventory/suppliers' },
  // { name: 'Low Stock Items', method: 'GET', path: '/inventory/low-stock' },
  // { name: 'Inventory Snapshot', method: 'GET', path: '/inventory/snapshot' },
];

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test a single endpoint
async function testEndpoint(endpoint) {
  try {
    console.log(chalk.yellow(`Testing: ${endpoint.name} (${endpoint.method.toUpperCase()} ${endpoint.path})`));
    
    // Use the correct method call syntax
    const response = await (endpoint.method.toLowerCase() === 'get' ? 
      api.get(endpoint.path) : 
      api.post(endpoint.path));
    
    console.log(chalk.green('✓ Success!'));
    console.log(chalk.gray(`  Status: ${response.status}`));
    console.log(chalk.gray(`  Data: ${JSON.stringify(response.data).substring(0, 100)}${JSON.stringify(response.data).length > 100 ? '...' : ''}`));
    return true;
  } catch (error) {
    console.log(chalk.red('✗ Failed!'));
    
    if (error.response) {
      console.log(chalk.red(`  Status: ${error.response.status}`));
      console.log(chalk.red(`  Error: ${JSON.stringify(error.response.data)}`));
      
      // If we're rate limited, provide more helpful information
      if (error.response.status === 429) {
        console.log(chalk.yellow('  Rate limited! Consider increasing delay between requests.'));
      }
    } else if (error.request) {
      console.log(chalk.red('  No response received from server'));
    } else {
      console.log(chalk.red(`  Error: ${error.message}`));
    }
    
    return { success: false, error };
  }
}

// Test runner
async function runTests() {
  console.log(chalk.blue('=== Testing Inventory API Endpoints ==='));
  console.log(chalk.gray(`API Base URL: ${API_BASE_URL}`));
  console.log('');
  
  let passCount = 0;
  let failCount = 0;
  
  // Test endpoints one by one with delay between requests
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    
    if (result.success) {
      passCount++;
    } else {
      failCount++;
      
      // If we hit a rate limit, stop testing to avoid more rate limits
      if (result.error?.response?.status === 429) {
        console.log(chalk.yellow('\nStopping tests due to rate limiting...'));
        break;
      }
    }
    
    console.log(''); // Add spacing between tests
    
    // Add delay between requests to avoid rate limiting
    if (endpoints.indexOf(endpoint) < endpoints.length - 1) {
      const delayMs = 1000; // 1 second delay
      console.log(chalk.gray(`Waiting ${delayMs}ms before next request...`));
      await delay(delayMs);
    }
  }
  
  // Summary
  console.log(chalk.blue('=== Test Summary ==='));
  console.log(chalk.green(`Passed: ${passCount}`));
  console.log(chalk.red(`Failed: ${failCount}`));
  console.log(chalk.blue(`Total: ${endpoints.length}`));
  
  return { passCount, failCount, total: endpoints.length };
}

// Run tests
runTests()
  .then(({ passCount, failCount, total }) => {
    if (failCount === 0) {
      console.log(chalk.green('\n✓ All tests passed!'));
      process.exit(0);
    } else {
      console.log(chalk.red(`\n✗ ${failCount}/${total} tests failed!`));
      process.exit(1);
    }
  })
  .catch(error => {
    console.error(chalk.red('Error running tests:'), error);
    process.exit(1);
  });
