const axios = require('axios');

async function testPurchaseOrders() {
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
    
    // Test purchase orders endpoint
    console.log('Testing purchase orders endpoint...');
    const purchaseOrdersResponse = await axios.get('http://localhost:3001/api/inventory/purchase-orders', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('Purchase orders endpoint response status:', purchaseOrdersResponse.status);
    console.log('Response data:', JSON.stringify(purchaseOrdersResponse.data, null, 2));
    
    return 'Test completed successfully';
  } catch (error) {
    console.error('Error testing purchase orders endpoint:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return 'Test failed';
  }
}

testPurchaseOrders()
  .then(console.log)
  .catch(console.error);
