const axios = require('axios');

// Configure API base URL
const API_BASE_URL = 'http://localhost:3001';

// Function to test the low-stock endpoint
async function testLowStockEndpoint() {
  try {
    console.log('Testing low-stock endpoint...');
    
    // Get an auth token first
    const loginResponse = await axios.post(`${API_BASE_URL}/api/access/auth/login`, {
      email: 'admin@billiardpos.com',
      password: 'Admin123'
    });
    
    console.log('Login response:', loginResponse.data);
    const token = loginResponse.data.token || loginResponse.data.accessToken;
    
    if (!token) {
      console.error('Failed to get authentication token');
      return;
    }
    
    console.log('Successfully authenticated');
    
    // Test the low-stock endpoint
    const lowStockResponse = await axios.get(`${API_BASE_URL}/api/inventory/low-stock`, {
      params: { threshold: 10 },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Low-stock API response status:', lowStockResponse.status);
    console.log('Low-stock items count:', lowStockResponse.data.length);
    console.log('Sample low-stock items:', lowStockResponse.data.slice(0, 3));
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing low-stock endpoint:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Run the test
testLowStockEndpoint();
