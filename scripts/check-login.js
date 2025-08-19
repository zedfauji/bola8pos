const axios = require('axios').default;
const https = require('https');

// Create an axios instance that doesn't reject on bad status codes
const api = axios.create({
  baseURL: 'https://localhost:3001/api',
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false // Ignore self-signed certs for local dev
  })
});

async function testLogin() {
  try {
    // 1. Test health endpoint
    console.log('Testing health endpoint...');
    const healthRes = await api.get('/health');
    console.log('Health check response:', healthRes.data);

    // 2. Test login
    console.log('\nTesting login...');
    const loginRes = await api.post('/auth/login', {
      email: 'admin@billiardpos.com',
      password: 'password'
    });
    
    console.log('Login response status:', loginRes.status);
    console.log('Login response data:', loginRes.data);
    
    // 3. Test protected endpoint with token
    if (loginRes.data.token) {
      console.log('\nTesting protected endpoint...');
      const protectedRes = await api.get('/tables', {
        headers: {
          'Authorization': `Bearer ${loginRes.data.token}`
        }
      });
      console.log('Protected endpoint response:', protectedRes.status);
    }
    
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response data:', error.response.data);
      console.error('Error status:', error.response.status);
      console.error('Error headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
  }
}

testLogin();
