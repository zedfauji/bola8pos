const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login with admin@billiardpos.com / password');
    const response = await axios.post('http://localhost:3001/api/access/auth/login', {
      email: 'admin@billiardpos.com',
      password: 'password'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Login successful!');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    // Save the access token for future use
    const accessToken = response.data.accessToken;
    console.log('Access token:', accessToken);
    
    // Test a protected endpoint
    console.log('\nTesting protected endpoint with access token...');
    const protectedResponse = await axios.get('http://localhost:3001/api/access/auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    console.log('Protected endpoint access successful!');
    console.log('Status:', protectedResponse.status);
    console.log('Response data:', JSON.stringify(protectedResponse.data, null, 2));
    
  } catch (error) {
    console.error('Login failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();
