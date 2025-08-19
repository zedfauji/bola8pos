const axios = require('axios');

async function debugPurchaseOrders() {
  try {
    // First login to get access token
    console.log('Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/access/auth/login', {
      email: 'admin@billiardpos.com',
      password: 'password'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const accessToken = loginResponse.data.accessToken;
    console.log('Login successful, got access token');
    
    // Add a global error handler to see full error details
    axios.interceptors.response.use(
      response => response,
      error => {
        console.error('Axios error intercepted:');
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Data:', JSON.stringify(error.response.data, null, 2));
          console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
          console.error('Request was made but no response received');
          console.error(error.request);
        } else {
          console.error('Error setting up request:', error.message);
        }
        console.error('Error config:', JSON.stringify(error.config, null, 2));
        return Promise.reject(error);
      }
    );
    
    // Test purchase orders endpoint with explicit error handling
    console.log('Testing purchase orders endpoint...');
    try {
      const purchaseOrdersResponse = await axios.get('http://localhost:3001/api/inventory/purchase-orders', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      console.log('Purchase orders endpoint response status:', purchaseOrdersResponse.status);
      console.log('Response data:', JSON.stringify(purchaseOrdersResponse.data, null, 2));
    } catch (error) {
      console.error('Error in purchase orders request:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
    }
    
    return 'Debug completed';
  } catch (error) {
    console.error('Top level error:');
    console.error(error);
    return 'Debug failed';
  }
}

debugPurchaseOrders()
  .then(console.log)
  .catch(console.error);
