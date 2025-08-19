const https = require('https');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure axios to use the self-signed certificate
const agent = new https.Agent({
  rejectUnauthorized: false // Only for development with self-signed certs
});

const API_URL = 'https://localhost:3001/api';
const ACCESS_URL = 'https://localhost:3001/api/access';
const LOGIN_URL = `${ACCESS_URL}/auth/login`;

async function testLogin() {
  try {
    console.log('Testing login...');
    const email = process.env.ADMIN_EMAIL || 'admin@billiardpos.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@123';
    console.log(`Using credentials: ${email} / ********`);
    
    // 1. Attempt to login with admin credentials
    const loginResponse = await axios.post(LOGIN_URL, {
      email,
      password
    }, {
      httpsAgent: agent,
      headers: {
        'Content-Type': 'application/json'
      },
      maxRedirects: 0,
      validateStatus: status => status < 500 // Don't throw for 4xx errors
    });

    console.log('Login Response Status:', loginResponse.status);
    console.log('Login Response Data:', JSON.stringify(loginResponse.data, null, 2));

    if (loginResponse.status === 200) {
      const { accessToken, refreshToken } = loginResponse.data;
      console.log('✅ Login successful!');
      
      // 2. Test accessing a protected endpoint
      console.log('\nTesting protected endpoint...');
      try {
        const protectedResponse = await axios.get(`${ACCESS_URL}/auth/me`, {
          httpsAgent: agent,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Protected Endpoint Status:', protectedResponse.status);
        console.log('User Data:', JSON.stringify(protectedResponse.data, null, 2));
        console.log('✅ Successfully accessed protected endpoint!');
      } catch (error) {
        console.error('❌ Failed to access protected endpoint:', error.response?.data || error.message);
      }
      
      return true;
    } else {
      console.error('❌ Login failed:', loginResponse.data?.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Error during login test:');
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('❌ No response received. Network/SSL error or server unreachable.');
      console.error('Error code:', error.code);
      console.error('Message:', error.message);
    } else {
      console.error('❌ Error setting up request:', error.message);
    }
    if (error.stack) console.error(error.stack.split('\n').slice(0,3).join('\n'));
    return false;
  }
}

// Run the test
testLogin()
  .then(success => {
    console.log(success ? '\n✅ Login test completed successfully!' : '\n❌ Login test failed');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Unhandled error in login test:', error);
    process.exit(1);
  });
