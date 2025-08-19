const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env' });

// Create an axios instance that ignores SSL errors for self-signed certs
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false // For testing with self-signed certs only
  })
});

const BASE_URL = 'https://localhost:3001';

async function testLogin() {
  try {
    console.log('1. Attempting to login...');
    const loginResponse = await axiosInstance.post(
      `${BASE_URL}/api/access/auth/login`,
      {
        email: 'admin@billiardpos.com',
        password: 'Admin@123'  // This now matches the reset password
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true // Important for cookies
      }
    );

    console.log('✅ Login successful!');
    console.log('   Status:', loginResponse.status);
    console.log('   Response data:', JSON.stringify(loginResponse.data, null, 2));
    
    const accessToken = loginResponse.data.accessToken;
    console.log('\n2. Access token received');
    
    // Test the token with our test endpoint
    console.log('\n3. Testing token verification...');
    const testResponse = await axiosInstance.post(
      `${BASE_URL}/api/test/token`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      }
    );
    
    console.log('✅ Token verification successful!');
    console.log('   Status:', testResponse.status);
    console.log('   Response:', JSON.stringify(testResponse.data, null, 2));
    
    // Check if refresh token cookie was set
    const cookies = loginResponse.headers['set-cookie'];
    const hasRefreshToken = cookies && cookies.some(cookie => 
      cookie.includes('refreshToken=')
    );
    
    console.log('\n4. Refresh token cookie:', hasRefreshToken ? '✅ Found' : '❌ Missing');
    if (cookies) {
      console.log('   Cookies:', cookies);
    }
    
  } catch (error) {
    console.error('❌ Test failed:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
      console.error('   Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('   No response received');
      console.error('   Request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('   Error:', error.message);
    }
    
    console.error('   Config:', error.config);
  }
}

testLogin();
